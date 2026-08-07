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
  generatingWordAtom,
  queryHistoryAtom,
  setCurrentResultAtom,
} from "@/shared/state/dictionary";
import { settingsAtom } from "@/shared/state/settings";
import {
  queryDictionary,
  DictionaryQueryError,
  writeDictionaryEntry,
} from "@/shared/services/dictionary-service";
import {
  streamDefinitionFromLlm,
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
        if (
          error instanceof DictionaryQueryError &&
          error.code === "NOT_FOUND"
        ) {
          if (!settings.dictionary.cachePath.trim()) {
            toast.error(t("main.llm.missing_cache_path"));
            return;
          }

          if (!hasLlmCredentials(settings.llm)) {
            toast.error(t("main.llm.missing_config"));
            return;
          }

          // Clear existing result and show LLM generating state
          setResult({ result: null });
          setGeneratingModel(settings.llm.model);
          setGeneratingWord(normalized);
          setGenerationPreview(null);
          setIsGeneratingFromLlm(true);

          try {
            const aiEntry = await streamDefinitionFromLlm(
              normalized,
              settings.llm,
              setGenerationPreview
            );
            setResult({
              result: { source: "user", entry: aiEntry },
              word: normalized,
            });
            toast.success(
              t("main.llm.success", { model: settings.llm.model })
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
      settings.dictionary.cachePath,
      settings.llm,
      t,
    ]
  );

  const clear = useCallback(() => {
    setResult({ result: null });
  }, [setResult]);

  return {
    isSearching,
    isGeneratingFromLlm,
    generatingModel,
    generatingWord,
    generationPreview,
    history,
    result,
    search,
    clear,
  };
}
