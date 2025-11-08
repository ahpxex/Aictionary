import { BookMarked, Clock, Hash } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryMetric } from "@/shared/types/statistics";

type OverviewCardsProps = {
  learnedCount: number;
  totalQueries: number;
  topMetric: QueryMetric | null;
};

export function OverviewCards(props: OverviewCardsProps) {
  const { t } = useTranslation();

  const getLearnedHint = (count: number) => {
    if (count === 0) return t("statistics.overview.learned_words.hint_none");
    if (count === 1) return t("statistics.overview.learned_words.hint_one");
    if (count < 10) return t("statistics.overview.learned_words.hint_few", { count });
    if (count < 50) return t("statistics.overview.learned_words.hint_many", { count });
    return t("statistics.overview.learned_words.hint_lots", { count });
  };

  const items = [
    {
      id: "learned",
      title: t("statistics.overview.learned_words.title"),
      icon: BookMarked,
      getValue: () => props.learnedCount.toString(),
      getHint: () => getLearnedHint(props.learnedCount),
    },
    {
      id: "queries",
      title: t("statistics.overview.total_queries.title"),
      icon: Hash,
      getValue: () => props.totalQueries.toString(),
      getHint: () => t("statistics.overview.total_queries.queried_times", { count: props.totalQueries }),
    },
    {
      id: "top",
      title: t("statistics.overview.most_frequent.title"),
      icon: Clock,
      getValue: () => props.topMetric ? props.topMetric.word : "–",
      getHint: () =>
        props.topMetric
          ? t("statistics.overview.total_queries.queried_times", { count: props.topMetric.count })
          : t("statistics.top_words.empty_state"),
    },
  ] as const;
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
                {item.getValue()}
              </span>
              <span className="text-muted-foreground text-sm">
                {item.getHint()}
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

