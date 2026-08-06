import { FormEvent, forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type SearchFormProps = {
  onSearch: (word: string) => void;
  isSearching: boolean;
  initialValue?: string;
};

export interface SearchFormRef {
  focusInput: () => void;
}

export const SearchForm = forwardRef<SearchFormRef, SearchFormProps>(
  ({ onSearch, isSearching, initialValue = "" }, ref) => {
    const { t } = useTranslation();
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      setValue(initialValue);
    }, [initialValue]);

    useImperativeHandle(ref, () => ({
      focusInput: () => {
        inputRef.current?.focus();
      },
    }));

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSearch(value);
    };

    return (
      <form
        onSubmit={handleSubmit}
        className="flex w-full items-stretch border-b-2 border-foreground"
      >
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t("main.search.placeholder")}
          className="min-w-0 flex-1 bg-transparent py-3 text-2xl font-medium tracking-tight outline-none placeholder:text-muted-foreground/60"
          autoFocus
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={isSearching}
          className="shrink-0 self-center bg-foreground px-5 py-2 text-sm font-medium tracking-wide text-background transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          {isSearching ? t("main.search.searching") : t("main.search.button")}
        </button>
      </form>
    );
  }
);
