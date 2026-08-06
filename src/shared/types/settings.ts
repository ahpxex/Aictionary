export type ThemePreference = {
  mode: "system" | "light" | "dark";
};

export type LanguagePreference = "en" | "zh";

export type LlmProvider = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type TtsProviderKind = "fish" | "openai";

export type FishAudioSettings = {
  apiKey: string;
  model: string;
  /** Fish Audio reference id selecting a custom voice. */
  voiceId: string;
};

/**
 * Any endpoint speaking the OpenAI `/v1/audio/speech` contract: the OpenAI
 * API itself or self-hosted wrappers such as openai-edge-tts. The API key is
 * optional because local wrappers often run without authentication.
 */
export type OpenAiTtsSettings = {
  baseUrl: string;
  apiKey: string;
  model: string;
  voice: string;
};

export type AudioSettings = {
  provider: TtsProviderKind;
  fish: FishAudioSettings;
  openai: OpenAiTtsSettings;
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
