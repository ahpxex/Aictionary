import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A flat settings section in the app's rail-and-spine language: uppercase
 * eyebrow title, optional description, content below. Sections stack with
 * hairline separators instead of card boxes.
 */
export function SettingsSection({
  title,
  description,
  children,
  contentClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <section className="border-t border-border py-6 first:border-t-0 first:pt-0">
      <div className="mb-5 flex flex-col gap-1">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em]">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className={cn("flex flex-col gap-4", contentClassName)}>{children}</div>
    </section>
  );
}
