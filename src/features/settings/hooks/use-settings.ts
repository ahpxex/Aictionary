import { useAtom } from "jotai";
import { useCallback, useMemo } from "react";
import { defaultSettings, settingsAtom } from "@/shared/state/settings";
import { AppSettings, ThemePreference } from "@/shared/types/settings";

export function useSettings() {
  const [storedSettings, setSettings] = useAtom(settingsAtom);

  const mergeWithDefaults = useCallback(
    (current: AppSettings): AppSettings => ({
      ...defaultSettings,
      ...current,
      theme: { ...defaultSettings.theme, ...current.theme },
      llm: { ...defaultSettings.llm, ...current.llm },
      dictionary: { ...defaultSettings.dictionary, ...current.dictionary },
      keyboard: { ...defaultSettings.keyboard, ...current.keyboard },
      about: { ...defaultSettings.about, ...current.about },
      system: { ...defaultSettings.system, ...current.system },
    }),
    []
  );

  const settings = useMemo<AppSettings>(
    () => mergeWithDefaults(storedSettings),
    [mergeWithDefaults, storedSettings]
  );

  const updateSettings = useCallback(
    (updater: (current: AppSettings) => AppSettings) => {
      setSettings((current) => updater(mergeWithDefaults(current)));
    },
    [mergeWithDefaults, setSettings]
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

  const updateSystem = useCallback(
    (
      changes:
        | Partial<AppSettings["system"]>
        | ((prev: AppSettings["system"]) => AppSettings["system"])
    ) => {
      updateSettings((current) => ({
        ...current,
        system:
          typeof changes === "function"
            ? changes(current.system)
            : { ...current.system, ...changes },
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
    updateSystem,
  };
}
