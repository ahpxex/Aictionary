import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { settingsAtom } from "@/shared/state/settings";
import { setRuntimeAnkiSettings } from "@/shared/state/anki-runtime";

export function AnkiSync() {
  const settings = useAtomValue(settingsAtom);

  useEffect(() => {
    setRuntimeAnkiSettings(settings.anki);
  }, [settings.anki]);

  return null;
}
