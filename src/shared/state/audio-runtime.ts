import { defaultSettings } from "@/shared/state/settings";
import type { AudioSettings } from "@/shared/types/settings";

let runtimeAudioSettings: AudioSettings = defaultSettings.audio;

export function setRuntimeAudioSettings(settings: AudioSettings) {
  runtimeAudioSettings = { ...settings };
}

export function getRuntimeAudioSettings(): AudioSettings {
  return runtimeAudioSettings;
}
