import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { statisticsSnapshotAtom } from "@/shared/state/statistics";

export function useStatistics() {
  const snapshot = useAtomValue(statisticsSnapshotAtom);

  const exportLearnedWords = useCallback(async () => {
    if (snapshot.learnedWords.length === 0) {
      toast.error("No learned words to export yet.");
      return;
    }
    try {
      const exportedPath = await invoke<string>("export_learned_words", {
        words: snapshot.learnedWords,
      });
      toast.success(`Learned words exported to ${exportedPath}`);
    } catch (error) {
      console.warn(error);
      toast.error("Failed to export learned words.");
    }
  }, [snapshot.learnedWords]);

  const exportQueryMetrics = useCallback(async () => {
    if (snapshot.queryMetrics.length === 0) {
      toast.error("No query data to export yet.");
      return;
    }
    try {
      const exportedPath = await invoke<string>("export_query_metrics", {
        metrics: snapshot.queryMetrics,
      });
      toast.success(`Query statistics exported to ${exportedPath}`);
    } catch (error) {
      console.warn(error);
      toast.error("Failed to export query statistics.");
    }
  }, [snapshot.queryMetrics]);

  return {
    snapshot,
    exportLearnedWords,
    exportQueryMetrics,
  };
}
