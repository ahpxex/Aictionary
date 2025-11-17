import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { disable as disableAutostart, enable as enableAutostart, isEnabled as isAutostartEnabled } from "@tauri-apps/plugin-autostart";
import { useSettings } from "@/features/settings/hooks/use-settings";

/**
 * Bridges persisted settings to platform-specific behaviour:
 * - Toggles the native tray icon visibility.
 * - Keeps the OS-level autostart registration in sync with user preference.
 */
export function SystemSync() {
  const { settings, updateSystem } = useSettings();
  const [autostartInitialized, setAutostartInitialized] = useState(false);

  // Keep the tray icon visibility in sync with the settings.
  useEffect(() => {
    const applyTrayVisibility = async () => {
      try {
        await invoke("set_tray_visibility", {
          visible: settings.system.trayIconEnabled,
        });
      } catch (error) {
        // In development or on unsupported platforms this may fail; log and continue.
        console.warn("[SystemSync] Failed to update tray visibility:", error);
      }
    };

    void applyTrayVisibility();
  }, [settings.system.trayIconEnabled]);

  // On first load, hydrate the autostart flag from the OS so that settings
  // reflect the real registration state.
  useEffect(() => {
    let cancelled = false;

    const syncInitialAutostart = async () => {
      try {
        const enabled = await isAutostartEnabled();
        if (cancelled) return;

        if (enabled !== settings.system.launchOnSystemStart) {
          updateSystem((prev) => ({
            ...prev,
            launchOnSystemStart: enabled,
          }));
        }
      } catch (error) {
        console.warn("[SystemSync] Failed to query autostart state:", error);
      } finally {
        if (!cancelled) {
          setAutostartInitialized(true);
        }
      }
    };

    if (!autostartInitialized) {
      void syncInitialAutostart();
    }

    return () => {
      cancelled = true;
    };
  }, [autostartInitialized, settings.system.launchOnSystemStart, updateSystem]);

  // Apply changes from settings to OS after the initial state has been hydrated.
  useEffect(() => {
    if (!autostartInitialized) return;

    const applyAutostart = async () => {
      try {
        if (settings.system.launchOnSystemStart) {
          await enableAutostart();
        } else {
          await disableAutostart();
        }
      } catch (error) {
        console.warn("[SystemSync] Failed to update autostart:", error);
      }
    };

    void applyAutostart();
  }, [autostartInitialized, settings.system.launchOnSystemStart]);

  return null;
}

