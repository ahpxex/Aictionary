import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WordDefinition } from "@/shared/types/dictionary";

type DefinitionsListProps = {
  definition: WordDefinition;
};

export function DefinitionsList({ definition }: DefinitionsListProps) {
  return (
    <div className="grid gap-4">
      {definition.definitions.map((item, index) => (
        <Card key={`${definition.word}-definition-${index}`}>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-3 text-xl">
              <Badge variant="outline" className="font-medium uppercase">
                {item.pos}
              </Badge>
              <span className="font-semibold text-foreground">
                {item.explanation_en}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-muted-foreground">{item.explanation_cn}</p>
            <div className="bg-muted/60 border-border grid gap-3 rounded-lg border p-4 text-sm">
              <p className="font-medium text-foreground">
                Example: {item.example_en}
              </p>
              <p className="text-muted-foreground">
                示例：{item.example_cn}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

