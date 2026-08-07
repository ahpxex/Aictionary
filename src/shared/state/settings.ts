import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  AppSettings,
  AudioSettings,
  KeyboardShortcutSettings,
  LlmProvider,
} from "@/shared/types/settings";

/**
 * The original quick query default. A global hotkey outranks the focused
 * application, so binding Command/Ctrl+Enter took that chord away from every
 * other app while Aictionary ran. Installs still carrying the old default
 * move to the new one; anything the user picked themselves is left alone.
 */
const LEGACY_QUICK_QUERY_DEFAULT = "Mod+Enter";

export const defaultSettings: AppSettings = {
  theme: {
    mode: "system",
  },
  language: "en",
  llm: {
    // No provider is assumed and no model is guessed: a hardcoded model id
    // goes stale the moment the provider retires it, and it would be wrong
    // for every provider but one. The settings tab loads the real list.
    baseUrl: "",
    apiKey: "",
    model: "",
  },
  audio: {
    provider: "edge",
    edge: {
      voice: "en-US-AndrewNeural",
    },
    fish: {
      apiKey: "",
      model: "s1",
      voiceId: "",
    },
    openai: {
      baseUrl: "",
      apiKey: "",
      model: "tts-1",
      voice: "alloy",
    },
    elevenlabs: {
      apiKey: "",
      voiceId: "",
      model: "eleven_multilingual_v2",
    },
  },
  anki: {
    apiUrl: "http://127.0.0.1:8765",
    deckName: "AIctionary",
    cardTheme: "light",
  },
  dictionary: {
    cachePath: "",
    lastUpdated: null,
  },
  keyboard: {
    quickQuery: "Mod+Shift+D",
    newQuery: "Mod+Shift+K",
    enabled: true,
  },
  about: {
    build: "dev",
  },
  system: {
    trayIconEnabled: true,
    launchOnSystemStart: false,
    dockOrTaskbarVisible: true,
    checkUpdatesOnStart: true,
  },
};

export const settingsAtom = atomWithStorage<AppSettings>(
  "aictionary-settings",
  defaultSettings
);

export const updateSettingsAtom = atom(
  null,
  (get, set, update: Partial<AppSettings>) => {
    set(settingsAtom, { ...get(settingsAtom), ...update });
  }
);

/**
 * The model id that used to ship as the default. It was wrong for every
 * provider but OpenAI and goes stale on its own, so an install that still
 * carries it *and* was never configured gets it cleared - the settings tab
 * loads the real list instead. A configured install is left alone, since
 * there the value may well be a deliberate choice.
 */
const LEGACY_DEFAULT_MODEL = "gpt-4o-mini";

export function normalizeLlmSettings(
  value: Partial<LlmProvider> | undefined
): LlmProvider {
  const merged = { ...defaultSettings.llm, ...(value ?? {}) };
  const untouched = !merged.apiKey.trim() && !merged.baseUrl.trim();

  return {
    ...merged,
    model:
      untouched && merged.model === LEGACY_DEFAULT_MODEL ? "" : merged.model,
  };
}

/** Retire the old quick query default without touching custom bindings. */
export function normalizeKeyboardSettings(
  value: Partial<KeyboardShortcutSettings> | undefined
): KeyboardShortcutSettings {
  const merged = { ...defaultSettings.keyboard, ...(value ?? {}) };

  return {
    ...merged,
    quickQuery:
      merged.quickQuery === LEGACY_QUICK_QUERY_DEFAULT
        ? defaultSettings.keyboard.quickQuery
        : merged.quickQuery,
  };
}

/**
 * Bring stored audio settings up to the current per-provider shape. Older
 * versions persisted a flat `{ apiKey, model, voiceId }` Fish Audio config;
 * those fields migrate into `fish` so existing credentials keep working.
 */
export function normalizeAudioSettings(value: unknown): AudioSettings {
  const defaults = defaultSettings.audio;
  if (!value || typeof value !== "object") {
    return {
      provider: defaults.provider,
      edge: { ...defaults.edge },
      fish: { ...defaults.fish },
      openai: { ...defaults.openai },
      elevenlabs: { ...defaults.elevenlabs },
    };
  }

  const raw = value as Partial<AudioSettings> & {
    apiKey?: unknown;
    model?: unknown;
    voiceId?: unknown;
  };

  if (!("provider" in raw) && ("apiKey" in raw || "voiceId" in raw)) {
    const legacyKey = typeof raw.apiKey === "string" ? raw.apiKey : "";
    return {
      // A configured legacy install keeps Fish; an untouched one gets the
      // zero-configuration Edge default.
      provider: legacyKey.trim() ? "fish" : "edge",
      edge: { ...defaults.edge },
      fish: {
        apiKey: legacyKey,
        model:
          typeof raw.model === "string" && raw.model.trim()
            ? raw.model
            : defaults.fish.model,
        voiceId: typeof raw.voiceId === "string" ? raw.voiceId : "",
      },
      openai: { ...defaults.openai },
      elevenlabs: { ...defaults.elevenlabs },
    };
  }

  const provider =
    raw.provider === "fish" ||
    raw.provider === "openai" ||
    raw.provider === "elevenlabs"
      ? raw.provider
      : "edge";

  return {
    provider,
    edge: { ...defaults.edge, ...(raw.edge ?? {}) },
    fish: { ...defaults.fish, ...(raw.fish ?? {}) },
    openai: { ...defaults.openai, ...(raw.openai ?? {}) },
    elevenlabs: { ...defaults.elevenlabs, ...(raw.elevenlabs ?? {}) },
  };
}
