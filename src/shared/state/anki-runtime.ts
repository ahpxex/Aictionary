import { defaultSettings } from "@/shared/state/settings";
import type { AnkiSettings } from "@/shared/types/settings";

let runtimeAnkiSettings: AnkiSettings = defaultSettings.anki;

export function setRuntimeAnkiSettings(settings?: Partial<AnkiSettings>) {
  runtimeAnkiSettings = {
    ...defaultSettings.anki,
    ...(settings ?? {}),
  };
}

export function getRuntimeAnkiSettings(): AnkiSettings {
  return runtimeAnkiSettings;
}
