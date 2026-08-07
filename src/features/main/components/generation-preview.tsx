import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import type { GenerationPreview as Preview } from "@/shared/services/llm-service";

type GenerationPreviewProps = {
  word: string;
  model: string | null;
  preview: Preview | null;
};

/**
 * The entry as it streams in.
 *
 * Generation takes tens of seconds, and a bare spinner for that long reads
 * as a hang. This lays the fields out in the order the model produces them,
 * so the wait shows visible progress rather than nothing at all. It is a
 * preview, not the real EntryView: the data is still partial, every field is
 * optional, and nothing here is interactive.
 */
export function GenerationPreviewPanel({
  word,
  model,
  preview,
}: GenerationPreviewProps) {
  const { t } = useTranslation();

  const headword = preview?.headword?.trim() ?? "";
  const meaningCount =
    preview?.posGroups.reduce((total, group) => total + group.meanings.length, 0) ?? 0;

  // Nothing has come back yet. Showing the headword now would plant a
  // finished-looking title above an empty page for the twenty-odd seconds
  // the provider spends before its first token, so hold the whole thing as
  // one centred waiting state until there is something to put under it.
  if (!headword && !preview?.headwordSummary) {
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

  return (
    <div className="flex flex-col gap-6 py-8">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="size-4 shrink-0 animate-spin" />
        <p className="text-sm">
          {t("main.llm.generating_status", { model: model ?? "" })}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-4xl font-bold tracking-tight">{headword || word}</p>
        {preview?.headwordSummary && (
          <p className="text-muted-foreground text-base">
            {preview.headwordSummary}
          </p>
        )}
      </div>

      {preview?.memoryHook && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3">
          <p className="text-sm leading-relaxed">{preview.memoryHook}</p>
        </div>
      )}

      {preview && preview.studyNotes.length > 0 && (
        <ul className="list-disc space-y-1 pl-5">
          {preview.studyNotes.map((note, index) => (
            <li key={index} className="text-sm text-muted-foreground">
              {note}
            </li>
          ))}
        </ul>
      )}

      {preview?.posGroups.map((group, groupIndex) => (
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
                  <p className="text-sm font-medium">{meaning.shortGloss}</p>
                )}
                {meaning.learnerExplanation && (
                  <p className="text-sm text-muted-foreground">
                    {meaning.learnerExplanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {meaningCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("main.llm.generating_progress", { count: meaningCount })}
        </p>
      )}
    </div>
  );
}
