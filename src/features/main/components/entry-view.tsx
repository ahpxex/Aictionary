import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  DictionaryExample,
  DictionaryLookupResult,
  DictionaryMeaning,
  DictionaryPosGroup,
  DictionaryPronunciation,
} from "@/shared/types/dictionary";
import {
  collectPronunciations,
  glanceForSections,
  headwordTerms,
  highlightTerms,
  organizeSections,
  posLabelZh,
  pronunciationsAreUniform,
  sectionRelations,
  splitMeaningsByPriority,
  type EntrySection,
} from "@/shared/lib/dictionary-entry";
import {
  EntryHeader,
  RailLabel,
  Row,
  Tag,
} from "@/features/main/components/entry-layout";
import {
  EntryFrame,
  EntryGlance,
  EntrySectionNav,
  EntryToc,
  sectionAnchor,
  type SectionNavItem,
} from "@/features/main/components/entry-navigation";
import { EntryActions } from "./entry-actions";
import { WordFrequency } from "./word-frequency";

/** Relation types shown expanded; the rest collapse behind a toggle. */
const PRIMARY_RELATION_TYPES = ["synonym", "antonym"];
const RELATION_RAIL_LABELS: Record<string, string> = {
  synonym: "SYN",
  antonym: "ANT",
  related_term: "REL",
  derived_term: "DER",
};
const RELATION_CHIP_LIMIT = 12;

const LEARN_KEY = "learn";
const COMPARE_KEY = "compare";

/*
 * Type scale of an entry, top to bottom. Every element of the same kind uses
 * the same step, which is what makes the hierarchy readable at a glance:
 *
 *   headword        4xl/6xl bold        (EntryHeader)
 *   section         lg semibold         part of speech, h2
 *   sense gloss     base semibold       h3
 *   body            sm, foreground      explanations, group summaries
 *   example         sm, foreground      headword set in semibold
 *   secondary       sm, muted           translations, usage notes, forms
 *   metadata        0.65rem tags        labels, rarity
 */

function Pronunciations({
  pronunciations,
}: {
  pronunciations: DictionaryPronunciation[];
}) {
  return (
    <>
      {pronunciations.map((pronunciation, index) => (
        <span key={`pron-${index}`} className="font-mono text-sm text-muted-foreground">
          {pronunciation.tags.length > 0 && (
            <span className="mr-1.5 text-[0.65rem] uppercase tracking-wider">
              {pronunciation.tags.join(" ")}
            </span>
          )}
          {pronunciation.ipa ?? pronunciation.text}
        </span>
      ))}
    </>
  );
}

/**
 * An example sentence over its translation. The left rule ties the pair
 * together and sets it apart from the explanation above; the headword is
 * picked out in the sentence so the usage being illustrated is obvious.
 */
function ExamplePair({
  example,
  terms,
}: {
  example: DictionaryExample;
  terms: string[];
}) {
  const segments = highlightTerms(example.text, terms);

  return (
    <div className="border-l-2 border-foreground/15 pl-3">
      <p className="text-sm leading-relaxed">
        {segments.map((segment, index) =>
          segment.match ? (
            <strong key={index} className="font-semibold text-foreground">
              {segment.text}
            </strong>
          ) : (
            <span key={index} className="text-foreground/85">
              {segment.text}
            </span>
          )
        )}
      </p>
      {example.translation?.trim() && (
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
          {example.translation}
        </p>
      )}
    </div>
  );
}

