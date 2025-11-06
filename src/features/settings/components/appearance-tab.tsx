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
  { value: "blue", label: "Blue", className: "bg-blue-500" },
  { value: "purple", label: "Purple", className: "bg-purple-500" },
  { value: "green", label: "Green", className: "bg-emerald-500" },
  { value: "orange", label: "Orange", className: "bg-orange-500" },
  { value: "rose", label: "Rose", className: "bg-rose-500" },
] as const;

export function AppearanceTab() {
  const { settings, updateTheme } = useSettings();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Theme</CardTitle>
        <CardDescription>
          Choose the overall appearance and highlight color.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="space-y-2">
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
            className="w-fit rounded-lg border border-input bg-muted/40 p-1"
          >
            {themeModeOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-muted-foreground text-xs">
            System follows your device preference automatically.
          </p>
        </div>
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Accent Color
          </span>
          <div className="flex flex-wrap gap-3">
            {accentOptions.map((accent) => {
              const isSelected = settings.theme.accent === accent.value;

              return (
                <button
                  key={accent.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => updateTheme({ accent: accent.value })}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isSelected
                      ? "border-foreground text-foreground shadow-sm"
                      : "border-border text-muted-foreground hover:border-input hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border border-border bg-muted/60 transition",
                      isSelected && "border-foreground"
                    )}
                  >
                    <span
                      className={cn("size-4 rounded-full", accent.className)}
                    />
                  </span>
                  <span>{accent.label}</span>
                  {isSelected && <Check className="ml-auto size-4" />}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
