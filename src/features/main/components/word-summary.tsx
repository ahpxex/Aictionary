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
import { DictionaryLookupResult } from "@/shared/types/dictionary";
import { collectPronunciations } from "@/shared/lib/dictionary-entry";
import {
  playCachedAudio,
  playFishTts,
  type PlayTtsResult,
} from "@/shared/services/tts-service";
import { toast } from "sonner";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { resolveAudioCache } from "@/shared/services/audio-cache";
import { addEntryToAnki } from "@/shared/services/anki-service";

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

export function WordSummaryCard({ result }: { result: DictionaryLookupResult }) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSavingToAnki, setIsSavingToAnki] = useState(false);
  const playerRef = useRef<PlayTtsResult | null>(null);
  const isAudioConfigured = Boolean(settings.audio.apiKey.trim());
  const isAnkiConfigured = Boolean(
    settings.anki.apiUrl.trim() && settings.anki.deckName.trim()
  );

  const { entry, source } = result;
  const hasWord = Boolean(entry.headword?.trim());
  const pronunciations = collectPronunciations(entry);

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
  }, [entry.headword, stopPlayback]);

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
      cacheEntry = await resolveAudioCache(entry.headword, {
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
          text: entry.headword,
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
      await addEntryToAnki(entry, {
        settingsOverride: settings.anki,
      });
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

  const entryTypeLabel =
    entry.entry_type !== "standard"
      ? t(`main.word_summary.entry_type.${entry.entry_type}`, {
          defaultValue: entry.entry_type,
        })
      : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <CardTitle className="text-4xl font-bold tracking-tight">
              {entry.headword}
            </CardTitle>
            {entryTypeLabel && (
              <Badge variant="secondary" className="text-xs">
                {entryTypeLabel}
              </Badge>
            )}
            {source === "user" && (
              <Badge variant="outline" className="text-xs">
                {t("main.word_summary.ai_generated")}
              </Badge>
            )}
          </div>
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
        <CardDescription className="flex flex-col gap-2 text-base text-muted-foreground">
          {pronunciations.length > 0 && (
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {pronunciations.map((pronunciation, index) => (
                <span key={`pron-${index}`} className="font-mono text-sm">
                  {pronunciation.tags.length > 0 && (
                    <span className="mr-1.5 text-[0.65rem] uppercase tracking-wider">
                      {pronunciation.tags.join(" ")}
                    </span>
                  )}
                  {pronunciation.ipa ?? pronunciation.text}
                </span>
              ))}
            </span>
          )}
          <span className="text-foreground/90">{entry.headword_summary}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col">
        {entry.memory_hook?.trim() && (
          <div className="border-t border-border py-4 text-sm leading-relaxed">
            <p className="mb-1.5 text-xs uppercase tracking-widest text-muted-foreground">
              {t("main.word_summary.memory_hook")}
            </p>
            <p>{entry.memory_hook}</p>
          </div>
        )}

        {entry.study_notes.length > 0 && (
          <div className="border-t border-border py-4 text-sm">
            <p className="mb-1.5 text-xs uppercase tracking-widest text-muted-foreground">
              {t("main.word_summary.study_notes")}
            </p>
            <ul className="flex flex-col gap-1 leading-relaxed">
              {entry.study_notes.map((note, index) => (
                <li key={`note-${index}`} className="flex gap-2">
                  <span className="select-none text-muted-foreground">–</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {entry.etymology_note?.trim() && (
          <div className="border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
            <p className="mb-1.5 text-xs uppercase tracking-widest">
              {t("main.word_summary.etymology")}
            </p>
            <p>{entry.etymology_note}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
