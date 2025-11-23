import { getRuntimeAnkiSettings } from "@/shared/state/anki-runtime";
import type { WordDefinition } from "@/shared/types/dictionary";
import type { AnkiSettings } from "@/shared/types/settings";

const ANKICONNECT_VERSION = 6;
const DEFAULT_MODEL_NAME = "Basic";
type AnkiCardTheme = AnkiSettings["cardTheme"];

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

function resolveCardTheme(theme?: AnkiSettings["cardTheme"]): AnkiSettings["cardTheme"] {
  return theme ?? "system";
}

function buildCardStyles() {
  return `
  <style>
    .aic-theme {
      font-family: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      --aic-surface: #ffffff;
      --aic-panel: #f8fafc;
      --aic-panel-strong: #eef2ff;
      --aic-border: #e2e8f0;
      --aic-text: #0f172a;
      --aic-muted: #6b7280;
      --aic-badge-bg: #e3e9ff;
      --aic-badge-text: #1d4ed8;
      --aic-example: #1d4ed8;
    }

    @media (prefers-color-scheme: dark) {
      .aic-theme:not([data-theme]),
      .aic-theme[data-theme="system"] {
        --aic-surface: #0f172a;
        --aic-panel: #111b2a;
        --aic-panel-strong: rgba(59, 130, 246, 0.12);
        --aic-border: rgba(148, 163, 184, 0.35);
        --aic-text: #eef1f7;
        --aic-muted: #94a3b8;
        --aic-badge-bg: rgba(59, 130, 246, 0.2);
        --aic-badge-text: #93c5fd;
        --aic-example: #60a5fa;
      }
    }

    .aic-theme[data-theme="dark"] {
      --aic-surface: #0f172a;
      --aic-panel: #111b2a;
      --aic-panel-strong: rgba(59, 130, 246, 0.12);
      --aic-border: rgba(148, 163, 184, 0.35);
      --aic-text: #eef1f7;
      --aic-muted: #94a3b8;
      --aic-badge-bg: rgba(59, 130, 246, 0.2);
      --aic-badge-text: #93c5fd;
      --aic-example: #60a5fa;
    }

    .aic-card {
      background: var(--aic-surface);
      color: var(--aic-text);
      border-radius: 16px;
      border: 1px solid var(--aic-border);
      padding: 20px 22px;
      line-height: 1.55;
    }

    .aic-word {
      font-size: 2.1rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .aic-word--small {
      font-size: 1.6rem;
    }

    .aic-pron {
      margin-top: 6px;
      font-size: 0.85rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--aic-muted);
    }

    .aic-definition {
      margin-top: 10px;
      font-size: 1rem;
    }

    .aic-section {
      margin-top: 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .aic-section-title {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--aic-muted);
    }

    .aic-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .aic-badge {
      padding: 2px 10px;
      border-radius: 999px;
      background: var(--aic-badge-bg);
      color: var(--aic-badge-text);
      font-size: 0.78rem;
      font-weight: 500;
    }

    .aic-stack {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .aic-definition-card,
    .aic-comparison-card {
      border: 1px solid var(--aic-border);
      border-radius: 12px;
      padding: 12px 14px;
      background: var(--aic-panel);
    }

    .aic-comparison-card {
      background: var(--aic-panel-strong);
      font-size: 0.92rem;
    }

    .aic-muted {
      color: var(--aic-muted);
      font-size: 0.92rem;
    }

    .aic-definition-card strong,
    .aic-comparison-card strong {
      display: block;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--aic-muted);
      margin-bottom: 6px;
    }

    .aic-example {
      margin-top: 6px;
      font-size: 0.82rem;
      color: var(--aic-example);
    }

    .aic-footer {
      margin-top: 22px;
      font-size: 0.78rem;
      color: var(--aic-muted);
      text-align: center;
    }
  </style>
  `.trim();
}

function buildFrontContent(
  definition: WordDefinition,
  theme: AnkiCardTheme
) {
  const styles = buildCardStyles();
  const themeAttr = resolveCardTheme(theme);
  const word = escapeHtml(definition.word ?? "");
  const pronunciation = definition.pronunciation?.trim()
    ? `/${escapeHtml(definition.pronunciation)}/`
    : "";
  const concise = definition.concise_definition?.trim()
    ? formatMultiline(definition.concise_definition)
    : "";

  return `
  ${styles}
  <div class="aic-theme" data-theme="${themeAttr}">
    <div class="aic-card">
      <div class="aic-word">${word}</div>
      ${pronunciation ? `<div class="aic-pron">${pronunciation}</div>` : ""}
      ${concise ? `<div class="aic-definition">${concise}</div>` : ""}
    </div>
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
        <span class="aic-badge">${formatFormLabel(key)} · ${escapeHtml(value)}</span>
      `
    )
    .join("\n");

  return `
    <div class="aic-section">
      <div class="aic-section-title">Word forms</div>
      <div class="aic-badges">${content}</div>
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
        segments.push(`<div>${formatMultiline(entry.explanation_en)}</div>`);
      }

      if (entry.explanation_cn?.trim()) {
        segments.push(`<div class="aic-muted">${formatMultiline(entry.explanation_cn)}</div>`);
      }

      const examples: string[] = [];
      if (entry.example_en?.trim()) {
        examples.push(`<div class="aic-example">EN · ${formatMultiline(entry.example_en)}</div>`);
      }

      if (entry.example_cn?.trim()) {
        examples.push(`<div class="aic-example">CN · ${formatMultiline(entry.example_cn)}</div>`);
      }

      return `
        <div class="aic-definition-card">
          <strong>${escapeHtml(entry.pos || `Sense ${index + 1}`)}</strong>
          ${segments.join("\n")}
          ${examples.join("\n")}
        </div>
      `;
    })
    .join("\n");

  return `
    <div class="aic-section">
      <div class="aic-section-title">Definitions</div>
      <div class="aic-stack">
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
        <div class="aic-comparison-card">
          <strong>${escapeHtml(entry.word_to_compare)}</strong>
          <div>${formatMultiline(entry.analysis)}</div>
        </div>
      `
    )
    .join("\n");

  if (!blocks) {
    return "";
  }

  return `
    <div class="aic-section">
      <div class="aic-section-title">Comparisons</div>
      <div class="aic-stack">
        ${blocks}
      </div>
    </div>
  `;
}

function buildBackContent(
  definition: WordDefinition,
  theme: AnkiCardTheme
) {
  const styles = buildCardStyles();
  const themeAttr = resolveCardTheme(theme);
  const sections = [
    buildFormsSection(definition),
    buildDefinitionsSection(definition),
    buildComparisonSection(definition),
  ].filter(Boolean);

  const footer = `
    <div class="aic-footer">
      Crafted with AIctionary · ${new Date().toLocaleDateString()}
    </div>
  `;

  return `
    ${styles}
    <div class="aic-theme" data-theme="${themeAttr}">
      <div class="aic-card">
        <div class="aic-word aic-word--small">${escapeHtml(definition.word ?? "")}</div>
        ${definition.concise_definition?.trim() ? `<div class="aic-definition">${formatMultiline(
          definition.concise_definition
        )}</div>` : ""}
        ${sections.join("\n")}
        ${footer}
      </div>
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

  const front = buildFrontContent(definition, settings.cardTheme);
  const back = buildBackContent(definition, settings.cardTheme);

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
