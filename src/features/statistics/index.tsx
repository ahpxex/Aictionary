import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AggregatedMetrics } from "@/features/statistics/components/aggregated-metrics";
import { OverviewCards } from "@/features/statistics/components/overview-cards";
import { TopWordsTable } from "@/features/statistics/components/top-words-table";
import { useStatistics } from "@/features/statistics/hooks/use-statistics";

export function StatisticsPage() {
  const { snapshot, exportLearnedWords, exportQueryMetrics } = useStatistics();
  const totalQueries = snapshot.queryMetrics.reduce(
    (acc, metric) => acc + metric.count,
    0
  );
  const topMetric = snapshot.queryMetrics[0] ?? null;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Statistics</h1>
        <p className="text-muted-foreground">
          Review your dictionary usage and export study materials.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-3 py-5">
          <Button onClick={exportLearnedWords}>
            <Download className="mr-2 size-4" />
            Export learned words
          </Button>
          <Button variant="outline" onClick={exportQueryMetrics}>
            <FileText className="mr-2 size-4" />
            Export query counts
          </Button>
        </CardContent>
      </Card>

      <OverviewCards
        learnedCount={snapshot.learnedWords.length}
        totalQueries={totalQueries}
        topMetric={topMetric}
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <AggregatedMetrics aggregates={snapshot.aggregates} />
        <TopWordsTable metrics={snapshot.queryMetrics} />
      </div>
    </div>
  );
}

