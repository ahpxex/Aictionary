import {
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
  /** Full label; a part of speech renders as its code plus the Chinese name. */
  label: string;
  /** One or two characters for the narrow thumb index on phones. */
  shortLabel: string;
  pos?: string;
};

/** The scrolling ancestor the entry lives in (see `ScrollRegion`). */
function scrollContainerOf(element: Element | null): HTMLElement | null {
  return element?.closest<HTMLElement>(".scroll-region") ?? null;
}

/**
 * Bring a section to the top of the entry's scroll region.
 *
 * Sections carry a small `scroll-margin-top`, so the heading lands with a
 * little air above it rather than flush against the top edge.
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
 * The short label of a part of speech: the first character of its Chinese
 * name (形, 名, 动 ...), which is what a printed dictionary's thumb index
 * uses, or its first three letters when there is no Chinese name.
 */
export function posShortLabel(pos: string): string {
  return posLabelZh(pos)?.charAt(0) ?? pos.slice(0, 3).toUpperCase();
}

/** Sections land this far below the top (`scroll-mt-6` on their rows). */
const SCROLL_MARGIN = 24;

/**
 * Which section is being read: the last one whose top has passed the top of
 * the scroll region. At the very bottom the last section wins even if it is
 * too short to reach the top, otherwise its entry could never light up.
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

/**
 * The entry and, beside it, the column its table of contents lives in.
 *
 * The column is there at every width, only narrower on small screens: a
 * phone gets a thumb index of single characters, a wider window the full
 * labels. The streaming preview uses the same frame with an empty column, so
 * the text does not move sideways when generation finishes and the contents
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
    <div className="grid grid-cols-[minmax(0,1fr)_2rem] gap-3 md:grid-cols-[minmax(0,1fr)_8rem] md:gap-6 lg:grid-cols-[minmax(0,1fr)_11rem] lg:gap-10">
      <div className="min-w-0">{children}</div>
      <aside>{toc}</aside>
    </div>
  );
}

/**
 * The entry's table of contents, held beside it while it scrolls: one line
 * per section, the section being read marked, like the running contents of
 * a book. On a phone the lines shrink to single characters along the edge.
 */
export function EntryToc({ items }: { items: SectionNavItem[] }) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLElement>(null);
  const active = useActiveSection(items, listRef, SCROLL_MARGIN + 8);

  return (
    <nav
      ref={listRef}
      aria-label={t("main.entry.sections")}
      className="sticky top-4 md:top-8"
    >
      <p className="mb-3 hidden text-[0.65rem] font-medium uppercase tracking-[0.15em] text-muted-foreground md:block">
        {t("main.entry.contents")}
      </p>
      <ul className="flex flex-col">
        {items.map((item) => {
          const isActive = item.key === active;
          return (
            <li key={item.key}>
              <button
                type="button"
                title={item.label}
                aria-label={item.label}
                aria-current={isActive ? "location" : undefined}
                onClick={() => scrollToSection(item.key)}
                className={cn(
                  "flex min-h-9 w-full items-center justify-center border-r-2 text-sm transition-colors md:min-h-0 md:items-baseline md:justify-start md:border-l md:border-r-0 md:py-1.5 md:pl-3 md:text-left",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                )}
              >
                <span aria-hidden className="md:hidden">
                  {item.shortLabel}
                </span>
                <span aria-hidden className="hidden md:inline">
                  <NavLabel item={item} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
