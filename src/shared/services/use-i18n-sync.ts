import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/features/settings/hooks/use-settings";

export function useI18nSync() {
  const { i18n } = useTranslation();
  const { settings } = useSettings();

  useEffect(() => {
    if (settings.language !== i18n.language) {
      i18n.changeLanguage(settings.language);
    }
  }, [settings.language, i18n]);
}