function SenseRow({
  meaning,
  number,
  terms,
}: {
  meaning: DictionaryMeaning;
  number: number;
  terms: string[];
}) {
  const { t } = useTranslation();

  return (
    <Row
      variant="marker"
      rail={
        <span className="font-mono text-sm font-semibold leading-6 text-foreground/70">
          {number}
        </span>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {meaning.priority === "core" && (
            <span
              aria-label={t("main.priority.core")}
              className="inline-block size-2 shrink-0 bg-primary"
            />
          )}
          {meaning.short_gloss?.trim() && (
            <h3 className="text-base font-semibold leading-6">{meaning.short_gloss}</h3>
          )}
          {meaning.priority === "rare" && <Tag>{t("main.priority.rare")}</Tag>}
          {meaning.labels.map((label) => (
            <Tag key={label}>{label}</Tag>
          ))}
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
          <div className="flex flex-col gap-2.5 pt-1">
            {meaning.examples.map((example, index) => (
              <ExamplePair key={`example-${index}`} example={example} terms={terms} />
            ))}
          </div>
        )}
      </div>
    </Row>
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
          className="border border-border px-2 py-0.5 text-xs text-foreground/90 transition-colors hover:border-foreground/40 hover:text-foreground"
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

/** A group's own introduction: its summary, usage, forms and, if they differ, pronunciations. */
function GroupIntro({
  group,
  showPronunciations,
}: {
  group: DictionaryPosGroup;
  showPronunciations: boolean;
}) {
  const { t } = useTranslation();
  const formatTags = (tags: string[]) =>
    tags.map((tag) => t(`main.form_tags.${tag}`, { defaultValue: tag })).join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      {showPronunciations && group.pronunciations.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Pronunciations pronunciations={group.pronunciations} />
        </div>
      )}
      {group.summary?.trim() && (
        <p className="text-sm leading-relaxed">{group.summary}</p>
      )}
      {group.usage_note?.trim() && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {group.usage_note}
        </p>
      )}
      {group.forms.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {group.forms.map((form, index) => (
            <span key={`form-${index}`}>
              {index > 0 && <span className="mx-1.5">·</span>}
              {form.tags.length > 0 && (
                <span className="mr-1 text-xs">{formatTags(form.tags)}</span>
              )}
              <span className="font-medium text-foreground/90">{form.text}</span>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

/**
 * One part of speech: its heading, then each of its groups' senses numbered
 * as one list, then the relations of all of them.
 *
 * A section made of one group shows that group's introduction under the
 * heading. With several (one per etymology), each group opens with its own
 * introduction behind a rule on the content column, so the reader sees where
 * one sense family ends and the next begins without losing the numbering.
 */
function PosSection({
  section,
  headword,
  showPronunciations,
  onSearchWord,
}: {
  section: EntrySection;
  headword: string;
  showPronunciations: boolean;
  onSearchWord?: (word: string) => void;
}) {
  const { t } = useTranslation();
  const [expandedRare, setExpandedRare] = useState<Set<number>>(new Set());
  const [showSecondaryRelations, setShowSecondaryRelations] = useState(false);

  const posZh = posLabelZh(section.pos);
  const single = section.groups.length === 1;

  const relations = sectionRelations(section);
  const primaryRelations = PRIMARY_RELATION_TYPES.map(
    (type) => [type, relations.get(type)] as const
  ).filter((pair): pair is readonly [string, string[]] => Boolean(pair[1]?.length));
  const secondaryRelations = [...relations.entries()].filter(
    ([type]) => !PRIMARY_RELATION_TYPES.includes(type)
  );
  const secondaryCount = secondaryRelations.reduce(
    (total, [, words]) => total + words.length,
    0
  );

  const toggleRare = (index: number) =>
    setExpandedRare((previous) => {
      const next = new Set(previous);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });

  let number = 0;

  return (
    <section aria-labelledby={`${sectionAnchor(section.key)}-title`}>
      <Row
        id={sectionAnchor(section.key)}
        divider
        variant="marker"
        rail={
          <span className="font-mono text-[0.7rem] font-semibold uppercase leading-7 tracking-[0.15em] text-foreground">
            {section.pos}
          </span>
        }
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2
              id={`${sectionAnchor(section.key)}-title`}
              className="text-lg font-semibold leading-7"
            >
              {posZh ?? section.pos}
            </h2>
            {section.properName && <Tag>{t("main.pos_group.proper_name")}</Tag>}
          </div>
          {single && (
            <GroupIntro
              group={section.groups[0].group}
              showPronunciations={showPronunciations}
            />
          )}
        </div>
      </Row>

      {section.groups.map(({ group, index }) => {
        const { visible, hidden } = splitMeaningsByPriority(group);
        const showRare = expandedRare.has(index);
        const shown = showRare ? [...visible, ...hidden] : visible;
        const terms = headwordTerms(headword, group);

        return (
          <div key={`group-${index}`}>
            {!single && (
              <Row variant="marker" subDivider>
                <GroupIntro group={group} showPronunciations={showPronunciations} />
              </Row>
            )}
            {shown.map((meaning) => {
              number += 1;
              return (
                <SenseRow
                  key={meaning.sense_id}
                  meaning={meaning}
                  number={number}
                  terms={terms}
                />
              );
            })}
            {hidden.length > 0 && (
              <Row variant="marker">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => toggleRare(index)}
                >
                  {showRare
                    ? t("main.pos_group.hide_rare")
                    : t("main.pos_group.show_rare", { count: hidden.length })}
                </button>
              </Row>
            )}
          </div>
        );
      })}

      {primaryRelations.map(([type, words], index) => (
        <Row
          key={type}
          variant="marker"
          subDivider={index === 0}
          rail={<RailLabel>{RELATION_RAIL_LABELS[type] ?? type}</RailLabel>}
        >
          <RelationChips words={words} onSearchWord={onSearchWord} />
        </Row>
      ))}

      {secondaryRelations.length > 0 &&
        (showSecondaryRelations ? (
          secondaryRelations.map(([type, words]) => (
            <Row
              key={type}
              variant="marker"
              rail={<RailLabel>{RELATION_RAIL_LABELS[type] ?? type}</RailLabel>}
            >
              <RelationChips words={words} onSearchWord={onSearchWord} />
            </Row>
          ))
        ) : (
          <Row variant="marker">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowSecondaryRelations(true)}
            >
              {t("main.relations.show_more", { count: secondaryCount })}
            </button>
          </Row>
        ))}
    </section>
  );
}

export function EntryView({
  result,
  onSearchWord,
}: {
  result: DictionaryLookupResult;
  onSearchWord?: (word: string) => void;
}) {
  const { t } = useTranslation();
  const { entry, source } = result;
  const uniformPronunciations = pronunciationsAreUniform(entry);
  const pronunciations = uniformPronunciations ? collectPronunciations(entry) : [];
  const comparisons = entry.comparisons ?? [];

  const sections = useMemo(() => organizeSections(entry), [entry]);
  const glance = useMemo(() => glanceForSections(sections), [sections]);

  const hasLearn =
    Boolean(entry.memory_hook?.trim()) ||
    entry.study_notes.length > 0 ||
    Boolean(entry.etymology_note?.trim());

  const navItems = useMemo<SectionNavItem[]>(() => {
    const items: SectionNavItem[] = sections.map((section) => ({
      key: section.key,
      label: section.pos,
      pos: section.pos,
    }));
    if (hasLearn) {
      items.push({ key: LEARN_KEY, label: t("main.entry.learn") });
    }
    if (comparisons.length > 0) {
      items.push({ key: COMPARE_KEY, label: t("main.comparison.title") });
    }
    return items;
  }, [comparisons.length, hasLearn, sections, t]);

  // The bar appears once this has scrolled out of view: the glance block if
  // there is one, the header otherwise.
  const navThresholdRef = useRef<HTMLDivElement>(null);

  const entryTypeLabel =
    entry.entry_type !== "standard"
      ? t(`main.word_summary.entry_type.${entry.entry_type}`, {
          defaultValue: entry.entry_type,
        })
      : null;

  const hasNavigation = navItems.length > 1;

  return (
    <EntryFrame toc={hasNavigation && <EntryToc items={navItems} />}>
      <article className="w-full">
        <EntryHeader
          headword={entry.headword}
          summary={entry.headword_summary}
          actions={<EntryActions entry={entry} />}
          meta={
            <>
              <WordFrequency word={entry.headword} language={entry.headword_language.code} />
              <Pronunciations pronunciations={pronunciations} />
              {entryTypeLabel && (
                <span className="text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
                  {entryTypeLabel}
                </span>
              )}
              {source === "user" && (
                <span className="text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
                  {t("main.word_summary.ai_generated")}
                </span>
              )}
            </>
          }
        />

        {glance.length > 0 && <EntryGlance rows={glance} />}
        <div ref={navThresholdRef} aria-hidden />
        {hasNavigation && (
          <EntrySectionNav items={navItems} revealAfter={navThresholdRef} />
        )}

        {sections.map((section) => (
          <PosSection
            key={`${entry.entry_id}-${section.key}`}
            section={section}
            headword={entry.headword}
            showPronunciations={!uniformPronunciations}
            onSearchWord={onSearchWord}
          />
        ))}

        {/* Study material follows the definitions it builds on. */}
        {entry.memory_hook?.trim() && (
          <Row
            id={sectionAnchor(LEARN_KEY)}
            divider
            rail={<RailLabel>{t("main.word_summary.memory_hook")}</RailLabel>}
          >
            <p className="text-sm leading-relaxed">{entry.memory_hook}</p>
          </Row>
        )}

        {entry.study_notes.length > 0 && (
          <Row
            id={entry.memory_hook?.trim() ? undefined : sectionAnchor(LEARN_KEY)}
            divider
            rail={<RailLabel>{t("main.word_summary.study_notes")}</RailLabel>}
          >
            <ul className="flex flex-col gap-1.5 text-sm leading-relaxed">
              {entry.study_notes.map((note, index) => (
                <li key={`note-${index}`} className="flex gap-2">
                  <span className="select-none text-muted-foreground">–</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </Row>
        )}

        {entry.etymology_note?.trim() && (
          <Row
            id={
              entry.memory_hook?.trim() || entry.study_notes.length > 0
                ? undefined
                : sectionAnchor(LEARN_KEY)
            }
            divider
            rail={<RailLabel>{t("main.word_summary.etymology")}</RailLabel>}
          >
            <p className="text-sm leading-relaxed text-muted-foreground">
              {entry.etymology_note}
            </p>
          </Row>
        )}

        {comparisons.length > 0 && (
          <Row
            id={sectionAnchor(COMPARE_KEY)}
            divider
            rail={<RailLabel>{t("main.comparison.title")}</RailLabel>}
          >
            <div className="flex flex-col gap-4">
              {comparisons.map((comparison, index) => (
                <div key={`comparison-${index}`} className="flex flex-col gap-1">
                  <h3 className="font-semibold">{comparison.word}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {comparison.analysis}
                  </p>
                </div>
              ))}
            </div>
          </Row>
        )}

        {/* Closing hairline so the spine terminates on a full-width rule. */}
        <div className="border-t border-border" />
      </article>
    </EntryFrame>
  );
}
