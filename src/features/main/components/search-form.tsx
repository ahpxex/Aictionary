import {
  FormEvent,
  KeyboardEvent,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { suggestDictionary } from "@/shared/services/dictionary-service";
import type { DictionarySuggestion } from "@/shared/types/dictionary";

type SearchFormProps = {
  onSearch: (word: string) => void;
  initialValue?: string;
};

export interface SearchFormRef {
  focusInput: () => void;
}

/**
 * The query bar living in the window chrome, styled like an address bar:
 * the giant headword below owns the "current word" role, this field is only
 * the way to ask for the next one. Enter submits; there is no button.
 */
export const SearchForm = forwardRef<SearchFormRef, SearchFormProps>(
  ({ onSearch, initialValue = "" }, ref) => {
    const { t } = useTranslation();
    const { settings } = useSettings();
    const [value, setValue] = useState(initialValue);
    const [suggestions, setSuggestions] = useState<DictionarySuggestion[]>([]);
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const formContainerRef = useRef<HTMLDivElement>(null);
    const requestIdRef = useRef(0);

    const closeSuggestions = () => {
      setSuggestions([]);
      setIsSuggestionsOpen(false);
      setActiveIndex(-1);
    };

    const selectSuggestion = (headword: string) => {
      inputRef.current?.blur();
      closeSuggestions();
      onSearch(headword);
    };

    // Only follow a real result. During generation the current result is
    // cleared, and syncing that through would wipe the word the user just
    // typed out from under them.
    useEffect(() => {
      if (initialValue) {
        setValue(initialValue);
      }
    }, [initialValue]);

    useEffect(() => {
      const query = value.trim();
      const requestId = ++requestIdRef.current;
      if (
        query.length < 2 ||
        /\p{Script=Han}/u.test(query) ||
        !settings.dictionary.cachePath.trim()
      ) {
        closeSuggestions();
        return;
      }

      const timer = window.setTimeout(() => {
        void suggestDictionary(query, settings.dictionary.cachePath).then(
          (nextSuggestions) => {
            if (requestId !== requestIdRef.current) {
              return;
            }
            setSuggestions(nextSuggestions);
            setIsSuggestionsOpen(
              nextSuggestions.length > 0 &&
                formContainerRef.current?.contains(document.activeElement) === true
            );
            setActiveIndex(-1);
          }
        );
      }, 120);

      return () => window.clearTimeout(timer);
    }, [settings.dictionary.cachePath, value]);

    useImperativeHandle(ref, () => ({
      focusInput: () => {
        inputRef.current?.focus();
        inputRef.current?.select();
      },
    }));

    // Global "new query" shortcut: the layout dispatches this window-level
    // event; the query bar is chrome, so it listens for it directly.
    useEffect(() => {
      const handleFocus = () => {
        inputRef.current?.focus();
        inputRef.current?.select();
      };

      window.addEventListener("focus-search-input", handleFocus);
      return () => {
        window.removeEventListener("focus-search-input", handleFocus);
      };
    }, []);

    useEffect(() => {
      const handleOutsidePointerDown = (event: PointerEvent) => {
        if (!formContainerRef.current?.contains(event.target as Node)) {
          setIsSuggestionsOpen(false);
          setActiveIndex(-1);
        }
      };

      document.addEventListener("pointerdown", handleOutsidePointerDown);
      return () => {
        document.removeEventListener("pointerdown", handleOutsidePointerDown);
      };
    }, []);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const selected = suggestions[activeIndex];
      if (selected) {
        selectSuggestion(selected.headword);
      } else {
        inputRef.current?.blur();
        closeSuggestions();
        onSearch(value);
      }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (suggestions.length === 0) {
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % suggestions.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeSuggestions();
      }
    };

    return (
      <div ref={formContainerRef} className="relative min-w-0 flex-1">
        <form
          onSubmit={handleSubmit}
          className="flex h-8 min-w-0 items-center gap-2 px-2 transition-colors hover:bg-muted/40 focus-within:bg-muted/60"
        >
          {/* The icon stays put while a lookup runs: the query bar is chrome,
              and progress belongs in the page, not in the field's affordance. */}
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setIsSuggestionsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            onPointerDown={() => setIsSuggestionsOpen(suggestions.length > 0)}
            onFocus={(event) => {
              window.requestAnimationFrame(() => event.target.select());
              setIsSuggestionsOpen(suggestions.length > 0);
            }}
            placeholder={t("main.search.placeholder")}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isSuggestionsOpen}
            aria-controls="dictionary-suggestions"
            aria-activedescendant={
              activeIndex >= 0
                ? `dictionary-suggestion-${activeIndex}`
                : undefined
            }
          />
        </form>
        {isSuggestionsOpen && suggestions.length > 0 && (
          <ul
            id="dictionary-suggestions"
            role="listbox"
            aria-label={t("main.search.suggestions_label")}
            className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover py-1 text-popover-foreground shadow-md"
          >
            {suggestions.map((suggestion, index) => (
              <li
                key={`${suggestion.headword}-${index}`}
                id={`dictionary-suggestion-${index}`}
                role="option"
                aria-selected={activeIndex === index}
              >
                <button
                  type="button"
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    activeIndex === index ? "bg-accent" : "hover:bg-muted"
                  }`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectSuggestion(suggestion.headword);
                  }}
                >
                  <span className="font-semibold">{suggestion.headword}</span>
                  {suggestion.gloss && (
                    <span className="ml-4 truncate text-muted-foreground">
                      {suggestion.gloss}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
);
