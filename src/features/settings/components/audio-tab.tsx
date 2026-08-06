import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Section } from "@/shared/components/section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { FISH_AUDIO_MODEL_OPTIONS } from "@/features/settings/constants/audio";
import type { TtsProviderKind } from "@/shared/types/settings";

export function AudioTab() {
  const { t } = useTranslation();
  const { settings, updateAudio } = useSettings();
  const audio = settings.audio;

  const fishModelOptions = useMemo(
    () =>
      FISH_AUDIO_MODEL_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t]
  );

  const updateFish = (changes: Partial<typeof audio.fish>) => {
    updateAudio((prev) => ({ ...prev, fish: { ...prev.fish, ...changes } }));
  };

  const updateOpenAi = (changes: Partial<typeof audio.openai>) => {
    updateAudio((prev) => ({ ...prev, openai: { ...prev.openai, ...changes } }));
  };

  return (
    <div className="flex flex-col">
      <Section
        title={t("settings.audio.title")}
        description={t("settings.audio.description")}
        contentClassName="grid gap-4"
      >
        <div className="grid gap-2">
          <Label>{t("settings.audio.provider.label")}</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            size="sm"
            value={audio.provider}
            onValueChange={(value) => {
              if (!value) return;
              updateAudio({ provider: value as TtsProviderKind });
            }}
            className="w-fit bg-transparent"
          >
            <ToggleGroupItem value="fish">
              {t("settings.audio.provider.fish")}
            </ToggleGroupItem>
            <ToggleGroupItem value="openai">
              {t("settings.audio.provider.openai")}
            </ToggleGroupItem>
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">
            {t("settings.audio.provider.helper")}
          </p>
        </div>
      </Section>

      {audio.provider === "fish" ? (
        <Section
          title={t("settings.audio.fish.title")}
          description={t("settings.audio.fish.description")}
          contentClassName="grid gap-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="fish-api-key">
              {t("settings.audio.fish.api_key.label")}
            </Label>
            <Input
              id="fish-api-key"
              type="password"
              placeholder={t("settings.audio.fish.api_key.placeholder")}
              value={audio.fish.apiKey}
              onChange={(event) =>
                updateFish({ apiKey: event.target.value.trim() })
              }
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.audio.fish.api_key.helper")}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="fish-model">
              {t("settings.audio.fish.model.label")}
            </Label>
            <Select
              value={audio.fish.model}
              onValueChange={(value) => updateFish({ model: value })}
            >
              <SelectTrigger id="fish-model">
                <SelectValue
                  placeholder={t("settings.audio.fish.model.placeholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {fishModelOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("settings.audio.fish.model.helper")}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="fish-voice">
              {t("settings.audio.fish.voice.label")}
            </Label>
            <Input
              id="fish-voice"
              placeholder={t("settings.audio.fish.voice.placeholder")}
              value={audio.fish.voiceId}
              onChange={(event) => updateFish({ voiceId: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.audio.fish.voice.helper")}
            </p>
          </div>
        </Section>
      ) : (
        <Section
          title={t("settings.audio.openai.title")}
          description={t("settings.audio.openai.description")}
          contentClassName="grid gap-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="openai-base-url">
              {t("settings.audio.openai.base_url.label")}
            </Label>
            <Input
              id="openai-base-url"
              placeholder={t("settings.audio.openai.base_url.placeholder")}
              value={audio.openai.baseUrl}
              onChange={(event) =>
                updateOpenAi({ baseUrl: event.target.value.trim() })
              }
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.audio.openai.base_url.helper")}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="openai-api-key">
              {t("settings.audio.openai.api_key.label")}
            </Label>
            <Input
              id="openai-api-key"
              type="password"
              placeholder={t("settings.audio.openai.api_key.placeholder")}
              value={audio.openai.apiKey}
              onChange={(event) =>
                updateOpenAi({ apiKey: event.target.value.trim() })
              }
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.audio.openai.api_key.helper")}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="openai-model">
              {t("settings.audio.openai.model.label")}
            </Label>
            <Input
              id="openai-model"
              placeholder={t("settings.audio.openai.model.placeholder")}
              value={audio.openai.model}
              onChange={(event) => updateOpenAi({ model: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.audio.openai.model.helper")}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="openai-voice">
              {t("settings.audio.openai.voice.label")}
            </Label>
            <Input
              id="openai-voice"
              placeholder={t("settings.audio.openai.voice.placeholder")}
              value={audio.openai.voice}
              onChange={(event) => updateOpenAi({ voice: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.audio.openai.voice.helper")}
            </p>
          </div>
        </Section>
      )}
    </div>
  );
}
