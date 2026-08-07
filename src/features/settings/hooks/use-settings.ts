import { useAtom } from "jotai";
import { useCallback, useMemo } from "react";
import {
  defaultSettings,
  normalizeAudioSettings,
  normalizeKeyboardSettings,
  normalizeLlmSettings,
  settingsAtom,
} from "@/shared/state/settings";
import {
  AppSettings,
  AudioSettings,
  ThemePreference,
} from "@/shared/types/settings";

function normalizeCardTheme(value?: AppSettings["anki"]["cardTheme"]) {
  return value === "dark" ? "dark" : "light";
}

export function useSettings() {
  const [storedSettings, setSettings] = useAtom(settingsAtom);

  const mergeWithDefaults = useCallback(
    (current: Partial<AppSettings>): AppSettings => ({
      ...defaultSettings,
      ...current,
      theme: { ...defaultSettings.theme, ...(current.theme ?? {}) },
      audio: normalizeAudioSettings(current.audio),
      anki: {
        ...defaultSettings.anki,
        ...(current.anki ?? {}),
        cardTheme: normalizeCardTheme(current.anki?.cardTheme),
      },
      dictionary: { ...defaultSettings.dictionary, ...(current.dictionary ?? {}) },
      keyboard: normalizeKeyboardSettings(current.keyboard),
      llm: normalizeLlmSettings(current.llm),
      about: { ...defaultSettings.about, ...(current.about ?? {}) },
      system: { ...defaultSettings.system, ...(current.system ?? {}) },
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

  const updateAudio = useCallback(
    (
      changes:
        | Partial<AudioSettings>
        | ((prev: AudioSettings) => AudioSettings)
    ) => {
      updateSettings((current) => ({
        ...current,
        audio:
          typeof changes === "function"
            ? changes(current.audio)
            : { ...current.audio, ...changes },
      }));
    },
    [updateSettings]
  );

  const updateAnki = useCallback(
    (
      changes:
        | Partial<AppSettings["anki"]>
        | ((prev: AppSettings["anki"]) => AppSettings["anki"])
    ) => {
      updateSettings((current) => ({
        ...current,
        anki:
          typeof changes === "function"
            ? changes(current.anki)
            : { ...current.anki, ...changes },
      }));
    },
    [updateSettings]
  );

  return {
    settings,
    updateSettings,
    updateTheme,
    updateLlm,
    updateAudio,
    updateAnki,
    updateDictionary,
    updateKeyboard,
    updateLanguage,
    updateSystem,
  };
}
