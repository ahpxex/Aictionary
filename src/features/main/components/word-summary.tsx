import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WordDefinition } from "@/shared/types/dictionary";

type WordSummaryProps = {
  definition: WordDefinition;
  onClear: () => void;
};

const WORD_FORMS_LABELS: Record<keyof WordDefinition["forms"], string> = {
  third_person_singular: "Third-person",
  past_tense: "Past",
  past_participle: "Past participle",
  present_participle: "Present participle",
};

export function WordSummaryCard({ definition, onClear }: WordSummaryProps) {
  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-3xl font-bold">
            {definition.word}
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-3 text-base text-muted-foreground">
            <span className="font-medium">/{definition.pronunciation}/</span>
            <span>{definition.concise_definition}</span>
          </CardDescription>
        </div>
        <Button variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="text-sm text-muted-foreground">Word forms</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(definition.forms).map(([key, value]) => (
            <div
              key={key}
              className={cn(
                "bg-muted/60 text-muted-foreground flex flex-col gap-1 rounded-lg border px-3 py-2"
              )}
            >
              <span className="text-xs uppercase tracking-wide">
                {WORD_FORMS_LABELS[key as keyof WordDefinition["forms"]]}
              </span>
              <span className="text-sm font-medium text-foreground">
                {value}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs uppercase">
            {definition.definitions.length} definitions
          </Badge>
          {definition.comparison.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {definition.comparison.length} comparisons
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

