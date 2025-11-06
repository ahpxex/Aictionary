export type WordDefinition = {
  word: string;
  pronunciation: string;
  concise_definition: string;
  forms: {
    third_person_singular: string;
    past_tense: string;
    past_participle: string;
    present_participle: string;
  };
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

