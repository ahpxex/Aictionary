import { useTranslation } from "react-i18next";
import { EntryHeader } from "@/features/main/components/entry-layout";
import { EntryActions } from "@/features/main/components/entry-actions";
import {
  collectPronunciations,
  pronunciationsAreUniform,
  splitMeaningsByPriority,
} from "@/shared/lib/dictionary-entry";
import type { DictionaryLookupResult } from "@/shared/types/dictionary";

/** Enough to answer "what does it mean"; the rest is a click away. */
const MEANING_LIMIT = 3;

/**
 * The popup's answer: the entry's header as the main window draws it, then
 * its leading senses. Rare senses are skipped the same way the full entry
 * folds them, including the rule that a group of only rare senses still
 * shows them rather than nothing.
 */
export function PopupEntry({ result }: { result: DictionaryLookupResult }) {
  const { t } = useTranslation();
  const { entry, source } = result;
  const pronunciations = pronunciationsAreUniform(entry)
    ? collectPronunciations(entry)
    : [];
  const meanings = entry.pos_groups
    .flatMap((group) =>
      splitMeaningsByPriority(group).visible.map((meaning) => ({
        pos: group.pos,
        meaning,
      }))
    )
    .slice(0, MEANING_LIMIT);

  return (
    <article className="w-full">
      <EntryHeader
        headword={entry.headword}
        summary={entry.headword_summary}
        actions={<EntryActions entry={entry} />}
        meta={
          <>
            {pronunciations.map((pronunciation, index) => (
              <span key={`pron-${index}`} className="font-mono text-sm text-muted-foreground">
                {pronunciation.tags.length > 0 && (
                  <span className="mr-1.5 text-[0.65rem] uppercase tracking-wider">
                    {pronunciation.tags.join(" ")}
                  </span>
                )}
                {pronunciation.ipa ?? pronunciation.text}
              </span>
            ))}
            {source === "user" && (
              <span className="text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
                {t("main.word_summary.ai_generated")}
              </span>
            )}
          </>
        }
      />

      {meanings.length > 0 && (
        <ol className="flex flex-col gap-3 border-t pt-4">
          {meanings.map(({ pos, meaning }, index) => (
            <li key={meaning.sense_id} className="flex gap-3 text-sm leading-relaxed">
              <span className="w-3 shrink-0 text-right font-mono text-xs leading-6 text-muted-foreground">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p>
                  <span className="mr-2 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    {pos}
                  </span>
                  {meaning.short_gloss && (
                    <span className="font-semibold">{meaning.short_gloss}</span>
                  )}
                </p>
                <p className="text-muted-foreground">{meaning.learner_explanation}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
