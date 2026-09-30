import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Volume2, Loader2, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DictionaryEntry } from "@/shared/types/dictionary";
import {
  playCachedAudio,
  playTts,
  type PlayTtsResult,
} from "@/shared/services/tts-service";
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
    return (
      error.message === MANUAL_STOP_MESSAGE || error.message === "Stream cancelled."
    );
  }

  return false;
}

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

/**
 * The pronounce and add-to-Anki buttons beside a headword.
 *
 * Shared by the main window's entry and the popup's summary of it, so both
 * speak through the same cache and provider settings and report failures
 * the same way.
 */
export function EntryActions({ entry }: { entry: DictionaryEntry }) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSavingToAnki, setIsSavingToAnki] = useState(false);
  const playerRef = useRef<PlayTtsResult | null>(null);
  const audio = settings.audio;
  const isAudioConfigured =
    audio.provider === "edge"
      ? true
      : audio.provider === "openai"
        ? Boolean(audio.openai.baseUrl.trim())
        : audio.provider === "elevenlabs"
          ? Boolean(audio.elevenlabs.apiKey.trim() && audio.elevenlabs.voiceId.trim())
          : Boolean(audio.fish.apiKey.trim());
  const activeVoice =
    audio.provider === "edge"
      ? audio.edge.voice
      : audio.provider === "openai"
        ? audio.openai.voice
        : audio.provider === "elevenlabs"
          ? audio.elevenlabs.voiceId
          : audio.fish.voiceId;
  const activeModel =
    audio.provider === "edge"
      ? ""
      : audio.provider === "openai"
        ? audio.openai.model
        : audio.provider === "elevenlabs"
          ? audio.elevenlabs.model
          : audio.fish.model;
  const isAnkiConfigured = Boolean(
    settings.anki.apiUrl.trim() && settings.anki.deckName.trim()
  );
  const hasWord = Boolean(entry.headword?.trim());

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
        provider: audio.provider,
        model: activeModel,
        voiceId: activeVoice,
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
        player = await playTts({
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
            resolveErrorMessage(error, t("main.word_summary.audio_error"))
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
      toast.error(resolveErrorMessage(error, t("main.word_summary.audio_error")));
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
      toast.error(resolveErrorMessage(error, t("main.word_summary.anki_error")));
    } finally {
      setIsSavingToAnki(false);
    }
  };

  const playAriaLabel = !isAudioConfigured
    ? t("main.word_summary.audio_not_configured")
    : isPlaying
      ? t("main.word_summary.stop_pronunciation")
      : t("main.word_summary.play_pronunciation");
  const ankiAriaLabel = t("main.word_summary.add_to_anki");

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={playAriaLabel}
        title={playAriaLabel}
        onClick={handlePronunciationClick}
        disabled={!hasWord || !isAudioConfigured}
      >
        {isPlaying ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Volume2 className="size-4" />
        )}
        <span className="sr-only">{playAriaLabel}</span>
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
    </>
  );
}
