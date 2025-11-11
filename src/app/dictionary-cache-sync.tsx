import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { getLatestDictionaryRelease } from "@/shared/services/github-service";
import { DownloadDialog } from "@/shared/components/download-dialog";
import type { DownloadOptions } from "@/shared/types/download";

/**
 * Ensures the dictionary cache path is populated once when the app boots.
 * Without this, lookups run before the user opens the settings page fall
 * back to the mock definition because the cache path stays empty.
 *
 * If no cache exists, automatically triggers download of the dictionary.
 */
export function DictionaryCacheSync() {
  const { settings, updateDictionary } = useSettings();
  const isInitializingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadOptions, setDownloadOptions] = useState<DownloadOptions | null>(null);

  useEffect(() => {
    if (settings.dictionary.cachePath) {
      hasInitializedRef.current = true;
      return;
    }

    if (hasInitializedRef.current || isInitializingRef.current) {
      return;
    }

    isInitializingRef.current = true;
    let cancelled = false;

    const initializePath = async () => {
      try {
        const defaultPath = await invoke<string>("get_default_dictionary_path");
        if (cancelled || !defaultPath) {
          return;
        }

        updateDictionary((prev) => {
          if (prev.cachePath) {
            return prev;
          }
          return {
            ...prev,
            cachePath: defaultPath,
          };
        });

        // Check if cache actually has dictionary files
        const cacheExists = await invoke<boolean>("check_dictionary_cache_exists", {
          cachePath: defaultPath,
        });

        if (!cacheExists && !cancelled) {
          // Trigger auto-download
          try {
            const release = await getLatestDictionaryRelease();
            const cachePath = defaultPath.replace(/[\/\\]+$/, "");
            const lastSlashIndex = Math.max(
              cachePath.lastIndexOf("/"),
              cachePath.lastIndexOf("\\")
            );
            const parentDir = lastSlashIndex > 0 ? cachePath.substring(0, lastSlashIndex) : cachePath;
            const zipFileName = "open-english-dictionary.zip";
            const zipPath = `${parentDir}/${zipFileName}`;

            const options: DownloadOptions = {
              url: release.downloadUrl,
              filePath: zipPath,
              maxRetries: 3,
              extractAfterDownload: true,
              extractTo: parentDir,
              onComplete: (result) => {
                console.log("Dictionary auto-downloaded:", result);
              },
              onExtractComplete: () => {
                console.log("Dictionary auto-extracted successfully");
              },
            };

            setDownloadOptions(options);
            setDownloadDialogOpen(true);
          } catch (error) {
            console.warn("Failed to auto-download dictionary:", error);
          }
        }
      } catch (error) {
        console.warn("Failed to initialize dictionary cache path:", error);
      } finally {
        isInitializingRef.current = false;
        hasInitializedRef.current = true;
      }
    };

    void initializePath();

    return () => {
      cancelled = true;
    };
  }, [settings.dictionary.cachePath, updateDictionary]);

  const handleDownloadSuccess = () => {
    const timestamp = new Date().toISOString();
    updateDictionary({ lastUpdated: timestamp });
  };

  return (
    <DownloadDialog
      open={downloadDialogOpen}
      onOpenChange={setDownloadDialogOpen}
      downloadOptions={downloadOptions}
      onSuccess={handleDownloadSuccess}
    />
  );
}
