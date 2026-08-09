import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The two-column rail an entry is laid out on: a right-aligned label in the
 * gutter, the content behind a vertical border.
 *
 * Shared so the streaming view and the finished entry are the same shape.
 * They used to be laid out independently, and the page visibly rearranged
 * itself the moment generation completed.
 *
 * The 5.5rem gutter costs a fifth of a phone viewport, which the content
 * column cannot spare, so the two rail kinds part ways below `md`:
 *
 * - `marker` rails hold a sense number or a three-letter relation code. They
 *   stay in a narrow gutter, and the spine keeps running down the entry.
 * - `label` rails hold wrapped words like "Memory hook". Squeezing those into
 *   a gutter shreds them one syllable per line, so they lift above the
 *   content and hand it the full width.
 */
export function Row({
  rail,
  children,
  divider = false,
  variant = "label",
  className = "",
}: {
  rail?: ReactNode;
  children: ReactNode;
  divider?: boolean;
  variant?: "label" | "marker";
  className?: string;
}) {
  const isMarker = variant === "marker";

  return (
    <div
      className={cn(
        "grid md:grid-cols-[5.5rem_1fr]",
        // 2.75rem is the narrowest gutter that still fits a four-letter
        // part-of-speech tag at the tracked label size.
        isMarker ? "grid-cols-[2.75rem_1fr]" : "grid-cols-1",
        divider && "border-t border-border",
        className
      )}
    >
      <div
        className={cn(
          "pt-4 md:pr-3 md:text-right",
          isMarker ? "pr-2 text-right" : "pb-1"
        )}
      >
        {rail}
      </div>
      <div
        className={cn(
          "md:border-l md:border-border md:py-4 md:pl-5",
          isMarker ? "border-l border-border py-4 pl-3" : "pb-4"
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function RailLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[0.65rem] font-medium uppercase leading-5 tracking-[0.15em] text-muted-foreground">
      {children}
    </span>
  );
}

/** The headword block, identical in the streaming and finished views. */
export function EntryHeader({
  headword,
  summary,
  meta,
  actions,
}: {
  headword: string;
  summary?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 pb-6">
      <div className="flex items-start justify-between gap-3 md:gap-4">
        {/* min-w-0 lets a long headword hyphenate instead of pushing the
            action buttons off a phone viewport. */}
        <h1 className="min-w-0 break-words text-4xl font-bold leading-none tracking-tighter md:text-6xl">
          {headword}
        </h1>
        {actions && (
          <div className="flex shrink-0 items-center gap-1 pt-1 md:pt-2">
            {actions}
          </div>
        )}
      </div>

      {meta && (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {meta}
        </div>
      )}

      {summary && (
        <div className="max-w-prose leading-relaxed text-foreground/90">
          {summary}
        </div>
      )}
    </header>
  );
}
