import { getRuntimeAnkiSettings } from "@/shared/state/anki-runtime";
import type { WordDefinition } from "@/shared/types/dictionary";
import type { AnkiSettings } from "@/shared/types/settings";

const ANKICONNECT_VERSION = 6;
const DEFAULT_MODEL_NAME = "Basic";

type AddDefinitionOptions = {
  signal?: AbortSignal;
  settingsOverride?: Partial<AnkiSettings>;
};

type AnkiConnectResponse<T> = {
  result: T;
  error: string | null;
};

type AnkiRequestPayload<Params> = {
  action: string;
  version: number;
  params?: Params;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMultiline(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function formatFormLabel(key: string) {
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildFrontContent(definition: WordDefinition) {
  const word = escapeHtml(definition.word ?? "");
  const pronunciation = definition.pronunciation?.trim()
    ? `/${escapeHtml(definition.pronunciation)}/`
    : "";
  const concise = definition.concise_definition?.trim()
    ? formatMultiline(definition.concise_definition)
    : "";

  return `
  <div style="font-family: 'Inter', 'SF Pro Display', system-ui; background: radial-gradient(circle at top, #0f172a, #020617); color: #f8fafc; padding: 28px 20px; border-radius: 20px; text-align: center;">
    <div style="font-size: 2.5rem; font-weight: 600; letter-spacing: -0.02em;">${word}</div>
    ${pronunciation ? `<div style="margin-top: 8px; font-size: 1.1rem; color: rgba(248, 250, 252, 0.75); letter-spacing: 0.15em;">${pronunciation}</div>` : ""}
    ${concise ? `<div style="margin-top: 16px; font-size: 1.1rem; color: rgba(248, 250, 252, 0.95);">${concise}</div>` : ""}
  </div>
  `.trim();
}

function buildFormsSection(definition: WordDefinition) {
  const entries = Object.entries(definition.forms ?? {}).filter(
    ([, value]) => Boolean(value && value.trim())
  );

  if (!entries.length) {
    return "";
  }

  const content = entries
    .map(
      ([key, value]) => `
      <span style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; font-weight: 500; color: #0f172a; background: #e0f2fe; border-radius: 999px; padding: 4px 12px;">
        <span style="text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.7rem; color: #0369a1;">${formatFormLabel(
          key
        )}</span>
        ${escapeHtml(value)}
      </span>
    `
    )
    .join("\n");

  return `
    <div style="margin-top: 20px;">
      <div style="font-size: 0.85rem; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #94a3b8;">Word Forms</div>
      <div style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px;">${content}</div>
    </div>
  `;
}

function buildDefinitionsSection(definition: WordDefinition) {
  if (!definition.definitions?.length) {
    return "";
  }

  const cards = definition.definitions
    .map((entry, index) => {
      const segments: string[] = [];
      if (entry.explanation_en?.trim()) {
        segments.push(
          `<div style="font-size: 1.05rem; font-weight: 600; color: #0f172a;">${formatMultiline(
            entry.explanation_en
          )}</div>`
        );
      }

      if (entry.explanation_cn?.trim()) {
        segments.push(
          `<div style="margin-top: 6px; color: #475569;">${formatMultiline(
            entry.explanation_cn
          )}</div>`
        );
      }

      const examples: string[] = [];
      if (entry.example_en?.trim()) {
        examples.push(
          `<div style="margin-top: 12px; font-size: 0.9rem; color: #0ea5e9;">EN · ${formatMultiline(
            entry.example_en
          )}</div>`
        );
      }

      if (entry.example_cn?.trim()) {
        examples.push(
          `<div style="margin-top: 4px; font-size: 0.9rem; color: #0284c7;">CN · ${formatMultiline(
            entry.example_cn
          )}</div>`
        );
      }

      return `
        <div style="padding: 18px; border-radius: 16px; background: #fff; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
          <div style="font-size: 0.75rem; font-weight: 600; letter-spacing: 0.3em; text-transform: uppercase; color: #94a3b8;">${escapeHtml(
            entry.pos || `Sense ${index + 1}`
          )}</div>
          ${segments.join("\n")}
          ${examples.join("\n")}
        </div>
      `;
    })
    .join("\n");

  return `
    <div style="margin-top: 24px;">
      <div style="font-size: 0.85rem; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #94a3b8;">Definitions</div>
      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 14px;">
        ${cards}
      </div>
    </div>
  `;
}

function buildComparisonSection(definition: WordDefinition) {
  if (!definition.comparison?.length) {
    return "";
  }

  const blocks = definition.comparison
    .filter((entry) => entry.word_to_compare?.trim() && entry.analysis?.trim())
    .map(
      (entry) => `
        <div style="padding: 16px; border-radius: 12px; background: #0f172a; color: #e2e8f0;">
          <div style="font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #38bdf8;">${escapeHtml(
            entry.word_to_compare
          )}</div>
          <div style="margin-top: 8px; font-size: 0.95rem; color: rgba(226, 232, 240, 0.92);">${formatMultiline(
            entry.analysis
          )}</div>
        </div>
      `
    )
    .join("\n");

  if (!blocks) {
    return "";
  }

  return `
    <div style="margin-top: 24px;">
      <div style="font-size: 0.85rem; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #94a3b8;">Comparisons</div>
      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 14px;">
        ${blocks}
      </div>
    </div>
  `;
}

function buildBackContent(definition: WordDefinition) {
  const sections = [
    buildFormsSection(definition),
    buildDefinitionsSection(definition),
    buildComparisonSection(definition),
  ].filter(Boolean);

  const footer = `
    <div style="margin-top: 24px; font-size: 0.8rem; text-align: center; color: #94a3b8;">
      Crafted with AIctionary · ${new Date().toLocaleDateString()}
    </div>
  `;

  return `
    <div style="font-family: 'Inter', 'SF Pro Display', system-ui; color: #0f172a; background: linear-gradient(145deg, #fdfbfb, #ebedee); border-radius: 24px; padding: 26px;">
      <div style="font-size: 1.25rem; font-weight: 600;">${escapeHtml(
        definition.word ?? ""
      )}</div>
      ${definition.concise_definition?.trim() ? `<div style="margin-top: 6px; color: #475569;">${formatMultiline(
        definition.concise_definition
      )}</div>` : ""}
      ${sections.join("\n")} 
      ${footer}
    </div>
  `.trim();
}

async function requestAnki<T, Params = Record<string, unknown>>(
  apiUrl: string,
  payload: AnkiRequestPayload<Params>,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    throw new Error(`AnkiConnect request failed: ${response.status}`);
  }

  const result: AnkiConnectResponse<T> = await response.json();

  if (result.error) {
    throw new Error(result.error);
  }

  return result.result;
}

function isDeckMissingError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("deck was not found") ||
    normalized.includes("no such deck") ||
    normalized.includes("deck does not exist")
  );
}

