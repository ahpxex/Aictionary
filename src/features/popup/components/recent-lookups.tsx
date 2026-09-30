import { useTranslation } from "react-i18next";
import type { QueryRecord } from "@/shared/types/dictionary";

const RECENT_LIMIT = 8;

type RecentLookupsProps = {
  history: QueryRecord[];
  onSelect: (word: string) => void;
};

/**
 * What the popup shows before anything is typed: the last few distinct
 * words, most recent first, since a word looked up once is often looked up
 * again soon after.
 */
export function RecentLookups({ history, onSelect }: RecentLookupsProps) {
  const { t } = useTranslation();

  const seen = new Set<string>();
  const recent: string[] = [];
  for (const record of history) {
    const key = record.word.trim().toLocaleLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    recent.push(record.word);
    if (recent.length === RECENT_LIMIT) break;
  }

  if (recent.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        {t("popup.empty")}
      </p>
    );
  }

  return (
    <section>
      <h2 className="pb-2 text-[0.65rem] font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {t("popup.recent")}
      </h2>
      <ul className="flex flex-col">
        {recent.map((word) => (
          <li key={word} className="border-t first:border-t-0">
            <button
              type="button"
              onClick={() => onSelect(word)}
              className="w-full py-2 text-left text-sm underline-offset-4 transition-colors hover:underline"
            >
              {word}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
