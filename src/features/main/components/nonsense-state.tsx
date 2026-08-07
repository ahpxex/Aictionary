import { useTranslation } from "react-i18next";

type NonsenseStateProps = {
  word: string;
};

/**
 * Shown when the opening pass decides the query is not a word.
 *
 * The alternative was letting the full generation invent an entry for a
 * typo, which it will happily do - confidently and in detail - and then
 * cache it. Saying nothing was written is more useful than a fabricated
 * definition, and there is no reason to be dour about it.
 */
export function NonsenseState({ word }: NonsenseStateProps) {
  const { t } = useTranslation();

  const lines = t("main.nonsense.lines", {
    returnObjects: true,
  }) as string[];

  // Stable per word rather than random, so re-rendering does not reshuffle
  // the joke while the user is reading it.
  const index =
    Math.abs(
      [...word].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 7)
    ) % lines.length;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="text-5xl select-none" aria-hidden="true">
        🫠
      </p>
      <p className="text-2xl font-bold tracking-tight">{word}</p>
      <p className="text-sm text-muted-foreground">{lines[index]}</p>
      <p className="text-xs text-muted-foreground/70">
        {t("main.nonsense.hint")}
      </p>
    </div>
  );
}
