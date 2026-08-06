import { useTranslation } from "react-i18next";
import { useDictionarySearch } from "@/features/main/hooks/use-dictionary-search";
import { EntryView } from "@/features/main/components/entry-view";

export function MainPage() {
  const { t } = useTranslation();
  const { isGeneratingFromLlm, generatingModel, result, search } = useDictionarySearch();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
      {!result && !isGeneratingFromLlm && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24">
          <p className="text-2xl font-bold tracking-tight text-muted-foreground/40">
            aictionary
          </p>
          <p className="text-sm text-muted-foreground">{t("main.empty_state")}</p>
        </div>
      )}

      {isGeneratingFromLlm && (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground text-sm">
            {t("main.llm.generating_status", { model: generatingModel })}
          </p>
        </div>
      )}

      {result && !isGeneratingFromLlm && (
        <EntryView result={result} onSearchWord={search} />
      )}
    </div>
  );
}
