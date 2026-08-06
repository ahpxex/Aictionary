# CLAUDE.md

## Project Overview

AIctionary is a Tauri-based desktop dictionary application with AI-powered explanations. It combines a React frontend with a Rust backend, providing offline dictionary lookups with optional LLM-based semantic explanations and word comparisons.

## Guidelines

- You don't have to run any of the development servers.
- Copy a clearly described commit message into clipboard every time finished conversation.

## Architecture

### State Management Pattern

The app uses a **single source of truth** pattern with Jotai atoms and sync components:

1. **Settings State** (`src/shared/state/settings.ts`)

   - All user preferences stored in `settingsAtom` (persisted to localStorage)
   - Includes: theme, language, LLM config, dictionary cache, keyboard shortcuts

2. **Sync Components** (`src/app/appearance-sync.tsx`)

   - Bridge between Jotai state and external libraries
   - Syncs settings changes to: next-themes (theme), DOM (accent color), react-i18next (language)
   - Pattern: `useEffect` watches settings atom → updates external systems
   - Important: Don't bypass sync components; always update settings atom

3. **Settings Hooks** (`src/features/settings/hooks/use-settings.ts`)
   - Provides `updateTheme()`, `updateLanguage()`, `updateLlm()`, etc.
   - Components should use these hooks, not modify atoms directly

### Feature-Based Structure

```
src/
├── app/                  # App-level setup (providers, router, layout, sync)
├── features/             # Feature modules (main, statistics, settings)
│   ├── main/            # Dictionary lookup and word definitions
│   ├── statistics/      # Usage tracking and analytics
│   └── settings/        # User preferences
├── shared/              # Cross-feature code
│   ├── components/      # Reusable UI components
│   ├── locales/         # i18n translation files (en, zh)
│   ├── services/        # i18n configuration
│   ├── state/           # Jotai atoms (settings)
│   └── types/           # TypeScript types
└── components/ui/       # shadcn/ui components
```

### Internationalization (i18n)

- Uses **react-i18next** with two languages: English (en) and Simplified Chinese (zh)
- Translation files: `src/shared/locales/{en,zh}/translation.json`
- Configuration: `src/shared/services/i18n.ts` (imported in `main.tsx`)
- Language syncing: Handled by `AppearanceSync` component
- Pattern: `const { t } = useTranslation()` → `t("namespace.key")`
- All user-facing text must use translation keys (140+ strings already translated)

### Tauri Integration

- Frontend communicates with Rust backend via `@tauri-apps/api`
- Example: LLM provider testing uses `invoke("test_llm_provider", { ... })`
- Backend code in `src-tauri/src/`

### Dictionary Data Contract

The dictionary consumes the `distribution_entry_v5` contract of
`ahpxex/open-dictionary` (release v2.0 and later):

- The release ships `distribution.sqlite.gz` (a gzip-compressed SQLite
  artifact) plus `SHA256SUMS.txt`. There are no per-word JSON files anymore.
- The extracted `distribution.sqlite` lives in the dictionary cache
  directory. Lookups go through the Rust command `dictionary_query`, which
  matches `normalized_headword` (lowercased input) via the
  `(headword_language_code, normalized_headword)` index and returns the full
  `entries.document_json` product row.
- User-generated (LLM) entries are stored separately in
  `user_dictionary.sqlite` in the same directory, so re-downloading the
  dictionary never touches user data. Lookups fall back to it when the
  distributed dictionary misses.
- TypeScript types for the contract live in `src/shared/types/dictionary.ts`
  (`DictionaryEntry`, `DictionaryLookupResult`, ...). Rendering helpers
  (pronunciation aggregation, rare-meaning folding with the contract's
  "never leave an entry empty" fallback rule, relation grouping) live in
  `src/shared/lib/dictionary-entry.ts`.
- LLM generation (`src/shared/services/llm-service.ts`) produces only
  explanatory fields; the full v5 envelope is assembled deterministically in
  code. User entries may carry an app-level `comparisons` extension field
  that distributed entries never have.

### GitHub Service

`src/shared/services/github-service.ts` provides functions to fetch dictionary releases from GitHub:

- `getLatestDictionaryRelease()`: Fetches the latest release carrying
  `distribution.sqlite.gz` from `ahpxex/open-dictionary`
- `getAllDictionaryReleases()`: Fetches all releases containing the dictionary artifact
- Returns: version, download URL, file size, publication date, and the
  `SHA256SUMS.txt` URL when published
- Uses GitHub's public API (no authentication required)

### Download Service

