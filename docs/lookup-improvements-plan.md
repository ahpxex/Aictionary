# Lookup Improvements Plan

This document turns the requested Popup, dual-channel query, and live
suggestion behavior into an implementation plan grounded in the current Tauri
2 + React + Rust architecture.

## Current baseline

- The main UI is `src/features/main`; its search flow is
  `src/features/main/hooks/use-dictionary-search.ts`.
- Offline forward and reverse lookup are Tauri commands in
  `src-tauri/src/dictionary/commands.rs`, backed by SQLite.
- The current dictionary miss path invokes the OpenAI-compatible LLM service
  in `src/shared/services/llm-service.ts` and can persist a generated entry.
- The tray is created in `src-tauri/src/tray.rs`. A left click currently opens
  the tray menu; the existing main window is configured in
  `src-tauri/tauri.conf.json`.
- There are currently no focused `test` or `spec` files, so the first slice
  should establish a lightweight test strategy for pure routing and ranking
  functions.

## Product principles

### 1. Choose by user intent, not by network availability

The query shape is the first signal:

| Input | Default channel | Expected behavior |
| --- | --- | --- |
| One word, inflected word, abbreviation, proper noun | Local dictionary | Fast, private, offline. Show compact or full entry. |
| Short dictionary phrase, idiom, phrasal verb | Local dictionary | Preserve spaces and punctuation; use forward lookup. |
| Sentence, clause, or multi-sentence text | Microsoft Translator | Show source text, translated text, loading and failure states. |

Recommended deterministic classifier rules:

1. Normalize Unicode whitespace without changing the text displayed to the
   user.
2. Treat input with sentence punctuation (`.`, `?`, `!`, `;`) or two or more
   clauses as sentence-like, unless it is a known dictionary phrase ending in
   punctuation.
3. Treat input with several whitespace-separated tokens and a finite verb,
   pronoun, or clause connector as sentence-like.
4. Otherwise classify as a word/phrase and use the local dictionary.
5. Keep the thresholds and token patterns in a pure function with table-driven
   tests. The classifier should return a reason/debug code for diagnostics,
   not expose internal scoring to normal users.

The classifier is a product policy, not a claim that English grammar can be
perfectly detected. When uncertain, prefer local lookup for short input because
it is private, fast, and reversible; offer an explicit “Translate this text”
action when the user intended a sentence.

The existing LLM generation remains available only as an explicit “Generate
entry” action after a local miss. It is not part of the default two-channel
router.

## Feature A: lightweight Popup

### Proposed design

Create a dedicated desktop window named `popup` with a small fixed initial size,
transparent title bar, always-on-top behavior where supported, and no tray menu
attached to it. Keep the main window unchanged except for an “Open full result”
event.

Rust responsibilities:

- In `src-tauri/src/tray.rs`, handle tray click events and calculate a safe
  position near the tray icon using the event's icon rectangle and monitor
  bounds.
- Create the Popup once, show/focus it on subsequent clicks, and hide it on
  Escape or close rather than destroying it every time.
- Emit a small `popup-opened` payload only when needed; do not send full
  dictionary documents through tray events.
- Keep all of this under `cfg(desktop)` and preserve the mobile command shape.

Frontend responsibilities:

- Add a dedicated `src/features/popup/` feature with its own page, hook, and
  compact result component.
- Reuse shared query services and types, but map a full
  `DictionaryLookupResult` to a compact view model in a pure helper.
- Render headword, IPA, and at most two core/common meanings. A button opens
  the full result in the main window and focuses it; it must not duplicate the
  complete `EntryView`.

### Acceptance criteria

- Clicking the tray icon shows the Popup adjacent to the icon instead of only
  showing the menu, and a second click reuses the same window.
- The Popup opens quickly with the input focused, supports Enter, Escape, and
  keyboard selection, and does not resize while suggestions/results change.
- A dictionary result contains only the compact fields; the full result opens
  in the main window.
- Closing or hiding the main window does not terminate the tray or Popup.

## Feature B: dual-channel query

### Proposed modules

- `src/shared/lib/query-router.ts`: normalization, classification, and reason
  codes; no I/O.
- `src/shared/types/query.ts`: route, query state, translation result, and
  error types.
- `src/shared/services/translation-service.ts`: Microsoft Translator request
  boundary with timeout, cancellation, response validation, and locale mapping.
