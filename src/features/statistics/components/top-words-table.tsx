import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QueryMetric } from "@/shared/types/statistics";
import { formatDistanceToNow, parseISO } from "date-fns";

type TopWordsTableProps = {
  metrics: QueryMetric[];
};

export function TopWordsTable({ metrics }: TopWordsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top words</CardTitle>
        <CardDescription>
          Words with the highest frequency across all time.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Word</TableHead>
              <TableHead className="text-right">Times queried</TableHead>
              <TableHead className="text-right">Last queried</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Search a word to start tracking statistics.
                </TableCell>
              </TableRow>
            ) : (
              metrics.slice(0, 10).map((metric) => (
                <TableRow key={metric.word}>
                  <TableCell className="font-medium">{metric.word}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {metric.count}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatDistanceToNow(parseISO(metric.lastQueriedAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

