import type { ReactNode } from "react";

/**
 * The two-column rail an entry is laid out on: a right-aligned label in the
 * gutter, the content behind a vertical border.
 *
 * Shared so the streaming view and the finished entry are the same shape.
 * They used to be laid out independently, and the page visibly rearranged
 * itself the moment generation completed.
 */
export function Row({
  rail,
  children,
  divider = false,
  className = "",
}: {
  rail?: ReactNode;
  children: ReactNode;
  divider?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-[5.5rem_1fr] ${
        divider ? "border-t border-border" : ""
      } ${className}`}
    >
      <div className="pr-3 pt-4 text-right">{rail}</div>
      <div className="border-l border-border py-4 pl-5">{children}</div>
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
      <div className="flex items-start justify-between gap-4">
        <h1 className="break-words text-6xl font-bold leading-none tracking-tighter">
          {headword}
        </h1>
        {actions && (
          <div className="flex shrink-0 items-center gap-1 pt-2">{actions}</div>
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
