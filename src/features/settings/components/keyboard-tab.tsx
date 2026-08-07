import { Button } from "@/components/ui/button";
import { Section } from "@/shared/components/section";
import { KbdInput } from "@/components/ui/kbd-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { defaultSettings } from "@/shared/state/settings";
import { formatShortcut } from "@/shared/lib/shortcuts";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function KeyboardTab() {
  const { t } = useTranslation();
  const { settings, updateKeyboard } = useSettings();

  const handleReset = () => {
    updateKeyboard({
      quickQuery: defaultSettings.keyboard.quickQuery,
      newQuery: defaultSettings.keyboard.newQuery,
    });
    toast.success(t("settings.keyboard.toast.reset"));
  };

  // Placeholders spell the defaults the way this platform presses them.
  const placeholder = (value: string) => formatShortcut(value).join(" ");

  return (
    <div className="flex flex-col">
      <Section
        title={t("settings.keyboard.shortcuts.title")}
        description={t("settings.keyboard.shortcuts.description")}
        contentClassName="grid gap-4"
      >
          <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/40 px-4 py-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {t("settings.keyboard.shortcuts.enable_label")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("settings.keyboard.shortcuts.enable_helper")}
              </p>
            </div>
            <Switch
              checked={settings.keyboard.enabled}
              onCheckedChange={(checked) =>
                updateKeyboard({ enabled: checked })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="shortcut-quick">{t("settings.keyboard.shortcuts.quick_query")}</Label>
            <KbdInput
              id="shortcut-quick"
              value={settings.keyboard.quickQuery}
              onChange={(value) => updateKeyboard({ quickQuery: value })}
              placeholder={placeholder(defaultSettings.keyboard.quickQuery)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="shortcut-new">{t("settings.keyboard.shortcuts.new_query")}</Label>
            <KbdInput
              id="shortcut-new"
              value={settings.keyboard.newQuery}
              onChange={(value) => updateKeyboard({ newQuery: value })}
              placeholder={placeholder(defaultSettings.keyboard.newQuery)}
            />
          </div>
          <Button variant="outline" onClick={handleReset}>
            {t("settings.keyboard.shortcuts.reset")}
          </Button>
        </Section>
    </div>
  );
}
