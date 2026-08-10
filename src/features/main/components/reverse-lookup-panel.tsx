import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { posLabelZh } from "@/shared/lib/dictionary-entry";
import type { ReverseLookupResult } from "@/shared/types/dictionary";

type ReverseLookupPanelProps = {
  lookup: ReverseLookupResult;
  onSelectWord: (word: string) => void;
};

/**
 * The candidate list a Chinese query resolves to: English headwords whose
 * glosses matched the query. Each row opens the word as a normal lookup.
 */
export function ReverseLookupPanel({ lookup, onSelectWord }: ReverseLookupPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">{lookup.term}</h1>
        <p className="text-sm text-muted-foreground">
          {lookup.candidates.length > 0
            ? t("main.reverse.hint", { count: lookup.candidates.length })
            : t("main.reverse.empty")}
        </p>
      </div>

      {lookup.candidates.length > 0 && (
        <div className="rounded-xl border">
          <div className="grid gap-1 p-2">
            {lookup.candidates.map((candidate, index) => {
              const posZh = candidate.pos ? posLabelZh(candidate.pos) : null;
              return (
                <div key={`${candidate.headword}-${index}`}>
                  <Button
                    variant="ghost"
                    className="flex h-auto w-full items-center justify-between gap-3 px-3 py-2 text-left"
                    onClick={() => onSelectWord(candidate.headword)}
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="shrink-0 font-medium">{candidate.headword}</span>
                      {candidate.pos && (
                        <span className="shrink-0 text-xs italic text-muted-foreground">
                          {posZh ?? candidate.pos}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 truncate text-sm text-muted-foreground">
                      {candidate.gloss}
                    </span>
                  </Button>
                  {index < lookup.candidates.length - 1 && <Separator className="mx-3" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
