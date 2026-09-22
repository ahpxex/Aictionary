/**
 * Which host the webview is embedded in.
 *
 * This is deliberately not a viewport question. A desktop window dragged
 * narrow still has a tray, a dock and a login item; a phone has none of them
 * however wide the screen is. Layout responds to `md:`, platform-only features
 * respond to this.
 *
 * The signals are native initialization bridges, so they are synchronous
 * and available on the very first render - a Tauri command would resolve a
 * frame or two late and flash desktop-only settings on a phone.
 */

type AndroidHost = {
  /** JSON-encoded system-bar insets in CSS pixels. */
  insets: () => string;
};

declare global {
  interface Window {
    /** Injected by MainActivity on Android; absent on every other host. */
    AndroidHost?: AndroidHost;
    /** Installed at document creation by the iOS host plugin. */
    AictionaryHost?: { readonly platform: "ios" };
  }
}

export function androidHost(): AndroidHost | undefined {
  return typeof window === "undefined" ? undefined : window.AndroidHost;
}

export function isIosHost(): boolean {
  return typeof window !== "undefined" && window.AictionaryHost?.platform === "ios";
}

/** A native phone/tablet host, independent of window width or user agent. */
export function isMobileHost(): boolean {
  return isIosHost() || androidHost() !== undefined;
}
