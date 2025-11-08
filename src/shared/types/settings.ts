export type ThemePreference = {
  mode: "system" | "light" | "dark";
  accent: "blue" | "purple" | "green" | "orange" | "rose";
};

export type LanguagePreference = "en" | "zh";

export type LlmProvider = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type DictionarySettings = {
  cachePath: string;
  lastUpdated: string | null;
};

export type KeyboardShortcutSettings = {
  quickQuery: string;
  newQuery: string;
};

export type AboutMetadata = {
  version: string;
  build: string;
};

export type AppSettings = {
  theme: ThemePreference;
  language: LanguagePreference;
  llm: LlmProvider;
  dictionary: DictionarySettings;
  keyboard: KeyboardShortcutSettings;
  about: AboutMetadata;
};

