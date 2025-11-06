import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WordDefinition } from "@/shared/types/dictionary";

type DefinitionsListProps = {
  definition: WordDefinition;
};

export function DefinitionsList({ definition }: DefinitionsListProps) {
  return (
    <div className="grid gap-4">
      {definition.definitions.map((item, index) => (
        <Card key={`${definition.word}-definition-${index}`}>
          <CardHeader className="gap-2">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-medium uppercase">
                {item.pos}
              </Badge>
              <CardTitle className="text-xl font-semibold">
                {item.explanation_cn}
              </CardTitle>
            </div>
            <CardDescription className="text-sm leading-relaxed">
              {item.explanation_en}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <p className="font-medium text-foreground">例句：{item.example_cn}</p>
              <p className="text-muted-foreground">Example: {item.example_en}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

