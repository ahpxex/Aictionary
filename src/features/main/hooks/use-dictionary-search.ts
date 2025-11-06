import { useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";
import { toast } from "sonner";
import {
  currentResultAtom,
  isSearchingAtom,
  queryHistoryAtom,
  setCurrentResultAtom,
} from "@/shared/state/dictionary";
import { queryDictionary } from "@/shared/services/dictionary-service";

export function useDictionarySearch() {
  const [isSearching, setIsSearching] = useAtom(isSearchingAtom);
  const [history] = useAtom(queryHistoryAtom);
  const [result] = useAtom(currentResultAtom);
  const setResult = useSetAtom(setCurrentResultAtom);

  const search = useCallback(
    async (word: string) => {
      const normalized = word.trim();
      if (!normalized) {
        toast.error("Please enter a word to search.");
        return;
      }

      setIsSearching(true);
      try {
        const definition = await queryDictionary(normalized);
        setResult({ result: definition, word: normalized });
      } catch (error) {
        console.error(error);
        toast.error("Unable to query the dictionary. Please try again later.");
      } finally {
        setIsSearching(false);
      }
    },
    [setResult, setIsSearching]
  );

  const clear = useCallback(() => {
    setResult({ result: null });
  }, [setResult]);

  return {
    isSearching,
    history,
    result,
    search,
    clear,
  };
}

