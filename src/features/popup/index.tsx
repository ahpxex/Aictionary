import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { SearchForm } from "@/features/main/components/search-form";
import { NonsenseState } from "@/features/main/components/nonsense-state";
import { ReverseLookupPanel } from "@/features/main/components/reverse-lookup-panel";
import { useDictionarySearch } from "@/features/main/hooks/use-dictionary-search";
import { ScrollRegion } from "@/shared/components/scroll-region";
import type { DictionaryLookupResult } from "@/shared/types/dictionary";
import { PopupEntry } from "./components/popup-entry";
import { PopupGeneration } from "./components/popup-generation";
import { RecentLookups } from "./components/recent-lookups";

/**
 * The popup lookup window: a query bar and a short answer, summoned by the
 * tray icon or its global shortcut and dismissed by Escape or by clicking
 * anywhere else.
 *
 * Lookups run here, in this window's own state, so they never disturb what
 * the main window is showing. The main window only gets involved when the
 * user asks for the full entry; the finished result is handed over then.
 */
export function PopupPage() {
  const { t } = useTranslation();
  const {
    isGeneratingFromLlm,
    generatingModel,
    generatingWord,
    generationPreview,
    generationSummary,
    nonsenseQuery,
    reverseLookup,
    history,
    result,
    search,
    returnToReverseLookup,
  } = useDictionarySearch();

  // The page stays loaded between shows, so autofocus only ever fired once.
  // Rust announces each show; the query bar takes the caret through the same
  // event the main window's "new query" shortcut uses.
  useEffect(() => {
    const pending = getCurrentWebviewWindow().listen("popup-shown", () => {
      window.dispatchEvent(new CustomEvent("focus-search-input"));
    });
    return () => {
      void pending.then((unlisten) => unlisten());
    };
  }, []);

  // Escape dismisses the panel, unless the query bar spent it closing its
  // suggestion list or an input method is composing.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) {
        return;
      }
      void getCurrentWebviewWindow().hide();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const openInMainWindow = (lookup: DictionaryLookupResult | null) => {
    invoke("open_main_window", { result: lookup }).catch((error) => {
      console.error("Failed to open the main window:", error);
      toast.error(t("popup.open_failed"));
    });
  };

  const viewKey = result
    ? `entry:${result.entry.headword}`
    : reverseLookup
      ? `reverse:${reverseLookup.term}`
      : nonsenseQuery
        ? `nonsense:${nonsenseQuery}`
        : isGeneratingFromLlm
          ? `generating:${generatingWord ?? ""}`
          : "empty";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center border-b px-2">
        <SearchForm
          onSearch={(word) => void search(word)}
          initialValue={reverseLookup?.term ?? result?.entry.headword}
        />
      </header>

      <ScrollRegion className="min-h-0 flex-1" resetKey={viewKey}>
        <div className="flex min-h-full flex-col px-4 py-4">
          {isGeneratingFromLlm ? (
            <PopupGeneration
              word={generatingWord ?? ""}
              model={generatingModel}
              summary={generationSummary}
              preview={generationPreview}
            />
          ) : result ? (
            <>
              {reverseLookup && (
                <button
                  type="button"
                  onClick={returnToReverseLookup}
                  className="mb-3 flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="size-3.5" />
                  {t("main.reverse.back", { term: reverseLookup.term })}
                </button>
              )}
              <PopupEntry result={result} />
            </>
          ) : nonsenseQuery ? (
            <NonsenseState word={nonsenseQuery} className="py-8" />
          ) : reverseLookup ? (
            <ReverseLookupPanel
              lookup={reverseLookup}
              onSelectWord={(word) => void search(word, { keepReverseLookup: true })}
            />
          ) : (
            <RecentLookups history={history} onSelect={(word) => void search(word)} />
          )}
        </div>
      </ScrollRegion>

      <footer className="shrink-0 border-t">
        <button
          type="button"
          onClick={() => openInMainWindow(result)}
          className="flex h-10 w-full items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          {result ? t("popup.open_entry") : t("popup.open_main")}
          <ArrowUpRight className="size-3.5" />
        </button>
      </footer>
    </div>
  );
}
