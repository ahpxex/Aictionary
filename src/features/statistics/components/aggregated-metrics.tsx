import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Section } from "@/shared/components/section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AggregatedMetric } from "@/shared/types/statistics";

type AggregatedMetricsProps = {
  aggregates: AggregatedMetric[];
  onRemoveWord?: (word: string) => void;
};

export function AggregatedMetrics({ aggregates, onRemoveWord }: AggregatedMetricsProps) {
  const { t } = useTranslation();

  const PERIOD_LABEL: Record<AggregatedMetric["period"], string> = {
    day: t("statistics.metrics.periods.daily"),
    week: t("statistics.metrics.periods.weekly"),
    month: t("statistics.metrics.periods.monthly"),
    year: t("statistics.metrics.periods.yearly"),
    total: t("statistics.metrics.periods.total"),
  };
  const ordered = ["day", "week", "month", "year", "total"] as const;
  const available = ordered
    .map((period) => aggregates.find((item) => item.period === period))
    .filter((item): item is AggregatedMetric => Boolean(item));

  return (
    <Section
      title={t("statistics.metrics.title")}
      description={t("statistics.metrics.description")}
    >
      <Tabs defaultValue={available[0]?.period ?? "day"} className="flex flex-col gap-4">
        <TabsList>
          {available.map((item) => (
            <TabsTrigger key={item.period} value={item.period}>
              {PERIOD_LABEL[item.period]}
            </TabsTrigger>
          ))}
        </TabsList>
        {available.map((item) => (
          <TabsContent key={item.period} value={item.period}>
            {item.buckets.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                {t("statistics.metrics.empty_state")}
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {item.buckets.slice(0, 5).map((bucket) => (
                  <div key={bucket.label} className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
                      <span className="font-semibold tabular-nums">
                        {bucket.label}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {t("statistics.overview.total_queries.queried_times", {
                          count: bucket.total,
                        })}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <Table className="table-fixed">
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("statistics.metrics.table.word")}</TableHead>
                            <TableHead className="w-[120px] text-right">
                              {t("statistics.metrics.table.count")}
                            </TableHead>
                            {onRemoveWord && <TableHead className="w-[60px]"></TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bucket.words.slice(0, 5).map((word) => (
                            <TableRow key={word.word}>
                              <TableCell className="font-medium">
                                <span
                                  className="block max-w-[12rem] truncate"
                                  title={word.word}
                                >
                                  {word.word}
                                </span>
                              </TableCell>
                              <TableCell className="w-[120px] text-right tabular-nums">
                                {word.count}
                              </TableCell>
                              {onRemoveWord && (
                                <TableCell className="w-[60px]">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onRemoveWord(word.word)}
                                    className="size-8"
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </Section>
  );
}
