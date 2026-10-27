import { detectAll } from "tinyld";
import { z } from "zod";

import { env } from "../../config/env";
import { AppError } from "../../shared/errors/AppError";

/**
 * A machine-translation backend. Chat code only talks to this interface, so switching provider
 * is one environment variable (TRANSLATION_PROVIDER), and cached translations record which
 * provider made them (`version`). The source language is always given: callers resolve it
 * (see sourceLanguage.ts) instead of trusting a provider's guess.
 */
export type TranslationProvider = {
  /** Stored with every cached translation; bump it when output would change. */
  version: string;
  /** Longest text one request may carry. */
  maxChars: number;
  translate(text: string, source: string, target: string): Promise<string>;
};

const REQUEST_TIMEOUT_MS = 8_000;

function unavailable(): AppError {
  return new AppError("Could not translate this message right now", 502, "INTERNAL_ERROR");
}

async function readJson(request: () => Promise<Response>): Promise<unknown> {
  let response: Response;
  try {
    response = await request();
  } catch {
    throw unavailable();
  }
  try {
    return await response.json();
  } catch {
    throw unavailable();
  }
}

const myMemoryResponseSchema = z.object({
  responseStatus: z.union([z.number(), z.string()]),
  responseData: z.object({ translatedText: z.string() }).optional(),
  matches: z
    .array(
      z.object({
        translation: z.string(),
        match: z.union([z.number(), z.string()]).optional(),
        quality: z.union([z.number(), z.string()]).optional(),
        "created-by": z.string().optional(),
        target: z.string().optional(),
      }),
    )
    .optional(),
});

/** Below this, a MyMemory entry is junk (e.g. "Ce faci azi?" → "Cattle", quality 0). */
const MY_MEMORY_MIN_QUALITY = 50;
/** A memory entry this similar is the same sentence translated by a person: trust it. */
const MY_MEMORY_EXACT_MATCH = 0.98;
/** Detector confidence above which a candidate is clearly in another language. */
const WRONG_LANGUAGE_CONFIDENCE = 0.9;

/**
 * Shared memories carry mislabelled entries (a French "Merci beaucoup!" stored as English).
 * Only a confident detection counts: short text such as "Hello" or "Hi," stays allowed.
 */
function clearlyNotIn(text: string, target: string): boolean {
  const [top] = detectAll(text);
  return Boolean(top && top.lang !== target && top.accuracy >= WRONG_LANGUAGE_CONFIDENCE);
}

/**
 * MyMemory returns several candidates: human translation memories plus one machine translation
 * ("MT!"). Its own pick goes by text similarity only, which surfaced junk ("Cattle") and
 * near-misses ("Hi xx, how are you today?"). So: drop unrated, untranslated or wrong-language
 * entries; take an exact human match when there is one; otherwise the machine translation.
 */
export function pickMyMemoryTranslation(
  source: string,
  payload: unknown,
  target?: string,
): string | null {
  const parsed = myMemoryResponseSchema.safeParse(payload);
  if (!parsed.success || String(parsed.data.responseStatus) !== "200") return null;

  const original = source.trim().toLowerCase();
  const matches = parsed.data.matches ?? [];
  if (matches.length === 0) {
    // No candidate list (rare): only then trust MyMemory's own pick.
    const own = parsed.data.responseData?.translatedText.trim() ?? "";
    return own && own.toLowerCase() !== original ? own : null;
  }
  const valid = matches
    .map((entry) => ({
      text: entry.translation.trim(),
      quality: Number(entry.quality ?? 0),
      match: Number(entry.match ?? 0),
      machine: entry["created-by"] === "MT!",
      language: entry.target?.toLowerCase().split("-")[0],
    }))
    .filter(
      (entry) =>
        entry.text.length > 0 &&
        entry.quality >= MY_MEMORY_MIN_QUALITY &&
        entry.text.toLowerCase() !== original &&
        (!target || !entry.language || entry.language === target.split("-")[0]) &&
        (!target || !clearlyNotIn(entry.text, target.split("-")[0] ?? target)),
    );
  const byMatch = (a: (typeof valid)[number], b: (typeof valid)[number]) =>
    b.match - a.match || b.quality - a.quality;

  const exact = valid.filter((entry) => !entry.machine && entry.match >= MY_MEMORY_EXACT_MATCH).sort(byMatch);
  if (exact[0]) return exact[0].text;
  const machine = valid.find((entry) => entry.machine);
  if (machine) return machine.text;
  return valid.sort(byMatch)[0]?.text ?? null;
}

