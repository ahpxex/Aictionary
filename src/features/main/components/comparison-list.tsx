import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { WordDefinition } from "@/shared/types/dictionary";

type ComparisonListProps = {
  definition: WordDefinition;
};

export function ComparisonList({ definition }: ComparisonListProps) {
  if (definition.comparison.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border">
      <div className="border-b px-4 py-3">
        <h2 className="text-lg font-semibold">Compare with</h2>
        <p className="text-muted-foreground text-sm">
          Understand nuances between related words.
        </p>
      </div>
      <ScrollArea className="max-h-80">
        <div className="grid gap-4 p-4">
          {definition.comparison.map((item, index) => (
            <div key={`${definition.word}-comparison-${index}`} className="space-y-2">
              <h3 className="font-semibold text-foreground">{item.word_to_compare}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {item.analysis}
              </p>
              {index < definition.comparison.length - 1 && <Separator />}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

