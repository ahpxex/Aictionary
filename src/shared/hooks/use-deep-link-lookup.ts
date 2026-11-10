import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import {
  parseLookupUrl,
  type LookupUrlInvalidReason,
} from "@/shared/lib/lookup-url";

type DeepLinkLookupOptions = {
  /**
   * Whether a lookup may run yet. Links that arrive earlier - typically the
   * one that launched the app - are held until this turns true.
   */
  ready: boolean;
  onLookup: (word: string) => void;
  onInvalid: (reason: LookupUrlInvalidReason) => void;
};

type Pending =
  | { kind: "lookup"; word: string }
  | { kind: "invalid"; reason: LookupUrlInvalidReason };

/**
 * Turns `aictionary://lookup?word=...` links into lookups in this window.
 *
 * A link reaches the app one of two ways. If it launched the app, it was
 * delivered before any JavaScript ran and is only available from
 * `getCurrent()`. If the app was already running, it arrives as an event.
 * Both are read here, the listener first so nothing slips between the two;
 * once an event has been seen, the launch URL is stale and is ignored, which
 * also keeps one link from being looked up twice.
 *
 * Only the latest link in a batch counts: the user asked for that word last.
 */
export function useDeepLinkLookup({
  ready,
  onLookup,
  onInvalid,
}: DeepLinkLookupOptions) {
  const [pending, setPending] = useState<Pending | null>(null);

  // The callbacks change identity every render; the listeners should not
  // re-subscribe because of it, so they read the latest ones from here.
  const handlersRef = useRef({ onLookup, onInvalid });
  useEffect(() => {
    handlersRef.current = { onLookup, onInvalid };
  });

  useEffect(() => {
    // The browser preview of the frontend has no Tauri host to ask.
    if (!isTauri()) {
      return;
    }

    let disposed = false;
    let sawEvent = false;
    let unlisten: (() => void) | null = null;

    const accept = (urls: string[] | null) => {
      const latest = latestAddressedToUs(urls);
      if (latest && !disposed) {
        setPending(latest);
      }
    };

    void (async () => {
      try {
        const stop = await onOpenUrl((urls) => {
          sawEvent = true;
          accept(urls);
        });
        if (disposed) {
          stop();
          return;
        }
        unlisten = stop;

        const launchUrls = await getCurrent();
        if (!sawEvent) {
          accept(launchUrls);
        }
      } catch (error) {
        console.warn("Failed to read aictionary:// links:", error);
      }
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!ready || !pending) {
      return;
    }

    setPending(null);
    if (pending.kind === "lookup") {
      handlersRef.current.onLookup(pending.word);
    } else {
      handlersRef.current.onInvalid(pending.reason);
    }
  }, [pending, ready]);
}

function latestAddressedToUs(urls: string[] | null): Pending | null {
  for (const url of [...(urls ?? [])].reverse()) {
    const parsed = parseLookupUrl(url);
    if (parsed.kind !== "foreign") {
      return parsed;
    }
  }
  return null;
}
