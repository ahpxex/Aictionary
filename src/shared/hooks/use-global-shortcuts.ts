import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** Why the synthetic copy behind a quick query did not happen. */
export type CopyFailure = "permission_denied" | "unavailable";

export type QuickQueryPayload = {
  /** Text to look up; null when the clipboard held nothing usable. */
  text: string | null;
  copyError: CopyFailure | null;
};

/** Per-shortcut registration outcome reported by `setup_shortcuts`. */
export type ShortcutSetupReport = {
  quickQueryError: string | null;
  newQueryError: string | null;
};

interface UseGlobalShortcutsOptions {
  quickQuery: string;
  newQuery: string;
  enabled: boolean;
  onQuickQuery: (payload: QuickQueryPayload) => void;
  onNewQuery: () => void;
  /** Called after every registration attempt, including the failures. */
  onSetupReport?: (report: ShortcutSetupReport) => void;
}

export function useGlobalShortcuts({
  quickQuery,
  newQuery,
  enabled,
  onQuickQuery,
  onNewQuery,
  onSetupReport,
}: UseGlobalShortcutsOptions) {
  // Callers pass inline closures, so their identity changes on every render.
  // Depending on them directly would tear down and re-register the Tauri
  // listeners each time - and because registration crosses the IPC boundary
  // asynchronously, every one of those cycles left a window in which an
  // emitted event had nobody listening and was dropped silently.
  const handlers = useRef({ onQuickQuery, onNewQuery, onSetupReport });

  useEffect(() => {
    handlers.current = { onQuickQuery, onNewQuery, onSetupReport };
  });

  useEffect(() => {
    let cancelled = false;

    const setupShortcuts = async () => {
      try {
        const report = await invoke<ShortcutSetupReport>("setup_shortcuts", {
          quickQuery,
          newQuery,
          enabled,
        });
        if (!cancelled) {
          handlers.current.onSetupReport?.(report);
        }
      } catch (error) {
        console.error("Failed to setup shortcuts:", error);
        if (!cancelled) {
          const message = String(error);
          handlers.current.onSetupReport?.({
            quickQueryError: message,
            newQueryError: message,
          });
        }
      }
    };

    void setupShortcuts();

    return () => {
      cancelled = true;
    };
  }, [quickQuery, newQuery, enabled]);

  // Registered once for the lifetime of the app: the ref above keeps the
  // callbacks current without re-subscribing.
  useEffect(() => {
    const pending = listen<QuickQueryPayload>("quick-query", (event) => {
      handlers.current.onQuickQuery(event.payload);
    });

    // Chaining off the promise also covers unmounting before registration
    // has finished crossing the IPC boundary.
    return () => {
      void pending.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    const pending = listen("new-query", () => {
      handlers.current.onNewQuery();
    });

    return () => {
      void pending.then((unlisten) => unlisten());
    };
  }, []);
}
