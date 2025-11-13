import { FormEvent, forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      className="bg-card border-input flex w-full max-w-2xl items-center gap-2 rounded-lg border p-2 shadow-sm"
    >
      <Search className="text-muted-foreground size-4" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t("main.search.placeholder")}
        className="border-none text-base shadow-none focus-visible:ring-0"
        autoFocus
      />
      <Button type="submit" disabled={isSearching}>
        {isSearching ? t("main.search.searching") : t("main.search.button")}
      </Button>
    </form>
    );
  }
);
