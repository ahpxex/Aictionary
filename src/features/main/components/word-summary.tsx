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
import { Volume2, Loader2 } from "lucide-react";
import { WordDefinition } from "@/shared/types/dictionary";
import { playFishTts, type PlayTtsResult } from "@/shared/services/tts-service";
import { toast } from "sonner";

export function WordSummaryCard({ definition }: { definition: WordDefinition }) {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<PlayTtsResult | null>(null);

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
      console.error("Failed to stop pronunciation playback", error);
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
    if (isPlaying) {
      await stopPlayback();
      return;
    }

    setIsPlaying(true);
    try {
      const player = await playFishTts({
        text: definition.word,
        autoplay: true,
      });

      playerRef.current = player;

      player.completion
        .catch((error) => {
          console.error("Pronunciation playback failed", error);
          toast.error(t("main.word_summary.audio_error"));
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
      toast.error(t("main.word_summary.audio_error"));
    }
  };

  const ariaLabel = isPlaying
    ? t("main.word_summary.stop_pronunciation")
    : t("main.word_summary.play_pronunciation");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-3xl font-bold">{definition.word}</CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={ariaLabel}
            title={ariaLabel}
            onClick={handlePronunciationClick}
            disabled={!definition.word}
          >
            {isPlaying ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Volume2 className="size-4" />
            )}
            <span className="sr-only">{ariaLabel}</span>
          </Button>
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
