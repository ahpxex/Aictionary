import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { cn } from "@/lib/utils";

const languageOptions = [
  { value: "en", labelKey: "settings.appearance.language.en" },
  { value: "zh", labelKey: "settings.appearance.language.zh" },
] as const;

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

export function AppearanceTab() {
  const { t } = useTranslation();
  const { settings, updateTheme, updateLanguage } = useSettings();

  return (
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
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("settings.appearance.language.label")}
          </span>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            size="sm"
            value={settings.language}
            onValueChange={(value) => {
              if (!value) return;
              updateLanguage(value as "en" | "zh");
            }}
            className="w-fit rounded-lg bg-transparent"
          >
            {languageOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardContent>
    </Card>
  );
}