- `src-tauri/src/translation.rs`: preferred network boundary for the API call,
  so webview CORS and provider-specific headers stay out of React. Follow the
  existing proxy/network conventions in `src-tauri/src/net.rs`.
- `src/shared/services/query-service.ts`: dispatches to dictionary or
  translation without embedding rendering concerns.

The Microsoft Translator configuration should be explicit in Settings: API
key, region when required, endpoint, and target language. Store it with the
existing persisted settings pattern, redact it in errors, and make the online
route opt-in until credentials are configured. The UI must distinguish “not
configured” from “network failed” and “translation returned no result”.

### Migration detail

Refactor `useDictionarySearch` to call the central query service. Preserve
reverse Chinese lookup as a dictionary-specific path. Remove the current
automatic LLM fallback from the default local miss branch, and expose LLM
generation as a separate action so the dual-channel contract remains true.

### Acceptance criteria

- The same router is used by the main page and Popup.
- Word and phrase queries complete without network access when the local cache
  exists.
- Sentence queries call Microsoft Translator only, with visible progress and a
  recoverable error state.
- No API key or full private query is written to logs.
- Router tests cover empty input, punctuation, phrases, clauses, long input,
  and ambiguous short multi-word input.

## Feature C: live prefix and fuzzy suggestions

### Proposed data path

Add a Tauri command such as `dictionary_suggest` in the dictionary module. It
should search both the distributed and user dictionaries, return a bounded
number of headwords, and avoid returning duplicate normalized headwords.

Ranking should be deterministic:

1. Exact normalized prefix.
2. Prefix after punctuation/diacritic normalization.
3. Small edit distance for short tokens, with a strict distance limit.
4. Frequency/priority if available, then shorter headword and lexical order.

Start with SQLite prefix search plus Rust-side bounded fuzzy ranking. Only add a
precomputed FTS/trigram index if profiling shows that approach is too slow;
the distributed database schema should not be changed speculatively.

In React, add a debounced `use-suggestions` hook. Each request gets a sequence
number or abort mechanism so an older response cannot replace newer results.
The dropdown should expose `aria-activedescendant`, Up/Down navigation, Enter
selection, and an empty state without blocking free-form input.

### Acceptance criteria

- Candidates appear while typing before the query is complete.
- Misspellings can still produce useful candidates, but a typo never triggers
  an automatic network request.
- Results are bounded, stable, deduplicated, and returned quickly from the
  local cache.
- Keyboard and screen-reader behavior works in both the main search form and
  Popup.

## Suggested delivery order

1. **Foundation:** pure query types/router, compact result mapper, shared query
   service interface, and focused tests.
2. **Suggestions:** Rust command plus the shared React hook and dropdown. This
   improves both existing main search and the future Popup.
3. **Popup:** desktop window lifecycle, tray positioning, Popup page, and full
   result handoff.
4. **Translation:** Microsoft Translator settings, Rust network command, UI
   states, and migration of the main/Popup search flows.

The order keeps the highest-risk policy and data contracts testable before
window management and network UX are added.

## Branch strategy

Do not implement all three features in one long-lived branch. They touch shared
query contracts, but they are independently reviewable and have different
failure modes.

Recommended branch layout:

- `feature/lookup-foundation`: router/types/service seams and tests.
- `feature/lookup-suggestions`: branch from foundation; Rust query and shared
  autocomplete UI.
- `feature/lookup-popup`: branch from foundation; Tauri window/tray behavior
  and compact result UI.
- `feature/lookup-translation`: branch from foundation; Microsoft Translator
  settings, backend call, and route integration.

Merge foundation first, then suggestions and Popup in either order. Merge
translation after the router contract is stable. If working alone and review
overhead matters more than parallel development, use one integration branch
with three small commits matching those feature boundaries; the commits, not
the branch count, are the important isolation mechanism.

## Verification checklist

- Frontend: `bun run build`.
- Rust: run `cargo check` from `src-tauri`.
- Unit tests: router, compact mapper, suggestion ranking, and stale-response
  protection.
- Manual macOS checks: tray position on multiple monitor layouts, focus after
  repeated clicks, Popup hide/show lifecycle, keyboard navigation, offline
  local lookup, and translation timeout/credential errors.