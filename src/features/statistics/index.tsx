import { Download, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AggregatedMetrics } from "@/features/statistics/components/aggregated-metrics";
import { TopWordsTable } from "@/features/statistics/components/top-words-table";
import { useStatistics } from "@/features/statistics/hooks/use-statistics";
import { ScrollRegion } from "@/shared/components/scroll-region";

export function StatisticsPage() {
  const { t } = useTranslation();
  const { snapshot, exportLearnedWords, exportQueryMetrics, removeWord } = useStatistics();
  const totalQueries = snapshot.queryMetrics.reduce(
    (acc, metric) => acc + metric.count,
    0
  );
  const topMetric = snapshot.queryMetrics[0] ?? null;

  const getLearnedHint = (count: number) => {
    if (count === 0) return t("statistics.overview.learned_words.hint_none");
    if (count === 1) return t("statistics.overview.learned_words.hint_one");
    if (count < 10) return t("statistics.overview.learned_words.hint_few", { count });
    if (count < 50) return t("statistics.overview.learned_words.hint_many", { count });
    return t("statistics.overview.learned_words.hint_lots", { count });
  };

  const overview = [
    {
      id: "learned",
      label: t("statistics.overview.learned_words.title"),
      value: snapshot.learnedWords.length.toLocaleString(),
      hint: getLearnedHint(snapshot.learnedWords.length),
    },
    {
      id: "queries",
      label: t("statistics.overview.total_queries.title"),
      value: totalQueries.toLocaleString(),
      hint: t("statistics.overview.total_queries.queried_times", {
        count: totalQueries,
      }),
    },
    {
      id: "top",
      label: t("statistics.overview.most_frequent.title"),
      value: topMetric ? topMetric.word : "–",
      hint: topMetric
        ? t("statistics.overview.total_queries.queried_times", {
            count: topMetric.count,
          })
        : t("statistics.top_words.empty_state"),
    },
  ];

  return (
    <ScrollRegion className="min-h-0 flex-1">
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-8 px-4 py-6 md:gap-10 md:px-6 md:py-8">
        {/* Overview: three oversized figures separated by hairlines. Three
            columns of 130px cannot carry a 5xl figure, so on a phone the
            hairlines turn horizontal and the figures stack. */}
        <div className="grid grid-cols-1 divide-y divide-border border-y border-border md:grid-cols-3 md:divide-y-0">
          {overview.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "flex flex-col gap-2 py-5 md:py-6",
                index > 0 && "md:border-l md:border-border md:pl-6",
                index < overview.length - 1 && "md:pr-6"
              )}
            >
              <span className="text-[0.65rem] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                {item.label}
              </span>
              <span className="break-words text-4xl font-bold leading-none tracking-tighter tabular-nums md:text-5xl">
                {item.value}
              </span>
              <span className="text-sm text-muted-foreground">{item.hint}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button onClick={exportLearnedWords}>
            <Download className="mr-2 size-4" />
            {t("statistics.export.learned_words")}
          </Button>
          <Button variant="outline" onClick={exportQueryMetrics}>
            <FileText className="mr-2 size-4" />
            {t("statistics.export.query_counts")}
          </Button>
        </div>

        <div className="grid items-start gap-8 md:gap-10 lg:grid-cols-[2fr_1fr]">
          <AggregatedMetrics aggregates={snapshot.aggregates} onRemoveWord={removeWord} />
          <TopWordsTable metrics={snapshot.queryMetrics} onRemoveWord={removeWord} />
        </div>
      </div>
    </ScrollRegion>
  );
}
