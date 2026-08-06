import OpenAI, { APIError } from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { DictionaryEntry } from "@/shared/types/dictionary";
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

/**
 * The model only generates explanatory content. The full
 * `distribution_entry_v5` envelope (ids, languages, empty relation edges)
 * is assembled deterministically in code afterwards, mirroring how the
 * upstream open-dictionary pipeline separates generated fields from
 * structural fields.
 */
const RESPONSE_SCHEMA = z.object({
  headword: z.string().min(1),
  headword_summary: z.string().min(1),
  memory_hook: z.string().min(1),
  study_notes: z.array(z.string()),
  etymology_note: z.string().nullable(),
  pos_groups: z
    .array(
      z.object({
        pos: z.string().min(1),
        summary: z.string().min(1),
        usage_note: z.string().nullable(),
        pronunciations: z.array(
          z.object({
            ipa: z.string().min(1),
            tags: z.array(z.string()),
          })
        ),
        forms: z.array(
          z.object({
            text: z.string().min(1),
            tags: z.array(z.string()),
          })
        ),
        meanings: z
          .array(
            z.object({
              priority: z.enum(["core", "common", "rare"]),
              short_gloss: z.string(),
              learner_explanation: z.string().min(1),
              usage_note: z.string().nullable(),
              examples: z.array(
                z.object({
                  text: z.string().min(1),
                  translation: z.string().min(1),
                })
              ),
            })
          )
          .min(1),
      })
    )
    .min(1),
  comparisons: z.array(
    z.object({
      word: z.string().min(1),
      analysis: z.string().min(1),
    })
  ),
});

type ParsedGeneration = z.infer<typeof RESPONSE_SCHEMA>;

type SanitizedConfig = {
  apiKey: string;
  baseURL?: string;
  model: string;
};

const SYSTEM_PROMPT = `
你是一位严谨的双语词典编纂专家，为中文母语的英语学习者编写词条。用户输入一个英语单词，你输出一个严格遵循给定 JSON Schema 的词条对象。

字段编写规则：

- headword：规范化后的目标单词本身。
- headword_summary：一句话概括这个词的核心含义与主要用法（中文）。
- memory_hook：一段帮助记忆的联想线索（中文），把这个词的多个含义串成一个可视化的画面或意象，而不是简单重复释义。
- study_notes：2 到 4 条学习要点（中文），聚焦易错点、常见搭配、近义辨析或语域提示。
- etymology_note：一句话的词源说明（中文），解释词根意象如何衍生出现代含义；如果没有把握则设为 null，不要编造。
- pos_groups：按词性分组。每组包含：
  - pos：小写英文词性名（noun、verb、adjective、adverb 等）。
  - summary：该词性下含义的一句话概括（中文）。
  - usage_note：该词性整体的用法提示（中文），没有则为 null。
  - pronunciations：国际音标（IPA，含斜杠外的内容不要加斜杠），tags 用 ["US"] 或 ["UK"]；美式必须给出，英式发音不同时再补一条 UK。
  - forms：屈折变化形式。tags 从以下词表中选取组合：plural、comparative、superlative、past、participle、present、singular、third-person。例如过去分词是 ["past", "participle"]，第三人称单数现在时是 ["present", "singular", "third-person"]。没有屈折变化则为空数组。
  - meanings：义项列表，按重要程度排序。每个义项包含：
    - priority：core（最常用的核心义）、common（常见义）、rare（书面、古旧、专业或罕见义）。判断要诚实，不要把所有义项都标成 core。
    - short_gloss：2 到 6 个字的中文速览释义。
    - learner_explanation：面向学习者的完整中文解释，说清含义边界与典型使用场景，不是简单对译。
    - usage_note：该义项的搭配或使用提醒（中文），没有则为 null。
    - examples：1 到 2 组双语例句，text 为自然地道的英文原句，translation 为对应中文翻译。core 与 common 义项必须给例句，rare 义项可以为空数组。
- comparisons：2 到 3 个近义词辨析。word 是被比较的近义词，analysis 用中文说明它与目标词在含义侧重、语域和典型场景上的差异。

整体要求：内容准确、克制，不确定的信息宁可省略；所有中文内容使用简体中文；引号使用中文引号。
`.trim();

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

/**
 * Deterministically wrap the generated explanatory fields into a full
 * `distribution_entry_v5` document so the rest of the app renders user
 * entries and distributed entries through one contract.
 */
function assembleUserEntry(
  parsed: ParsedGeneration,
  fallbackWord: string
): DictionaryEntry {
  const headword = parsed.headword.trim() || fallbackWord;
  const normalized = headword.toLowerCase();

  return {
    schema_version: "distribution_entry_v5",
    entry_id: `user-${normalized}`,
    headword,
    normalized_headword: normalized,
    headword_language: { code: "en", name: "English" },
    definition_language: { code: "zh-Hans", name: "Chinese (Simplified)" },
    entry_type: "standard",
    headword_summary: parsed.headword_summary.trim(),
    memory_hook: parsed.memory_hook.trim(),
    study_notes: parsed.study_notes
      .map((note) => note.trim())
      .filter((note) => note.length > 0),
    etymology_note: parsed.etymology_note?.trim() || null,
    etymologies: [],
    pos_groups: parsed.pos_groups.map((group) => ({
      pos: group.pos.trim().toLowerCase(),
      etymology_id: null,
      proper_name: false,
      summary: group.summary.trim(),
      usage_note: group.usage_note?.trim() || null,
      forms: group.forms.map((form) => ({
        text: form.text.trim(),
        tags: form.tags,
        roman: null,
      })),
      pronunciations: group.pronunciations.map((pronunciation) => ({
        ipa: pronunciation.ipa.trim(),
        text: null,
        tags: pronunciation.tags,
      })),
      relations: [],
      meanings: group.meanings.map((meaning, index) => ({
        sense_id: `s${index + 1}`,
        priority: meaning.priority,
        short_gloss: meaning.short_gloss.trim() || null,
        learner_explanation: meaning.learner_explanation.trim(),
        usage_note: meaning.usage_note?.trim() || null,
        labels: [],
        topics: [],
        examples: meaning.examples.map((example) => ({
          text: example.text.trim(),
          translation: example.translation.trim(),
        })),
      })),
    })),
    comparisons: parsed.comparisons.map((comparison) => ({
      word: comparison.word.trim(),
      analysis: comparison.analysis.trim(),
    })),
  };
}

export function hasLlmCredentials(config: LlmProvider) {
  return Boolean(config.apiKey.trim() && config.model.trim());
}

export async function fetchAvailableModels(
  config: LlmProvider
): Promise<LlmModelSummary[]> {
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

export async function generateDefinitionFromLlm(
  word: string,
  config: LlmProvider
): Promise<DictionaryEntry> {
  const trimmed = word.trim();
  if (!trimmed) {
    throw new LlmServiceError("Word is required.");
  }

  try {
    const { client, model } = createClient(config);
    const completion = await client.chat.completions.parse({
      model,
      temperature: 0.1,
      response_format: zodResponseFormat(RESPONSE_SCHEMA, "dictionary_entry"),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: trimmed,
        },
      ],
    });

    const parsed = completion.choices[0]?.message.parsed;

    if (!parsed) {
      throw new LlmServiceError("LLM response was missing structured content.");
    }

    return assembleUserEntry(parsed, trimmed);
  } catch (error) {
    throw normalizeLlmError(
      error,
      "Unable to generate a definition with the configured model."
    );
  }
}
