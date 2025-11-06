import { useState } from "react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
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
      toast.success("Dictionary cache refreshed.");
    } catch (error) {
      console.warn(error);
      toast.error("Unable to refresh the dictionary cache.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenCache = async () => {
    if (!settings.dictionary.cachePath) {
      toast.error("Set a cache location first.");
      return;
    }
    try {
      await openPath(settings.dictionary.cachePath);
    } catch (error) {
      console.warn(error);
      toast.error("Failed to open the cache folder.");
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Cache management</CardTitle>
          <CardDescription>
            The dictionary cache keeps offline results for faster lookups.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cache-path">Cache directory</Label>
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
            <span>Last updated:</span>
            <span className="font-medium text-foreground">
              {settings.dictionary.lastUpdated
                ? formatDistanceToNow(new Date(settings.dictionary.lastUpdated), {
                    addSuffix: true,
                  })
                : "Never"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleRedownload} disabled={isRefreshing}>
              {isRefreshing ? "Refreshing…" : "Re-download cache"}
            </Button>
            <Button variant="secondary" onClick={handleOpenCache}>
              Show in Finder
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                updateDictionary({ cachePath: "", lastUpdated: null })
              }
            >
              Clear path
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Why cache?</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground">
          <p>• Keep key vocabulary available even without network access.</p>
          <p>• Reduce latency for frequently queried words.</p>
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
