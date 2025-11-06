import { useDictionarySearch } from "@/features/main/hooks/use-dictionary-search";
import { ComparisonList } from "@/features/main/components/comparison-list";
import { DefinitionsList } from "@/features/main/components/definitions-list";
import { SearchForm } from "@/features/main/components/search-form";
import { WordSummaryCard } from "@/features/main/components/word-summary";
import { Card, CardContent } from "@/components/ui/card";

export function MainPage() {
  const { isSearching, result, search } = useDictionarySearch();

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col items-center gap-4">
        <SearchForm
          onSearch={search}
          isSearching={isSearching}
          initialValue={result?.word}
        />
        {!result && (
          <p className="text-muted-foreground text-sm">
            Enter a word to see its definitions.
          </p>
        )}
      </div>

      {result && (
        <div className="flex flex-col gap-6">
          <WordSummaryCard definition={result} />
          <Card>
            <CardContent className="flex flex-col gap-6 py-6">
              <h2 className="text-2xl font-semibold">Definitions</h2>
              <DefinitionsList definition={result} />
            </CardContent>
          </Card>
          <ComparisonList definition={result} />
        </div>
      )}
    </div>
  );
}
