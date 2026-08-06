import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { normalizeAudioSettings, settingsAtom } from "@/shared/state/settings";
import { setRuntimeAudioSettings } from "@/shared/state/audio-runtime";

export function AudioSync() {
  const settings = useAtomValue(settingsAtom);

  useEffect(() => {
    setRuntimeAudioSettings(normalizeAudioSettings(settings.audio));
  }, [settings.audio]);

  return null;
}
