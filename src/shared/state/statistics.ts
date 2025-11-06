import { atom } from "jotai";
import { addDays, format, parseISO, startOfMonth, startOfWeek, startOfYear } from "date-fns";
import { queryHistoryAtom } from "@/shared/state/dictionary";
import {
  AggregatedMetric,
  QueryMetric,
  StatisticsSnapshot,
} from "@/shared/types/statistics";
import { QueryRecord } from "@/shared/types/dictionary";

const MAX_LEARNED_WORDS = 100;

const queryMetricsAtom = atom<QueryMetric[]>((get) => {
  const history = get(queryHistoryAtom);
  const byWord = new Map<string, QueryMetric>();

  for (const entry of history) {
    const existing = byWord.get(entry.word);
    if (!existing) {
      byWord.set(entry.word, {
        word: entry.word,
        count: 1,
        lastQueriedAt: entry.timestamp,
      });
    } else {
      existing.count += 1;
      existing.lastQueriedAt = entry.timestamp;
    }
  }

  return Array.from(byWord.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.lastQueriedAt.localeCompare(a.lastQueriedAt);
  });
});

const learnedWordsAtom = atom<string[]>((get) => {
  const metrics = get(queryMetricsAtom);
  return metrics
    .filter((metric) => metric.count > 0)
    .slice(0, MAX_LEARNED_WORDS)
    .map((metric) => metric.word);
});

function formatBucketLabel(
  period: AggregatedMetric["period"],
  key: string
) {
  if (period === "total") return "Total";
  const date = parseISO(key);

  switch (period) {
    case "day":
      return format(date, "yyyy-MM-dd");
    case "week": {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 6);
      return `${format(weekStart, "yyyy-MM-dd")} → ${format(
        weekEnd,
        "yyyy-MM-dd"
      )}`;
    }
    case "month":
      return format(startOfMonth(date), "yyyy-MM");
    case "year":
      return format(startOfYear(date), "yyyy");
    default:
      return format(date, "yyyy-MM-dd");
  }
}

function computeAggregates(history: QueryRecord[]) {
  const periods: AggregatedMetric["period"][] = [
    "day",
    "week",
    "month",
    "year",
    "total",
  ];

  return periods.map<AggregatedMetric>((period) => {
    const bucketMap = new Map<
      string,
      {
        words: Map<string, QueryMetric>;
        total: number;
        key: number;
      }
    >();

    for (const entry of history) {
      const date = parseISO(entry.timestamp);
      let bucketKey: string;
      let orderKey: number;

      switch (period) {
        case "day":
          bucketKey = format(date, "yyyy-MM-dd");
          orderKey = Number(format(date, "yyyyMMdd"));
          break;
        case "week": {
          const weekStart = startOfWeek(date, { weekStartsOn: 1 });
          bucketKey = weekStart.toISOString();
          orderKey = weekStart.getTime();
          break;
        }
        case "month": {
          const monthStart = startOfMonth(date);
          bucketKey = monthStart.toISOString();
          orderKey = monthStart.getTime();
          break;
        }
        case "year": {
          const yearStart = startOfYear(date);
          bucketKey = yearStart.toISOString();
          orderKey = yearStart.getTime();
          break;
        }
        case "total":
        default:
          bucketKey = "total";
          orderKey = 0;
          break;
      }

      const bucket =
        bucketMap.get(bucketKey) ??
        bucketMap
          .set(bucketKey, {
            words: new Map<string, QueryMetric>(),
            total: 0,
            key: orderKey,
          })
          .get(bucketKey)!;

      const metric =
        bucket.words.get(entry.word) ??
        bucket.words
          .set(entry.word, {
            word: entry.word,
            count: 0,
            lastQueriedAt: entry.timestamp,
          })
          .get(entry.word)!;

      metric.count += 1;
      metric.lastQueriedAt = entry.timestamp;
      bucket.total += 1;
    }

    const buckets = Array.from(bucketMap.entries())
      .map(([bucketKey, bucket]) => ({
        label: period === "total" ? "Total" : formatBucketLabel(period, bucketKey),
        total: bucket.total,
        words: Array.from(bucket.words.values()).sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return b.lastQueriedAt.localeCompare(a.lastQueriedAt);
        }),
        orderKey: bucket.key,
      }))
      .sort((a, b) => b.orderKey - a.orderKey)
      .map(({ orderKey: _orderKey, ...rest }) => rest);

    return {
      period,
      buckets,
    };
  });
}

const aggregatesAtom = atom<AggregatedMetric[]>((get) => {
  const history = get(queryHistoryAtom);
  return computeAggregates(history);
});

export const statisticsSnapshotAtom = atom<StatisticsSnapshot>((get) => ({
  learnedWords: get(learnedWordsAtom),
  queryMetrics: get(queryMetricsAtom),
  aggregates: get(aggregatesAtom),
}));
