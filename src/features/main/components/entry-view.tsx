import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Volume2, Loader2, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  DictionaryLookupResult,
  DictionaryMeaning,
  DictionaryPosGroup,
} from "@/shared/types/dictionary";
import {
  collectPronunciations,
  groupRelationsByType,
  posLabelZh,
  pronunciationsAreUniform,
  splitMeaningsByPriority,
} from "@/shared/lib/dictionary-entry";
import {
  playCachedAudio,
  playTts,
  type PlayTtsResult,
} from "@/shared/services/tts-service";
import { useSettings } from "@/features/settings/hooks/use-settings";
import {
  EntryHeader,
  RailLabel,
  Row,
} from "@/features/main/components/entry-layout";
import { resolveAudioCache } from "@/shared/services/audio-cache";
import { addEntryToAnki } from "@/shared/services/anki-service";

const MANUAL_STOP_MESSAGE = "Stream manually stopped";
const AUDIO_FORMAT = "mp3";

/** Relation types shown expanded; the rest collapse behind a toggle. */
const PRIMARY_RELATION_TYPES = ["synonym", "antonym"];
const RELATION_RAIL_LABELS: Record<string, string> = {
  synonym: "SYN",
  antonym: "ANT",
  related_term: "REL",
  derived_term: "DER",
};
const RELATION_CHIP_LIMIT = 12;

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
 * One row of the entry sheet: a narrow rail on the left, content to the
 * right of the vertical spine. Rows stack without gaps so the spine reads
 * as one continuous line down the entry.
 */
function ExamplePair({
  text,
  translation,
}: {
  text: string;
  translation: string;
}) {
  // Side by side, the two halves get roughly 140px each on a phone - a couple
  // of words per line. Below `md` they stack instead, and the border that
  // separated the columns becomes the one that marks the translation.
  return (
    <div className="grid grid-cols-1 md:grid-cols-2">
      <p className="text-sm leading-relaxed text-foreground/90 md:pr-4">
        {text}
      </p>
      <p className="border-l border-border pl-3 text-sm leading-relaxed text-muted-foreground md:pl-4">
        {translation}
      </p>
    </div>
  );
}

function MeaningRows({
  meanings,
  startIndex,
}: {
  meanings: DictionaryMeaning[];
  startIndex: number;
}) {
  const { t } = useTranslation();

  return (
    <>
      {meanings.map((meaning, offset) => (
        <Row
          key={meaning.sense_id ?? `meaning-${startIndex + offset}`}
          variant="marker"
          rail={
            <span className="font-mono text-sm font-semibold leading-6 text-foreground/70">
              {startIndex + offset + 1}
            </span>
          }
        >
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {meaning.priority === "core" && (
                <span
                  aria-hidden
                  className="inline-block size-2 -translate-y-px bg-primary"
                />
              )}
              {meaning.short_gloss?.trim() && (
                <span className="font-semibold">{meaning.short_gloss}</span>
              )}
              {meaning.priority === "rare" && (
                <span className="border border-border px-1 text-[0.65rem] leading-4 text-muted-foreground">
                  {t("main.priority.rare")}
                </span>
              )}
              {meaning.labels.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  [{meaning.labels.join(", ")}]
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed">{meaning.learner_explanation}</p>
            {meaning.usage_note?.trim() && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="mr-1.5 text-xs font-medium text-foreground/60">
                  {t("main.pos_group.usage_label")}
                </span>
                {meaning.usage_note}
              </p>
            )}
            {meaning.examples.length > 0 && (
              <div className="flex flex-col gap-2 pt-1">
                {meaning.examples.map((example, exampleIndex) => (
                  <ExamplePair
                    key={`example-${exampleIndex}`}
                    text={example.text}
                    translation={example.translation}
                  />
                ))}
              </div>
            )}
          </div>
        </Row>
      ))}
    </>
  );
}

