import { useTranslation } from "react-i18next";
import { useDictionarySearch } from "@/features/main/hooks/use-dictionary-search";
import { EntryView } from "@/features/main/components/entry-view";
import { ScrollRegion } from "@/shared/components/scroll-region";

export function MainPage() {
  const { t } = useTranslation();
  const { result, search } = useDictionarySearch();

  return (
    <ScrollRegion className="min-h-0 flex-1">
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-6 py-8">
        {!result && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24">
            <p className="text-2xl font-bold tracking-tight text-muted-foreground/40">
              aictionary
            </p>
            <p className="text-sm text-muted-foreground">{t("main.empty_state")}</p>
          </div>
        )}

        {result && <EntryView result={result} onSearchWord={search} />}
      </div>
    </ScrollRegion>
  );
}
