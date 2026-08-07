import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/** Below this the indicator stops shrinking, or long content loses its mark. */
const MIN_THUMB_HEIGHT = 24;

type ThumbGeometry = {
  height: number;
  offset: number;
};

type ScrollRegionProps = {
  className?: string;
  children: ReactNode;
};

/**
 * A scroll container with a hairline scroll indicator.
 *
 * The platform bar cannot be made to fit this design: WebKit ignores the
 * ::-webkit-scrollbar pseudo-elements here, and the standard scrollbar-width /
 * scrollbar-color properties stop at "thin" with rounded caps that fatten under
 * the pointer. So the native bar is hidden and the mark is drawn instead - two
 * square pixels riding the container's edge, the same width at rest and under
 * the cursor. At that size it reads as a rule rather than a control, so it
 * takes no pointer events and scrolling stays entirely native.
 */
export function ScrollRegion({ className, children }: ScrollRegionProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<ThumbGeometry | null>(null);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const { scrollHeight, clientHeight, scrollTop } = viewport;
    const scrollable = scrollHeight - clientHeight;
    if (scrollable <= 0) {
      setThumb(null);
      return;
    }

    const height = Math.max(
      (clientHeight / scrollHeight) * clientHeight,
      MIN_THUMB_HEIGHT
    );
    setThumb({
      height,
      offset: (scrollTop / scrollable) * (clientHeight - height),
    });
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const resize = new ResizeObserver(measure);
    resize.observe(viewport);

    // Re-attach to whatever the viewport currently holds: switching panels
    // swaps the child out, and a panel can grow on its own once data arrives.
    const observeContent = () => {
      for (const child of Array.from(viewport.children)) resize.observe(child);
      measure();
    };
    observeContent();

    const mutation = new MutationObserver(observeContent);
    mutation.observe(viewport, { childList: true });

    return () => {
      resize.disconnect();
      mutation.disconnect();
    };
  }, [measure]);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={viewportRef}
        onScroll={measure}
        className="scroll-region h-full overflow-y-auto"
      >
        {children}
      </div>
      {thumb && (
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 w-0.5 bg-foreground/25"
          style={{
            height: `${thumb.height}px`,
            transform: `translateY(${thumb.offset}px)`,
          }}
        />
      )}
    </div>
  );
}