function RelationChips({
  words,
  onSearchWord,
}: {
  words: string[];
  onSearchWord?: (word: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? words : words.slice(0, RELATION_CHIP_LIMIT);
  const remaining = words.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((word) => (
        <button
          key={word}
          type="button"
          onClick={() => onSearchWord?.(word)}
          className="border border-border px-2 py-0.5 text-xs text-foreground/90 transition-colors hover:border-foreground/40 hover:text-foreground"
        >
          {word}
        </button>
      ))}
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          +{remaining}
        </button>
      )}
    </div>
  );
}

function PosGroupSection({
  group,
  showPronunciations,
  onSearchWord,
}: {
  group: DictionaryPosGroup;
  showPronunciations: boolean;
  onSearchWord?: (word: string) => void;
}) {
  const { t } = useTranslation();
  const [showRare, setShowRare] = useState(false);
  const [showSecondaryRelations, setShowSecondaryRelations] = useState(false);

  const { visible, hidden } = splitMeaningsByPriority(group);

  const relations = groupRelationsByType(group);
  const primaryRelations = PRIMARY_RELATION_TYPES.map(
    (type) => [type, relations.get(type)] as const
  ).filter((pair): pair is readonly [string, string[]] => Boolean(pair[1]?.length));
  const secondaryRelations = [...relations.entries()].filter(
    ([type]) => !PRIMARY_RELATION_TYPES.includes(type)
  );
  const secondaryCount = secondaryRelations.reduce(
    (total: number, [, words]) => total + words.length,
    0
  );

  const formatTags = (tags: string[]) =>
    tags
      .map((tag) => t(`main.form_tags.${tag}`, { defaultValue: tag }))
      .join(" ");

  const posZh = posLabelZh(group.pos);

  return (
    <section>
      {/* Bilingual runner: English pos in the rail, Chinese label after the spine. */}
      <Row
        divider
        variant="marker"
        rail={
          <span className="font-mono text-[0.7rem] font-semibold uppercase leading-6 tracking-[0.15em] text-foreground">
            {group.pos}
          </span>
        }
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {posZh && <span className="text-sm font-semibold">{posZh}</span>}
            {group.proper_name && (
              <span className="border border-border px-1 text-[0.65rem] leading-4 text-muted-foreground">
                {t("main.pos_group.proper_name")}
              </span>
            )}
            {showPronunciations &&
              group.pronunciations.map((pronunciation, index) => (
              <span
                key={`group-pron-${index}`}
                className="font-mono text-sm text-muted-foreground"
              >
                {pronunciation.tags.length > 0 && (
                  <span className="mr-1 text-[0.65rem] uppercase tracking-wider">
                    {pronunciation.tags.join(" ")}
                  </span>
                )}
                {pronunciation.ipa ?? pronunciation.text}
              </span>
            ))}
          </div>
          <p className="leading-relaxed">{group.summary}</p>
          {group.usage_note?.trim() && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {group.usage_note}
            </p>
          )}
          {group.forms.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {group.forms.map((form, index) => (
                <span key={`form-${index}`}>
                  {index > 0 && <span className="mx-1.5">·</span>}
                  {form.tags.length > 0 && (
                    <span className="mr-1 text-xs">{formatTags(form.tags)}</span>
                  )}
                  <span className="font-medium text-foreground/90">{form.text}</span>
                </span>
              ))}
            </p>
          )}
        </div>
      </Row>

      <MeaningRows meanings={visible} startIndex={0} />
      {showRare && <MeaningRows meanings={hidden} startIndex={visible.length} />}

      {hidden.length > 0 && (
        <Row>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowRare((previous) => !previous)}
          >
            {showRare
              ? t("main.pos_group.hide_rare")
              : t("main.pos_group.show_rare", { count: hidden.length })}
          </button>
        </Row>
      )}

      {primaryRelations.map(([type, words]) => (
        <Row
          key={type}
          variant="marker"
          rail={<RailLabel>{RELATION_RAIL_LABELS[type] ?? type}</RailLabel>}
        >
          <RelationChips words={words} onSearchWord={onSearchWord} />
        </Row>
      ))}

      {secondaryRelations.length > 0 &&
        (showSecondaryRelations ? (
          secondaryRelations.map(([type, words]) => (
            <Row
              key={type}
              variant="marker"
              rail={<RailLabel>{RELATION_RAIL_LABELS[type] ?? type}</RailLabel>}
            >
              <RelationChips words={words} onSearchWord={onSearchWord} />
            </Row>
          ))
        ) : (
          <Row>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowSecondaryRelations(true)}
            >
              {t("main.relations.show_more", { count: secondaryCount })}
            </button>
          </Row>
        ))}
    </section>
  );
}

