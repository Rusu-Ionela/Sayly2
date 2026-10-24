import type { LanguageSetupSection } from "./types";

export function languageSectionTitle(section: LanguageSetupSection) {
  switch (section) {
    case "native":
      return "I am native in";
    case "fluent":
      return "I am fluent in";
    case "learning":
      return "I am learning";
  }
}

export function languageSectionChangeLabel(section: LanguageSetupSection) {
  switch (section) {
    case "native":
      return "CHANGE NATIVE LANGUAGE";
    case "fluent":
      return "CHANGE FLUENT LANGUAGE";
    case "learning":
      return "CHANGE LEARNING LANGUAGE";
  }
}

export function languageSectionRemoveHint(section: LanguageSetupSection) {
  switch (section) {
    case "native":
    case "fluent":
      return "You need at least one native or fluent language";
    case "learning":
      return "You need at least one learning language";
  }
}

export function languageSectionLevelHeading(languageName: string) {
  return `YOUR ${languageName.toUpperCase()} LEVEL`;
}
