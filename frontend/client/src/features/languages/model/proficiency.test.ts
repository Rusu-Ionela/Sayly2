import { MAX_LEARNING_LANGUAGES, MAX_NATIVE_LANGUAGES, MAX_SPOKEN_LANGUAGES } from "@sayly/shared";
import { formatProficiencyLabel } from "./proficiency";
import { normalizeLearningProficiency } from "../constants";
import type { UserLanguagesGrouped } from "../types";
import { duplicateLanguageMessage, selectedLanguageIdsFromLists } from "../utils";

describe("language limits", () => {
  it("exposes canonical caps", () => {
    expect(MAX_SPOKEN_LANGUAGES).toBe(10);
    expect(MAX_LEARNING_LANGUAGES).toBe(5);
    expect(MAX_NATIVE_LANGUAGES).toBe(1);
  });
});

describe("formatProficiencyLabel", () => {
  it("formats enums", () => {
    expect(formatProficiencyLabel("UPPER_INTERMEDIATE")).toBe("Upper Intermediate");
    expect(formatProficiencyLabel("NATIVE")).toBe("Native");
  });
});

describe("language selection rules", () => {
  it("unions spoken and learning ids so catalog rows are blocked once taken", () => {
    const ids = selectedLanguageIdsFromLists(
      [{ languageId: "en" }],
      [{ languageId: "en" }, { languageId: "fr" }],
    );
    expect(ids.has("en")).toBe(true);
    expect(ids.has("fr")).toBe(true);
    expect(ids.has("es")).toBe(false);
  });

  it("prevents adding a language already in spoken or learning", () => {
    const grouped: UserLanguagesGrouped = {
      SPEAKS: [
        {
          id: "1",
          languageId: "en",
          code: "en",
          name: "English",
          flagEmoji: "🇬🇧",
          type: "SPEAKS",
          proficiency: "NATIVE",
        },
      ],
      LEARNING: [
        {
          id: "2",
          languageId: "fr",
          code: "fr",
          name: "French",
          flagEmoji: "🇫🇷",
          type: "LEARNING",
          proficiency: "BEGINNER",
        },
      ],
    };

    expect(duplicateLanguageMessage(grouped, "en")).toBe(
      "That language is already in your languages.",
    );
    expect(duplicateLanguageMessage(grouped, "fr")).toBe(
      "That language is already in your languages.",
    );
    expect(duplicateLanguageMessage(grouped, "es")).toBeNull();
  });

  it("normalizes learning proficiency", () => {
    expect(normalizeLearningProficiency("NATIVE")).toBe("ADVANCED");
    expect(normalizeLearningProficiency("BEGINNER")).toBe("BEGINNER");
  });
});
