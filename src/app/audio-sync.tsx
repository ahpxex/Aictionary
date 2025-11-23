import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { settingsAtom } from "@/shared/state/settings";
import { setRuntimeAudioSettings } from "@/shared/state/audio-runtime";

export function AudioSync() {
  const settings = useAtomValue(settingsAtom);

  useEffect(() => {
    setRuntimeAudioSettings(settings.audio);
  }, [settings.audio]);

  return null;
}
