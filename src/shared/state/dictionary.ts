import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { DictionaryLookupResult, QueryRecord } from "@/shared/types/dictionary";

export const currentResultAtom = atom<DictionaryLookupResult | null>(null);
export const isSearchingAtom = atom(false);
export const isGeneratingFromLlmAtom = atom(false);
export const generatingModelAtom = atom<string | null>(null);

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
