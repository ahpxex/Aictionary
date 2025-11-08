import { useState } from "react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
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
import { Separator } from "@/components/ui/separator";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { formatDistanceToNow } from "date-fns";

export function DictionaryTab() {
  const { t } = useTranslation();
  const { settings, updateDictionary } = useSettings();
  const [isRefreshing, setIsRefreshing] = useState(false);

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
    <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
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
            <Input
              id="cache-path"
              placeholder="/path/to/cache"
              value={settings.dictionary.cachePath}
              onChange={(event) =>
                updateDictionary({ cachePath: event.target.value })
              }
            />
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

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.dictionary.why.title")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground">
          <p>• {t("settings.dictionary.why.items.0")}</p>
          <p>• {t("settings.dictionary.why.items.1")}</p>
          <Separator />
          <p>
            The cache will be refreshed automatically after the next successful
            download. Configure the service provider to enable live updates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