async function ensureDeckExists(
  apiUrl: string,
  deckName: string,
  signal?: AbortSignal
) {
  try {
    await requestAnki(apiUrl, {
      action: "createDeck",
      version: ANKICONNECT_VERSION,
      params: { deck: deckName },
    }, signal);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("deck already exists")
    ) {
      return;
    }

    throw error;
  }
}

export async function addDefinitionToAnki(
  definition: WordDefinition,
  options?: AddDefinitionOptions
) {
  const runtimeSettings = getRuntimeAnkiSettings();
  const settings: AnkiSettings = {
    ...runtimeSettings,
    ...options?.settingsOverride,
  } as AnkiSettings;

  const apiUrl = settings.apiUrl?.trim();
  const deckName = settings.deckName?.trim();

  if (!apiUrl || !deckName) {
    throw new Error("Incomplete Anki configuration");
  }

  if (!definition.word?.trim()) {
    throw new Error("Missing word definition");
  }

  const front = buildFrontContent(definition);
  const back = buildBackContent(definition);

  const payload: AnkiRequestPayload<{ note: Record<string, unknown> }> = {
    action: "addNote",
    version: ANKICONNECT_VERSION,
    params: {
      note: {
        deckName,
        modelName: DEFAULT_MODEL_NAME,
        fields: {
          Front: front,
          Back: back,
        },
        options: {
          allowDuplicate: false,
        },
        tags: ["aictionary", "ai"],
      },
    },
  };

  const request = () => requestAnki<number | null>(apiUrl, payload, options?.signal);

  try {
    return await request();
  } catch (error) {
    if (error instanceof Error && isDeckMissingError(error.message)) {
      await ensureDeckExists(apiUrl, deckName, options?.signal);
      return await request();
    }

    throw error;
  }
}
