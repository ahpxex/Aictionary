export type QueryMetric = {
  word: string;
  count: number;
  lastQueriedAt: string;
};

export type AggregatedMetric = {
  period: "day" | "week" | "month" | "year" | "total";
  buckets: Array<{
    label: string;
    words: QueryMetric[];
    total: number;
  }>;
};

export type StatisticsSnapshot = {
  learnedWords: string[];
  queryMetrics: QueryMetric[];
  aggregates: AggregatedMetric[];
};

