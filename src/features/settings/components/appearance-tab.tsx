import { Check } from "lucide-react";
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

const themeModeOptions = [
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
] satisfies Array<{ value: "system" | "light" | "dark"; label: string }>;

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
  const { settings, updateTheme } = useSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme</CardTitle>
        <CardDescription>
          Choose the overall appearance and highlight color.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-4">
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mode
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
                mode: value as (typeof themeModeOptions)[number]["value"],
              });
            }}
            className="w-fit rounded-lg  bg-transparent"
          >
            {themeModeOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Accent Color
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
  );
}
