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
    const appWindow = getCurrentWindow();

    // The native frame the compositor draws around the window - its border,
    // titlebar and traffic lights - is painted from the platform appearance,
    // which otherwise tracks the system setting and clashes with an app theme
    // the user pinned the other way. Drive it from our own theme instead, and
    // hand control back to the platform when the user chose "system".
    appWindow
      .setTheme(settings.theme.mode === "system" ? null : mode)
      .catch((error) => {
        console.warn("Failed to sync window appearance", error);
      });

    appWindow.setBackgroundColor(WINDOW_BACKGROUND[mode]).catch((error) => {
      console.warn("Failed to sync window background color", error);
    });
  }, [resolvedTheme, settings.theme.mode]);

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