export function EntryView({
  result,
  onSearchWord,
}: {
  result: DictionaryLookupResult;
  onSearchWord?: (word: string) => void;
}) {
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

  const { entry, source } = result;
  const hasWord = Boolean(entry.headword?.trim());
  const uniformPronunciations = pronunciationsAreUniform(entry);
  const pronunciations = uniformPronunciations ? collectPronunciations(entry) : [];
  const comparisons = entry.comparisons ?? [];

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

  const entryTypeLabel =
    entry.entry_type !== "standard"
      ? t(`main.word_summary.entry_type.${entry.entry_type}`, {
          defaultValue: entry.entry_type,
        })
      : null;

  return (
    <article className="w-full">
      {/* Entry header: the headword is the hero. */}
      <EntryHeader
        headword={entry.headword}
        summary={entry.headword_summary}
        actions={
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
        }
        meta={
          <>
            {pronunciations.map((pronunciation, index) => (
              <span key={`pron-${index}`} className="font-mono text-sm text-muted-foreground">
                {pronunciation.tags.length > 0 && (
                  <span className="mr-1.5 text-[0.65rem] uppercase tracking-wider">
                    {pronunciation.tags.join(" ")}
                  </span>
                )}
                {pronunciation.ipa ?? pronunciation.text}
              </span>
            ))}
            {entryTypeLabel && (
              <span className="text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
                {entryTypeLabel}
              </span>
            )}
            {source === "user" && (
              <span className="text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
                {t("main.word_summary.ai_generated")}
              </span>
            )}
          </>
        }
      />

      {entry.memory_hook?.trim() && (
        <Row divider rail={<RailLabel>{t("main.word_summary.memory_hook")}</RailLabel>}>
          <p className="text-sm leading-relaxed">{entry.memory_hook}</p>
        </Row>
      )}

      {entry.study_notes.length > 0 && (
        <Row divider rail={<RailLabel>{t("main.word_summary.study_notes")}</RailLabel>}>
          <ul className="flex flex-col gap-1.5 text-sm leading-relaxed">
            {entry.study_notes.map((note, index) => (
              <li key={`note-${index}`} className="flex gap-2">
                <span className="select-none text-muted-foreground">–</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </Row>
      )}

      {entry.etymology_note?.trim() && (
        <Row divider rail={<RailLabel>{t("main.word_summary.etymology")}</RailLabel>}>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {entry.etymology_note}
          </p>
        </Row>
      )}

      {entry.pos_groups.map((group, index) => (
        <PosGroupSection
          key={`${entry.entry_id}-pos-${index}`}
          group={group}
          showPronunciations={!uniformPronunciations}
          onSearchWord={onSearchWord}
        />
      ))}

      {comparisons.length > 0 && (
        <Row divider rail={<RailLabel>{t("main.comparison.title")}</RailLabel>}>
          <div className="flex flex-col gap-4">
            {comparisons.map((comparison, index) => (
              <div key={`comparison-${index}`} className="flex flex-col gap-1">
                <h3 className="font-semibold">{comparison.word}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {comparison.analysis}
                </p>
              </div>
            ))}
          </div>
        </Row>
      )}

      {/* Closing hairline so the spine terminates on a full-width rule. */}
      <div className="border-t border-border" />
    </article>
  );
}
