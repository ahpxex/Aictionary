import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WordDefinition } from "@/shared/types/dictionary";

const WORD_FORMS_LABELS: Record<keyof WordDefinition["forms"], string> = {
  third_person_singular: "第三人称",
  past_tense: "过去式",
  past_participle: "过去分词",
  present_participle: "现在分词",
};

export function WordSummaryCard({ definition }: { definition: WordDefinition }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl font-bold">{definition.word}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-3 text-base text-muted-foreground">
          <span className="font-medium">/{definition.pronunciation}/</span>
          <span>{definition.concise_definition}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="text-xs uppercase tracking-wide text-foreground">
            词形
          </span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(definition.forms).map(([key, value]) => (
              <Badge key={key} variant="outline" className="text-xs font-medium">
                {WORD_FORMS_LABELS[key as keyof WordDefinition["forms"]]}：{value}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
