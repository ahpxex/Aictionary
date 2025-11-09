# CLAUDE.md

## Project Overview

AIctionary is a Tauri-based desktop dictionary application with AI-powered explanations. It combines a React frontend with a Rust backend, providing offline dictionary lookups with optional LLM-based semantic explanations and word comparisons.

## Development Commands

You don't have to run any of the development servers.

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
