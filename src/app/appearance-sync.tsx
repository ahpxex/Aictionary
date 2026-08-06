import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { settingsAtom } from "@/shared/state/settings";

/**
 * The titlebar is styled Transparent, so it shows the NSWindow background
 * instead of the blurred system material. Keep that background in sync with
 * the page theme; values mirror --background in App.css (white and
 * oklch(0.145 0 0) = #0a0a0a).
 */
const WINDOW_BACKGROUND: Record<"light" | "dark", [number, number, number]> = {
  light: [255, 255, 255],
  dark: [10, 10, 10],
};

export function AppearanceSync() {
  const settings = useAtomValue(settingsAtom);
  const { setTheme, resolvedTheme } = useTheme();
  const { i18n } = useTranslation();

  useEffect(() => {
    setTheme(settings.theme.mode);
  }, [settings.theme.mode, setTheme]);

  useEffect(() => {
    const mode = resolvedTheme === "dark" ? "dark" : "light";
    getCurrentWindow()
      .setBackgroundColor(WINDOW_BACKGROUND[mode])
      .catch((error) => {
        console.warn("Failed to sync window background color", error);
      });
  }, [resolvedTheme]);

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

