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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/features/settings/hooks/use-settings";
import type { AnkiSettings } from "@/shared/types/settings";

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

          <div className="grid gap-2">
            <Label htmlFor="anki-card-theme">
              {t("settings.anki.card_theme.label")}
            </Label>
            <Select
              value={settings.anki.cardTheme}
              onValueChange={(value) =>
                updateAnki({ cardTheme: value as AnkiSettings["cardTheme"] })
              }
            >
              <SelectTrigger id="anki-card-theme">
                <SelectValue
                  placeholder={t("settings.anki.card_theme.placeholder")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  {t("settings.anki.card_theme.options.light")}
                </SelectItem>
                <SelectItem value="dark">
                  {t("settings.anki.card_theme.options.dark")}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("settings.anki.card_theme.helper")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
