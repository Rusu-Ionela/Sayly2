/**
 * Curated idioms members can add to their Collection. Ids are stable (saved rows point
 * at them), so never rename one — add a new entry instead.
 */
export type ExpressionDto = {
  id: string;
  /** ISO-639-1. */
  languageCode: string;
  phrase: string;
  meaning: string;
  example: string;
};

type Entry = Omit<ExpressionDto, "id" | "languageCode"> & { slug: string };

const CATALOG: Record<string, Entry[]> = {
  en: [
    {
      slug: "spill-the-beans",
      phrase: "Spill the beans",
      meaning: "To reveal a secret.",
      example: "Come on, spill the beans — who did you meet last night?",
    },
    {
      slug: "under-the-weather",
      phrase: "Under the weather",
      meaning: "Feeling a little ill.",
      example: "I'm staying home today, I'm a bit under the weather.",
    },
    {
      slug: "break-the-ice",
      phrase: "Break the ice",
      meaning: "To make people feel comfortable when they first meet.",
      example: "He told a joke to break the ice before the meeting.",
    },
    {
      slug: "piece-of-cake",
      phrase: "A piece of cake",
      meaning: "Something very easy.",
      example: "Don't worry about the test, it's a piece of cake.",
    },
    {
      slug: "hit-the-sack",
      phrase: "Hit the sack",
      meaning: "To go to bed.",
      example: "I'm exhausted, I'm going to hit the sack.",
    },
    {
      slug: "once-in-a-blue-moon",
      phrase: "Once in a blue moon",
      meaning: "Very rarely.",
      example: "We only see each other once in a blue moon.",
    },
  ],
  es: [
    {
      slug: "estar-en-las-nubes",
      phrase: "Estar en las nubes",
      meaning: "To be daydreaming or distracted.",
      example: "Perdona, no te escuché, estaba en las nubes.",
    },
    {
      slug: "costar-un-ojo-de-la-cara",
      phrase: "Costar un ojo de la cara",
      meaning: "To be very expensive.",
      example: "El concierto me costó un ojo de la cara.",
    },
    {
      slug: "ser-pan-comido",
      phrase: "Ser pan comido",
      meaning: "To be very easy.",
      example: "No te preocupes, el examen es pan comido.",
    },
    {
      slug: "tomar-el-pelo",
      phrase: "Tomar el pelo",
      meaning: "To pull someone's leg.",
      example: "¿Me estás tomando el pelo?",
    },
  ],
  fr: [
    {
      slug: "poser-un-lapin",
      phrase: "Poser un lapin",
      meaning: "To stand someone up.",
      example: "Il m'a posé un lapin hier soir.",
    },
    {
      slug: "avoir-le-cafard",
      phrase: "Avoir le cafard",
      meaning: "To feel down.",
      example: "Quand il pleut, j'ai un peu le cafard.",
    },
    {
      slug: "coute-les-yeux-de-la-tete",
      phrase: "Coûter les yeux de la tête",
      meaning: "To be very expensive.",
      example: "Cette voiture coûte les yeux de la tête.",
    },
    {
      slug: "avoir-un-poil-dans-la-main",
      phrase: "Avoir un poil dans la main",
      meaning: "To be lazy.",
      example: "Il ne fait jamais rien, il a un poil dans la main.",
    },
  ],
  de: [
    {
      slug: "tomaten-auf-den-augen",
      phrase: "Tomaten auf den Augen haben",
      meaning: "To not see something obvious.",
      example: "Der Schlüssel liegt doch vor dir — hast du Tomaten auf den Augen?",
    },
    {
      slug: "ich-verstehe-nur-bahnhof",
      phrase: "Ich verstehe nur Bahnhof",
      meaning: "I don't understand a thing.",
      example: "Bei Physik verstehe ich nur Bahnhof.",
    },
    {
      slug: "daumen-druecken",
      phrase: "Die Daumen drücken",
      meaning: "To keep your fingers crossed.",
      example: "Ich drücke dir die Daumen für die Prüfung!",
    },
    {
      slug: "schwein-haben",
      phrase: "Schwein haben",
      meaning: "To be lucky.",
      example: "Wir haben den letzten Zug erwischt — Schwein gehabt!",
    },
  ],
  it: [
    {
      slug: "in-bocca-al-lupo",
      phrase: "In bocca al lupo",
      meaning: "Good luck.",
      example: "Domani hai l'esame? In bocca al lupo!",
    },
    {
      slug: "non-vedo-l-ora",
      phrase: "Non vedo l'ora",
      meaning: "I can't wait.",
      example: "Non vedo l'ora di andare in vacanza.",
    },
    {
      slug: "avere-le-mani-in-pasta",
      phrase: "Avere le mani in pasta",
      meaning: "To be involved in something.",
      example: "Lui ha le mani in pasta in tutti i progetti.",
    },
    {
      slug: "acqua-in-bocca",
      phrase: "Acqua in bocca!",
      meaning: "Keep it a secret!",
      example: "Ti racconto una cosa, ma acqua in bocca!",
    },
  ],
};

const EXPRESSIONS: ExpressionDto[] = Object.entries(CATALOG).flatMap(([languageCode, entries]) =>
  entries.map(({ slug, ...entry }) => ({ id: `${languageCode}-${slug}`, languageCode, ...entry })),
);

const BY_ID = new Map(EXPRESSIONS.map((item) => [item.id, item]));

/** Languages that have a curated list. */
export const EXPRESSION_LANGUAGES = Object.keys(CATALOG);

export function listExpressions(languageCodes: string[]): ExpressionDto[] {
  const wanted = new Set(languageCodes);
  return EXPRESSIONS.filter((item) => wanted.has(item.languageCode));
}

export function findExpression(id: string): ExpressionDto | undefined {
  return BY_ID.get(id);
}
