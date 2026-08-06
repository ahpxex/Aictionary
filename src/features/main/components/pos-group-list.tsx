import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";
import type {
  DictionaryEntry,
  DictionaryMeaning,
  DictionaryPosGroup,
} from "@/shared/types/dictionary";
import {
  groupRelationsByType,
  splitMeaningsByPriority,
} from "@/shared/lib/dictionary-entry";

/** Relation types rendered expanded by default; the rest stay collapsed. */
const PRIMARY_RELATION_TYPES = ["synonym", "antonym"];
const RELATION_CHIP_LIMIT = 10;

type PosGroupListProps = {
  entry: DictionaryEntry;
  onSearchWord?: (word: string) => void;
};

function MeaningItem({
  meaning,
  index,
}: {
  meaning: DictionaryMeaning;
  index: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex gap-3">
      <span className="w-5 shrink-0 pt-px text-right font-mono text-sm font-semibold text-foreground/70">
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {meaning.short_gloss?.trim() && (
            <span className="font-semibold">{meaning.short_gloss}</span>
          )}
          {meaning.priority === "rare" && (
            <span className="border border-border px-1 text-[0.65rem] leading-4 text-muted-foreground">
              {t("main.priority.rare")}
            </span>
          )}
          {meaning.labels.length > 0 && (
            <span className="text-xs text-muted-foreground">
              [{meaning.labels.join(", ")}]
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed">{meaning.learner_explanation}</p>
        {meaning.usage_note?.trim() && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="mr-1.5 text-xs font-medium text-foreground/60">
              {t("main.pos_group.usage_label")}
            </span>
            {meaning.usage_note}
          </p>
        )}
        {meaning.examples.length > 0 && (
          <div className="flex flex-col gap-1.5 pt-0.5">
            {meaning.examples.map((example, exampleIndex) => (
              <div key={`example-${exampleIndex}`} className="text-sm leading-relaxed">
                <p className="text-foreground/90">{example.text}</p>
                <p className="text-muted-foreground">{example.translation}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RelationChips({
  words,
  onSearchWord,
}: {
  words: string[];
  onSearchWord?: (word: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? words : words.slice(0, RELATION_CHIP_LIMIT);
  const remaining = words.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((word) => (
        <button
          key={word}
          type="button"
          onClick={() => onSearchWord?.(word)}
          className="border border-border px-2 py-0.5 text-xs text-foreground/90 transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {word}
        </button>
      ))}
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          +{remaining}
        </button>
      )}
    </div>
  );
}

function PosGroupCard({
  group,
  onSearchWord,
}: {
  group: DictionaryPosGroup;
  onSearchWord?: (word: string) => void;
}) {
  const { t } = useTranslation();
  const [showRare, setShowRare] = useState(false);
  const [showSecondaryRelations, setShowSecondaryRelations] = useState(false);

  const { visible, hidden } = splitMeaningsByPriority(group);
  const meanings = showRare ? [...visible, ...hidden] : visible;

  const relations = groupRelationsByType(group);
  const primaryRelations = PRIMARY_RELATION_TYPES.map(
    (type) => [type, relations.get(type)] as const
  ).filter((pair): pair is readonly [string, string[]] => Boolean(pair[1]?.length));
  const secondaryRelations = [...relations.entries()].filter(
    ([type]) => !PRIMARY_RELATION_TYPES.includes(type)
  );

  const formatTags = (tags: string[]) =>
    tags
      .map((tag) => t(`main.form_tags.${tag}`, { defaultValue: tag }))
      .join(" ");

  return (
    <Card className="gap-4">
      <CardHeader className="gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Badge
            variant="outline"
            className="font-mono text-[0.7rem] uppercase tracking-wider"
          >
            {group.pos}
          </Badge>
          {group.proper_name && (
            <Badge variant="secondary" className="text-[0.65rem]">
              {t("main.pos_group.proper_name")}
            </Badge>
          )}
          {group.pronunciations.map((pronunciation, index) => (
            <span
              key={`group-pron-${index}`}
              className="font-mono text-sm text-muted-foreground"
            >
              {pronunciation.tags.length > 0 && (
                <span className="mr-1 text-[0.65rem] uppercase tracking-wider">
                  {pronunciation.tags.join(" ")}
                </span>
              )}
              {pronunciation.ipa ?? pronunciation.text}
            </span>
          ))}
        </div>
        <CardTitle className="text-lg font-semibold leading-relaxed">
          {group.summary}
        </CardTitle>
        {group.usage_note?.trim() && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {group.usage_note}
          </p>
        )}
        {group.forms.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {group.forms.map((form, index) => (
              <span key={`form-${index}`}>
                {index > 0 && <span className="mx-1.5 text-border">·</span>}
                {form.tags.length > 0 && (
                  <span className="mr-1 text-xs">{formatTags(form.tags)}</span>
                )}
                <span className="font-medium text-foreground/90">{form.text}</span>
              </span>
            ))}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 border-t border-border pt-4">
          {meanings.map((meaning, index) => (
            <MeaningItem
              key={meaning.sense_id ?? `meaning-${index}`}
              meaning={meaning}
              index={index}
            />
          ))}
        </div>

        {hidden.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground"
            onClick={() => setShowRare((previous) => !previous)}
          >
            {showRare ? (
              <>
                <ChevronUp className="size-4" />
                {t("main.pos_group.hide_rare")}
              </>
            ) : (
              <>
                <ChevronDown className="size-4" />
                {t("main.pos_group.show_rare", { count: hidden.length })}
              </>
            )}
          </Button>
        )}

        {(primaryRelations.length > 0 || secondaryRelations.length > 0) && (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            {primaryRelations.map(([type, words]) => (
              <div key={type} className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t(`main.relations.${type}`, { defaultValue: type })}
                </span>
                <RelationChips words={words} onSearchWord={onSearchWord} />
              </div>
            ))}

            {secondaryRelations.length > 0 && (
              <>
                {showSecondaryRelations ? (
                  secondaryRelations.map(([type, words]) => (
                    <div key={type} className="flex flex-col gap-1.5">
                      <span className="text-xs uppercase tracking-widest text-muted-foreground">
                        {t(`main.relations.${type}`, { defaultValue: type })}
                      </span>
                      <RelationChips words={words} onSearchWord={onSearchWord} />
                    </div>
                  ))
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start text-muted-foreground"
                    onClick={() => setShowSecondaryRelations(true)}
                  >
                    <ChevronDown className="size-4" />
                    {t("main.relations.show_more", {
                      count: secondaryRelations.reduce(
                        (total: number, [, words]) => total + words.length,
                        0
                      ),
                    })}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PosGroupList({ entry, onSearchWord }: PosGroupListProps) {
  return (
    <div className="grid gap-4">
      {entry.pos_groups.map((group, index) => (
        <PosGroupCard
          key={`${entry.entry_id}-pos-${index}`}
          group={group}
          onSearchWord={onSearchWord}
        />
      ))}
    </div>
  );
}
