import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Volume2, Loader2, BookmarkPlus } from "lucide-react";
import { WordDefinition } from "@/shared/types/dictionary";
import {
  playCachedAudio,
  playFishTts,
  type PlayTtsResult,
} from "@/shared/services/tts-service";
import { toast } from "sonner";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { resolveAudioCache } from "@/shared/services/audio-cache";
import { addDefinitionToAnki } from "@/shared/services/anki-service";

const MANUAL_STOP_MESSAGE = "Stream manually stopped";
const AUDIO_FORMAT = "mp3";

function isAbortError(error: unknown) {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }

  if (error instanceof Error) {
    return error.message === MANUAL_STOP_MESSAGE || error.message === "Stream cancelled.";
  }

  return false;
}

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function WordSummaryCard({ definition }: { definition: WordDefinition }) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSavingToAnki, setIsSavingToAnki] = useState(false);
  const playerRef = useRef<PlayTtsResult | null>(null);
  const isAudioConfigured = Boolean(settings.audio.apiKey.trim());
  const isAnkiConfigured = Boolean(
    settings.anki.apiUrl.trim() && settings.anki.deckName.trim()
  );
  const hasWord = Boolean(definition.word?.trim());

  const WORD_FORMS_LABELS: Record<string, string> = {
    third_person_singular: t("main.word_summary.third_person"),
    past_tense: t("main.word_summary.past_tense"),
    past_participle: t("main.word_summary.past_participle"),
    present_participle: t("main.word_summary.present_participle"),
    comparative: t("main.word_summary.comparative"),
    superlative: t("main.word_summary.superlative"),
    plural: t("main.word_summary.plural"),
    singular: t("main.word_summary.singular"),
  };
  const formEntries = Object.entries(definition.forms || {});
  const formatKey = (key: string) =>
    WORD_FORMS_LABELS[key] ?? key.replace(/_/g, " ");

  const stopPlayback = useCallback(async () => {
    if (!playerRef.current) {
      setIsPlaying(false);
      return;
    }

    try {
      await playerRef.current.stop();
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Failed to stop pronunciation playback", error);
      }
    } finally {
      playerRef.current = null;
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      void stopPlayback();
    };
  }, [definition.word, stopPlayback]);

  const handlePronunciationClick = async () => {
    if (!isAudioConfigured) {
      toast.error(t("main.word_summary.audio_not_configured"));
      return;
    }

    if (!hasWord) {
      toast.error(t("main.word_summary.audio_error"));
      return;
    }

    if (isPlaying) {
      await stopPlayback();
      return;
    }

    let cacheEntry: { path: string; exists: boolean } | null = null;
    try {
      cacheEntry = await resolveAudioCache(definition.word, {
        model: settings.audio.model,
        voiceId: settings.audio.voiceId,
        format: AUDIO_FORMAT,
      });
    } catch (error) {
      console.warn("Failed to prepare audio cache path", error);
    }

    setIsPlaying(true);
    try {
      let player: PlayTtsResult | null = null;

      if (cacheEntry?.exists) {
        try {
          player = await playCachedAudio(cacheEntry.path);
        } catch (error) {
          console.warn("Failed to play cached audio; regenerating", error);
          player = null;
        }
      }

      if (!player) {
        player = await playFishTts({
          text: definition.word,
          autoplay: true,
          format: AUDIO_FORMAT,
          cacheFilePath: cacheEntry?.path,
        });
      }

      playerRef.current = player;

      player.completion
        .catch((error) => {
          if (isAbortError(error)) {
            return;
          }

          console.error("Pronunciation playback failed", error);
          toast.error(
            resolveErrorMessage(
              error,
              t("main.word_summary.audio_error")
            )
          );
        })
        .finally(() => {
          if (playerRef.current === player) {
            playerRef.current = null;
          }
          setIsPlaying(false);
        });
    } catch (error) {
      console.error("Unable to start pronunciation playback", error);
      setIsPlaying(false);
      toast.error(
        resolveErrorMessage(error, t("main.word_summary.audio_error"))
      );
    }
  };

  const handleAddToAnki = async () => {
    if (!hasWord) {
      toast.error(t("main.word_summary.anki_error"));
      return;
    }

    if (!isAnkiConfigured) {
      toast.error(t("main.word_summary.anki_not_configured"));
      return;
    }

    setIsSavingToAnki(true);
    try {
      await addDefinitionToAnki(definition);
      toast.success(t("main.word_summary.anki_success"));
    } catch (error) {
      console.error("Failed to add word to Anki", error);
      toast.error(
        resolveErrorMessage(error, t("main.word_summary.anki_error"))
      );
    } finally {
      setIsSavingToAnki(false);
    }
  };

  const ariaLabel = !isAudioConfigured
    ? t("main.word_summary.audio_not_configured")
    : isPlaying
      ? t("main.word_summary.stop_pronunciation")
      : t("main.word_summary.play_pronunciation");

  const ankiAriaLabel = t("main.word_summary.add_to_anki");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-3xl font-bold">{definition.word}</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={ariaLabel}
              title={ariaLabel}
              onClick={handlePronunciationClick}
              disabled={!hasWord || !isAudioConfigured}
            >
              {isPlaying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Volume2 className="size-4" />
              )}
              <span className="sr-only">{ariaLabel}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={ankiAriaLabel}
              title={ankiAriaLabel}
              onClick={handleAddToAnki}
              disabled={!hasWord || !isAnkiConfigured || isSavingToAnki}
            >
              {isSavingToAnki ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <BookmarkPlus className="size-4" />
              )}
              <span className="sr-only">{ankiAriaLabel}</span>
            </Button>
          </div>
        </div>
        <CardDescription className="flex flex-wrap items-center gap-3 text-base text-muted-foreground">
          <span className="font-medium">/{definition.pronunciation}/</span>
          <span>{definition.concise_definition}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {formEntries.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-xs uppercase tracking-wide text-foreground">
              {t("main.word_summary.word_forms")}
            </span>
            <div className="flex flex-wrap gap-2">
              {formEntries
                .filter(([, value]) => value && value.trim() !== "")
                .map(([key, value]) => (
                  <Badge key={key} variant="outline" className="text-xs font-medium">
                    {formatKey(key)}：{value}
                  </Badge>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
