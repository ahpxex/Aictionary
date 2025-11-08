import { useAtom } from "jotai";
import { useCallback } from "react";
import { settingsAtom } from "@/shared/state/settings";
import { AppSettings, ThemePreference } from "@/shared/types/settings";

export function useSettings() {
  const [settings, setSettings] = useAtom(settingsAtom);

  const updateSettings = useCallback(
    (updater: (current: AppSettings) => AppSettings) => {
      setSettings((current) => updater(current));
    },
    [setSettings]
  );

  const updateTheme = useCallback(
    (changes: Partial<ThemePreference>) => {
      updateSettings((current) => ({
        ...current,
        theme: { ...current.theme, ...changes },
      }));
    },
    [updateSettings]
  );

  const updateLlm = useCallback(
    (
      changes: Partial<AppSettings["llm"]> | ((prev: AppSettings["llm"]) => AppSettings["llm"])
    ) => {
      updateSettings((current) => ({
        ...current,
        llm:
          typeof changes === "function"
            ? changes(current.llm)
            : { ...current.llm, ...changes },
      }));
    },
    [updateSettings]
  );

  const updateDictionary = useCallback(
    (
      changes:
        | Partial<AppSettings["dictionary"]>
        | ((prev: AppSettings["dictionary"]) => AppSettings["dictionary"])
    ) => {
      updateSettings((current) => ({
        ...current,
        dictionary:
          typeof changes === "function"
            ? changes(current.dictionary)
            : { ...current.dictionary, ...changes },
      }));
    },
    [updateSettings]
  );

  const updateKeyboard = useCallback(
    (
      changes:
        | Partial<AppSettings["keyboard"]>
        | ((prev: AppSettings["keyboard"]) => AppSettings["keyboard"])
    ) => {
      updateSettings((current) => ({
        ...current,
        keyboard:
          typeof changes === "function"
            ? changes(current.keyboard)
            : { ...current.keyboard, ...changes },
      }));
    },
    [updateSettings]
  );

  const updateLanguage = useCallback(
    (language: AppSettings["language"]) => {
      updateSettings((current) => ({
        ...current,
        language,
      }));
    },
    [updateSettings]
  );

  return {
    settings,
    updateSettings,
    updateTheme,
    updateLlm,
    updateDictionary,
    updateKeyboard,
    updateLanguage,
  };
}

