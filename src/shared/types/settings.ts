export type ThemePreference = {
  mode: "system" | "light" | "dark";
};

export type LanguagePreference = "en" | "zh";

/** The flattened config the LLM service actually calls a provider with. */
export type LlmProvider = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

/** What is remembered per provider. Keys are never shared between them. */
export type LlmProviderCredentials = {
  apiKey: string;
  model: string;
};

export type LlmSettings = {
  /** Preset id from `llm-providers.ts`, or "custom". */
  providerId: string;
  /** Endpoint for the custom provider; presets carry their own. */
  customBaseUrl: string;
  /** Credentials per provider id, so switching never loses a key. */
  credentials: Record<string, LlmProviderCredentials>;
};

export type TtsProviderKind = "edge" | "fish" | "openai" | "elevenlabs";

/**
 * Microsoft Edge's read-aloud service, spoken natively over websocket.
 * Free and keyless, so it works with zero configuration and is the default.
 */
export type EdgeTtsSettings = {
  voice: string;
};

export type ElevenLabsSettings = {
  apiKey: string;
  voiceId: string;
  model: string;
};

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
  edge: EdgeTtsSettings;
  fish: FishAudioSettings;
  openai: OpenAiTtsSettings;
  elevenlabs: ElevenLabsSettings;
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
  build: string;
};

export type SystemSettings = {
  /** Whether the tray icon should be visible on supported desktop platforms. */
  trayIconEnabled: boolean;
  /** Whether the app should start automatically when the user logs in. */
  launchOnSystemStart: boolean;
  /** Whether the app's dock / taskbar icon should be shown when the tray is enabled. */
  dockOrTaskbarVisible: boolean;
  /** Whether to ask GitHub for a newer release when the app starts. */
  checkUpdatesOnStart: boolean;
};

/**
 * Where outbound connections look for a proxy.
 *
 * `auto` follows the platform - proxy environment variables, then the system
 * pane on macOS. `manual` is the only option that works on Android, which has
 * neither of those for an app to inherit.
 */
export type ProxyMode = "auto" | "manual" | "direct";

export type NetworkSettings = {
  proxyMode: ProxyMode;
  /** `<scheme>://<host>:<port>`; http, https, socks4 and socks5 are accepted. */
  proxyUrl: string;
};

export type AppSettings = {
  theme: ThemePreference;
  language: LanguagePreference;
  llm: LlmSettings;
  audio: AudioSettings;
  network: NetworkSettings;
  anki: AnkiSettings;
  dictionary: DictionarySettings;
  keyboard: KeyboardShortcutSettings;
  about: AboutMetadata;
  system: SystemSettings;
};
