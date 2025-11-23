import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { defaultSettings, settingsAtom } from "@/shared/state/settings";
import { setRuntimeAnkiSettings } from "@/shared/state/anki-runtime";

export function AnkiSync() {
  const settings = useAtomValue(settingsAtom);

  useEffect(() => {
    const merged = {
      ...defaultSettings.anki,
      ...(settings.anki ?? {}),
    };
    setRuntimeAnkiSettings(merged);
  }, [settings.anki]);

  return null;
}
