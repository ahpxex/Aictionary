/**
 * Which host the webview is embedded in.
 *
 * This is deliberately not a viewport question. A desktop window dragged
 * narrow still has a tray, a dock and a login item; a phone has none of them
 * however wide the screen is. Layout responds to `md:`, platform-only features
 * respond to this.
 *
 * The signal is the Kotlin bridge MainActivity injects, so it is synchronous
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
  }
}

export function androidHost(): AndroidHost | undefined {
  return typeof window === "undefined" ? undefined : window.AndroidHost;
}

/** True only inside the Android app; false on macOS, Windows and Linux. */
export function isMobileHost(): boolean {
  return androidHost() !== undefined;
}
