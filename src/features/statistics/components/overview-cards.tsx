import { BookMarked, Clock, Hash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryMetric } from "@/shared/types/statistics";

type OverviewCardsProps = {
  learnedCount: number;
  totalQueries: number;
  topMetric: QueryMetric | null;
};

const items = [
  {
    id: "learned",
    title: "Learned words",
    icon: BookMarked,
    getValue: (props: OverviewCardsProps) => props.learnedCount.toString(),
    getHint: (props: OverviewCardsProps) =>
      props.learnedCount > 0
        ? "Keep exploring to grow this list."
        : "Nothing yet. Start with a new word.",
  },
  {
    id: "queries",
    title: "Total queries",
    icon: Hash,
    getValue: (props: OverviewCardsProps) => props.totalQueries.toString(),
    getHint: () => "We count every dictionary lookup you make.",
  },
  {
    id: "top",
    title: "Most frequent",
    icon: Clock,
    getValue: (props: OverviewCardsProps) =>
      props.topMetric ? props.topMetric.word : "–",
    getHint: (props: OverviewCardsProps) =>
      props.topMetric
        ? `Queried ${props.topMetric.count} times.`
        : "Search a word multiple times to see it here.",
  },
] as const;

export function OverviewCards(props: OverviewCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.id}>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">
                {item.title}
              </CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <span className="text-3xl font-bold tracking-tight">
                {item.getValue(props)}
              </span>
              <span className="text-muted-foreground text-sm">
                {item.getHint(props)}
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

