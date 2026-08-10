import { useTranslation } from "react-i18next";
import { useDictionarySearch } from "@/features/main/hooks/use-dictionary-search";
import { EntryView } from "@/features/main/components/entry-view";
import { ScrollRegion } from "@/shared/components/scroll-region";
import { GenerationPreviewPanel } from "@/features/main/components/generation-preview";
import { NonsenseState } from "@/features/main/components/nonsense-state";
import { ReverseLookupPanel } from "@/features/main/components/reverse-lookup-panel";

export function MainPage() {
  const { t } = useTranslation();
  const {
    isGeneratingFromLlm,
    generatingModel,
    generatingWord,
    generationPreview,
    generationSummary,
    nonsenseQuery,
    reverseLookup,
    result,
    search,
  } = useDictionarySearch();

  return (
    <ScrollRegion className="min-h-0 flex-1">
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 md:px-6 md:py-8">
        {!result && !isGeneratingFromLlm && !nonsenseQuery && !reverseLookup && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center md:py-24">
            <p className="text-2xl font-bold tracking-tight text-muted-foreground/40">
              Aictionary
            </p>
            <p className="text-sm text-muted-foreground">{t("main.empty_state")}</p>
          </div>
        )}

        {isGeneratingFromLlm && (
          <GenerationPreviewPanel
            word={generatingWord ?? ""}
            model={generatingModel}
            summary={generationSummary}
            preview={generationPreview}
          />
        )}

        {nonsenseQuery && !isGeneratingFromLlm && (
          <NonsenseState word={nonsenseQuery} />
        )}

        {reverseLookup && !result && !isGeneratingFromLlm && (
          <ReverseLookupPanel lookup={reverseLookup} onSelectWord={search} />
        )}

        {result && !isGeneratingFromLlm && (
          <EntryView result={result} onSearchWord={search} />
        )}
      </div>
    </ScrollRegion>
  );
}
