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
  adverb: "副词",
  pronoun: "代词",
  preposition: "介词",
  conjunction: "连词",
  interjection: "感叹词",
  determiner: "限定词",
  article: "冠词",
  numeral: "数词",
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
