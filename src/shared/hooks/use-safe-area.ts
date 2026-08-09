import { useEffect } from "react";
import { androidHost } from "@/shared/lib/platform";

/**
 * Bridges the Android window insets onto CSS custom properties so the layout
 * can reason about system bars the same way it reasons about any other gutter.
 *
 * On desktop nothing publishes insets and the variables keep the `0px` default
 * declared in App.css, so every consumer can use them unconditionally.
 */

type Insets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const VARIABLES: Record<keyof Insets, string> = {
  top: "--safe-area-top",
  right: "--safe-area-right",
  bottom: "--safe-area-bottom",
  left: "--safe-area-left",
};

function apply(insets: Partial<Insets>) {
  const root = document.documentElement;
  for (const [edge, variable] of Object.entries(VARIABLES)) {
    const value = insets[edge as keyof Insets];
    if (typeof value === "number" && Number.isFinite(value)) {
      root.style.setProperty(variable, `${value}px`);
    }
  }
}

export function useSafeArea() {
  useEffect(() => {
    // Pull first: the activity's first inset dispatch normally happens before
    // this document exists, so the pushed event alone would leave the very
    // first paint unpadded.
    const host = androidHost();
    if (host) {
      try {
        apply(JSON.parse(host.insets()) as Insets);
      } catch (error) {
        console.warn("[SafeArea] Failed to read Android insets:", error);
      }
    }

    // Then follow changes: rotation, a keyboard opening, a cutout appearing.
    const handleInsets = (event: Event) => {
      const detail = (event as CustomEvent<Insets>).detail;
      if (detail) apply(detail);
    };

    window.addEventListener("android-insets", handleInsets);
    return () => {
      window.removeEventListener("android-insets", handleInsets);
    };
  }, []);
}
