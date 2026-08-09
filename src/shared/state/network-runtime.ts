import { defaultSettings } from "@/shared/state/settings";
import type { NetworkSettings } from "@/shared/types/settings";

/**
 * A plain mirror of the network settings for callers outside React.
 *
 * Same reason as the audio mirror next door: services invoked from event
 * handlers and streams need the current value without being handed a hook.
 */
let runtimeNetworkSettings: NetworkSettings = defaultSettings.network;

export function setRuntimeNetworkSettings(settings: NetworkSettings) {
  runtimeNetworkSettings = { ...settings };
}

export function getRuntimeNetworkSettings(): NetworkSettings {
  return runtimeNetworkSettings;
}
