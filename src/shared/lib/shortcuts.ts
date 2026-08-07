/**
 * Accelerators are persisted in a portable form so one settings blob stays
 * meaningful on every platform: `Mod` is the primary accelerator (Command on
 * macOS, Control elsewhere), while `Ctrl` and `Super` name the literal keys.
 * The Rust side resolves these tokens again in `shortcuts.rs` before handing
 * them to the global shortcut plugin.
 */

/** Tokens that only qualify a shortcut rather than being its main key. */
const MODIFIER_TOKENS = new Set(["Mod", "Ctrl", "Super", "Alt", "Shift"]);

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

/** Symbols macOS users expect to see; other platforms spell things out. */
const MAC_LABELS: Record<string, string> = {
  Mod: "⌘",
  Super: "⌘",
  Ctrl: "⌃",
  Alt: "⌥",
  Shift: "⇧",
  Enter: "↩",
  Escape: "⎋",
  Tab: "⇥",
  Backspace: "⌫",
  Delete: "⌦",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

const OTHER_LABELS: Record<string, string> = {
  Mod: "Ctrl",
  Super: "Win",
  Ctrl: "Ctrl",
  Alt: "Alt",
  Shift: "Shift",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

/** Render one stored token the way the current platform writes it. */
export function formatShortcutToken(token: string, isMac = isMacPlatform()): string {
  const trimmed = token.trim();
  if (!trimmed) {
    return "Space";
  }
  const labels = isMac ? MAC_LABELS : OTHER_LABELS;
  return labels[trimmed] ?? trimmed;
}

/** Split a stored accelerator into platform-appropriate display tokens. */
export function formatShortcut(value: string, isMac = isMacPlatform()): string[] {
  if (!value.trim()) {
    return [];
  }
  return value.split("+").map((token) => formatShortcutToken(token, isMac));
}

/**
 * Derive the main (non-modifier) token from a keyboard event.
 *
 * `event.code` is used rather than `event.key` because the latter reports the
 * character the modifiers produced - Alt+K on macOS arrives as "˚", which no
 * hotkey parser accepts. Codes such as `Enter`, `Space`, `ArrowUp` or
 * `BracketLeft` pass straight through; letters and digits are shortened to
 * the bare character. Returns null while only modifiers are held.
 */
export function mainKeyFromEvent(event: {
  code: string;
  key: string;
}): string | null {
  if (["Control", "Meta", "Shift", "Alt", "CapsLock"].includes(event.key)) {
    return null;
  }

  const { code } = event;
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3);
  }
  if (/^Digit[0-9]$/.test(code)) {
    return code.slice(5);
  }
  if (code === "NumpadEnter") {
    return "Enter";
  }
  if (code) {
    return code;
  }

  // Virtual keyboards and IME input can leave `code` empty; fall back to the
  // character itself so the field is not simply unusable there.
  return event.key === " " ? "Space" : event.key.toUpperCase();
}

/**
 * Build the stored accelerator for a keypress, or null when the user is
 * still only holding modifiers.
 */
export function shortcutFromEvent(
  event: { code: string; key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean },
  isMac = isMacPlatform()
): string | null {
  const mainKey = mainKeyFromEvent(event);
  if (!mainKey || MODIFIER_TOKENS.has(mainKey)) {
    return null;
  }

  const tokens: string[] = [];
  // Command and Control are distinct keys; conflating them made it impossible
  // to bind a real Control shortcut on macOS.
  if (isMac ? event.metaKey : event.ctrlKey) {
    tokens.push("Mod");
  }
  if (isMac ? event.ctrlKey : event.metaKey) {
    tokens.push(isMac ? "Ctrl" : "Super");
  }
  if (event.altKey) {
    tokens.push("Alt");
  }
  if (event.shiftKey) {
    tokens.push("Shift");
  }
  tokens.push(mainKey);

  return tokens.join("+");
}
