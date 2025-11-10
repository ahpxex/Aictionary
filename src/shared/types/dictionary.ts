export type WordDefinition = {
  word: string;
  pronunciation: string;
  concise_definition: string;
  forms: Record<string, string>;
  definitions: Array<{
    pos: string;
    explanation_en: string;
    explanation_cn: string;
    example_en: string;
    example_cn: string;
  }>;
  comparison: Array<{
    word_to_compare: string;
    analysis: string;
  }>;
};

export type QueryRecord = {
  word: string;
  timestamp: string;
};
