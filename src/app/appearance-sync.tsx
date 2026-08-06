import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { settingsAtom } from "@/shared/state/settings";

export function AppearanceSync() {
  const settings = useAtomValue(settingsAtom);
  const { setTheme } = useTheme();
  const { i18n } = useTranslation();

  useEffect(() => {
    setTheme(settings.theme.mode);
  }, [settings.theme.mode, setTheme]);

  // Accent personalization was removed; clear the attribute left behind by
  // older versions so their CSS no longer applies.
  useEffect(() => {
    delete document.documentElement.dataset.accent;
  }, []);

  useEffect(() => {
    if (settings.language !== i18n.language) {
      i18n.changeLanguage(settings.language);
    }
  }, [settings.language, i18n]);

  return null;
}

