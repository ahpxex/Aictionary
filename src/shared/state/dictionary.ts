import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  DictionaryLookupResult,
  QueryRecord,
  ReverseLookupResult,
} from "@/shared/types/dictionary";
import type { GenerationPreview } from "@/shared/services/llm-service";

export const currentResultAtom = atom<DictionaryLookupResult | null>(null);
export const isSearchingAtom = atom(false);
export const isGeneratingFromLlmAtom = atom(false);
export const generatingModelAtom = atom<string | null>(null);
/** The word being generated, shown before the model echoes it back. */
export const generatingWordAtom = atom<string | null>(null);
/** The one-line summary from the fast first pass. */
export const generationSummaryAtom = atom<string | null>(null);
/** Set when the query turned out not to be a word worth an entry. */
export const nonsenseQueryAtom = atom<string | null>(null);
/** The entry taking shape while the model streams it back. */
export const generationPreviewAtom = atom<GenerationPreview | null>(null);
/**
 * A word that missed the dictionary in a lookup the user did not type - an
 * `aictionary://` link - waiting for the user's go-ahead to generate it.
 * Generation spends the user's model quota, and any app or web page can open
 * a link, so only a click inside the app may start it.
 */
export const generationOfferAtom = atom<string | null>(null);
/** Set when a Chinese query produced a candidate list instead of an entry. */
export const reverseLookupAtom = atom<ReverseLookupResult | null>(null);

/**
 * Whether this launch has settled which dictionary directory to read.
 *
 * The persisted path cannot be trusted on the first render: it may be empty
 * on a fresh install, and on iOS it is re-resolved every launch because an
 * update moves the app container. Lookups that start themselves - a link
 * opened from another app - wait for this instead of racing the
 * resolution with a stale path. It also turns true when resolution fails, so
 * such a lookup reports the failure instead of waiting forever.
 */
export const dictionaryPathSettledAtom = atom(false);

export const queryHistoryAtom = atomWithStorage<QueryRecord[]>(
  "aictionary-query-history",
  []
);

export const setCurrentResultAtom = atom(
  null,
  (get, set, payload: { result: DictionaryLookupResult | null; word?: string }) => {
    set(currentResultAtom, payload.result);

    if (payload.result && payload.word) {
      const history = get(queryHistoryAtom);
      const timestamp = new Date().toISOString();
      const updated = [{ word: payload.word, timestamp }, ...history].slice(
        0,
        500
      );
      set(queryHistoryAtom, updated);
    }
  }
);
