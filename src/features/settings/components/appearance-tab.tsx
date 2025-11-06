import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { cn } from "@/lib/utils";

const themeOptions = [
  {
    value: "system",
    label: "Match system",
    description: "Automatically switch between light and dark.",
  },
  {
    value: "light",
    label: "Light",
    description: "Bright UI with higher contrast.",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Dim UI that is easier on the eyes at night.",
  },
] satisfies Array<{
  value: "system" | "light" | "dark";
  label: string;
  description: string;
}>;

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
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <RadioGroup
            value={settings.theme.mode}
            onValueChange={(value) =>
              updateTheme({ mode: value as (typeof themeOptions)[number]["value"] })
            }
            className="grid gap-3"
          >
            {themeOptions.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "border-input hover:border-foreground/50 flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors",
                  settings.theme.mode === option.value && "border-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={option.value} />
                  <span className="font-medium">{option.label}</span>
                </div>
                <span className="text-muted-foreground text-sm">
                  {option.description}
                </span>
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accent color</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            Adjust the primary highlight color across the interface.
          </p>
          <div className="grid grid-cols-5 gap-3">
            {accentOptions.map((accent) => {
              const isSelected = settings.theme.accent === accent.value;
              return (
                <Button
                  key={accent.value}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  className={cn("flex h-16 flex-col items-center gap-2")}
                  onClick={() => updateTheme({ accent: accent.value })}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full transition-colors",
                      accent.className,
                      isSelected && "ring-2 ring-offset-2"
                    )}
                  >
                    {isSelected && <Check className="size-4 text-white" />}
                  </span>
                  <span className="text-xs font-medium">{accent.label}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-muted/40 p-4">
            <Label className="text-xs uppercase text-muted-foreground">
              Heading
            </Label>
            <p className="text-foreground text-xl font-semibold">
              Adapt to your workspace
            </p>
            <p className="text-muted-foreground text-sm">
              The app will follow the selected theme automatically. Accent
              colors apply to buttons, links, and highlights.
            </p>
          </div>
          <div className="rounded-lg border bg-background p-4 shadow-inner">
            <Label className="text-xs uppercase text-muted-foreground">
              Buttons
            </Label>
            <div className="mt-2 flex gap-2">
              <Button size="sm">Primary</Button>
              <Button size="sm" variant="outline">
                Outline
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
