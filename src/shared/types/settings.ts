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

export type AudioSettings = {
  apiKey: string;
  model: string;
  voiceId: string;
};

export type AnkiSettings = {
  apiUrl: string;
  deckName: string;
  cardTheme: "light" | "dark";
};

export type DictionarySettings = {
  cachePath: string;
  lastUpdated: string | null;
};

export type KeyboardShortcutSettings = {
  quickQuery: string;
  newQuery: string;
  enabled: boolean;
};

export type AboutMetadata = {
  version: string;
  build: string;
};

export type SystemSettings = {
  /** Whether the tray icon should be visible on supported desktop platforms. */
  trayIconEnabled: boolean;
  /** Whether the app should start automatically when the user logs in. */
  launchOnSystemStart: boolean;
  /** Whether the app's dock / taskbar icon should be shown when the tray is enabled. */
  dockOrTaskbarVisible: boolean;
};

export type AppSettings = {
  theme: ThemePreference;
  language: LanguagePreference;
  llm: LlmProvider;
  audio: AudioSettings;
  anki: AnkiSettings;
  dictionary: DictionarySettings;
  keyboard: KeyboardShortcutSettings;
  about: AboutMetadata;
  system: SystemSettings;
};
