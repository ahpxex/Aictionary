import { FormEvent, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SearchFormProps = {
  onSearch: (word: string) => void;
  isSearching: boolean;
  initialValue?: string;
};

export function SearchForm({
  onSearch,
  isSearching,
  initialValue = "",
}: SearchFormProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

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
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search a word…"
        className="border-none text-base shadow-none focus-visible:ring-0"
        autoFocus
      />
      <Button type="submit" disabled={isSearching}>
        {isSearching ? "Searching…" : "Search"}
      </Button>
    </form>
  );
}
