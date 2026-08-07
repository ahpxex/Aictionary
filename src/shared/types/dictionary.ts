/**
 * Types mirroring the open-dictionary `distribution_entry_v5` contract.
 * See https://github.com/ahpxex/open-dictionary — each dictionary entry is
 * one headword with etymologies, part-of-speech groups, and meanings.
 */

export type LanguageRef = {
  code: string;
  name: string;
};

export type DictionaryExample = {
  text: string;
  translation: string;
};

export type MeaningPriority = "core" | "common" | "rare";

export type DictionaryMeaning = {
  sense_id: string;
  priority: MeaningPriority;
  short_gloss: string | null;
  learner_explanation: string;
  usage_note: string | null;
  labels: string[];
  topics: string[];
  examples: DictionaryExample[];
};

export type DictionaryForm = {
  text: string;
  tags: string[];
  roman: string | null;
};

export type DictionaryPronunciation = {
  ipa: string | null;
  text: string | null;
  tags: string[];
};

export type DictionaryRelation = {
  type: string;
  word: string;
  lang_code: string | null;
};

export type DictionaryPosGroup = {
  pos: string;
  etymology_id: string | null;
  proper_name: boolean;
  summary: string;
  usage_note: string | null;
  forms: DictionaryForm[];
  pronunciations: DictionaryPronunciation[];
  relations: DictionaryRelation[];
  meanings: DictionaryMeaning[];
};

export type DictionaryEtymology = {
  etymology_id: string;
  text: string | null;
  pos_members: string[];
};

export type DictionaryEntry = {
  schema_version: string;
  entry_id: string;
  headword: string;
  normalized_headword: string;
  headword_language: LanguageRef;
  definition_language: LanguageRef;
  entry_type: "standard" | "proper_name" | "affix" | "proverb" | (string & {});
  headword_summary: string;
  memory_hook: string;
  study_notes: string[];
  etymology_note: string | null;
  etymologies: DictionaryEtymology[];
  pos_groups: DictionaryPosGroup[];
};

export type DictionaryLookupResult = {
  entry: DictionaryEntry;
};

/** Metadata embedded in the distribution.sqlite artifact. */
export type DictionaryMetadata = {
  distribution_schema_version?: string;
  sqlite_schema_version?: string;
  entry_count?: number;
  definition_language?: LanguageRef;
  skipped_entries_without_meanings?: number;
  [key: string]: unknown;
};

export type QueryRecord = {
  word: string;
  timestamp: string;
};
