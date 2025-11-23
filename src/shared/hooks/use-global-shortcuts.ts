import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface UseGlobalShortcutsOptions {
  quickQuery: string;
  newQuery: string;
  enabled: boolean;
  onQuickQuery: (text: string) => void;
  onNewQuery: () => void;
}

export function useGlobalShortcuts({
  quickQuery,
  newQuery,
  enabled,
  onQuickQuery,
  onNewQuery,
}: UseGlobalShortcutsOptions) {
  useEffect(() => {
    // Setup shortcuts on mount and when shortcuts change
    const setupShortcuts = async () => {
      try {
        await invoke("setup_shortcuts", {
          quickQuery,
          newQuery,
          enabled,
        });
      } catch (error) {
        console.error("Failed to setup shortcuts:", error);
      }
    };

    setupShortcuts();
  }, [quickQuery, newQuery, enabled]);

  useEffect(() => {
    // Listen for quick-query event (clipboard text)
    const unlisten = listen<string>("quick-query", (event) => {
      onQuickQuery(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onQuickQuery]);

  useEffect(() => {
    // Listen for new-query event (focus search box)
    const unlisten = listen("new-query", () => {
      onNewQuery();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onNewQuery]);
}
