import { FormEvent, forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";

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
    const inputRef = useRef<HTMLInputElement>(null);

    // Only follow a real result. During generation the current result is
    // cleared, and syncing that through would wipe the word the user just
    // typed out from under them.
    useEffect(() => {
      if (initialValue) {
        setValue(initialValue);
      }
    }, [initialValue]);

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
      onSearch(value);
    };

    return (
      <form
        onSubmit={handleSubmit}
        className="flex h-8 min-w-0 flex-1 items-center gap-2 px-2 transition-colors hover:bg-muted/40 focus-within:bg-muted/60"
      >
        {/* The icon stays put while a lookup runs: the query bar is chrome,
            and progress belongs in the page, not in the field's affordance. */}
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={(event) => event.target.select()}
          placeholder={t("main.search.placeholder")}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          autoFocus
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </form>
    );
  }
);
