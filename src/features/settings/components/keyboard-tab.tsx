import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { toast } from "sonner";

export function KeyboardTab() {
  const { settings, updateKeyboard } = useSettings();

  const handleReset = () => {
    updateKeyboard({
      quickQuery: "Mod+Enter",
      newQuery: "Mod+Shift+K",
    });
    toast.success("Keyboard shortcuts restored.");
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Shortcuts</CardTitle>
          <CardDescription>
            Configure the key combinations for quick interactions.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="shortcut-quick">Quick query</Label>
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
            <Label htmlFor="shortcut-new">New query</Label>
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
            Reset to defaults
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground">
          <p>
            • Quick query focuses the search bar and submits automatically when
            text is highlighted.
          </p>
          <p>
            • New query opens a fresh search input regardless of current state.
          </p>
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

