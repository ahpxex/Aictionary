import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { cn } from "@/lib/utils";

const accentOptions = [
  {
    value: "blue",
    label: "Blue",
    className: "bg-blue-500",
    borderClassName: "border-blue-500",
  },
  {
    value: "purple",
    label: "Purple",
    className: "bg-purple-500",
    borderClassName: "border-purple-500",
  },
  {
    value: "green",
    label: "Green",
    className: "bg-emerald-500",
    borderClassName: "border-emerald-500",
  },
  {
    value: "orange",
    label: "Orange",
    className: "bg-orange-500",
    borderClassName: "border-orange-500",
  },
  {
    value: "rose",
    label: "Rose",
    className: "bg-rose-500",
    borderClassName: "border-rose-500",
  },
] as const;

const languageOptions = [
  { value: "en", labelKey: "settings.language.options.en" },
  { value: "zh", labelKey: "settings.language.options.zh" },
] as const;

export function AppearanceTab() {
  const { t } = useTranslation();
  const { settings, updateTheme, updateLanguage, updateSystem } = useSettings();

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.appearance.title")}</CardTitle>
          <CardDescription>
            {t("settings.appearance.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("settings.appearance.mode.label")}
            </span>
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={0}
              size="sm"
              value={settings.theme.mode}
              onValueChange={(value) => {
                if (!value) return;
                updateTheme({
                  mode: value as "system" | "light" | "dark",
                });
              }}
              className="w-fit rounded-lg  bg-transparent"
            >
              <ToggleGroupItem value="light">
                {t("settings.appearance.mode.light")}
              </ToggleGroupItem>
              <ToggleGroupItem value="system">
                {t("settings.appearance.mode.system")}
              </ToggleGroupItem>
              <ToggleGroupItem value="dark">
                {t("settings.appearance.mode.dark")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("settings.appearance.accent.label")}
            </span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={settings.theme.accent}
              onValueChange={(value) => {
                if (!value) return;
                updateTheme({ accent: value as typeof accentOptions[number]["value"] });
              }}
              className="w-fit flex-wrap justify-start"
            >
              {accentOptions.map((accent) => (
                <ToggleGroupItem
                  key={accent.value}
                  value={accent.value}
                >
                  <span
                    className={cn("size-4 rounded-full", accent.className)}
                  />

                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.language.title")}</CardTitle>
          <CardDescription>
            {t("settings.language.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {t("settings.language.label")}
            </label>
            <Select
              value={settings.language}
              onValueChange={(value) => updateLanguage(value as "en" | "zh")}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.appearance.desktop.title")}</CardTitle>
          <CardDescription>
            {t("settings.appearance.desktop.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {t("settings.appearance.desktop.tray_label")}
              </p>
            </div>
            <Switch
              checked={settings.system.trayIconEnabled}
              onCheckedChange={(checked) =>
                updateSystem({ trayIconEnabled: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {t("settings.appearance.desktop.startup_label")}
              </p>
            </div>
            <Switch
              checked={settings.system.launchOnSystemStart}
              onCheckedChange={(checked) =>
                updateSystem({ launchOnSystemStart: checked })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
