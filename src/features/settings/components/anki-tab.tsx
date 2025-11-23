import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/features/settings/hooks/use-settings";

export function AnkiTab() {
  const { t } = useTranslation();
  const { settings, updateAnki } = useSettings();

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.anki.title")}</CardTitle>
          <CardDescription>{t("settings.anki.description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="anki-api-url">
              {t("settings.anki.api_url.label")}
            </Label>
            <Input
              id="anki-api-url"
              placeholder={t("settings.anki.api_url.placeholder")}
              value={settings.anki.apiUrl}
              onChange={(event) => updateAnki({ apiUrl: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.anki.api_url.helper")}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="anki-deck-name">
              {t("settings.anki.deck.label")}
            </Label>
            <Input
              id="anki-deck-name"
              placeholder={t("settings.anki.deck.placeholder")}
              value={settings.anki.deckName}
              onChange={(event) => updateAnki({ deckName: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.anki.deck.helper")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
