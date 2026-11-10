import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  resolveActiveLlmProvider,
  settingsAtom,
} from "@/shared/state/settings";

type GenerationOfferProps = {
  word: string;
  onGenerate: (word: string) => void;
  className?: string;
};

/**
 * Shown when a word opened from an `aictionary://` link is not in the
 * dictionary.
 *
 * A typed query would go straight to the model. A link may come from any app
 * or web page, so it stops here and the user decides whether this word is
 * worth a request against their own quota.
 */
export function GenerationOffer({
  word,
  onGenerate,
  className,
}: GenerationOfferProps) {
  const { t } = useTranslation();
  const settings = useAtomValue(settingsAtom);
  const model = resolveActiveLlmProvider(settings.llm).model;

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center",
        className
      )}
    >
      <p className="text-2xl font-bold tracking-tight">{word}</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("main.generation_offer.description", { model })}
      </p>
      <Button className="mt-2" onClick={() => onGenerate(word)}>
        <Sparkles />
        {t("main.generation_offer.generate")}
      </Button>
    </div>
  );
}
