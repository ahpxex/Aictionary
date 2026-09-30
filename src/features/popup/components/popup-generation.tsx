import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EntryHeader } from "@/features/main/components/entry-layout";
import type { GenerationPreview } from "@/shared/services/llm-service";

const MEANING_LIMIT = 3;

type PopupGenerationProps = {
  word: string;
  model: string | null;
  summary: string | null;
  preview: GenerationPreview | null;
};

/**
 * A generated entry as it streams in, cut to the popup's size: the header
 * the finished entry will have, and its first senses as they arrive. The
 * generation runs in this window, so it keeps going while the panel is
 * hidden and the result is waiting the next time it opens.
 */
export function PopupGeneration({ word, model, summary, preview }: PopupGenerationProps) {
  const { t } = useTranslation();

  if (!summary) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {t("main.llm.generating_status", { model: model ?? "" })}
        </p>
        <p className="text-xs text-muted-foreground/70">{word}</p>
      </div>
    );
  }

  const meanings = (preview?.posGroups ?? [])
    .flatMap((group) => group.meanings.map((meaning) => ({ pos: group.pos, meaning })))
    .slice(0, MEANING_LIMIT);

  return (
    <article className="w-full">
      <EntryHeader
        headword={word}
        summary={summary}
        meta={
          <span className="text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
            {t("main.word_summary.ai_generated")}
          </span>
        }
      />

      <ol className="flex flex-col gap-3 border-t pt-4">
        {meanings.length > 0
          ? meanings.map(({ pos, meaning }, index) => (
              <li key={index} className="flex gap-3 text-sm leading-relaxed">
                <span className="w-3 shrink-0 text-right font-mono text-xs leading-6 text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p>
                    {pos && (
                      <span className="mr-2 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                        {pos}
                      </span>
                    )}
                    {meaning.shortGloss && (
                      <span className="font-semibold">{meaning.shortGloss}</span>
                    )}
                  </p>
                  {meaning.learnerExplanation ? (
                    <p className="text-muted-foreground">{meaning.learnerExplanation}</p>
                  ) : (
                    <Skeleton className="mt-1 h-4 w-4/5" />
                  )}
                </div>
              </li>
            ))
          : [0, 1].map((index) => (
              <li key={index} className="flex flex-col gap-2 pl-6">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-11/12" />
              </li>
            ))}
      </ol>
    </article>
  );
}
