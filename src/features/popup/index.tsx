import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { ArrowUpRight, BookmarkPlus, Loader2, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SearchForm, type SearchFormRef } from "@/features/main/components/search-form";
import { useDictionarySearch } from "@/features/main/hooks/use-dictionary-search";
import { useSettings } from "@/features/settings/hooks/use-settings";
import type { DictionaryEntry, DictionaryMeaning } from "@/shared/types/dictionary";
import {
  collectPronunciations,
  pronunciationsAreUniform,
} from "@/shared/lib/dictionary-entry";
import {
  playCachedAudio,
  playTts,
  type PlayTtsResult,
} from "@/shared/services/tts-service";
import { resolveAudioCache } from "@/shared/services/audio-cache";
import { addEntryToAnki } from "@/shared/services/anki-service";
import type { GenerationPreview } from "@/shared/services/llm-service";
import { NonsenseState } from "@/features/main/components/nonsense-state";

const AUDIO_FORMAT = "mp3";
const popupWindow = getCurrentWebviewWindow();

function CompactGeneratingResult({
  word,
  summary,
  preview,
}: {
  word: string;
  summary: string;
  preview: GenerationPreview | null;
}) {
  const meanings = (preview?.posGroups ?? [])
    .flatMap((group) => group.meanings)
    .filter((meaning) => meaning.shortGloss || meaning.learnerExplanation)
    .slice(0, 2);

  return (
    <section className="min-h-0 flex-1 overflow-y-auto border-t pt-3">
      <h1 className="break-words text-2xl font-bold leading-none">{word}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{summary}</p>
      {meanings.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {meanings.map((meaning, index) => (
            <div key={index} className="flex gap-2 text-sm leading-relaxed">
              <span className="font-mono text-muted-foreground">{index + 1}</span>
              <div>
                {meaning.shortGloss && <p className="font-semibold">{meaning.shortGloss}</p>}
                {meaning.learnerExplanation && <p>{meaning.learnerExplanation}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CompactResult({ entry }: { entry: DictionaryEntry }) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const playerRef = useRef<PlayTtsResult | null>(null);
  const audio = settings.audio;
  const pronunciations = pronunciationsAreUniform(entry)
    ? collectPronunciations(entry)
    : [];
  const meanings = useMemo(
    () =>
      entry.pos_groups
        .flatMap((group) => group.meanings)
        .filter((meaning) => meaning.priority !== "rare")
        .slice(0, 2),
    [entry.pos_groups]
  );
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
    audio.provider === "openai"
      ? audio.openai.model
      : audio.provider === "elevenlabs"
        ? audio.elevenlabs.model
        : audio.provider === "fish"
          ? audio.fish.model
          : "";
  const isAnkiConfigured = Boolean(
    settings.anki.apiUrl.trim() && settings.anki.deckName.trim()
  );

  const stopPlayback = useCallback(async () => {
    if (playerRef.current) {
      await playerRef.current.stop().catch(() => undefined);
      playerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  useEffect(() => () => void stopPlayback(), [stopPlayback]);

  const playPronunciation = async () => {
    if (!isAudioConfigured) {
      toast.error(t("main.word_summary.audio_not_configured"));
      return;
    }
    if (isPlaying) {
      await stopPlayback();
      return;
    }

    const cacheEntry = await resolveAudioCache(entry.headword, {
      provider: audio.provider,
      model: activeModel,
      voiceId: activeVoice,
      format: AUDIO_FORMAT,
    }).catch(() => null);

    setIsPlaying(true);
    try {
      const player = cacheEntry?.exists
        ? await playCachedAudio(cacheEntry.path)
        : await playTts({
            text: entry.headword,
            autoplay: true,
            format: AUDIO_FORMAT,
            cacheFilePath: cacheEntry?.path,
          });
      playerRef.current = player;
      await player.completion;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("main.word_summary.audio_error"));
    } finally {
      playerRef.current = null;
      setIsPlaying(false);
    }
  };

  const saveToAnki = async () => {
    if (!isAnkiConfigured) {
      toast.error(t("main.word_summary.anki_not_configured"));
      return;
    }
    setIsSaving(true);
    try {
      await addEntryToAnki(entry, { settingsOverride: settings.anki });
      toast.success(t("main.word_summary.anki_success"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("main.word_summary.anki_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="min-h-0 flex-1 overflow-y-auto border-t pt-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold leading-none">{entry.headword}</h1>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
            {pronunciations.map((pronunciation, index) => (
              <span key={`popup-pronunciation-${index}`}>
                {pronunciation.ipa ?? pronunciation.text}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("main.word_summary.play_pronunciation")}
            title={t("main.word_summary.play_pronunciation")}
            onClick={() => void playPronunciation()}
            disabled={!isAudioConfigured}
          >
            {isPlaying ? <Loader2 className="size-4 animate-spin" /> : <Volume2 className="size-4" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("main.word_summary.add_to_anki")}
            title={t("main.word_summary.add_to_anki")}
            onClick={() => void saveToAnki()}
            disabled={!isAnkiConfigured || isSaving}
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <BookmarkPlus className="size-4" />}
          </Button>
        </div>
      </div>
      {entry.headword_summary && (
        <p className="mt-2 text-sm text-muted-foreground">{entry.headword_summary}</p>
      )}
      <div className="mt-3 flex flex-col gap-2">
        {meanings.map((meaning: DictionaryMeaning, index) => (
          <div key={meaning.sense_id} className="flex gap-2 text-sm leading-relaxed">
            <span className="font-mono text-muted-foreground">{index + 1}</span>
            <div>
              {meaning.short_gloss && <p className="font-semibold">{meaning.short_gloss}</p>}
              <p>{meaning.learner_explanation}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PopupPage() {
  const { t } = useTranslation();
  const inputRef = useRef<SearchFormRef>(null);
  const {
    result,
    history,
    isSearching,
    isGeneratingFromLlm,
    generatingModel,
    generatingWord,
    generationSummary,
    generationPreview,
    nonsenseQuery,
    search,
    clear,
  } = useDictionarySearch();
  const [query, setQuery] = useState("");
  const uniqueHistory = useMemo(() => {
    const seen = new Set<string>();
    return history.filter((record) => {
      const key = record.word.trim().toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [history]);

  useEffect(() => {
    inputRef.current?.focusInput();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void popupWindow.hide();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const unlistenPromise = listen("popup-opened", () => {
      inputRef.current?.focusInput();
    });

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    if (!isGeneratingFromLlm || !generatingWord) return;

    void emit("open-main-generation", {
      word: generatingWord,
      model: generatingModel,
      summary: generationSummary,
      preview: generationPreview,
    });
  }, [
    generationPreview,
    generationSummary,
    generatingModel,
    generatingWord,
    isGeneratingFromLlm,
  ]);

  useEffect(() => {
    if (!nonsenseQuery) return;
    void emit("open-main-nonsense", { word: nonsenseQuery });
  }, [nonsenseQuery]);

  const openMainWindow = async () => {
    await invoke("open_main_window");
    await popupWindow.hide();
  };

  const openMainResult = async () => {
    if (!result) return;
    await emit("open-main-result", { result });
    await popupWindow.hide();
  };

  const openMainGeneration = async () => {
    if (!generatingWord) return;
    await emit("open-main-generation", {
      word: generatingWord,
      model: generatingModel,
      summary: generationSummary,
      preview: generationPreview,
    });
    await popupWindow.hide();
  };

  const openMainNonsense = async () => {
    if (!nonsenseQuery) return;
    await emit("open-main-nonsense", { word: nonsenseQuery });
    await popupWindow.hide();
  };

  return (
    <main className="flex h-screen flex-col gap-3 bg-background p-4 text-foreground">
      <SearchForm
        ref={inputRef}
        onSearch={search}
        onValueChange={(value) => {
          setQuery(value);
          if (!value.trim()) {
            clear();
          }
        }}
        showClearButton
        onClear={clear}
        showIcon={false}
        className="shrink-0 flex-none"
      />
      {isGeneratingFromLlm && !result && (
        generationSummary && generatingWord ? (
          <CompactGeneratingResult
            word={generatingWord}
            summary={generationSummary}
            preview={generationPreview}
          />
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            {t("popup.ai_searching")}
          </div>
        )
      )}
      {isGeneratingFromLlm && generatingWord && !result && (
        <Button
          type="button"
          variant="ghost"
          className="mt-auto w-full shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => void openMainGeneration()}
        >
          {t("popup.learn_more")}
          <ArrowUpRight className="size-3.5" />
        </Button>
      )}
      {nonsenseQuery && !isGeneratingFromLlm && !result && (
        <>
          <NonsenseState word={nonsenseQuery} />
          <Button
            type="button"
            variant="ghost"
            className="mt-auto w-full shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => void openMainNonsense()}
          >
            {t("popup.learn_more")}
            <ArrowUpRight className="size-3.5" />
          </Button>
        </>
      )}
      {isSearching && !isGeneratingFromLlm && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {t("main.search.searching")}
        </div>
      )}
      {result && <CompactResult entry={result.entry} />}
      {query.trim() === "" && !isSearching && !isGeneratingFromLlm && (
        <section className="min-h-0 flex-1 overflow-y-auto pt-2">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {t("popup.history")}
          </h2>
          {uniqueHistory.length > 0 ? (
            <div className="flex flex-col">
              {uniqueHistory.slice(0, 12).map((record) => (
                <button
                  key={`${record.word}-${record.timestamp}`}
                  type="button"
                  className="border-b border-border/60 px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
                  onClick={() => {
                    inputRef.current?.setInputValue(record.word);
                    void search(record.word);
                  }}
                >
                  {record.word}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("popup.history_empty")}</p>
          )}
        </section>
      )}
      {query.trim() === "" && !isSearching && !isGeneratingFromLlm && (
        <Button
          type="button"
          variant="ghost"
          className="mt-auto w-full shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => void openMainWindow()}
        >
          {t("popup.open_main")}
        </Button>
      )}
      {result && (
        <Button
          type="button"
          variant="ghost"
          className="mt-auto w-full justify-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => void openMainResult()}
        >
          {t("popup.learn_more")}
          <ArrowUpRight className="size-3.5" />
        </Button>
      )}
    </main>
  );
}
