import { useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  currentResultAtom,
  isSearchingAtom,
  isGeneratingFromLlmAtom,
  generatingModelAtom,
  generationPreviewAtom,
  generationSummaryAtom,
  nonsenseQueryAtom,
  generatingWordAtom,
  queryHistoryAtom,
  reverseLookupAtom,
  setCurrentResultAtom,
} from "@/shared/state/dictionary";
import {
  resolveActiveLlmProvider,
  settingsAtom,
} from "@/shared/state/settings";
import {
  queryDictionary,
  reverseQueryDictionary,
  DictionaryQueryError,
  writeDictionaryEntry,
} from "@/shared/services/dictionary-service";
import {
  generateEntry,
  hasLlmCredentials,
  LlmServiceError,
} from "@/shared/services/llm-service";

export function useDictionarySearch() {
  const { t } = useTranslation();
  const [isSearching, setIsSearching] = useAtom(isSearchingAtom);
  const [isGeneratingFromLlm, setIsGeneratingFromLlm] = useAtom(isGeneratingFromLlmAtom);
  const [generatingModel, setGeneratingModel] = useAtom(generatingModelAtom);
  const [generationPreview, setGenerationPreview] = useAtom(generationPreviewAtom);
  const [generatingWord, setGeneratingWord] = useAtom(generatingWordAtom);
  const [generationSummary, setGenerationSummary] = useAtom(generationSummaryAtom);
  const [nonsenseQuery, setNonsenseQuery] = useAtom(nonsenseQueryAtom);
  const [reverseLookup, setReverseLookup] = useAtom(reverseLookupAtom);
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

      // Clear the previous verdict up front. Only the generation branch used
      // to reset it, so a nonsense query's easter egg outlived every later
      // search that resolved from the dictionary and sat on top of it.
      setNonsenseQuery(null);

      // Chinese input flips the direction: instead of looking up an entry,
      // search the dictionary's Chinese glosses for English candidates.
      // Clicking a candidate re-enters this function with an English word.
      if (/\p{Script=Han}/u.test(normalized)) {
        setIsSearching(true);
        try {
          const candidates = await reverseQueryDictionary(
            normalized,
            settings.dictionary.cachePath
          );
          setResult({ result: null });
          setReverseLookup({ term: normalized, candidates });
        } catch (error) {
          console.error(error);
          if (
            error instanceof DictionaryQueryError &&
            error.code === "MISSING_CACHE_PATH"
          ) {
            toast.error(t("main.reverse.missing_cache_path"));
          } else {
            toast.error(t("main.errors.dictionary"));
          }
        } finally {
          setIsSearching(false);
        }
        return;
      }

      setReverseLookup(null);
      setIsSearching(true);
      try {
        const definition = await queryDictionary(
          normalized,
          settings.dictionary.cachePath
        );
        setResult({ result: definition, word: normalized });
      } catch (error) {
        if (
          error instanceof DictionaryQueryError &&
          error.code === "NOT_FOUND"
        ) {
          if (!settings.dictionary.cachePath.trim()) {
            toast.error(t("main.llm.missing_cache_path"));
            return;
          }

          const llm = resolveActiveLlmProvider(settings.llm);
          if (!hasLlmCredentials(llm)) {
            toast.error(t("main.llm.missing_config"));
            return;
          }

          // Clear existing result and show LLM generating state
          setResult({ result: null });
          setGeneratingModel(llm.model);
          setGeneratingWord(normalized);
          setGenerationPreview(null);
          setGenerationSummary(null);
          setNonsenseQuery(null);
          setIsGeneratingFromLlm(true);

          try {
            const outcome = await generateEntry(normalized, llm, {
              onSummary: setGenerationSummary,
              onPreview: setGenerationPreview,
            });

            // Not a word: say so playfully and cache nothing. Forcing an
            // entry for a typo would only fill the user dictionary with
            // confident nonsense.
            if (outcome.kind === "not-a-word") {
              setNonsenseQuery(normalized);
              return;
            }

            const aiEntry = outcome.entry;
            setResult({
              result: { source: "user", entry: aiEntry },
              word: normalized,
            });
            toast.success(
              t("main.llm.success", { model: llm.model })
            );
            try {
              await writeDictionaryEntry(
                aiEntry,
                settings.dictionary.cachePath
              );
            } catch (persistError) {
              console.error(persistError);
              toast.warning(t("main.llm.cache_error"));
            }
            return;
          } catch (llmError) {
            console.error(llmError);
            const message =
              llmError instanceof LlmServiceError
                ? llmError.message
                : t("main.llm.error");
            toast.error(message);
          } finally {
            setIsGeneratingFromLlm(false);
            setGenerationPreview(null);
            setGenerationSummary(null);
            setGeneratingModel(null);
            setGeneratingWord(null);
          }
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
    [
      setResult,
      setIsSearching,
      setIsGeneratingFromLlm,
      setGeneratingModel,
      setGeneratingWord,
      setGenerationPreview,
      setGenerationSummary,
      setNonsenseQuery,
      setReverseLookup,
      settings.dictionary.cachePath,
      settings.llm,
      t,
    ]
  );

  const clear = useCallback(() => {
    setResult({ result: null });
    setNonsenseQuery(null);
    setReverseLookup(null);
  }, [setNonsenseQuery, setResult, setReverseLookup]);

  return {
    isSearching,
    isGeneratingFromLlm,
    generatingModel,
    generatingWord,
    generationPreview,
    generationSummary,
    nonsenseQuery,
    reverseLookup,
    history,
    result,
    search,
    clear,
  };
}
