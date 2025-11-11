import { useTranslation } from "react-i18next";
import { useDictionarySearch } from "@/features/main/hooks/use-dictionary-search";
import { ComparisonList } from "@/features/main/components/comparison-list";
import { DefinitionsList } from "@/features/main/components/definitions-list";
import { SearchForm } from "@/features/main/components/search-form";
import { WordSummaryCard } from "@/features/main/components/word-summary";

export function MainPage() {
  const { t } = useTranslation();
  const { isSearching, isGeneratingFromLlm, generatingModel, result, search } = useDictionarySearch();

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col items-center gap-4">
        <SearchForm
          onSearch={search}
          isSearching={isSearching}
          initialValue={result?.word}
        />
        {!result && !isGeneratingFromLlm && (
          <p className="text-muted-foreground text-sm">
            {t("main.empty_state")}
          </p>
        )}
      </div>

      {isGeneratingFromLlm && (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground text-sm">
            {t("main.llm.generating_status", { model: generatingModel })}
          </p>
        </div>
      )}

      {result && !isGeneratingFromLlm && (
        <div className="flex flex-col gap-6">
          <WordSummaryCard definition={result} />
          <div className="flex flex-col gap-4">
            <DefinitionsList definition={result} />
          </div>
          <ComparisonList definition={result} />
        </div>
      )}
    </div>
  );
}
