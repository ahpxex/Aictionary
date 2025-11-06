import { Sparkles } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { useDictionarySearch } from "@/features/main/hooks/use-dictionary-search";
import { ComparisonList } from "@/features/main/components/comparison-list";
import { DefinitionsList } from "@/features/main/components/definitions-list";
import { QuickActions } from "@/features/main/components/quick-actions";
import { SearchForm } from "@/features/main/components/search-form";
import { SearchHistory } from "@/features/main/components/search-history";
import { WordSummaryCard } from "@/features/main/components/word-summary";
import { Card, CardContent } from "@/components/ui/card";

export function MainPage() {
  const { isSearching, history, result, search, clear } = useDictionarySearch();

  return (
    <div className="flex flex-1 flex-col gap-10">
      <section className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col gap-2">
          <span className="text-primary font-semibold uppercase tracking-wider">
            AIctionary
          </span>
          <h1 className="text-4xl font-bold tracking-tight">
            Discover precise bilingual definitions instantly
          </h1>
          <p className="text-muted-foreground text-lg">
            Type a word to see pronunciations, forms, usage examples, and
            comparisons powered by your configured providers.
          </p>
        </div>
        <SearchForm
          onSearch={search}
          isSearching={isSearching}
          initialValue={result?.word}
        />
      </section>

      <QuickActions />

      <div className="grid gap-6 lg:grid-cols-[2.5fr_1fr]">
        <div className="flex flex-col gap-6">
          {result ? (
            <>
              <WordSummaryCard definition={result} onClear={clear} />
              <Card>
                <CardContent className="flex flex-col gap-6 py-6">
                  <h2 className="text-2xl font-semibold">
                    Detailed definitions
                  </h2>
                  <DefinitionsList definition={result} />
                </CardContent>
              </Card>
              <ComparisonList definition={result} />
            </>
          ) : (
            <Card>
              <CardContent className="py-12">
                <Empty>
                  <EmptyMedia variant="icon">
                    <Sparkles className="size-6" />
                  </EmptyMedia>
                  <EmptyHeader>
                    <EmptyTitle>Ready when you are</EmptyTitle>
                    <EmptyDescription>
                      Start by searching for a word to explore its meaning,
                      usage, and related vocabulary.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <SearchHistory history={history} onSelect={search} />
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="flex flex-col gap-3 py-6">
              <h3 className="text-base font-semibold">
                Tips for effective searches
              </h3>
              <Separator />
              <ul className="text-muted-foreground text-sm leading-relaxed">
                <li>• Use quick query shortcut configured in settings.</li>
                <li>• Try related phrases to see nuanced comparisons.</li>
                <li>• Export studied words from the statistics page.</li>
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
