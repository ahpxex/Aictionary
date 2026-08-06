import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { AppSettings, AudioSettings } from "@/shared/types/settings";

export const defaultSettings: AppSettings = {
  theme: {
    mode: "system",
  },
  language: "en",
  llm: {
    baseUrl: "",
    apiKey: "",
    model: "gpt-4o-mini",
  },
  audio: {
    provider: "fish",
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
    quickQuery: "Mod+Enter",
    newQuery: "Mod+Shift+K",
    enabled: true,
  },
  about: {
    version: "0.1.0",
    build: "dev",
  },
  system: {
    trayIconEnabled: true,
    launchOnSystemStart: false,
    dockOrTaskbarVisible: true,
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
 * Bring stored audio settings up to the current per-provider shape. Older
 * versions persisted a flat `{ apiKey, model, voiceId }` Fish Audio config;
 * those fields migrate into `fish` so existing credentials keep working.
 */
export function normalizeAudioSettings(value: unknown): AudioSettings {
  const defaults = defaultSettings.audio;
  if (!value || typeof value !== "object") {
    return {
      provider: defaults.provider,
      fish: { ...defaults.fish },
      openai: { ...defaults.openai },
    };
  }

  const raw = value as Partial<AudioSettings> & {
    apiKey?: unknown;
    model?: unknown;
    voiceId?: unknown;
  };

  if (!("provider" in raw) && ("apiKey" in raw || "voiceId" in raw)) {
    return {
      provider: "fish",
      fish: {
        apiKey: typeof raw.apiKey === "string" ? raw.apiKey : "",
        model:
          typeof raw.model === "string" && raw.model.trim()
            ? raw.model
            : defaults.fish.model,
        voiceId: typeof raw.voiceId === "string" ? raw.voiceId : "",
      },
      openai: { ...defaults.openai },
    };
  }

  return {
    provider: raw.provider === "openai" ? "openai" : "fish",
    fish: { ...defaults.fish, ...(raw.fish ?? {}) },
    openai: { ...defaults.openai, ...(raw.openai ?? {}) },
  };
}
