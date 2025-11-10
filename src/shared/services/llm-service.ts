import OpenAI, { APIError } from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { WordDefinition } from "@/shared/types/dictionary";
import { LlmProvider } from "@/shared/types/settings";

export type LlmModelSummary = {
  id: string;
  ownedBy: string;
  created: number;
};

export class LlmServiceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "LlmServiceError";
    if (options?.cause) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

const RESPONSE_SCHEMA = z.object({
  word: z.string().min(1),
  pronunciation: z.string().min(1),
  concise_definition: z.string().min(1),
  forms: z.record(z.string(), z.string()),
  definitions: z
    .array(
      z.object({
        pos: z.string().min(1),
        explanation_en: z.string().min(1),
        explanation_cn: z.string().min(1),
        example_en: z.string().min(1),
        example_cn: z.string().min(1),
      })
    )
    .min(1),
  comparison: z.array(
    z.object({
      word_to_compare: z.string().min(1),
      analysis: z.string().min(1),
    })
  ),
});

type ParsedDefinition = z.infer<typeof RESPONSE_SCHEMA>;

type SanitizedConfig = {
  apiKey: string;
  baseURL?: string;
  model: string;
};

const DEFAULT_FORMS: Record<string, string> = {
  third_person_singular: "",
  past_tense: "",
  past_participle: "",
  present_participle: "",
  plural: "",
  comparative: "",
  superlative: "",
  singular: "",
};

const SYSTEM_PROMPT = `You are an English-to-Chinese lexicographer. When asked for a word, return a high quality bilingual dictionary entry.
Requirements:
- Always provide pronunciation in IPA or a common phonetic notation.
- Keep \"concise_definition\" to one sentence summary in English.
- Populate \"forms\" with the most useful inflections for the word's part of speech. Use empty string when a form is not applicable.
- Provide at least two detailed senses in \"definitions\" with natural language explanations in both English and Simplified Chinese plus parallel example sentences.
- In \"comparison\", include 1-3 closely related words and explain subtle differences in English.
- Never hallucinate facts about offensive usage. Say \"N/A\" if unsure but keep the schema shape.
`;

function sanitizeConfig(config: LlmProvider): SanitizedConfig {
  const apiKey = config.apiKey.trim();
  if (!apiKey) {
    throw new LlmServiceError("LLM API key is missing.");
  }

  const model = config.model.trim();
  if (!model) {
    throw new LlmServiceError("LLM model is missing.");
  }

  const baseURL = (config.baseUrl || "").trim() || undefined;
  return { apiKey, baseURL, model };
}

function createClient(config: LlmProvider) {
  const sanitized = sanitizeConfig(config);
  return {
    client: new OpenAI({
      apiKey: sanitized.apiKey,
      baseURL: sanitized.baseURL,
      dangerouslyAllowBrowser: true,
    }),
    model: sanitized.model,
  };
}

function normalizeLlmError(error: unknown, fallback = "LLM request failed") {
  if (error instanceof LlmServiceError) {
    return error;
  }

  if (error instanceof APIError) {
    return new LlmServiceError(error.message || fallback, { cause: error });
  }

  if (error instanceof Error) {
    return new LlmServiceError(error.message, { cause: error });
  }

  return new LlmServiceError(fallback);
}

function normalizeParsedDefinition(parsed: ParsedDefinition, fallbackWord: string): WordDefinition {
  const word = parsed.word.trim() || fallbackWord;
  const forms = Object.entries(parsed.forms || {}).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      acc[key] = typeof value === "string" ? value.trim() : "";
      return acc;
    },
    { ...DEFAULT_FORMS }
  );

  const sanitizedDefinitions = parsed.definitions.map((definition) => ({
    pos: definition.pos.trim(),
    explanation_en: definition.explanation_en.trim(),
    explanation_cn: definition.explanation_cn.trim(),
    example_en: definition.example_en.trim(),
    example_cn: definition.example_cn.trim(),
  }));

  const sanitizedComparison = parsed.comparison.map((item) => ({
    word_to_compare: item.word_to_compare.trim(),
    analysis: item.analysis.trim(),
  }));

  return {
    word,
    pronunciation: parsed.pronunciation.trim() || word,
    concise_definition: parsed.concise_definition.trim() || `Definition for ${word}`,
    forms,
    definitions: sanitizedDefinitions,
    comparison: sanitizedComparison,
  };
}

export function hasLlmCredentials(config: LlmProvider) {
  return Boolean(config.apiKey.trim() && config.model.trim());
}

export async function fetchAvailableModels(config: LlmProvider): Promise<LlmModelSummary[]> {
  try {
    const { client } = createClient(config);
    const page = await client.models.list();
    return page.data
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((model) => ({
        id: model.id,
        ownedBy: model.owned_by,
        created: model.created,
      }));
  } catch (error) {
    throw normalizeLlmError(error, "Unable to load models from the provider.");
  }
}

export async function testLlmConnection(config: LlmProvider) {
  await fetchAvailableModels(config);
}

export async function generateDefinitionFromLlm(word: string, config: LlmProvider): Promise<WordDefinition> {
  const trimmed = word.trim();
  if (!trimmed) {
    throw new LlmServiceError("Word is required.");
  }

  try {
    const { client, model } = createClient(config);
    const completion = await client.chat.completions.parse({
      model,
      temperature: 0.2,
      max_tokens: 900,
      response_format: zodResponseFormat(RESPONSE_SCHEMA, "word_definition"),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Provide the bilingual entry for the word: ${trimmed}. Ensure at least two senses and one comparison.`,
        },
      ],
    });

    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed) {
      throw new LlmServiceError("LLM response was missing structured content.");
    }

    return normalizeParsedDefinition(parsed, trimmed);
  } catch (error) {
    throw normalizeLlmError(error, "Unable to generate a definition with the configured model.");
  }
}
