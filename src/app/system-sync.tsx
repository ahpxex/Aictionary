import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { setDockVisibility } from "@tauri-apps/api/app";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { useSettings } from "@/features/settings/hooks/use-settings";

/**
 * Bridges persisted settings to platform-specific behaviour:
 * - Toggles the native tray icon visibility.
 * - Keeps the OS-level autostart registration in sync with user preference.
 * - Controls dock / taskbar visibility when the tray is enabled.
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

  // Keep dock / taskbar visibility in sync with settings.
  useEffect(() => {
    const applyDockOrTaskbarVisibility = async () => {
      const visible = settings.system.dockOrTaskbarVisible;

      try {
        // macOS: control dock visibility via Tauri app API.
        await setDockVisibility(visible);
      } catch (error) {
        // Non-mac platforms may throw or no-op here; log and continue.
        console.warn("[SystemSync] Failed to update dock visibility:", error);
      }

      try {
        // Windows / Linux (where supported): hide from taskbar when we have a tray.
        const window = getCurrentWebviewWindow();
        await window.setSkipTaskbar(!visible && settings.system.trayIconEnabled);
      } catch (error) {
        // Some platforms or window managers may not support this.
        console.warn("[SystemSync] Failed to update taskbar visibility:", error);
      }
    };

    void applyDockOrTaskbarVisibility();
  }, [settings.system.dockOrTaskbarVisible, settings.system.trayIconEnabled]);

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
