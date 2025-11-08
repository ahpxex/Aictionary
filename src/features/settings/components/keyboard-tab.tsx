import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function KeyboardTab() {
  const { t } = useTranslation();
  const { settings, updateKeyboard } = useSettings();

  const handleReset = () => {
    updateKeyboard({
      quickQuery: "Mod+Enter",
      newQuery: "Mod+Shift+K",
    });
    toast.success(t("settings.keyboard.toast.reset"));
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.keyboard.shortcuts.title")}</CardTitle>
          <CardDescription>
            Configure the key combinations for quick interactions.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="shortcut-quick">{t("settings.keyboard.shortcuts.quick_query")}</Label>
            <Input
              id="shortcut-quick"
              value={settings.keyboard.quickQuery}
              onChange={(event) =>
                updateKeyboard({ quickQuery: event.target.value })
              }
              placeholder="Mod+Enter"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="shortcut-new">{t("settings.keyboard.shortcuts.new_query")}</Label>
            <Input
              id="shortcut-new"
              value={settings.keyboard.newQuery}
              onChange={(event) =>
                updateKeyboard({ newQuery: event.target.value })
              }
              placeholder="Mod+Shift+K"
            />
          </div>
          <Button variant="outline" onClick={handleReset}>
            {t("settings.keyboard.shortcuts.reset")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.keyboard.usage.title")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground">
          <p>• {t("settings.keyboard.usage.items.0")}</p>
          <p>• {t("settings.keyboard.usage.items.1")}</p>
          <Separator />
          <p>
            Shortcuts follow the format `Mod` = `⌘` on macOS and `Ctrl` on
            Windows.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

