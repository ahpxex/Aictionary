import { useState, useEffect } from "react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { open } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { formatDistanceToNow } from "date-fns";
import { FolderOpen } from "lucide-react";

export function DictionaryTab() {
  const { t } = useTranslation();
  const { settings, updateDictionary } = useSettings();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const initializeDefaultPath = async () => {
      if (!settings.dictionary.cachePath) {
        try {
          const defaultPath = await invoke<string>("get_default_dictionary_path");
          updateDictionary({ cachePath: defaultPath });
        } catch (error) {
          console.warn("Failed to get default dictionary path:", error);
        }
      }
    };
    initializeDefaultPath();
  }, []);

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

  const handleRedownload = async () => {
    setIsRefreshing(true);
    try {
      await invoke("refresh_dictionary_cache", {
        cachePath: settings.dictionary.cachePath,
      });
      const timestamp = new Date().toISOString();
      updateDictionary({ lastUpdated: timestamp });
      toast.success(t("settings.dictionary.toast.redownload_success"));
    } catch (error) {
      console.warn(error);
      toast.error(t("settings.dictionary.toast.redownload_error"));
    } finally {
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

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.dictionary.cache.title")}</CardTitle>
          <CardDescription>
            {t("settings.dictionary.why.items.0")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cache-path">{t("settings.dictionary.cache.label")}</Label>
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
                ? formatDistanceToNow(new Date(settings.dictionary.lastUpdated), {
                    addSuffix: true,
                  })
                : t("settings.dictionary.cache.never")}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleRedownload} disabled={isRefreshing}>
              {isRefreshing ? "Refreshing…" : t("settings.dictionary.cache.button_redownload")}
            </Button>
            <Button variant="secondary" onClick={handleOpenCache}>
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
        </CardContent>
      </Card>
    </div>
  );
}
