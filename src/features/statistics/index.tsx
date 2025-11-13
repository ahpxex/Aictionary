import { BookMarked, Clock, Download, FileText, Hash } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AggregatedMetrics } from "@/features/statistics/components/aggregated-metrics";
import { TopWordsTable } from "@/features/statistics/components/top-words-table";
import { useStatistics } from "@/features/statistics/hooks/use-statistics";

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

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">{t("statistics.title")}</CardTitle>
          <CardDescription className="text-base">
            {t("statistics.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* Metrics Grid */}
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold uppercase text-muted-foreground">
                  {t("statistics.overview.learned_words.title")}
                </span>
                <BookMarked className="size-4 text-muted-foreground" />
              </div>
              <span className="text-3xl font-bold tracking-tight">
                {snapshot.learnedWords.length}
              </span>
              <span className="text-sm text-muted-foreground">
                {getLearnedHint(snapshot.learnedWords.length)}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold uppercase text-muted-foreground">
                  {t("statistics.overview.total_queries.title")}
                </span>
                <Hash className="size-4 text-muted-foreground" />
              </div>
              <span className="text-3xl font-bold tracking-tight">
                {totalQueries}
              </span>
              <span className="text-sm text-muted-foreground">
                {t("statistics.overview.total_queries.queried_times", { count: totalQueries })}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold uppercase text-muted-foreground">
                  {t("statistics.overview.most_frequent.title")}
                </span>
                <Clock className="size-4 text-muted-foreground" />
              </div>
              <span className="text-3xl font-bold tracking-tight">
                {topMetric ? topMetric.word : "–"}
              </span>
              <span className="text-sm text-muted-foreground">
                {topMetric
                  ? t("statistics.overview.total_queries.queried_times", { count: topMetric.count })
                  : t("statistics.top_words.empty_state")}
              </span>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex flex-wrap justify-end gap-3 border-t pt-6">
            <Button onClick={exportLearnedWords}>
              <Download className="mr-2 size-4" />
              {t("statistics.export.learned_words")}
            </Button>
            <Button variant="outline" onClick={exportQueryMetrics}>
              <FileText className="mr-2 size-4" />
              {t("statistics.export.query_counts")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <AggregatedMetrics aggregates={snapshot.aggregates} onRemoveWord={removeWord} />
        <TopWordsTable metrics={snapshot.queryMetrics} onRemoveWord={removeWord} />
      </div>
    </div>
  );
}