/** Free MyMemory API: no key, 500 characters per request, rate limited per IP or e-mail. */
export const myMemoryProvider: TranslationProvider = {
  version: "mymemory:explicit-source:4",
  maxChars: 500,
  async translate(text, source, target) {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", text);
    url.searchParams.set("langpair", `${source}|${target}`);
    url.searchParams.set("mt", "1");
    // A contact address raises the free daily quota (MyMemory's "de" parameter).
    if (env.myMemoryEmail) url.searchParams.set("de", env.myMemoryEmail);
    const payload = await readJson(() => fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }));
    const translated = pickMyMemoryTranslation(text, payload, target);
    if (!translated) throw unavailable();
    return translated;
  },
};

const googleResponseSchema = z.object({
  data: z.object({
    translations: z.array(z.object({ translatedText: z.string().min(1) })).min(1),
  }),
});

/** Google Cloud Translation (Basic, v2 REST) with an API key; plain text in, plain text out. */
export function googleProvider(apiKey: string): TranslationProvider {
  return {
    version: "google:v2:2",
    maxChars: 5_000,
    async translate(text, source, target) {
      const url = new URL("https://translation.googleapis.com/language/translate/v2");
      url.searchParams.set("key", apiKey);
      const payload = await readJson(() =>
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: text, source, target, format: "text" }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }),
      );
      const parsed = googleResponseSchema.safeParse(payload);
      const translated = parsed.success ? parsed.data.data.translations[0]?.translatedText.trim() : "";
      if (!translated) throw unavailable();
      return translated;
    },
  };
}

const deeplResponseSchema = z.object({
  translations: z.array(z.object({ text: z.string().min(1) })).min(1),
});

/** DeepL wants EN-US / PT-PT style codes for some targets and plain codes for sources. */
function deeplTarget(code: string): string {
  if (code === "en") return "EN-US";
  if (code === "pt") return "PT-PT";
  return code.toUpperCase();
}

/** DeepL API; keys ending in ":fx" belong to the free plan and its own host. */
export function deeplProvider(apiKey: string): TranslationProvider {
  const host = apiKey.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
  return {
    version: "deepl:v2:1",
    maxChars: 5_000,
    async translate(text, source, target) {
      const payload = await readJson(() =>
        fetch(`${host}/v2/translate`, {
          method: "POST",
          headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: [text],
            source_lang: source.toUpperCase(),
            target_lang: deeplTarget(target),
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }),
      );
      const parsed = deeplResponseSchema.safeParse(payload);
      const translated = parsed.success ? parsed.data.translations[0]?.text.trim() : "";
      if (!translated) throw unavailable();
      return translated;
    },
  };
}

function configuredProvider(): TranslationProvider {
  if (env.translationProvider === "deepl" && env.deeplApiKey) return deeplProvider(env.deeplApiKey);
  if (env.translationProvider === "google" && env.googleTranslateApiKey) {
    return googleProvider(env.googleTranslateApiKey);
  }
  return myMemoryProvider;
}

/** The provider this API instance uses, chosen once from the environment. */
export const translationProvider: TranslationProvider = configuredProvider();

/** Translates with the configured provider, rejecting text it cannot take in one request. */
export async function translateText(text: string, source: string, target: string): Promise<string> {
  if (text.length > translationProvider.maxChars) {
    throw new AppError(
      `Message is too long to translate (max ${translationProvider.maxChars} characters)`,
      400,
      "VALIDATION_ERROR",
    );
  }
  return translationProvider.translate(text, source, target);
}
