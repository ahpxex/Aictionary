import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { AppSettings } from "@/shared/types/settings";

export const defaultSettings: AppSettings = {
  theme: {
    mode: "system",
    accent: "blue",
  },
  language: "en",
  llm: {
    baseUrl: "",
    apiKey: "",
    model: "gpt-4o-mini",
  },
  audio: {
    apiKey: "",
    model: "s1",
    voiceId: "",
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
