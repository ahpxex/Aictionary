import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EntryHeader,
  RailLabel,
  Row,
} from "@/features/main/components/entry-layout";
import type { GenerationPreview as Preview } from "@/shared/services/llm-service";

type GenerationPreviewProps = {
  word: string;
  model: string | null;
  /** From the fast opening call; on screen long before the rest. */
  summary: string | null;
  preview: Preview | null;
};

/** Placeholder paragraph. Widths vary so it reads as prose, not as bars. */
function SkeletonLines({ widths }: { widths: string[] }) {
  return (
    <div className="space-y-2">
      {widths.map((width, index) => (
        <Skeleton key={index} className="h-4" style={{ width }} />
      ))}
    </div>
  );
}

/**
 * The entry as it streams in.
 *
 * Laid out on the same rail as the finished entry - same header, same
 * labelled rows - so completion swaps text into place instead of
 * rearranging the page. Sections that have not arrived hold their spot as
 * pulsing skeletons, which is what the user looks at for most of the wait.
 */
export function GenerationPreviewPanel({
  word,
  model,
  summary,
  preview,
}: GenerationPreviewProps) {
  const { t } = useTranslation();

  // Nothing has come back yet. Showing the headword now would plant a
  // finished-looking title above an empty page, so hold the whole thing as
  // one centred waiting state until there is something to put under it.
  if (!summary) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {t("main.llm.generating_status", { model: model ?? "" })}
        </p>
        <p className="text-xs text-muted-foreground/70">{word}</p>
      </div>
    );
  }

  const posGroups = preview?.posGroups ?? [];

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

      <Row divider rail={<RailLabel>{t("main.word_summary.memory_hook")}</RailLabel>}>
        {preview?.memoryHook ? (
          <p className="text-sm leading-relaxed">{preview.memoryHook}</p>
        ) : (
          <SkeletonLines widths={["100%", "78%"]} />
        )}
      </Row>

      <Row divider rail={<RailLabel>{t("main.word_summary.study_notes")}</RailLabel>}>
        {preview && preview.studyNotes.length > 0 ? (
          <ul className="flex flex-col gap-1.5 text-sm leading-relaxed">
            {preview.studyNotes.map((note, index) => (
              <li key={index} className="flex gap-2">
                <span className="text-muted-foreground">–</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        ) : (
          <SkeletonLines widths={["94%", "72%", "86%"]} />
        )}
      </Row>

      {posGroups.length > 0
        ? posGroups.map((group, groupIndex) => (
            <Row
              key={groupIndex}
              divider
              variant="marker"
              rail={<RailLabel>{group.pos ?? ""}</RailLabel>}
            >
              <div className="flex flex-col gap-3">
                {group.summary && (
                  <p className="text-sm leading-relaxed">{group.summary}</p>
                )}
                {group.meanings.map((meaning, meaningIndex) => (
                  <div key={meaningIndex} className="flex flex-col gap-1">
                    {meaning.shortGloss && (
                      <p className="text-sm font-medium">
                        {meaning.shortGloss}
                      </p>
                    )}
                    {meaning.learnerExplanation ? (
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {meaning.learnerExplanation}
                      </p>
                    ) : (
                      <SkeletonLines widths={["90%", "62%"]} />
                    )}
                  </div>
                ))}
              </div>
            </Row>
          ))
        : // Two stand-ins: most entries open with a couple of senses, so the
          // page settles rather than jumping when the real groups land.
          [0, 1].map((index) => (
            <Row
              key={index}
              divider
              variant="marker"
              rail={<Skeleton className="ml-auto h-3 w-8 md:w-12" />}
            >
              <div className="flex flex-col gap-3">
                <Skeleton className="h-4 w-40" />
                <SkeletonLines widths={["92%", "68%"]} />
              </div>
            </Row>
          ))}
    </article>
  );
}
