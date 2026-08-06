import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { openPath } from "@tauri-apps/plugin-opener";
import { open } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Section } from "@/shared/components/section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { formatDistanceToNow } from "date-fns";
import { FolderOpen } from "lucide-react";
import { DownloadDialog } from "@/shared/components/download-dialog";
import { planDictionaryDownload } from "@/shared/services/dictionary-download";
import { getDictionaryMetadata } from "@/shared/services/dictionary-service";
import type { DictionaryMetadata } from "@/shared/types/dictionary";
import type { DownloadOptions } from "@/shared/types/download";
import { MIN_FULL_DICTIONARY_ENTRIES } from "@/shared/constants/dictionary";

export function DictionaryTab() {
  const { t } = useTranslation();
  const { settings, updateDictionary } = useSettings();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadOptions, setDownloadOptions] =
    useState<DownloadOptions | null>(null);
  const [metadata, setMetadata] = useState<DictionaryMetadata | null>(null);

  const cachePath = settings.dictionary.cachePath.trim();
  const lastUpdated = settings.dictionary.lastUpdated;

  useEffect(() => {
    let cancelled = false;

    if (!cachePath) {
      setMetadata(null);
      return;
    }

    getDictionaryMetadata(cachePath)
      .then((data) => {
        if (!cancelled) {
          setMetadata(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMetadata(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cachePath, lastUpdated]);

  const handleBrowseFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: settings.dictionary.cachePath || undefined,
      });
      if (selected) {
        updateDictionary({ cachePath: selected });
      }
    } catch (error) {
      console.warn("Failed to browse folder:", error);
      toast.error(t("settings.dictionary.toast.browse_error"));
    }
  };

  const handleCheckCompleteness = async () => {
    const cachePath = settings.dictionary.cachePath.trim();
    if (!cachePath) {
      toast.error(t("settings.dictionary.toast.browse_error"));
      return;
    }

    setIsChecking(true);
    try {
      const count = await invoke<number>("count_dictionary_entries", {
        cachePath,
      });

      if (count > MIN_FULL_DICTIONARY_ENTRIES) {
        toast.success(
          t("settings.dictionary.toast.check_complete", {
            count,
          })
        );
      } else {
        toast.warning(
          t("settings.dictionary.toast.check_incomplete", {
            count,
            required: MIN_FULL_DICTIONARY_ENTRIES,
          })
        );
      }
    } catch (error) {
      console.warn("Failed to check dictionary cache completeness:", error);
      toast.error(t("settings.dictionary.toast.check_error"));
    } finally {
      setIsChecking(false);
    }
  };

  const handleRedownload = async () => {
    if (!settings.dictionary.cachePath) {
      toast.error(t("settings.dictionary.toast.browse_error"));
      return;
    }

    setIsRefreshing(true);
    try {
      const { options } = await planDictionaryDownload(
        settings.dictionary.cachePath,
        {
          onComplete: (result) => {
            console.log("Dictionary downloaded:", result);
          },
          onExtractComplete: () => {
            console.log("Dictionary extracted successfully");
          },
        }
      );

      setDownloadOptions(options);
      setDownloadDialogOpen(true);
    } catch (error) {
      console.warn("Failed to fetch dictionary release:", error);
      toast.error(t("settings.dictionary.toast.redownload_error"));
      setIsRefreshing(false);
    }
  };

  const handleOpenCache = async () => {
    if (!settings.dictionary.cachePath) {
      toast.error(t("settings.dictionary.toast.show_error"));
      return;
    }
    try {
      await openPath(settings.dictionary.cachePath);
    } catch (error) {
      console.warn(error);
      toast.error(t("settings.dictionary.toast.show_error"));
    }
  };

  const handleDownloadSuccess = () => {
    const timestamp = new Date().toISOString();
    updateDictionary({ lastUpdated: timestamp });
    toast.success(t("settings.dictionary.toast.redownload_success"));
    setIsRefreshing(false);
  };

  return (
    <>
      <div className="flex flex-col">
        <Section
          title={t("settings.dictionary.cache.title")}
          description={t("settings.dictionary.why.items.0")}
          contentClassName="grid gap-4"
        >
            <div className="grid gap-2">
              <Label htmlFor="cache-path">
                {t("settings.dictionary.cache.label")}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="cache-path"
                  placeholder="/path/to/cache"
                  value={settings.dictionary.cachePath}
                  onChange={(event) =>
                    updateDictionary({ cachePath: event.target.value })
                  }
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleBrowseFolder}
                  title={t("settings.dictionary.cache.button_browse")}
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{t("settings.dictionary.cache.last_updated")}</span>
              <span className="font-medium text-foreground">
                {settings.dictionary.lastUpdated
                  ? formatDistanceToNow(
                      new Date(settings.dictionary.lastUpdated),
                      {
                        addSuffix: true,
                      }
                    )
                  : t("settings.dictionary.cache.never")}
              </span>
            </div>
            {metadata && (
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <span>
                    {t("settings.dictionary.metadata.entries")}{" "}
                    <span className="font-medium text-foreground">
                      {metadata.entry_count?.toLocaleString() ?? "-"}
                    </span>
                  </span>
                  <span>
                    {t("settings.dictionary.metadata.user_entries")}{" "}
                    <span className="font-medium text-foreground">
                      {metadata.user_entry_count?.toLocaleString() ?? 0}
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <span>
                    {t("settings.dictionary.metadata.schema")}{" "}
                    <span className="font-medium text-foreground">
                      {metadata.distribution_schema_version ?? "-"}
                    </span>
                  </span>
                  {metadata.definition_language?.name && (
                    <span>
                      {t("settings.dictionary.metadata.definition_language")}{" "}
                      <span className="font-medium text-foreground">
                        {metadata.definition_language.name}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleRedownload} disabled={isRefreshing}>
                {isRefreshing
                  ? "Refreshing…"
                  : t("settings.dictionary.cache.button_redownload")}
              </Button>
              <Button
                variant="outline"
                onClick={handleCheckCompleteness}
                disabled={isChecking}
              >
                {isChecking
                  ? t("settings.dictionary.cache.button_checking")
                  : t("settings.dictionary.cache.button_check")}
              </Button>
              <Button variant="outline" onClick={handleOpenCache}>
                {t("settings.dictionary.cache.button_show")}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  updateDictionary({ cachePath: "", lastUpdated: null });
                  toast.success(t("settings.dictionary.toast.clear_success"));
                }}
              >
                {t("settings.dictionary.cache.button_clear")}
              </Button>
            </div>
          </Section>
      </div>

      <DownloadDialog
        open={downloadDialogOpen}
        onOpenChange={setDownloadDialogOpen}
        downloadOptions={downloadOptions}
        onSuccess={handleDownloadSuccess}
      />
    </>
  );
}
