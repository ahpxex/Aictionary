import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle>{t("statistics.metrics.title")}</CardTitle>
        <CardDescription>
          {t("statistics.metrics.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                <div className="grid gap-4">
                  {item.buckets.slice(0, 5).map((bucket) => (
                    <Card key={bucket.label} className="border-muted">
                      <CardHeader className="flex-row items-center justify-between gap-4">
                        <CardTitle className="text-base font-semibold">
                          {bucket.label}
                        </CardTitle>
                        <span className="text-muted-foreground text-sm">
                          {bucket.total} queries
                        </span>
                      </CardHeader>
                      <CardContent className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("statistics.metrics.table.word")}</TableHead>
                              <TableHead className="text-right">
                                {t("statistics.metrics.table.count")}
                              </TableHead>
                              {onRemoveWord && <TableHead className="w-[60px]"></TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bucket.words.slice(0, 5).map((word) => (
                              <TableRow key={word.word}>
                                <TableCell className="font-medium">
                                  {word.word}
                                </TableCell>
                                <TableCell className="text-right">
                                  {word.count}
                                </TableCell>
                                {onRemoveWord && (
                                  <TableCell>
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

