import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { posLabelZh, type GlanceRow } from "@/shared/lib/dictionary-entry";
import { RailLabel, Row } from "@/features/main/components/entry-layout";

/** Anchor id of an entry section, shared by the sections and every link to them. */
export function sectionAnchor(key: string): string {
  return `entry-section-${key}`;
}

export type SectionNavItem = {
  key: string;
  /** Short label; a part of speech renders as its code plus the Chinese name. */
  label: string;
  pos?: string;
};

/** The scrolling ancestor the entry lives in (see `ScrollRegion`). */
function scrollContainerOf(element: Element | null): HTMLElement | null {
  return element?.closest<HTMLElement>(".scroll-region") ?? null;
}

/**
 * Bring a section to the top of the entry's scroll region.
 *
 * Sections carry a `scroll-margin-top` that clears the sticky bar, so a
 * plain `scrollIntoView` lands the heading just below it.
 */
export function scrollToSection(key: string) {
  document
    .getElementById(sectionAnchor(key))
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Pocket-dictionary summary under the headword: one line per part of speech
 * with its common glosses. Each line jumps to the full section, so this
 * block is also the entry's table of contents before any scrolling.
 */
export function EntryGlance({
  rows,
  interactive = true,
}: {
  rows: GlanceRow[];
  /** False while an entry is still streaming in and has no sections to reach. */
  interactive?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Row divider rail={<RailLabel>{t("main.entry.glance")}</RailLabel>}>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              disabled={!interactive}
              onClick={() => scrollToSection(row.key)}
              className="group flex w-full items-baseline gap-3 text-left disabled:cursor-default"
            >
              <span className="w-10 shrink-0 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors group-enabled:group-hover:text-foreground">
                {row.pos}
              </span>
              <span className="min-w-0 text-sm leading-relaxed underline-offset-4 group-enabled:group-hover:underline">
                {row.glosses.join("；")}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Row>
  );
}

function NavLabel({ item }: { item: SectionNavItem }) {
  if (!item.pos) {
    return <>{item.label}</>;
  }
  const zh = posLabelZh(item.pos);
  return (
    <>
      <span className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em]">
        {item.pos}
      </span>
      {zh && <span className="ml-1">{zh}</span>}
    </>
  );
}

/**
 * Which section is being read: the last one whose top has passed under the
 * sticky bar. At the very bottom the last section wins even if it is too
 * short to reach the top, otherwise its link could never light up.
 */
function useActiveSection(
  items: SectionNavItem[],
  anchorRef: RefObject<HTMLElement | null>,
  offset: number
) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const container = scrollContainerOf(anchorRef.current);
    if (!container || items.length === 0) {
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const top = container.getBoundingClientRect().top + offset;
      let current: string | null = null;
      for (const item of items) {
        const section = document.getElementById(sectionAnchor(item.key));
        if (section && section.getBoundingClientRect().top <= top) {
          current = item.key;
        }
      }
      const atBottom =
        container.scrollTop + container.clientHeight >= container.scrollHeight - 2;
      if (atBottom && current !== null) {
        current = items[items.length - 1].key;
      }
      setActive(current);
    };
    const schedule = () => {
      if (!frame) {
        frame = requestAnimationFrame(update);
      }
    };

    update();
    container.addEventListener("scroll", schedule, { passive: true });
    return () => {
      container.removeEventListener("scroll", schedule);
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [anchorRef, items, offset]);

  return active;
}

/** Height of the bar; sections reserve it with `scroll-mt-12`. */
const NAV_HEIGHT = 48;

/** Sections land this far below the top on wide screens (`lg:scroll-mt-6`). */
const TOC_SCROLL_MARGIN = 24;

/**
 * The entry's two-column frame on wide screens: the entry, and a column for
 * its table of contents. Narrower than `lg` there is no room beside the
 * text, so the column disappears and the entry takes the full width.
 *
 * The streaming preview uses the same frame with an empty column, so the
 * text does not move sideways when generation finishes and the contents
 * appear.
 */
export function EntryFrame({
  toc,
  children,
}: {
  toc?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_11rem] lg:gap-10">
      <div className="min-w-0">{children}</div>
      <aside className="hidden lg:block">{toc}</aside>
    </div>
  );
}

/**
 * The table of contents beside a long entry on wide screens: one line per
 * section down the side, held in place while the entry scrolls, with the
 * section being read marked, like the running contents of a book.
 */
export function EntryToc({ items }: { items: SectionNavItem[] }) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLElement>(null);
  const active = useActiveSection(items, listRef, TOC_SCROLL_MARGIN + 8);

  return (
    <nav ref={listRef} aria-label={t("main.entry.sections")} className="sticky top-8">
      <p className="mb-3 text-[0.65rem] font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {t("main.entry.contents")}
      </p>
      <ul className="flex flex-col">
        {items.map((item) => {
          const isActive = item.key === active;
          return (
            <li key={item.key}>
              <button
                type="button"
                aria-current={isActive ? "location" : undefined}
                onClick={() => scrollToSection(item.key)}
                className={cn(
                  "flex w-full items-baseline border-l py-1.5 pl-3 text-left text-sm transition-colors",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                )}
              >
                <NavLabel item={item} />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * On narrower screens, where there is no room for a side column: a slim bar
 * pinned to the top of the entry once the glance block (or the header, when
 * there is none) has scrolled away, so any section stays one click away in a
 * long entry.
 *
 * It overlays the content instead of taking space: appearing or leaving
 * would otherwise shift everything under it by its own height. `revealAfter`
 * marks the point that has to leave the viewport first.
 */
export function EntrySectionNav({
  items,
  revealAfter,
}: {
  items: SectionNavItem[];
  revealAfter: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  const barRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const active = useActiveSection(items, barRef, NAV_HEIGHT + 8);

  useEffect(() => {
    const target = revealAfter.current;
    const container = scrollContainerOf(barRef.current);
    if (!target || !container) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) =>
        setRevealed(
          !entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0)
        ),
      { root: container }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [revealAfter]);

  // Keep the active link in view when the bar scrolls sideways on a phone.
  const activeRef = useCallback((node: HTMLButtonElement | null) => {
    node?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, []);

  return (
    <div ref={barRef} className="sticky top-0 z-20 h-0 lg:hidden">
      <nav
        aria-label={t("main.entry.sections")}
        aria-hidden={!revealed}
        inert={!revealed}
        className={cn(
          "absolute inset-x-0 top-0 -mx-4 border-b border-border bg-background px-4 transition-[opacity,transform] duration-200 md:-mx-6 md:px-6",
          revealed
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0"
        )}
      >
        <ul className="flex h-12 items-stretch gap-5 overflow-x-auto [scrollbar-width:none]">
          {items.map((item) => {
            const isActive = item.key === active;
            return (
              <li key={item.key} className="flex shrink-0">
                <button
                  type="button"
                  ref={isActive ? activeRef : undefined}
                  aria-current={isActive ? "location" : undefined}
                  onClick={() => scrollToSection(item.key)}
                  className={cn(
                    "relative flex items-center whitespace-nowrap text-sm transition-colors",
                    isActive
                      ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <NavLabel item={item} />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
