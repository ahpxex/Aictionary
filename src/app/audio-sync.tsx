import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { normalizeAudioSettings, settingsAtom } from "@/shared/state/settings";
import { setRuntimeAudioSettings } from "@/shared/state/audio-runtime";
import { setRuntimeNetworkSettings } from "@/shared/state/network-runtime";

export function AudioSync() {
  const settings = useAtomValue(settingsAtom);

  useEffect(() => {
    setRuntimeAudioSettings(normalizeAudioSettings(settings.audio));
  }, [settings.audio]);

  // Audio is the one subsystem that has to be told about the proxy: the Edge
  // websocket cannot discover one on its own.
  useEffect(() => {
    setRuntimeNetworkSettings(settings.network);
  }, [settings.network]);

  return null;
}
