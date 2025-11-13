import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KbdInput } from "@/components/ui/kbd-input";
import { Label } from "@/components/ui/label";
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
    <div className="grid gap-6">
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
            <KbdInput
              id="shortcut-quick"
              value={settings.keyboard.quickQuery}
              onChange={(value) => updateKeyboard({ quickQuery: value })}
              placeholder="Mod+Enter"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="shortcut-new">{t("settings.keyboard.shortcuts.new_query")}</Label>
            <KbdInput
              id="shortcut-new"
              value={settings.keyboard.newQuery}
              onChange={(value) => updateKeyboard({ newQuery: value })}
              placeholder="Mod+Shift+K"
            />
          </div>
          <Button variant="outline" onClick={handleReset}>
            {t("settings.keyboard.shortcuts.reset")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
