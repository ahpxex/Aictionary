import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WordDefinition } from "@/shared/types/dictionary";

export function WordSummaryCard({ definition }: { definition: WordDefinition }) {
  const { t } = useTranslation();

  const WORD_FORMS_LABELS: Record<string, string> = {
    third_person_singular: t("main.word_summary.third_person"),
    past_tense: t("main.word_summary.past_tense"),
    past_participle: t("main.word_summary.past_participle"),
    present_participle: t("main.word_summary.present_participle"),
    comparative: t("main.word_summary.comparative"),
    superlative: t("main.word_summary.superlative"),
    plural: t("main.word_summary.plural"),
    singular: t("main.word_summary.singular"),
  };
  const formEntries = Object.entries(definition.forms || {});
  const formatKey = (key: string) =>
    WORD_FORMS_LABELS[key] ?? key.replace(/_/g, " ");

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
        {formEntries.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-xs uppercase tracking-wide text-foreground">
              {t("main.word_summary.word_forms")}
            </span>
            <div className="flex flex-wrap gap-2">
              {formEntries
                .filter(([, value]) => value && value.trim() !== "")
                .map(([key, value]) => (
                  <Badge key={key} variant="outline" className="text-xs font-medium">
                    {formatKey(key)}：{value}
                  </Badge>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
