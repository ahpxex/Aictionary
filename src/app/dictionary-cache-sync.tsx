import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { planDictionaryDownload } from "@/shared/services/dictionary-download";
import { DownloadDialog } from "@/shared/components/download-dialog";
import type { DownloadOptions } from "@/shared/types/download";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MIN_FULL_DICTIONARY_ENTRIES } from "@/shared/constants/dictionary";

/**
 * Ensures the dictionary cache path is populated once when the app boots.
 * Without this, lookups run before the user opens the settings page fall
 * back to the mock definition because the cache path stays empty.
 *
 * If no cache exists, automatically triggers download of the dictionary.
 */
export function DictionaryCacheSync() {
  const { t } = useTranslation();
  const { settings, updateDictionary } = useSettings();
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadOptions, setDownloadOptions] = useState<DownloadOptions | null>(null);
  const [resolvedCachePath, setResolvedCachePath] = useState<string | null>(null);
  /**
   * "missing" = the user never downloaded the dictionary, so there is nothing
   * broken to report – just offer the first download.
   * "incomplete" = a dictionary was downloaded before but the database is now
   * gone or holds too few entries.
   */
  const [promptKind, setPromptKind] = useState<"missing" | "incomplete" | null>(
    null
  );
  const [entryCount, setEntryCount] = useState<number | null>(null);

  // Help verify that this component is actually mounting and running.
  useEffect(() => {
    console.log("[DictionaryCacheSync] Mounted with settings:", settings);
  }, [settings]);

  useEffect(() => {
    let cancelled = false;

    const initializePath = async () => {
      try {
        let cachePath = settings.dictionary.cachePath;

        if (!cachePath) {
          const defaultPath = await invoke<string>("get_default_dictionary_path");
          if (cancelled || !defaultPath) {
            return;
          }

          cachePath = defaultPath;

          updateDictionary((prev) => {
            if (prev.cachePath) {
              return prev;
            }
            return {
              ...prev,
              cachePath: defaultPath,
            };
          });
        }

        if (cancelled || !cachePath) {
          return;
        }

        setResolvedCachePath(cachePath);
        console.log("[DictionaryCacheSync] Using cache path:", cachePath);

        // Check if cache actually has dictionary files at all.
        const cacheExists = await invoke<boolean>("check_dictionary_cache_exists", {
          cachePath,
        });
        console.log(
          "[DictionaryCacheSync] Cache existence check:",
          cachePath,
          "exists?",
          cacheExists
        );

        if (!cancelled) {
          // A previous successful download is the only signal that there ever
          // was a cache; without it a missing database just means "not set up
          // yet", never "corrupted".
          const hasDownloadedBefore = Boolean(settings.dictionary.lastUpdated);

          if (!cacheExists) {
            console.log(
              "[DictionaryCacheSync] No dictionary database found at cache path.",
              hasDownloadedBefore ? "Previously downloaded." : "Never downloaded."
            );
            setEntryCount(0);
            setPromptKind(hasDownloadedBefore ? "incomplete" : "missing");
            return;
          }

          // Cache exists, check if it looks complete (enough entries).
          try {
            const count = await invoke<number>("count_dictionary_entries", {
              cachePath,
            });
            console.log(
              "[DictionaryCacheSync] Dictionary entry count at cache path:",
              cachePath,
              "=>",
              count
            );

            if (count <= MIN_FULL_DICTIONARY_ENTRIES) {
              console.log(
                "[DictionaryCacheSync] Cache considered incomplete (<= ",
                MIN_FULL_DICTIONARY_ENTRIES,
                "entries)."
              );
              setEntryCount(count);
              setPromptKind("incomplete");
            } else {
              console.log("[DictionaryCacheSync] Cache considered complete.");
            }
          } catch (error) {
            console.warn("Failed to check dictionary entry count:", error);
          }
        }
      } catch (error) {
        console.warn("Failed to initialize dictionary cache path:", error);
      }
    };

    void initializePath();

    return () => {
      cancelled = true;
    };
  }, [settings.dictionary.cachePath, settings.dictionary.lastUpdated, updateDictionary]);

  const handleDownloadSuccess = () => {
    const timestamp = new Date().toISOString();
    updateDictionary({ lastUpdated: timestamp });
  };

  const handleConfirmRedownload = async () => {
    if (!resolvedCachePath) {
      return;
    }

    try {
      const { options } = await planDictionaryDownload(resolvedCachePath, {
        onComplete: (result) => {
          console.log("Dictionary re-downloaded:", result);
        },
        onExtractComplete: () => {
          console.log("Dictionary re-extracted successfully");
        },
      });

      setDownloadOptions(options);
      setDownloadDialogOpen(true);
    } catch (error) {
      console.warn("Failed to re-download dictionary cache:", error);
    }
  };

  return (
    <>
      <DownloadDialog
        open={downloadDialogOpen}
        onOpenChange={setDownloadDialogOpen}
        downloadOptions={downloadOptions}
        onSuccess={handleDownloadSuccess}
      />

      <AlertDialog
        open={promptKind !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPromptKind(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {promptKind === "missing"
                ? t("settings.dictionary.missing.title")
                : t("settings.dictionary.incomplete.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {promptKind === "missing"
                ? t("settings.dictionary.missing.description")
                : t("settings.dictionary.incomplete.description", {
                    count: entryCount ?? 0,
                    required: MIN_FULL_DICTIONARY_ENTRIES,
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {promptKind === "missing"
                ? t("settings.dictionary.missing.cancel")
                : t("settings.dictionary.incomplete.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPromptKind(null);
                void handleConfirmRedownload();
              }}
            >
              {promptKind === "missing"
                ? t("settings.dictionary.missing.confirm")
                : t("settings.dictionary.incomplete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
