/**
 * The `aictionary://` URL scheme other apps use to open a word's entry.
 *
 *   aictionary://lookup?word=serendipity
 *
 * Shortcuts, scripts, browser links and other apps build these, so parsing
 * is lenient about spelling (`aictionary:lookup?word=`, a trailing slash, any
 * letter case in the scheme and action) and strict about meaning: anything
 * that is not a lookup with a usable word is rejected rather than guessed at.
 */

export const LOOKUP_URL_SCHEME = "aictionary";

/**
 * Upper bound on a linked query, in characters.
 *
 * A word or phrase is far shorter. The bound exists because any app or web
 * page can open a link, and a long query that misses the dictionary goes to
 * the user's configured model at the user's expense.
 */
export const MAX_LOOKUP_URL_WORD_LENGTH = 100;

export type LookupUrlParseResult =
  | { kind: "lookup"; word: string }
  /** Recognizably ours, but unusable: unknown action, missing or bad word. */
  | { kind: "invalid"; reason: LookupUrlInvalidReason }
  /** Some other scheme entirely; not addressed to us. */
  | { kind: "foreign" };

export type LookupUrlInvalidReason =
  | "malformed"
  | "unknown_action"
  | "missing_word"
  | "word_too_long";

// C0/C1 controls, plus the line and paragraph separators. A lookup is a
// single line typed into the query bar, so none of them belong in one.
const CONTROL_CHARACTERS = /[\p{Cc}\u2028\u2029]/gu;

export function parseLookupUrl(raw: string): LookupUrlParseResult {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    // Without a parseable scheme we cannot tell whose link this was.
    return raw.trim().toLowerCase().startsWith(`${LOOKUP_URL_SCHEME}:`)
      ? { kind: "invalid", reason: "malformed" }
      : { kind: "foreign" };
  }

  if (url.protocol.toLowerCase() !== `${LOOKUP_URL_SCHEME}:`) {
    return { kind: "foreign" };
  }

  // `aictionary://lookup?…` puts the action in the host; the slashless
  // `aictionary:lookup?…` puts it in the path. Hosts of non-special schemes
  // keep their case, so normalize here.
  const host = url.hostname.toLowerCase();
  const path = url.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
  const action = host || path;
  const extraPath = host ? path : "";

  if (action !== "lookup" || extraPath !== "") {
    return { kind: "invalid", reason: "unknown_action" };
  }

  const word = (url.searchParams.get("word") ?? "")
    .replace(CONTROL_CHARACTERS, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!word) {
    return { kind: "invalid", reason: "missing_word" };
  }

  // Count code points, not UTF-16 units, so CJK and emoji are not penalized.
  if (Array.from(word).length > MAX_LOOKUP_URL_WORD_LENGTH) {
    return { kind: "invalid", reason: "word_too_long" };
  }

  return { kind: "lookup", word };
}
