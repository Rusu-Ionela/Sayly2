import { afterEach, describe, expect, it, vi } from "vitest";

import { deeplProvider, googleProvider, myMemoryProvider, pickMyMemoryTranslation } from "./provider";
import { pickSourceLanguage } from "./sourceLanguage";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Real MyMemory answer for "Ce faci azi?" (ro→en): its own pick was the junk entry. */
const ceFaciAzi = {
  responseStatus: 200,
  responseData: { translatedText: "Cattle", match: 1 },
  matches: [
    { translation: "Cattle", match: 1, quality: "0", "created-by": "Wikipedia" },
    { translation: "What are you doing today? ", match: 0.99, quality: "74", "created-by": "MateCat" },
  ],
};

describe("source language", () => {
  it("never guesses: one-word Romanian from a Romanian speaker is Romanian", () => {
    // MyMemory's autodetect read "salut" as Catalan and returned "health".
    expect(pickSourceLanguage("salut", ["ro", "en"], "en")).toBe("ro");
  });

  it("detects among the author's languages for real sentences", () => {
    expect(pickSourceLanguage("Ce faci azi?", ["ro", "en"], "en")).toBe("ro");
    expect(pickSourceLanguage("hello friend, how are you?", ["en", "ro"], "ro")).toBe("en");
    expect(pickSourceLanguage("good morning", ["en", "ro"], "ro")).toBe("en");
    expect(pickSourceLanguage("Hola, ¿qué tal estás hoy?", ["es", "en"], "en")).toBe("es");
  });

  it("does not translate a message already in your language", () => {
    expect(() => pickSourceLanguage("Bună dimineața! Ce mai faci?", ["ro", "en"], "ro")).toThrow(
      /already/,
    );
  });
});

describe("MyMemory", () => {
  it("ranks candidates by quality instead of trusting MyMemory's pick", () => {
    expect(pickMyMemoryTranslation("Ce faci azi?", ceFaciAzi)).toBe("What are you doing today?");
  });

  it("rejects an answer made only of junk or untranslated text", () => {
    expect(
      pickMyMemoryTranslation("salut", {
        responseStatus: 200,
        responseData: { translatedText: "health" },
        matches: [
          { translation: "health", match: 0.85, quality: "0" },
          { translation: "salut", match: 0.8, quality: "80" },
        ],
      }),
    ).toBeNull();
  });

  it("prefers the machine translation over a near-miss from the memory", () => {
    // Real answer for "Salut! Ce faci azi?" (ro→en).
    expect(
      pickMyMemoryTranslation(
        "Salut! Ce faci azi?",
        {
          responseStatus: 200,
          responseData: { translatedText: "Hi xx, how are you today?" },
          matches: [
            { translation: "Hi xx, how are you today? ", match: 0.86, quality: "74", "created-by": "MateCat" },
            { translation: "Hi! How are you today?", match: 0.85, quality: "70", "created-by": "MT!" },
          ],
        },
        "en",
      ),
    ).toBe("Hi! How are you today?");
  });

  it("drops an entry stored under the wrong language", () => {
    // Real answer for "Mulțumesc frumos!" (ro→en): a French entry labelled en-US.
    expect(
      pickMyMemoryTranslation(
        "Mulțumesc frumos!",
        {
          responseStatus: 200,
          responseData: { translatedText: "Thank you! Reply" },
          matches: [
            { translation: "Thank you! Reply", match: 0.99, quality: "0", target: "en-GB" },
            { translation: "Merci beaucoup!", match: 0.98, quality: "74", target: "en-US" },
            { translation: "Thank you very much", match: 0.96, quality: "74", target: "en-US" },
          ],
        },
        "en",
      ),
    ).toBe("Thank you very much");
  });

  it("keeps short correct answers the detector cannot classify", () => {
    expect(
      pickMyMemoryTranslation(
        "salut",
        { responseStatus: 200, matches: [{ translation: "Hello", match: 0.99, quality: "74", target: "en-GB" }] },
        "en",
      ),
    ).toBe("Hello");
  });

  it("sends the explicit language pair, never autodetect", async () => {
    const fetchMock = vi.fn(async (_url: URL) => ({
      json: async () => ({
        responseStatus: 200,
        responseData: { translatedText: "Hi," },
        matches: [
          { translation: "Hi,", match: 0.99, quality: "74" },
          { translation: "Hello", match: 0.98, quality: "74" },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await myMemoryProvider.translate("salut", "ro", "en")).toBe("Hi,");
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get("langpair")).toBe("ro|en");
  });
});

describe("paid providers", () => {
  it("Google gets the source, target and plain text", async () => {
    const fetchMock = vi.fn(async (_url: URL, _init: RequestInit) => ({
      json: async () => ({ data: { translations: [{ translatedText: "Bonjour" }] } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await googleProvider("secret").translate("Hello", "en", "fr")).toBe("Bonjour");
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("key=secret");
    expect(JSON.parse(String(init?.body))).toEqual({ q: "Hello", source: "en", target: "fr", format: "text" });
  });

  it("DeepL uses the free host for :fx keys and its own language codes", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      json: async () => ({ translations: [{ text: "Hello" }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await deeplProvider("abc:fx").translate("Salut", "ro", "en")).toBe("Hello");
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api-free.deepl.com/v2/translate");
    expect(JSON.parse(String(init?.body))).toEqual({ text: ["Salut"], source_lang: "RO", target_lang: "EN-US" });
  });

  it("turns a provider error into a 502 instead of returning junk", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ error: { code: 403 } }) })));
    await expect(googleProvider("bad").translate("Hello", "en", "fr")).rejects.toMatchObject({ statusCode: 502 });
  });
});
