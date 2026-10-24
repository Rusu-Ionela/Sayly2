/**
 * Non-secret preference storage (theme, UI flags).
 * Re-exports the shared preferences adapter — never use for auth tokens.
 */
export { preferencesStorage as preferenceStorage, preferencesStorage } from "./storage";
