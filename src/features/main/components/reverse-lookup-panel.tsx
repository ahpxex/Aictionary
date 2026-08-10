import { useTranslation } from "react-i18next";
import { Row } from "@/features/main/components/entry-layout";
import { posLabelZh } from "@/shared/lib/dictionary-entry";
import type { ReverseLookupResult } from "@/shared/types/dictionary";

type ReverseLookupPanelProps = {
  lookup: ReverseLookupResult;
  onSelectWord: (word: string) => void;
};

/**
 * The candidate list a Chinese query resolves to: English headwords whose
 * glosses matched the query. Laid out on the same rail grid as an entry —
 * the pos marker rides the gutter, the spine runs down the list — so the
 * panel reads as a page of the dictionary, not a widget in front of it.
 * Each row opens its word as a normal lookup.
 */
export function ReverseLookupPanel({ lookup, onSelectWord }: ReverseLookupPanelProps) {
  const { t } = useTranslation();

  return (
    <div>
      {/* Same family as the entry headword, a size down: the term is a
          question, not the entry itself. */}
      <header className="flex flex-col gap-2 pb-6">
        <h1 className="min-w-0 break-words text-3xl font-bold leading-none tracking-tighter md:text-4xl">
          {lookup.term}
        </h1>
        <p className="text-sm text-muted-foreground">
          {lookup.candidates.length > 0
            ? t("main.reverse.hint", { count: lookup.candidates.length })
            : t("main.reverse.empty")}
        </p>
      </header>

      {lookup.candidates.map((candidate, index) => {
        const posZh = candidate.pos ? posLabelZh(candidate.pos) : null;
        return (
          <button
            key={`${candidate.headword}-${index}`}
            type="button"
            onClick={() => onSelectWord(candidate.headword)}
            className="group block w-full text-left"
          >
            <Row
              divider
              variant="marker"
              rail={
                candidate.pos && (
                  <span className="font-mono text-[0.7rem] font-semibold uppercase leading-6 tracking-[0.15em] text-muted-foreground transition-colors group-hover:text-foreground">
                    {candidate.pos}
                  </span>
                )
              }
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="font-semibold leading-6 underline-offset-4 group-hover:underline">
                  {candidate.headword}
                </span>
                {posZh && (
                  <span className="text-xs text-muted-foreground">{posZh}</span>
                )}
                <span className="text-sm leading-relaxed text-muted-foreground">
                  {candidate.gloss}
                </span>
              </div>
            </Row>
          </button>
        );
      })}
    </div>
  );
}
