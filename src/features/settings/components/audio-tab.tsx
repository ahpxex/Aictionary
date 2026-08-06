import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown } from "lucide-react";
import { Section } from "@/shared/components/section";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
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
import type { AudioSettings, TtsProviderKind } from "@/shared/types/settings";

const PROVIDERS: TtsProviderKind[] = ["edge", "fish", "openai", "elevenlabs"];

type EdgeVoice = {
  shortName: string;
  locale: string;
  gender: string;
  friendlyName: string;
};

/**
 * Searchable picker over the live Edge voice catalog. Voices are fetched
 * once, on first open, through the Rust backend.
 */
function EdgeVoicePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (voice: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [voices, setVoices] = useState<EdgeVoice[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && voices === null && !isLoading) {
      setIsLoading(true);
      setLoadError(null);
      invoke<EdgeVoice[]>("list_edge_voices")
        .then(setVoices)
        .catch((error) => {
          setLoadError(typeof error === "string" ? error : String(error));
        })
        .finally(() => setIsLoading(false));
    }
  };

  return (
    <div className="grid gap-2">
      <Label>{t("settings.audio.edge.voice.label")}</Label>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {value || t("settings.audio.edge.voice.placeholder")}
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={t("settings.audio.edge.voice.search")} />
            <CommandList>
              <CommandEmpty>
                {isLoading
                  ? t("settings.audio.edge.voice.loading")
                  : loadError ?? t("settings.audio.edge.voice.empty")}
              </CommandEmpty>
              {(voices ?? []).map((voice) => (
                <CommandItem
                  key={voice.shortName}
                  value={`${voice.shortName} ${voice.locale} ${voice.friendlyName}`}
                  onSelect={() => {
                    onChange(voice.shortName);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "size-4",
                      voice.shortName === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{voice.shortName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {voice.locale}
                      {voice.gender ? ` \u00b7 ${voice.gender}` : ""}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground">
        {t("settings.audio.edge.voice.helper")}
      </p>
    </div>
  );
}

type FieldProps = {
  id: string;
  labelKey: string;
  value: string;
  onChange: (value: string) => void;
  password?: boolean;
};

function TextField({ id, labelKey, value, onChange, password }: FieldProps) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{t(`${labelKey}.label`)}</Label>
      <Input
        id={id}
        type={password ? "password" : "text"}
        placeholder={t(`${labelKey}.placeholder`)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="text-xs text-muted-foreground">{t(`${labelKey}.helper`)}</p>
    </div>
  );
}

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

  const patchProvider = <K extends "edge" | "fish" | "openai" | "elevenlabs">(
    key: K,
    changes: Partial<AudioSettings[K]>
  ) => {
    updateAudio((prev) => ({ ...prev, [key]: { ...prev[key], ...changes } }));
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
            {PROVIDERS.map((provider) => (
              <ToggleGroupItem key={provider} value={provider}>
                {t(`settings.audio.provider.${provider}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">
            {t("settings.audio.provider.helper")}
          </p>
        </div>
      </Section>

      {audio.provider === "edge" && (
        <Section
          title={t("settings.audio.edge.title")}
          description={t("settings.audio.edge.description")}
          contentClassName="grid gap-4"
        >
          <EdgeVoicePicker
            value={audio.edge.voice}
            onChange={(voice) => patchProvider("edge", { voice })}
          />
        </Section>
      )}

      {audio.provider === "fish" && (
        <Section
          title={t("settings.audio.fish.title")}
          description={t("settings.audio.fish.description")}
          contentClassName="grid gap-4"
        >
          <TextField
            id="fish-api-key"
            labelKey="settings.audio.fish.api_key"
            value={audio.fish.apiKey}
            onChange={(value) => patchProvider("fish", { apiKey: value.trim() })}
            password
          />

          <div className="grid gap-2">
            <Label htmlFor="fish-model">
              {t("settings.audio.fish.model.label")}
            </Label>
            <Select
              value={audio.fish.model}
              onValueChange={(value) => patchProvider("fish", { model: value })}
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

          <TextField
            id="fish-voice"
            labelKey="settings.audio.fish.voice"
            value={audio.fish.voiceId}
            onChange={(value) => patchProvider("fish", { voiceId: value })}
          />
        </Section>
      )}

      {audio.provider === "openai" && (
        <Section
          title={t("settings.audio.openai.title")}
          description={t("settings.audio.openai.description")}
          contentClassName="grid gap-4"
        >
          <TextField
            id="openai-base-url"
            labelKey="settings.audio.openai.base_url"
            value={audio.openai.baseUrl}
            onChange={(value) =>
              patchProvider("openai", { baseUrl: value.trim() })
            }
          />
          <TextField
            id="openai-api-key"
            labelKey="settings.audio.openai.api_key"
            value={audio.openai.apiKey}
            onChange={(value) =>
              patchProvider("openai", { apiKey: value.trim() })
            }
            password
          />
          <TextField
            id="openai-model"
            labelKey="settings.audio.openai.model"
            value={audio.openai.model}
            onChange={(value) => patchProvider("openai", { model: value })}
          />
          <TextField
            id="openai-voice"
            labelKey="settings.audio.openai.voice"
            value={audio.openai.voice}
            onChange={(value) => patchProvider("openai", { voice: value })}
          />
        </Section>
      )}

      {audio.provider === "elevenlabs" && (
        <Section
          title={t("settings.audio.elevenlabs.title")}
          description={t("settings.audio.elevenlabs.description")}
          contentClassName="grid gap-4"
        >
          <TextField
            id="elevenlabs-api-key"
            labelKey="settings.audio.elevenlabs.api_key"
            value={audio.elevenlabs.apiKey}
            onChange={(value) =>
              patchProvider("elevenlabs", { apiKey: value.trim() })
            }
            password
          />
          <TextField
            id="elevenlabs-voice"
            labelKey="settings.audio.elevenlabs.voice"
            value={audio.elevenlabs.voiceId}
            onChange={(value) =>
              patchProvider("elevenlabs", { voiceId: value.trim() })
            }
          />
          <TextField
            id="elevenlabs-model"
            labelKey="settings.audio.elevenlabs.model"
            value={audio.elevenlabs.model}
            onChange={(value) => patchProvider("elevenlabs", { model: value })}
          />
        </Section>
      )}
    </div>
  );
}
