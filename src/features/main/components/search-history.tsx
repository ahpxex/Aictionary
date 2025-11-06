import { HistoryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { QueryRecord } from "@/shared/types/dictionary";
import { formatDistanceToNow, parseISO } from "date-fns";

type SearchHistoryProps = {
  history: QueryRecord[];
  onSelect: (word: string) => void;
};

export function SearchHistory({ history, onSelect }: SearchHistoryProps) {
  if (history.length === 0) return null;

  const unique = Array.from(
    history.reduce((acc, record) => {
      if (!acc.has(record.word)) {
        acc.set(record.word, record);
      }
      return acc;
    }, new Map<string, QueryRecord>())
  ).map(([, record]) => record);

  return (
    <div className="rounded-xl border">
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <HistoryIcon className="size-4" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Recent queries
          </h2>
        </div>
      </div>
      <ScrollArea className="max-h-72">
        <div className="grid gap-1 p-2">
          {unique.slice(0, 15).map((record, index) => (
            <div key={`${record.word}-${index}`}>
              <Button
                variant="ghost"
                className="flex w-full items-center justify-between px-3 py-2"
                onClick={() => onSelect(record.word)}
              >
                <span className="font-medium">{record.word}</span>
                <span className="text-muted-foreground text-xs">
                  {formatDistanceToNow(parseISO(record.timestamp), {
                    addSuffix: true,
                  })}
                </span>
              </Button>
              {index < unique.length - 1 && <Separator className="mx-3" />}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

