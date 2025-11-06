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
import { AggregatedMetric } from "@/shared/types/statistics";

type AggregatedMetricsProps = {
  aggregates: AggregatedMetric[];
};

const PERIOD_LABEL: Record<AggregatedMetric["period"], string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
  year: "Yearly",
  total: "Total",
};

export function AggregatedMetrics({ aggregates }: AggregatedMetricsProps) {
  const ordered = ["day", "week", "month", "year", "total"] as const;
  const available = ordered
    .map((period) => aggregates.find((item) => item.period === period))
    .filter((item): item is AggregatedMetric => Boolean(item));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time-based trends</CardTitle>
        <CardDescription>
          Track how your learning evolves across different timeframes.
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
                  No data yet for this period.
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
                              <TableHead>Word</TableHead>
                              <TableHead className="text-right">
                                Count
                              </TableHead>
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

