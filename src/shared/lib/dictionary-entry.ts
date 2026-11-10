import type {
  DictionaryEntry,
  DictionaryMeaning,
  DictionaryPosGroup,
  DictionaryPronunciation,
} from "@/shared/types/dictionary";

/**
 * Collect the distinct pronunciations of an entry across all pos groups,
 * keeping the upstream order (US first, then UK, then untagged).
 */
export function collectPronunciations(
  entry: DictionaryEntry
): DictionaryPronunciation[] {
  const seen = new Set<string>();
  const collected: DictionaryPronunciation[] = [];

  for (const group of entry.pos_groups) {
    for (const pronunciation of group.pronunciations) {
      const rendered = pronunciation.ipa ?? pronunciation.text;
      if (!rendered) {
        continue;
      }
      const key = `${pronunciation.tags.join("+")}|${rendered}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      collected.push(pronunciation);
    }
  }

  return collected;
}

/**
 * Whether every pos group that carries pronunciations carries the same
 * ones. Uniform entries (the common case) show pronunciation once in the
 * entry header; entries like "record", where noun and verb stress differ,
 * show it per pos group instead.
 */
export function pronunciationsAreUniform(entry: DictionaryEntry): boolean {
  const serialized = entry.pos_groups
    .filter((group) => group.pronunciations.length > 0)
    .map((group) =>
      group.pronunciations
        .map(
          (pronunciation) =>
            `${pronunciation.tags.join("+")}|${pronunciation.ipa ?? pronunciation.text ?? ""}`
        )
        .join(";")
    );

  return new Set(serialized).size <= 1;
}

export type MeaningVisibility = {
  visible: DictionaryMeaning[];
  hidden: DictionaryMeaning[];
};

/**
 * Split a pos group's meanings into the ones shown by default and the rare
 * ones hidden behind a toggle.
 *
 * Distribution contract rule: priorities are truthful, so a group may consist
 * entirely of `rare` meanings. Clients that hide rare meanings MUST fall back
 * to showing everything whenever the filter would leave the group empty.
 */
export function splitMeaningsByPriority(
  group: DictionaryPosGroup
): MeaningVisibility {
  const visible = group.meanings.filter((meaning) => meaning.priority !== "rare");
  if (visible.length === 0) {
    return { visible: group.meanings, hidden: [] };
  }
  const hidden = group.meanings.filter((meaning) => meaning.priority === "rare");
  return { visible, hidden };
}

/**
 * Chinese labels for Wiktionary part-of-speech names. These pair with the
 * English pos in the bilingual runner (e.g. "NOUN | 名词"); they describe the
 * dictionary data itself, not the UI language, so they live here instead of
 * the i18n catalogs.
 */
const POS_LABELS_ZH: Record<string, string> = {
  noun: "名词",
  verb: "动词",
  adjective: "形容词",
  adj: "形容词",
  adverb: "副词",
  adv: "副词",
  pronoun: "代词",
  pron: "代词",
  preposition: "介词",
  prep: "介词",
  conjunction: "连词",
  conj: "连词",
  interjection: "感叹词",
  intj: "感叹词",
  determiner: "限定词",
  det: "限定词",
  article: "冠词",
  numeral: "数词",
  num: "数词",
  particle: "助词",
  name: "专有名词",
  phrase: "短语",
  proverb: "谚语",
  prefix: "前缀",
  suffix: "后缀",
  affix: "词缀",
  abbreviation: "缩写",
  symbol: "符号",
  character: "字符",
};

export function posLabelZh(pos: string): string | null {
  return POS_LABELS_ZH[pos.toLowerCase()] ?? null;
}

/** Group the relation edges of a pos group by relation type. */
export function groupRelationsByType(
  group: DictionaryPosGroup
): Map<string, string[]> {
  const byType = new Map<string, string[]>();
  for (const relation of group.relations) {
    const word = relation.word.trim();
    if (!word) {
      continue;
    }
    const existing = byType.get(relation.type);
    if (existing) {
      if (!existing.includes(word)) {
        existing.push(word);
      }
    } else {
      byType.set(relation.type, [word]);
    }
  }
  return byType;
}

/**
 * One part of speech on the page: every pos group that shares it, in the
 * order they should be read.
 *
 * The distribution splits a part of speech by etymology, so "light" carries
 * four separate verb groups. Shown one after another under the same heading
 * they read as one list of senses, which is what a learner expects.
 */
export type EntrySection = {
  /** Stable within an entry; used for the section's anchor. */
  key: string;
  pos: string;
  properName: boolean;
  groups: { group: DictionaryPosGroup; index: number }[];
};

const PRIORITY_RANK: Record<string, number> = { core: 0, common: 1, rare: 2 };

/** The most important priority any of the group's senses carries. */
function groupRank(group: DictionaryPosGroup): number {
  return group.meanings.reduce(
    (best, meaning) => Math.min(best, PRIORITY_RANK[meaning.priority] ?? 2),
    3
  );
}

function isProperNameGroup(group: DictionaryPosGroup): boolean {
  return group.proper_name || group.pos.toLowerCase() === "name";
}

/**
 * Arrange an entry's pos groups into sections, most useful first.
 *
 * The distribution lists groups alphabetically by part of speech, which puts
 * "bank" the village ahead of "bank" the institution. Priorities in the data
 * are truthful, so they decide instead: a section with more core senses comes
 * first, then one with more senses outside the rare tier. Proper names - a
 * surname, a place - go last whatever their priority, because they are rarely
 * what someone looking up a word wants. Within a section, groups holding a
 * core sense lead. Ties keep the distribution's order.
 */
export function organizeSections(entry: DictionaryEntry): EntrySection[] {
  const byKey = new Map<string, EntrySection>();

  entry.pos_groups.forEach((group, index) => {
    const properName = isProperNameGroup(group);
    const key = `${group.pos.toLowerCase()}${properName ? "-name" : ""}`;
    const section = byKey.get(key);
    if (section) {
      section.groups.push({ group, index });
    } else {
      byKey.set(key, { key, pos: group.pos, properName, groups: [{ group, index }] });
    }
  });

  const stats = (section: EntrySection) => {
    let core = 0;
    let nonRare = 0;
    for (const { group } of section.groups) {
      for (const meaning of group.meanings) {
        if (meaning.priority === "core") core += 1;
        if (meaning.priority !== "rare") nonRare += 1;
      }
    }
    return { core, nonRare, first: section.groups[0].index };
  };

  const sections = [...byKey.values()];
  for (const section of sections) {
    section.groups.sort(
      (a, b) => groupRank(a.group) - groupRank(b.group) || a.index - b.index
    );
  }

  return sections
    .map((section) => ({ section, ...stats(section) }))
    .sort(
      (a, b) =>
        Number(a.section.properName) - Number(b.section.properName) ||
        b.core - a.core ||
        b.nonRare - a.nonRare ||
        a.first - b.first
    )
    .map(({ section }) => section);
}

/** One line of the at-a-glance block: a section and its leading glosses. */
export type GlanceRow = {
  key: string;
  pos: string;
  glosses: string[];
};

/** Enough glosses to recognize the sense; the full list is a click away. */
const GLANCE_GLOSS_LIMIT = 4;

/**
 * The at-a-glance block: each section's short glosses on one line, the way a
 * pocket dictionary lists them, so the common meanings are readable before
 * any scrolling.
 *
 * Takes plain pos/gloss lists rather than an entry so the streaming preview
 * can build the same block from a half-finished generation. Sections without
 * a gloss are left out. When the whole entry has fewer than two glosses the
 * block would only repeat the sense printed right below it, so there is none.
 */
export function buildGlance(
  sections: { key: string; pos: string | null | undefined; glosses: (string | null | undefined)[] }[]
): GlanceRow[] {
  const rows: GlanceRow[] = [];

  for (const section of sections) {
    const glosses: string[] = [];
    for (const gloss of section.glosses) {
      if (glosses.length === GLANCE_GLOSS_LIMIT) {
        break;
      }
      const text = gloss?.trim();
      if (text && !glosses.includes(text)) {
        glosses.push(text);
      }
    }
    const pos = section.pos?.trim();
    if (pos && glosses.length > 0) {
      rows.push({ key: section.key, pos, glosses });
    }
  }

  const total = rows.reduce((sum, row) => sum + row.glosses.length, 0);
  return total >= 2 ? rows : [];
}

/**
 * Glance rows for a finished entry.
 *
 * Core senses come first, then common ones. Rare senses are left out per
 * section rather than per group: a group of only rare senses is still
 * printed in full below (the contract's fallback), but a summary of the
 * common meanings has no use for it while its section has common ones. A
 * section with nothing but rare senses lists those.
 */
export function glanceForSections(sections: EntrySection[]): GlanceRow[] {
  return buildGlance(
    sections.map((section) => {
      const meanings = section.groups.flatMap(({ group }) => group.meanings);
      const common = meanings.filter((meaning) => meaning.priority !== "rare");
      // Core senses of every group before any common one, so a second
      // etymology's core sense ("bank" the shore) is not crowded out by the
      // first group's long tail.
      const ranked = [...(common.length > 0 ? common : meanings)].sort(
        (a, b) => (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2)
      );
      return {
        key: section.key,
        pos: section.pos,
        glosses: ranked.map((meaning) => meaning.short_gloss),
      };
    })
  );
}

/**
 * Relations of every group in a section, merged by type. The groups of one
 * part of speech repeat each other's synonyms; listed once per section they
 * stay readable.
 */
export function sectionRelations(section: EntrySection): Map<string, string[]> {
  const merged = new Map<string, string[]>();
  for (const { group } of section.groups) {
    for (const [type, words] of groupRelationsByType(group)) {
      const existing = merged.get(type) ?? [];
      for (const word of words) {
        if (!existing.includes(word)) {
          existing.push(word);
        }
      }
      merged.set(type, existing);
    }
  }
  return merged;
}

export type TextSegment = { text: string; match: boolean };

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Spellings of `word` an example sentence is likely to use: the regular
 * inflections, with the usual spelling changes (make → making, study →
 * studied, stop → stopped). Irregular forms come from the entry's own form
 * list instead, so nothing here has to know English morphology in full.
 */
function regularInflections(word: string): string[] {
  const variants = [word];
  if (!/^[\p{L}'-]+$/u.test(word)) {
    return variants;
  }
  for (const suffix of ["s", "es", "ed", "d", "ing", "'s", "er", "est"]) {
    variants.push(word + suffix);
  }
  const last = word.slice(-1);
  const stem = word.slice(0, -1);
  if (last === "e") {
    variants.push(`${stem}ing`, `${stem}ed`, `${stem}er`, `${stem}est`);
  }
  if (last === "y" && !/[aeiou]y$/i.test(word)) {
    variants.push(`${stem}ies`, `${stem}ied`, `${stem}ier`, `${stem}iest`);
  }
  if (/[^aeiou][aeiou][bdgklmnprt]$/i.test(word)) {
    variants.push(`${word}${last}ed`, `${word}${last}ing`, `${word}${last}er`);
  }
  return variants;
}

/**
 * Split an example sentence so the headword and its forms can be set apart
 * from the rest of the text.
 *
 * Matching is case-insensitive and whole-word: "light" marks "Light" and
 * "lighting" but not "delight". Multi-word headwords match across any run of
 * whitespace. The returned segments always concatenate back to `text`.
 */
export function highlightTerms(text: string, terms: string[]): TextSegment[] {
  const spellings = new Set<string>();
  for (const term of terms) {
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      continue;
    }
    for (const variant of regularInflections(trimmed)) {
      spellings.add(variant.toLowerCase());
    }
  }

  if (spellings.size === 0 || !text) {
    return text ? [{ text, match: false }] : [];
  }

  // Longest first, so "lighting" wins over "light" at the same position.
  const alternatives = [...spellings]
    .sort((a, b) => b.length - a.length)
    .map((spelling) => escapeRegExp(spelling).replace(/\s+/g, "\\s+"));
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${alternatives.join("|")})(?![\\p{L}\\p{N}])`,
    "giu"
  );

  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), match: false });
    }
    segments.push({ text: match[0], match: true });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false });
  }
  return segments;
}

/**
 * The words to mark in a pos group's examples: the headword and the group's
 * listed forms (lit, lighter, ...), minus the bookkeeping entries Wiktionary
 * puts in form lists, which are not words that appear in a sentence.
 */
export function headwordTerms(
  headword: string,
  group: DictionaryPosGroup
): string[] {
  const terms = [headword];
  for (const form of group.forms) {
    const text = form.text.trim();
    if (
      text &&
      /\p{L}/u.test(text) &&
      !form.tags.some((tag) => tag === "table-tags" || tag === "inflection-template")
    ) {
      terms.push(text);
    }
  }
  return terms;
}
