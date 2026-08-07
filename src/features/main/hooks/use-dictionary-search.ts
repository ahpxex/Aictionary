import { useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  currentResultAtom,
  isSearchingAtom,
  queryHistoryAtom,
  setCurrentResultAtom,
} from "@/shared/state/dictionary";
import { settingsAtom } from "@/shared/state/settings";
import {
  queryDictionary,
  DictionaryQueryError,
} from "@/shared/services/dictionary-service";

export function useDictionarySearch() {
  const { t } = useTranslation();
  const [isSearching, setIsSearching] = useAtom(isSearchingAtom);
  const [history] = useAtom(queryHistoryAtom);
  const [result] = useAtom(currentResultAtom);
  const setResult = useSetAtom(setCurrentResultAtom);
  const [settings] = useAtom(settingsAtom);

  const search = useCallback(
    async (word: string) => {
      const normalized = word.trim();
      if (!normalized) {
        toast.error(t("main.search.empty_error"));
        return;
      }

      setIsSearching(true);
      try {
        const definition = await queryDictionary(
          normalized,
          settings.dictionary.cachePath
        );
        setResult({ result: definition, word: normalized });
      } catch (error) {
        // The distributed dictionary is the only source of entries, so a miss
        // is final: report it and leave the previous result alone.
        if (
          error instanceof DictionaryQueryError &&
          error.code === "NOT_FOUND"
        ) {
          toast.error(t("main.search.not_found", { word: normalized }));
          return;
        }

        console.error(error);
        const fallbackMessage =
          error instanceof DictionaryQueryError
            ? error.message
            : t("main.errors.dictionary");
        toast.error(fallbackMessage);
      } finally {
        setIsSearching(false);
      }
    },
    [setResult, setIsSearching, settings.dictionary.cachePath, t]
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
