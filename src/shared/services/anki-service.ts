import { getRuntimeAnkiSettings } from "@/shared/state/anki-runtime";
import type { DictionaryEntry } from "@/shared/types/dictionary";
import type { AnkiSettings } from "@/shared/types/settings";
import {
  collectPronunciations,
  splitMeaningsByPriority,
} from "@/shared/lib/dictionary-entry";

const ANKICONNECT_VERSION = 6;
const DEFAULT_MODEL_NAME = "Basic";
type AnkiCardTheme = AnkiSettings["cardTheme"];

type AddEntryOptions = {
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

function resolveCardTheme(theme?: AnkiCardTheme): AnkiCardTheme {
  return theme === "dark" ? "dark" : "light";
}

function buildCardStyles() {
  return `
  <style>
    .aic-theme {
      font-family: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .aic-theme,
    .aic-theme[data-theme="light"] {
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
      font-size: 0.9rem;
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

    .aic-definition-card {
      border: 1px solid var(--aic-border);
      border-radius: 12px;
      padding: 12px 14px;
      background: var(--aic-panel);
    }

    .aic-muted {
      color: var(--aic-muted);
      font-size: 0.92rem;
    }

    .aic-definition-card strong {
      display: block;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--aic-muted);
      margin-bottom: 6px;
    }

    .aic-gloss {
      font-weight: 600;
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

function formatPronunciations(entry: DictionaryEntry): string {
  const pronunciations = collectPronunciations(entry);
  if (!pronunciations.length) {
    return "";
  }

  return pronunciations
    .map((pronunciation) => {
      const rendered = pronunciation.ipa ?? pronunciation.text ?? "";
      const tags = pronunciation.tags.join(" ");
      return escapeHtml(tags ? `${tags} ${rendered}` : rendered);
    })
    .join(" · ");
}

function buildFrontContent(entry: DictionaryEntry, theme: AnkiCardTheme) {
  const styles = buildCardStyles();
  const themeAttr = resolveCardTheme(theme);
  const word = escapeHtml(entry.headword ?? "");
  const pronunciation = formatPronunciations(entry);

  return `
  ${styles}
  <div class="aic-theme" data-theme="${themeAttr}">
    <div class="aic-card">
      <div class="aic-word">${word}</div>
      ${pronunciation ? `<div class="aic-pron">${pronunciation}</div>` : ""}
    </div>
  </div>
  `.trim();
}

function buildFormsSection(entry: DictionaryEntry) {
  const badges = entry.pos_groups
    .flatMap((group) => group.forms)
    .filter((form) => form.text.trim())
    .map(
      (form) => `
        <span class="aic-badge">${escapeHtml(
          form.tags.length ? `${form.tags.join(" ")} · ${form.text}` : form.text
        )}</span>
      `
    );

  if (!badges.length) {
    return "";
  }

  return `
    <div class="aic-section">
      <div class="aic-section-title">Word forms</div>
      <div class="aic-badges">${badges.join("\n")}</div>
    </div>
  `;
}

function buildMeaningsSection(entry: DictionaryEntry) {
  const cards = entry.pos_groups.map((group) => {
    // Cards stay compact: rare meanings are dropped unless the group has
    // nothing else (the distribution contract's fallback rule).
    const { visible } = splitMeaningsByPriority(group);

    const meanings = visible
      .map((meaning) => {
        const segments: string[] = [];
        const gloss = meaning.short_gloss?.trim();
        if (gloss) {
          segments.push(`<div class="aic-gloss">${escapeHtml(gloss)}</div>`);
        }
        segments.push(`<div>${formatMultiline(meaning.learner_explanation)}</div>`);

        const examples = meaning.examples
          .slice(0, 1)
          .flatMap((example) => [
            `<div class="aic-example">EN · ${formatMultiline(example.text)}</div>`,
            `<div class="aic-example">CN · ${formatMultiline(example.translation)}</div>`,
          ]);

        return `${segments.join("\n")}${examples.join("\n")}`;
      })
      .join('<div style="height: 8px"></div>');

    return `
      <div class="aic-definition-card">
        <strong>${escapeHtml(group.pos)}</strong>
        <div class="aic-muted">${formatMultiline(group.summary)}</div>
        <div style="height: 6px"></div>
        ${meanings}
      </div>
    `;
  });

  if (!cards.length) {
    return "";
  }

  return `
    <div class="aic-section">
      <div class="aic-section-title">Meanings</div>
      <div class="aic-stack">
        ${cards.join("\n")}
      </div>
    </div>
  `;
}

function buildStudySection(entry: DictionaryEntry) {
  const blocks: string[] = [];

  if (entry.memory_hook?.trim()) {
    blocks.push(`
      <div class="aic-definition-card">
        <strong>Memory hook</strong>
        <div>${formatMultiline(entry.memory_hook)}</div>
      </div>
    `);
  }

  if (entry.study_notes.length) {
    const notes = entry.study_notes
      .map((note) => `<div>· ${formatMultiline(note)}</div>`)
      .join("\n");
    blocks.push(`
      <div class="aic-definition-card">
        <strong>Study notes</strong>
        ${notes}
      </div>
    `);
  }

  if (!blocks.length) {
    return "";
  }

  return `
    <div class="aic-section">
      <div class="aic-section-title">Study</div>
      <div class="aic-stack">
        ${blocks.join("\n")}
      </div>
    </div>
  `;
}

function buildBackContent(entry: DictionaryEntry, theme: AnkiCardTheme) {
  const styles = buildCardStyles();
  const themeAttr = resolveCardTheme(theme);
  const sections = [
    buildMeaningsSection(entry),
    buildFormsSection(entry),
    buildStudySection(entry),
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
        <div class="aic-word aic-word--small">${escapeHtml(entry.headword ?? "")}</div>
        ${entry.headword_summary?.trim() ? `<div class="aic-definition">${formatMultiline(
          entry.headword_summary
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

export async function addEntryToAnki(
  entry: DictionaryEntry,
  options?: AddEntryOptions
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

  if (!entry.headword?.trim()) {
    throw new Error("Missing word definition");
  }

  const cardTheme = resolveCardTheme(settings.cardTheme);
  const front = buildFrontContent(entry, cardTheme);
  const back = buildBackContent(entry, cardTheme);

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