The app includes a comprehensive download service with progress tracking and retry logic:

**Backend (Rust)**: `src-tauri/src/download.rs`

- `download_file` command: Downloads files with progress tracking and automatic retries
- `extract_gzip` command: Verifies the archive against an expected SHA-256
  (when provided) and decompresses it with progress feedback; writes to a
  `.part` file and renames atomically, then deletes the archive
- `fetch_text_file` command: Fetches small text assets (checksum manifests)
  through Rust so release downloads never depend on webview CORS
- Event emissions: `download-progress`, `download-complete`, `download-error`, `download-retry`, `verify-progress`, `extract-progress`, `extract-complete`
- Exponential backoff for retries (2^attempt seconds between attempts)
- Configurable max retries (default: 3)

**Frontend (React)**:

- **Types**: `src/shared/types/download.ts` - TypeScript interfaces for download operations
- **Service**: `src/shared/services/download-service.ts` - Wrapper for Tauri commands with event listeners
- **Planner**: `src/shared/services/dictionary-download.ts` -
  `planDictionaryDownload(cachePath)` resolves the latest release, fetches
  and parses the checksum manifest, and returns ready-to-use
  `DownloadOptions`
- **Hook**: `src/shared/hooks/use-download.ts` - React hook for managing download state
- **Component**: `src/shared/components/download-dialog.tsx` - Dialog with progress UI

**Usage Pattern** (see `src/features/settings/components/dictionary-tab.tsx`):

```typescript
import { useState } from "react";
import { DownloadDialog } from "@/shared/components/download-dialog";
import { planDictionaryDownload } from "@/shared/services/dictionary-download";
import type { DownloadOptions } from "@/shared/types/download";

const [dialogOpen, setDialogOpen] = useState(false);
const [options, setOptions] = useState<DownloadOptions | null>(null);

// Trigger download from GitHub
const handleDownload = async () => {
  const { options } = await planDictionaryDownload(cachePath, {
    onComplete: (result) => console.log("Downloaded:", result.filePath),
    onExtractComplete: () => console.log("Extraction complete!"),
  });
  setOptions(options);
  setDialogOpen(true);
};

// Render dialog
<DownloadDialog
  open={dialogOpen}
  onOpenChange={setDialogOpen}
  downloadOptions={options}
  onSuccess={() => console.log("All done!")}
/>;
```

**Features**:

- Real-time progress tracking (bytes downloaded, percentage)
- Automatic retry with exponential backoff
- SHA-256 verification against the release's checksum manifest
- Gzip extraction with progress bar and atomic rename
- Localized UI (English/Chinese)
- Error handling with user-friendly messages
- Non-dismissible dialog during active download/verification/extraction

### UI Patterns

- **Components**: shadcn/ui (Radix UI primitives) with Tailwind CSS
- **Styling**: Tailwind v4 with data attributes for theming
  - Theme mode: Handled by next-themes (class-based: `.dark`)
  - Accent color: DOM attribute `data-accent="blue|purple|green|orange|rose"`
- **Forms**: react-hook-form with zod validation
- **Routing**: React Router v7 (hash-based for Tauri compatibility)

## Key Conventions

### Path Aliases

- Use `@/` for absolute imports from `src/` (configured in tsconfig.json)
- Example: `import { Button } from "@/components/ui/button"`

### Settings Updates

Always use the provided update functions from `useSettings()`:

```typescript
const { settings, updateTheme, updateLanguage } = useSettings();
// ✓ Correct
updateLanguage("zh");
// ✗ Wrong - bypasses sync
setSettings({ ...settings, language: "zh" });
```

### Adding New Translations

1. Add keys to both `src/shared/locales/en/translation.json` and `zh/translation.json`
2. Use structured namespace keys: `"feature.component.element"`
3. For dynamic values use interpolation: `t("key", { count: 5 })`

### Feature Organization

Each feature module should contain:

- `index.tsx` - Main page component (exported as `*Page`)
- `components/` - Feature-specific components
- `hooks/` - Feature-specific hooks (optional)

## Important Technical Details

### Lazy Loading

Main features are lazy-loaded via React Router:

```typescript
const MainPage = lazy(() =>
  import("@/features/main").then((m) => ({ default: m.MainPage }))
);
```

### Storage Keys

- Settings: `"aictionary-settings"` (localStorage via Jotai)
- Theme: `"aictionary-theme"` (localStorage via next-themes)

### TypeScript Strictness

- Strict mode enabled
- No unused locals/parameters allowed
- All settings types defined in `src/shared/types/settings.ts`
