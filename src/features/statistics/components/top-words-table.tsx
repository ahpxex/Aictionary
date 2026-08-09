import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Section } from "@/shared/components/section";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { QueryMetric } from "@/shared/types/statistics";
import { formatDistanceToNow, parseISO } from "date-fns";

type TopWordsTableProps = {
  metrics: QueryMetric[];
  onRemoveWord?: (word: string) => void;
};

export function TopWordsTable({ metrics, onRemoveWord }: TopWordsTableProps) {
  const { t } = useTranslation();
  return (
    <Section
      title={t("statistics.top_words.title")}
      description={t("statistics.top_words.description")}
      contentClassName="overflow-x-auto"
    >
        {/* 340px of the columns are fixed, so without a floor the word column
            collapses to a few characters on a phone instead of the row
            scrolling sideways. */}
        <Table className="min-w-[30rem] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>{t("statistics.top_words.table.word")}</TableHead>
              <TableHead className="w-[120px] text-right">{t("statistics.top_words.table.times_queried")}</TableHead>
              <TableHead className="w-[160px] text-right">{t("statistics.top_words.table.last_queried")}</TableHead>
              {onRemoveWord && <TableHead className="w-[60px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.length === 0 ? (
              <TableRow>
                <TableCell colSpan={onRemoveWord ? 4 : 3} className="text-center text-muted-foreground">
                  {t("statistics.top_words.empty_state")}
                </TableCell>
              </TableRow>
            ) : (
              metrics.slice(0, 10).map((metric) => (
                <TableRow key={metric.word}>
                  <TableCell className="font-medium">
                    <span
                      className="block max-w-[16rem] truncate"
                      title={metric.word}
                    >
                      {metric.word}
                    </span>
                  </TableCell>
                  <TableCell className="w-[120px] text-right font-semibold">
                    {metric.count}
                  </TableCell>
                  <TableCell className="w-[160px] text-right text-sm text-muted-foreground">
                    {formatDistanceToNow(parseISO(metric.lastQueriedAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  {onRemoveWord && (
                    <TableCell className="w-[60px]">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveWord(metric.word)}
                        className="size-8"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
    </Section>
  );
}
