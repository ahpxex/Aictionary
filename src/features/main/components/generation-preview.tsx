import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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
 * Sections that have not arrived hold their place as pulsing skeletons
 * rather than being announced by a spinner: the page then keeps the shape
 * of the entry it is becoming, and each block simply resolves into text.
 * The provider takes tens of seconds over the full schema, so this is what
 * the user looks at for most of the wait.
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
    <div className="flex flex-col gap-8 py-8">
      <div className="space-y-2">
        <p className="text-4xl font-bold tracking-tight">{word}</p>
        <p className="text-muted-foreground text-base">{summary}</p>
      </div>

      {preview?.memoryHook ? (
        <div className="rounded-lg border bg-muted/40 px-4 py-3">
          <p className="text-sm leading-relaxed">{preview.memoryHook}</p>
        </div>
      ) : (
        <div className="rounded-lg border px-4 py-3">
          <SkeletonLines widths={["100%", "82%"]} />
        </div>
      )}

      {preview && preview.studyNotes.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5">
          {preview.studyNotes.map((note, index) => (
            <li key={index} className="text-sm text-muted-foreground">
              {note}
            </li>
          ))}
        </ul>
      ) : (
        <SkeletonLines widths={["94%", "76%", "88%"]} />
      )}

      {posGroups.length > 0
        ? posGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="space-y-3">
              {group.pos && (
                <p className="text-sm font-medium italic text-muted-foreground">
                  {group.pos}
                </p>
              )}
              {group.summary && <p className="text-sm">{group.summary}</p>}
              <div className="space-y-3">
                {group.meanings.map((meaning, meaningIndex) => (
                  <div key={meaningIndex} className="border-l-2 pl-3">
                    {meaning.shortGloss && (
                      <p className="text-sm font-medium">
                        {meaning.shortGloss}
                      </p>
                    )}
                    {meaning.learnerExplanation ? (
                      <p className="text-sm text-muted-foreground">
                        {meaning.learnerExplanation}
                      </p>
                    ) : (
                      <SkeletonLines widths={["90%", "64%"]} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        : // Two stand-ins: most entries open with a couple of senses, so the
          // page settles rather than jumping when the real ones land.
          [0, 1].map((index) => (
            <div key={index} className="space-y-3">
              <Skeleton className="h-4 w-20" />
              <div className="space-y-3 border-l-2 pl-3">
                <Skeleton className="h-4 w-32" />
                <SkeletonLines widths={["92%", "70%"]} />
              </div>
            </div>
          ))}
    </div>
  );
}
