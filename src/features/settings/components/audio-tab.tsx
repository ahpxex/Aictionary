import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import {
  fetchFishAudioVoices,
  FishAudioServiceError,
  type FishAudioVoiceSummary,
} from "@/shared/services/fish-audio-service";

const DEFAULT_VOICE_VALUE = "__default_voice__";

export function AudioTab() {
  const { t } = useTranslation();
  const { settings, updateAudio } = useSettings();
  const [voices, setVoices] = useState<FishAudioVoiceSummary[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [hasLoadedVoices, setHasLoadedVoices] = useState(false);

  const canLoadVoices = Boolean(settings.audio.apiKey.trim());

  useEffect(() => {
    setVoices([]);
    setHasLoadedVoices(false);
  }, [settings.audio.apiKey]);

  const handleLoadVoices = async () => {
    if (!canLoadVoices) {
      toast.error(t("settings.audio.voice.missing_api_key"));
      return;
    }

    setIsLoadingVoices(true);
    try {
      const list = await fetchFishAudioVoices(settings.audio.apiKey);
      setVoices(list);
      setHasLoadedVoices(true);

      if (!settings.audio.voiceId && list.length > 0) {
        updateAudio({ voiceId: list[0].id });
      }

      toast.success(
        t("settings.audio.voice.toast.success", { count: list.length })
      );
    } catch (error) {
      const message =
        error instanceof FishAudioServiceError
          ? error.message
          : t("settings.audio.voice.toast.error");
      toast.error(message);
    } finally {
      setIsLoadingVoices(false);
    }
  };

  const modelOptions = useMemo(
    () =>
      FISH_AUDIO_MODEL_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t]
  );

  const renderVoiceItems = () => {
    const items = voices.map((voice) => (
      <SelectItem key={voice.id} value={voice.id}>
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{voice.title}</span>
          <span className="text-xs text-muted-foreground break-words">
            {voice.description || voice.id}
          </span>
        </div>
      </SelectItem>
    ));

    if (
      settings.audio.voiceId &&
      !voices.some((voice) => voice.id === settings.audio.voiceId)
    ) {
      items.push(
        <SelectItem key="custom-voice" value={settings.audio.voiceId}>
          {t("settings.audio.voice.custom", { voice: settings.audio.voiceId })}
        </SelectItem>
      );
    }

    return items;
  };

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
            <Select
              value={
                settings.audio.voiceId ? settings.audio.voiceId : DEFAULT_VOICE_VALUE
              }
              onValueChange={(value) =>
                updateAudio({
                  voiceId: value === DEFAULT_VOICE_VALUE ? "" : value,
                })
              }
            >
              <SelectTrigger id="audio-voice">
                <SelectValue
                  placeholder={t("settings.audio.voice.placeholder")}
                />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={DEFAULT_VOICE_VALUE}>
                  {t("settings.audio.voice.none")}
                </SelectItem>
                {renderVoiceItems()}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("settings.audio.voice.helper")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleLoadVoices}
                disabled={!canLoadVoices || isLoadingVoices}
              >
                {isLoadingVoices
                  ? t("settings.audio.voice.loading")
                  : t("settings.audio.voice.load")}
              </Button>
            </div>
            {hasLoadedVoices && voices.length === 0 && (
              <p className="text-xs text-destructive">
                {t("settings.audio.voice.empty")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
