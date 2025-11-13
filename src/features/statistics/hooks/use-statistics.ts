import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { statisticsSnapshotAtom, removeWordAtom } from "@/shared/state/statistics";

export function useStatistics() {
  const snapshot = useAtomValue(statisticsSnapshotAtom);
  const removeWord = useSetAtom(removeWordAtom);

  const exportLearnedWords = useCallback(async () => {
    if (snapshot.learnedWords.length === 0) {
      toast.error("No learned words to export yet.");
      return;
    }

    try {
      // Show save dialog
      const filePath = await save({
        defaultPath: "aictionary_learned_words.txt",
        filters: [
          {
            name: "Text Files",
            extensions: ["txt"],
          },
        ],
      });

      // User cancelled the dialog
      if (!filePath) {
        return;
      }

      // Export to the chosen path
      const exportedPath = await invoke<string>("export_learned_words", {
        words: snapshot.learnedWords,
        filePath,
      });

      toast.success(`Learned words exported successfully`);

      // Reveal the file in file explorer
      await revealItemInDir(exportedPath);
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

  const handleRemoveWord = useCallback((word: string) => {
    removeWord(word);
    toast.success(`Removed "${word}" from statistics`);
  }, [removeWord]);

  return {
    snapshot,
    exportLearnedWords,
    exportQueryMetrics,
    removeWord: handleRemoveWord,
  };
}
