import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { DictionaryLookupResult, QueryRecord } from "@/shared/types/dictionary";
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
