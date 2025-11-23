import { useMemo } from "react";
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
import { FISH_AUDIO_MODEL_OPTIONS } from "@/features/settings/constants/audio";

export function AudioTab() {
  const { t } = useTranslation();
  const { settings, updateAudio } = useSettings();

  const modelOptions = useMemo(
    () =>
      FISH_AUDIO_MODEL_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t]
  );

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.audio.title")}</CardTitle>
          <CardDescription>{t("settings.audio.description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="audio-api-key">
              {t("settings.audio.api_key.label")}
            </Label>
            <Input
              id="audio-api-key"
              type="password"
              placeholder={t("settings.audio.api_key.placeholder")}
              value={settings.audio.apiKey}
              onChange={(event) =>
                updateAudio({ apiKey: event.target.value.trim() })
              }
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.audio.api_key.helper")}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="audio-model">
              {t("settings.audio.model.label")}
            </Label>
            <Select
              value={settings.audio.model}
              onValueChange={(value) => updateAudio({ model: value })}
            >
              <SelectTrigger id="audio-model">
                <SelectValue
                  placeholder={t("settings.audio.model.placeholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("settings.audio.model.helper")}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="audio-voice">
              {t("settings.audio.voice.label")}
            </Label>
            <Input
              id="audio-voice"
              placeholder={t("settings.audio.voice.placeholder")}
              value={settings.audio.voiceId}
              onChange={(event) => updateAudio({ voiceId: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.audio.voice.helper")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
