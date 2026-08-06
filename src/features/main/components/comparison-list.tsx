import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DictionaryEntry } from "@/shared/types/dictionary";

type ComparisonListProps = {
  entry: DictionaryEntry;
};

/**
 * Near-synonym comparisons. Only user-generated (LLM) entries carry these;
 * distributed dictionary entries express relations via pos-group relation
 * edges instead.
 */
export function ComparisonList({ entry }: ComparisonListProps) {
  const { t } = useTranslation();
  const comparisons = entry.comparisons ?? [];
  if (comparisons.length === 0) {
    return null;
  }

  return (
    <div className="border">
      <div className="border-b px-4 py-3">
        <h2 className="text-lg font-semibold">{t("main.comparison.title")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("main.comparison.description")}
        </p>
      </div>
      <ScrollArea className="max-h-[60vh]">
        <div className="grid gap-4 p-4">
          {comparisons.map((item, index) => (
            <div key={`${entry.entry_id}-comparison-${index}`} className="space-y-2">
              <h3 className="font-semibold text-foreground">{item.word}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {item.analysis}
              </p>
              {index < comparisons.length - 1 && <Separator />}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
