import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
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

  // Parse shortcut string and render as kbd elements
  const renderShortcut = (shortcut: string) => {
    const keys = shortcut.split("+");
    return (
      <KbdGroup>
        {keys.map((key, index) => (
          <Kbd key={index}>{key === " " || key === "" ? "Space" : key}</Kbd>
        ))}
      </KbdGroup>
    );
  };

  // Handle keyboard events and convert to shortcut notation
  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    field: "quickQuery" | "newQuery"
  ) => {
    event.preventDefault();
    
    const keys: string[] = [];
    
    // Add modifiers
    if (event.ctrlKey || event.metaKey) {
      keys.push("Mod");
    }
    if (event.shiftKey && event.key !== "Shift") {
      keys.push("Shift");
    }
    if (event.altKey && event.key !== "Alt") {
      keys.push("Alt");
    }
    
    // Add the main key (if it's not a modifier)
    const key = event.key;
    if (!["Control", "Meta", "Shift", "Alt"].includes(key)) {
      // Format the key name
      let formattedKey = key;
      if (key.length === 1) {
        formattedKey = key.toUpperCase();
      } else if (key === " ") {
        formattedKey = "Space";
      } else {
        // Capitalize first letter for keys like "Enter", "Escape", etc.
        formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
      }
      keys.push(formattedKey);
    }
    
    // Only update if we have a complete shortcut
    if (keys.length > 0 && !["Shift", "Alt", "Mod"].includes(keys[keys.length - 1])) {
      const shortcut = keys.join("+");
      updateKeyboard({ [field]: shortcut });
    }
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
            <div className="flex items-center justify-between">
              <Label htmlFor="shortcut-quick">{t("settings.keyboard.shortcuts.quick_query")}</Label>
              {renderShortcut(settings.keyboard.quickQuery)}
            </div>
            <Input
              id="shortcut-quick"
              value={settings.keyboard.quickQuery}
              onKeyDown={(event) => handleKeyDown(event, "quickQuery")}
              onChange={(event) =>
                updateKeyboard({ quickQuery: event.target.value })
              }
              placeholder="Mod+Enter"
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="shortcut-new">{t("settings.keyboard.shortcuts.new_query")}</Label>
              {renderShortcut(settings.keyboard.newQuery)}
            </div>
            <Input
              id="shortcut-new"
              value={settings.keyboard.newQuery}
              onKeyDown={(event) => handleKeyDown(event, "newQuery")}
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
    </div>
  );
}
