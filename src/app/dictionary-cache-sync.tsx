import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettings } from "@/features/settings/hooks/use-settings";

/**
 * Ensures the dictionary cache path is populated once when the app boots.
 * Without this, lookups run before the user opens the settings page fall
 * back to the mock definition because the cache path stays empty.
 */
export function DictionaryCacheSync() {
  const { settings, updateDictionary } = useSettings();
  const isInitializingRef = useRef(false);

  useEffect(() => {
    if (settings.dictionary.cachePath || isInitializingRef.current) {
      return;
    }

    isInitializingRef.current = true;
    let cancelled = false;

    const initializePath = async () => {
      try {
        const defaultPath = await invoke<string>("get_default_dictionary_path");
        if (cancelled || !defaultPath) {
          return;
        }

        updateDictionary((prev) => {
          if (prev.cachePath) {
            return prev;
          }
          return {
            ...prev,
            cachePath: defaultPath,
          };
        });
      } catch (error) {
        console.warn("Failed to initialize dictionary cache path:", error);
      } finally {
        isInitializingRef.current = false;
      }
    };

    void initializePath();

    return () => {
      cancelled = true;
    };
  }, [settings.dictionary.cachePath, updateDictionary]);

  return null;
}
