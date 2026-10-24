import { asc, eq, inArray } from "drizzle-orm";

import { db } from "../../db/client";
import type { DbTransaction } from "../../db/client";
import type { ProficiencyLevel } from "../../db/schema";
import { languages, userLanguages } from "../../db/schema";

import { LANGUAGE_CATALOG } from "./catalog";
import { toLanguageDto } from "./dto";
import type { LanguageDto, SyncUserLanguagesInput } from "./types";
import { lockUser } from "../../db/helpers";

const LANGUAGE_COLUMNS = {
  id: languages.id,
  name: languages.name,
  code: languages.code,
  flagEmoji: languages.flagEmoji,
  sortOrder: languages.sortOrder,
} as const;

/** ponytail: in-process cache is enough for a rarely-changing catalog; use Redis if this is multi-instance. */
const CATALOG_TTL_MS = 10 * 60 * 1000;

type CatalogCache = {
  items: LanguageDto[];
  expiresAt: number;
};

let catalogCache: CatalogCache | null = null;
let catalogLoad: Promise<LanguageDto[]> | null = null;

export function invalidateLanguageCatalogCache(): void {
  catalogCache = null;
}

function buildLanguageRows(
  userId: string,
  spokenLanguages: Array<{ languageId: string; proficiency: ProficiencyLevel }>,
  learningLanguages: Array<{ languageId: string; proficiency: ProficiencyLevel }>,
) {
  return [
    ...spokenLanguages.map((item) => ({
      userId,
      languageId: item.languageId,
      type: "SPEAKS" as const,
      proficiencyLevel: item.proficiency,
    })),
    ...learningLanguages.map((item) => ({
      userId,
      languageId: item.languageId,
      type: "LEARNING" as const,
      proficiencyLevel: item.proficiency,
    })),
  ];
}

function languageKey(row: { languageId: string; type: string }): string {
  return `${row.languageId}:${row.type}`;
}

export async function seedLanguageCatalog(): Promise<number> {
  for (const language of LANGUAGE_CATALOG) {
    await db
      .insert(languages)
      .values({
        id: language.code,
        name: language.name,
        code: language.code,
        flagEmoji: language.flagEmoji,
        sortOrder: language.sortOrder,
      })
      .onConflictDoUpdate({
        target: languages.code,
        set: {
          name: language.name,
          flagEmoji: language.flagEmoji,
          sortOrder: language.sortOrder,
        },
      });
  }

  invalidateLanguageCatalogCache();
  return LANGUAGE_CATALOG.length;
}

async function loadLanguagesFromDb(): Promise<LanguageDto[]> {
  const rows = await db
    .select(LANGUAGE_COLUMNS)
    .from(languages)
    .orderBy(asc(languages.sortOrder), asc(languages.name));

  return rows.map(toLanguageDto);
}

export async function listLanguages(): Promise<LanguageDto[]> {
  const now = Date.now();
  if (catalogCache && catalogCache.expiresAt > now) {
    return catalogCache.items;
  }

  if (!catalogLoad) {
    catalogLoad = (async () => {
      let items = await loadLanguagesFromDb();
      const have = new Set(items.map((item) => item.code));
      const missingRequired = LANGUAGE_CATALOG.some((language) => !have.has(language.code));
      if (missingRequired) {
        await seedLanguageCatalog();
        items = await loadLanguagesFromDb();
      }
      catalogCache = { items, expiresAt: Date.now() + CATALOG_TTL_MS };
      return items;
    })().finally(() => {
      catalogLoad = null;
    });
  }

  return catalogLoad;
}

export async function findLanguagesByIds(ids: string[]): Promise<LanguageDto[]> {
  if (ids.length === 0) {
    return [];
  }

  const rows = await db
    .select(LANGUAGE_COLUMNS)
    .from(languages)
    .where(inArray(languages.id, ids));

  return rows.map(toLanguageDto);
}

export async function findUserLanguages(userId: string) {
  return db.query.userLanguages.findMany({
    where: eq(userLanguages.userId, userId),
    orderBy: (table, { asc }) => [asc(table.type), asc(table.createdAt)],
    with: {
      language: {
        columns: {
          code: true,
          name: true,
          flagEmoji: true,
        },
      },
    },
  });
}

/**
 * Atomic replace of a user's language rows: delete removed, update proficiency, insert new.
 * Uses a SQL transaction (Drizzle equivalent of prisma.$transaction).
 */
export async function syncUserLanguages(
  userId: string,
  input: SyncUserLanguagesInput,
  tx?: DbTransaction,
): Promise<void> {
  const incoming = buildLanguageRows(userId, input.spokenLanguages, input.learningLanguages);

  const run = async (client: DbTransaction) => {
    await lockUser(client, userId);

    const existing = await client
      .select({
        id: userLanguages.id,
        languageId: userLanguages.languageId,
        type: userLanguages.type,
        proficiencyLevel: userLanguages.proficiencyLevel,
      })
      .from(userLanguages)
      .where(eq(userLanguages.userId, userId));

    const incomingByKey = new Map(incoming.map((row) => [languageKey(row), row]));
    const existingByKey = new Map(existing.map((row) => [languageKey(row), row]));

    const idsToDelete = existing
      .filter((row) => !incomingByKey.has(languageKey(row)))
      .map((row) => row.id);

    if (idsToDelete.length > 0) {
      await client.delete(userLanguages).where(inArray(userLanguages.id, idsToDelete));
    }

    const now = new Date();

    for (const row of incoming) {
      const previous = existingByKey.get(languageKey(row));
      if (!previous || previous.proficiencyLevel === row.proficiencyLevel) {
        continue;
      }

      await client
        .update(userLanguages)
        .set({
          proficiencyLevel: row.proficiencyLevel,
          updatedAt: now,
        })
        .where(eq(userLanguages.id, previous.id));
    }

    const toInsert = incoming.filter((row) => !existingByKey.has(languageKey(row)));
    if (toInsert.length > 0) {
      await client.insert(userLanguages).values(toInsert);
    }
  };

  if (tx) {
    await run(tx);
    return;
  }

  await db.transaction(run);
}
