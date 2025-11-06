import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { useTheme } from "next-themes";
import { settingsAtom } from "@/shared/state/settings";

export function AppearanceSync() {
  const settings = useAtomValue(settingsAtom);
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme(settings.theme.mode);
  }, [settings.theme.mode, setTheme]);

  useEffect(() => {
    document.documentElement.dataset.accent = settings.theme.accent;
  }, [settings.theme.accent]);

  return null;
}

