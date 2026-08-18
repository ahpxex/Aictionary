import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  AppSettings,
  AudioSettings,
  KeyboardShortcutSettings,
  LlmProvider,
  LlmProviderCredentials,
  LlmSettings,
} from "@/shared/types/settings";
import {
  baseUrlForProvider,
  presetIdForBaseUrl,
} from "@/shared/lib/llm-providers";

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
    providerId: "openai",
    customBaseUrl: "",
    credentials: {},
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
    popupQuery: "Mod+Shift+P",
    enabled: true,
  },
  about: {
    build: "dev",
  },
  network: {
    proxyMode: "auto",
    proxyUrl: "",
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
 * carries it is treated as never configured.
 */
const LEGACY_DEFAULT_MODEL = "gpt-4o-mini";

/** The shape credentials were stored in before they were per-provider. */
type LegacyLlmSettings = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
};

/**
 * Move a single shared credential set onto the provider it belonged to.
 *
 * One key for every provider was always wrong - they are different accounts
 * at different companies - so the stored pair is filed under whichever
 * provider the old base URL pointed at, and the rest start empty.
 */
export function normalizeLlmSettings(
  value: (Partial<LlmSettings> & LegacyLlmSettings) | undefined
): LlmSettings {
  const defaults = defaultSettings.llm;
  if (!value || typeof value !== "object") {
    return { ...defaults, credentials: {} };
  }

  if (!("credentials" in value) || !value.credentials) {
    const apiKey = typeof value.apiKey === "string" ? value.apiKey : "";
    const baseUrl = typeof value.baseUrl === "string" ? value.baseUrl : "";
    const rawModel = typeof value.model === "string" ? value.model : "";
    const model = rawModel === LEGACY_DEFAULT_MODEL ? "" : rawModel;
    const providerId = baseUrl.trim()
      ? presetIdForBaseUrl(baseUrl)
      : defaults.providerId;

    return {
      providerId,
      customBaseUrl: providerId === "custom" ? baseUrl : "",
      credentials: apiKey || model ? { [providerId]: { apiKey, model } } : {},
    };
  }

  return {
    providerId: value.providerId || defaults.providerId,
    customBaseUrl: value.customBaseUrl ?? "",
    credentials: value.credentials,
  };
}

/** The credentials stored for one provider, defaulting to empty. */
export function credentialsForProvider(
  llm: LlmSettings,
  providerId: string
): LlmProviderCredentials {
  return llm.credentials[providerId] ?? { apiKey: "", model: "" };
}

/**
 * Flatten the stored settings into the single provider config the LLM
 * service calls: the selected provider's URL plus its own credentials.
 */
export function resolveActiveLlmProvider(llm: LlmSettings): LlmProvider {
  const credentials = credentialsForProvider(llm, llm.providerId);
  return {
    baseUrl: baseUrlForProvider(llm.providerId, llm.customBaseUrl),
    apiKey: credentials.apiKey,
    model: credentials.model,
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
