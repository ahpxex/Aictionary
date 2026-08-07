import { createOpenAI } from "@ai-sdk/openai";
import {
  APICallError,
  generateObject,
  NoObjectGeneratedError,
  streamObject,
  type DeepPartial,
  type RepairTextFunction,
  type LanguageModel,
} from "ai";
import { z } from "zod";
import { DictionaryEntry } from "@/shared/types/dictionary";
import { LlmProvider } from "@/shared/types/settings";

/** Where an OpenAI-compatible provider serves its API when none is configured. */
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

type RawModelListEntry = {
  id: string;
  owned_by?: string;
  created?: number;
};

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
 *
 * Strings carry no `.min()`: it converts to `minLength`, which OpenAI's
 * strict structured outputs reject outright, failing the whole request.
 * `minItems` on arrays is supported, so list sizes stay constrained here;
 * empty strings are dropped when the entry is assembled instead.
 */
const RESPONSE_SCHEMA = z.object({
  memory_hook: z.string(),
  study_notes: z.array(z.string()),
  etymology_note: z.string().nullable(),
  pos_groups: z
    .array(
      z.object({
        pos: z.string(),
        summary: z.string(),
        usage_note: z.string().nullable(),
        pronunciations: z.array(
          z.object({
            ipa: z.string(),
            tags: z.array(z.string()),
          })
        ),
        forms: z.array(
          z.object({
            text: z.string(),
            tags: z.array(z.string()),
          })
        ),
        meanings: z
          .array(
            z.object({
              priority: z.enum(["core", "common", "rare"]),
              short_gloss: z.string(),
              learner_explanation: z.string(),
              usage_note: z.string().nullable(),
              examples: z.array(
                z.object({
                  text: z.string(),
                  translation: z.string(),
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
      word: z.string(),
      analysis: z.string(),
    })
  ),
});

/**
 * The opening call, deliberately tiny.
 *
 * A large strict schema costs the provider tens of seconds before its first
 * token, so the one line worth showing immediately is asked for on its own
 * - it comes back in a second or two. It doubles as the sanity check on the
 * query, since deciding "is this even a word" needs no more context than
 * writing the summary does.
 */
const PREFLIGHT_SCHEMA = z.object({
  is_meaningful: z.boolean(),
  headword_summary: z.string(),
});

const PREFLIGHT_PROMPT = `
你在为一部英汉词典做词条预检。用户给你一个查询词，你判断它是否值得收录，并写一句话概括。

- is_meaningful：该查询是否是一个真实存在、值得收录的英语单词、短语、缩写或专有名词。明显的拼写错误、随机字符、无意义的键盘乱敲、以及纯粹不存在的造词，都返回 false。是否常用不影响判断——生僻词、专业术语、俚语都算 true。
- headword_summary：如果 is_meaningful 为 true，用一句中文概括这个词的核心含义与主要用法；如果为 false，返回空字符串。

只做这两件事，不要输出其他内容。
`.trim();

type ParsedGeneration = z.infer<typeof RESPONSE_SCHEMA>;
type PartialGeneration = DeepPartial<ParsedGeneration>;

type SanitizedConfig = {
  apiKey: string;
  baseURL?: string;
  model: string;
};

const SYSTEM_PROMPT = `
你是一位严谨的双语词典编纂专家，为中文母语的英语学习者编写词条。用户输入一个英语单词，你输出一个严格遵循给定 JSON Schema 的词条对象。

词条的标题词和一句话概括已经确定，会在用户消息中给出，你不需要重复产出，但后续所有内容都必须与之保持一致。

字段编写规则：

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

/**
 * Validate only what it takes to reach the provider.
 *
 * Listing models must not require a model to be chosen already - that is
 * the request whose whole purpose is to find one.
 */
function sanitizeCredentials(config: LlmProvider) {
  const apiKey = config.apiKey.trim();
  if (!apiKey) {
    throw new LlmServiceError("LLM API key is missing.");
  }

  // An empty base URL means plain OpenAI; anything else is an
  // OpenAI-compatible endpoint the user pointed us at.
  const baseURL =
    (config.baseUrl || "").trim().replace(/\/+$/, "") || DEFAULT_BASE_URL;

  return { apiKey, baseURL };
}

function sanitizeConfig(config: LlmProvider): SanitizedConfig {
  const { apiKey, baseURL } = sanitizeCredentials(config);

  const model = config.model.trim();
  if (!model) {
    throw new LlmServiceError("LLM model is missing.");
  }

  return { apiKey, baseURL, model };
}

/**
 * Resolve the configured provider into the two candidate models.
 *
 * The AI SDK defaults to the Responses API (`/responses`), which is what
 * OpenAI and DeepSeek both want: DeepSeek's `/chat/completions` rejects a
 * json_schema response format outright ("This response_format type is
 * unavailable now"). Plenty of other OpenAI-compatible servers implement
 * only `/chat/completions`, though, so that stays available as a fallback
 * for when `/responses` is not there at all.
 */
function createModels(config: LlmProvider) {
  const sanitized = sanitizeConfig(config);
  const provider = createOpenAI({
    apiKey: sanitized.apiKey,
    baseURL: sanitized.baseURL,
  });

  return {
    responses: provider(sanitized.model),
    chat: provider.chat(sanitized.model),
    modelId: sanitized.model,
  };
}

/**
 * Whether the provider simply does not serve the endpoint we tried, as
 * opposed to rejecting the request on its merits. Only the former is worth
 * retrying against the other API shape.
 */
function isMissingEndpoint(error: unknown): boolean {
  if (!APICallError.isInstance(error)) {
    return false;
  }
  if (error.statusCode === 404 || error.statusCode === 405) {
    return true;
  }
  const message = error.message.toLowerCase();
  return message.includes("not found") || message.includes("unknown endpoint");
}

function normalizeLlmError(error: unknown, fallback = "LLM request failed") {
  if (error instanceof LlmServiceError) {
    return error;
  }

  // The provider answered, but not with anything matching the schema -
  // usually a model too weak for structured output.
  if (NoObjectGeneratedError.isInstance(error)) {
    return new LlmServiceError(
      "The model did not return a dictionary entry in the expected shape.",
      { cause: error }
    );
  }

  if (APICallError.isInstance(error)) {
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
 *
 * This is also where empty strings are dropped. The wire schema cannot
 * forbid them (see RESPONSE_SCHEMA), so anything blank is filtered out here
 * rather than rendered as a stray bullet with nothing in it.
 */
function assembleUserEntry(
  parsed: ParsedGeneration,
  queryWord: string,
  headwordSummary: string
): DictionaryEntry {
  // The headword is the user's query, never the model's idea of it. Letting
  // the model choose meant it could silently answer about a different word -
  // correcting a spelling, expanding an abbreviation - and the entry would
  // then be cached under a headword nobody searched for.
  const headword = queryWord.trim();
  const normalized = headword.toLowerCase();

  const entry: DictionaryEntry = {
    schema_version: "distribution_entry_v5",
    entry_id: `user-${normalized}`,
    headword,
    normalized_headword: normalized,
    headword_language: { code: "en", name: "English" },
    definition_language: { code: "zh-Hans", name: "Chinese (Simplified)" },
    entry_type: "standard",
    headword_summary: headwordSummary.trim(),
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
      forms: group.forms
        .map((form) => ({
          text: form.text.trim(),
          tags: form.tags,
          roman: null,
        }))
        .filter((form) => form.text.length > 0),
      pronunciations: group.pronunciations
        .map((pronunciation) => ({
          ipa: pronunciation.ipa.trim(),
          text: null,
          tags: pronunciation.tags,
        }))
        .filter((pronunciation) => pronunciation.ipa.length > 0),
      relations: [],
      meanings: group.meanings
        .filter((meaning) => meaning.learner_explanation.trim().length > 0)
        .map((meaning, index) => ({
          sense_id: `s${index + 1}`,
          priority: meaning.priority,
          short_gloss: meaning.short_gloss.trim() || null,
          learner_explanation: meaning.learner_explanation.trim(),
          usage_note: meaning.usage_note?.trim() || null,
          labels: [],
          topics: [],
          examples: meaning.examples
            .map((example) => ({
              text: example.text.trim(),
              translation: example.translation.trim(),
            }))
            .filter((example) => example.text.length > 0),
        })),
    }))
      // A part-of-speech group whose meanings were all blank has nothing
      // left to render.
      .filter((group) => group.pos.length > 0 && group.meanings.length > 0),
    comparisons: parsed.comparisons
      .map((comparison) => ({
        word: comparison.word.trim(),
        analysis: comparison.analysis.trim(),
      }))
      .filter((comparison) => comparison.word && comparison.analysis),
  };

  // The contract never leaves an entry empty. If filtering removed every
  // group there is nothing worth showing or caching, so fail loudly instead
  // of persisting a hollow entry the user would have to delete by hand.
  if (entry.pos_groups.length === 0) {
    throw new LlmServiceError(
      "The model returned no usable meanings for this word."
    );
  }

  return entry;
}

export function hasLlmCredentials(config: LlmProvider) {
  return Boolean(config.apiKey.trim() && config.model.trim());
}

/**
 * List the models the provider exposes. The AI SDK has no model-listing
 * primitive - it deals in a model you already chose - so this talks to the
 * OpenAI-compatible `/models` endpoint directly. It doubles as the
 * connection test, since it is the cheapest authenticated call available.
 */
export async function fetchAvailableModels(
  config: LlmProvider
): Promise<LlmModelSummary[]> {
  const { apiKey, baseURL } = sanitizeCredentials(config);

  try {
    const response = await fetch(`${baseURL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      throw new LlmServiceError(
        `Provider returned ${response.status} ${response.statusText}.`
      );
    }

    const payload: { data?: RawModelListEntry[] } = await response.json();

    return (payload.data ?? [])
      .filter((model): model is RawModelListEntry => Boolean(model?.id))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((model) => ({
        id: model.id,
        ownedBy: model.owned_by ?? "",
        created: model.created ?? 0,
      }));
  } catch (error) {
    throw normalizeLlmError(error, "Unable to load models from the provider.");
  }
}

export async function testLlmConnection(config: LlmProvider) {
  await fetchAvailableModels(config);
}

/**
 * A dictionary entry taking shape, as it arrives.
 *
 * Generation runs long enough - tens of seconds - that showing nothing but a
 * spinner is its own problem, so the wire-level partial is mapped into this
 * lean shape for the UI to render progressively. Everything is optional
 * because any field may still be mid-flight.
 */
export type GenerationPreview = {
  memoryHook?: string;
  studyNotes: string[];
  posGroups: {
    pos?: string;
    summary?: string;
    meanings: { shortGloss?: string; learnerExplanation?: string }[];
  }[];
};

function toPreview(partial: PartialGeneration): GenerationPreview {
  return {
    memoryHook: partial?.memory_hook,
    studyNotes: (partial?.study_notes ?? []).filter(
      (note): note is string => Boolean(note)
    ),
    posGroups: (partial?.pos_groups ?? []).map((group) => ({
      pos: group?.pos,
      summary: group?.summary,
      meanings: (group?.meanings ?? []).map((meaning) => ({
        shortGloss: meaning?.short_gloss,
        learnerExplanation: meaning?.learner_explanation,
      })),
    })),
  };
}

/**
 * Rescue a response that arrived wrapped in a markdown fence.
 *
 * Providers that honour the JSON schema most of the time still drop out of
 * structured mode occasionally - DeepSeek does this on this schema roughly
 * one run in three - and answer with ```json … ``` instead. The payload
 * inside is valid, so unwrap it rather than failing the whole generation.
 * Returning null hands the original error back unchanged.
 */
const repairText: RepairTextFunction = async ({ text }) => {
  const fenced = /^\s*```(?:json)?\s*\n([\s\S]*?)\n?\s*```\s*$/.exec(text);
  return fenced ? fenced[1] : null;
};

const GENERATION_REQUEST = {
  schema: RESPONSE_SCHEMA,
  schemaName: "dictionary_entry",
  schemaDescription: "A bilingual dictionary entry for one English headword.",
  temperature: 0.1,
  system: SYSTEM_PROMPT,
  repairText,
} as const;

/**
 * What a generation attempt produced.
 *
 * A query that is not a word is a legitimate outcome, not a failure: the UI
 * has something to say about it and nothing should be cached.
 */
export type GenerationOutcome =
  | { kind: "entry"; entry: DictionaryEntry }
  | { kind: "not-a-word" };

export type GenerationCallbacks = {
  /** The one-line summary, available seconds before the rest. */
  onSummary: (summary: string) => void;
  /** Every partial of the full entry as it streams in. */
  onPreview: (preview: GenerationPreview) => void;
};

/** Run a request against the Responses API, falling back to chat completions. */
async function withEndpointFallback<T>(
  models: ReturnType<typeof createModels>,
  run: (model: LanguageModel) => Promise<T>
): Promise<T> {
  try {
    return await run(models.responses);
  } catch (error) {
    if (!isMissingEndpoint(error)) {
      throw error;
    }
    return await run(models.chat);
  }
}

/**
 * Generate an entry in two passes.
 *
 * The full schema is strict and large, and providers stall on it for tens of
 * seconds before emitting anything. A tiny opening call answers in a second
 * or two with the summary - which goes on screen immediately - and with a
 * verdict on whether the query is a word at all. Its summary is then handed
 * to the second pass, so the long generation neither repeats that work nor
 * contradicts what the user is already reading.
 */
export async function generateEntry(
  word: string,
  config: LlmProvider,
  callbacks: GenerationCallbacks
): Promise<GenerationOutcome> {
  const trimmed = word.trim();
  if (!trimmed) {
    throw new LlmServiceError("Word is required.");
  }

  const models = createModels(config);

  try {
    const preflight = await withEndpointFallback(models, (model) =>
      generateObject({
        model,
        schema: PREFLIGHT_SCHEMA,
        schemaName: "headword_preflight",
        temperature: 0,
        system: PREFLIGHT_PROMPT,
        prompt: trimmed,
        repairText,
      }).then((result) => result.object)
    );

    if (!preflight.is_meaningful) {
      return { kind: "not-a-word" };
    }

    const summary = preflight.headword_summary.trim();
    callbacks.onSummary(summary);

    // The second pass is told what has already been settled so it stays
    // consistent with the summary on screen.
    const prompt = summary
      ? `${trimmed}\n\n已确定的一句话概括：${summary}`
      : trimmed;

    const entry = await withEndpointFallback(models, async (model) => {
      const { partialObjectStream, object } = streamObject({
        ...GENERATION_REQUEST,
        model,
        prompt,
      });

      for await (const partial of partialObjectStream) {
        callbacks.onPreview(toPreview(partial));
      }

      return assembleUserEntry(await object, trimmed, summary);
    });

    return { kind: "entry", entry };
  } catch (error) {
    throw normalizeLlmError(
      error,
      "Unable to generate a definition with the configured model."
    );
  }
}
