import { FormEvent, forwardRef, useEffect, useImperativeHandle, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { suggestDictionary } from "@/shared/services/dictionary-service";

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
    const [value, setValue] = useState(initialValue);
    const { settings } = useSettings();
    const [focused, setFocused] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [composing, setComposing] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [active, setActive] = useState(-1);
    const listId = useId();
    const showSuggestions = focused && !dismissed && !composing && suggestions.length > 0;
    const inputRef = useRef<HTMLInputElement>(null);

    // Only follow a real result. During generation the current result is
    // cleared, and syncing that through would wipe the word the user just
    // typed out from under them.
    useEffect(() => {
      if (initialValue) {
        setValue(initialValue);
      }
    }, [initialValue]);

    useEffect(() => {
      let current = true;
      setSuggestions([]);
      setActive(-1);
      if (!focused || dismissed || composing || !value.trim()) return;
      const timer = setTimeout(() => {
        suggestDictionary(value, settings.dictionary.cachePath)
          .then((words) => { if (current) setSuggestions(words); })
          .catch(() => { if (current) setSuggestions([]); });
      }, 150);
      return () => { current = false; clearTimeout(timer); };
    }, [value, focused, dismissed, composing, settings.dictionary.cachePath]);

    const submit = (word: string) => {
      setDismissed(true);
      setSuggestions([]);
      setValue(word);
      onSearch(word);
    };

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

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!composing) submit(showSuggestions && active >= 0 ? suggestions[active] : value);
    };

    return (
      <form
        onSubmit={handleSubmit}
        className="relative flex h-8 min-w-0 flex-1 items-center gap-2 px-2 transition-colors hover:bg-muted/40 focus-within:bg-muted/60"
      >
        {/* The icon stays put while a lookup runs: the query bar is chrome,
            and progress belongs in the page, not in the field's affordance. */}
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => { setValue(event.target.value); setDismissed(false); setSuggestions([]); setActive(-1); }}
          onFocus={(event) => { event.target.select(); setFocused(true); setDismissed(false); }}
          onBlur={() => { setFocused(false); setDismissed(true); }}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || composing || event.keyCode === 229) {
              if (event.key === "Enter") event.preventDefault();
              return;
            }
            if (event.key === "Enter" && showSuggestions && active >= 0) {
              event.preventDefault();
              submit(suggestions[active]);
            }
            if (event.key === "Escape") { setDismissed(true); setActive(-1); }
            if (showSuggestions && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
              event.preventDefault();
              setActive((previous) => event.key === "ArrowDown"
                ? (previous + 1) % suggestions.length
                : previous <= 0 ? suggestions.length - 1 : previous - 1);
            }
          }}
          role="combobox"
          aria-label={t("main.search.placeholder")}
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? listId : undefined}
          aria-activedescendant={showSuggestions && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          placeholder={t("main.search.placeholder")}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          autoFocus
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {showSuggestions && (
          <ul id={listId} role="listbox" aria-label={t("main.search.suggestions")}
            className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover py-1 text-popover-foreground shadow-md">
            {suggestions.map((word, index) => (
              <li key={word} id={`${listId}-${index}`} role="option" aria-selected={active === index}
                className={`cursor-pointer px-3 py-1.5 text-sm ${active === index ? "bg-accent text-accent-foreground" : "hover:bg-accent"}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => submit(word)}>
                {word}
              </li>
            ))}
          </ul>
        )}
      </form>
    );
  }
);
