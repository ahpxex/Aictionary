import { Outlet, NavLink, useNavigate } from "react-router";
import { useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { BarChart3, BookOpen, Settings2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSafeArea } from "@/shared/hooks/use-safe-area";
import { formatShortcut, isMacPlatform } from "@/shared/lib/shortcuts";
import type {
  QuickQueryPayload,
  ShortcutSetupReport,
} from "@/shared/hooks/use-global-shortcuts";
import { cn } from "@/lib/utils";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { useDictionarySearch } from "@/features/main/hooks/use-dictionary-search";
import { SearchForm } from "@/features/main/components/search-form";
import { useGlobalShortcuts } from "@/shared/hooks/use-global-shortcuts";

type NavItem = {
  to: string;
  labelKey: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", labelKey: "nav.dictionary", icon: BookOpen },
  { to: "/statistics", labelKey: "nav.statistics", icon: BarChart3 },
  { to: "/settings", labelKey: "nav.settings", icon: Settings2 },
];

export function AppLayout() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const { search, result, reverseLookup } = useDictionarySearch();

  // Searching from any tab jumps back to the dictionary view.
  const handleSearch = (word: string) => {
    navigate("/");
    search(word);
  };

  const focusQueryBar = useCallback(() => {
    // Switch to the dictionary tab first, then ask the query bar in the
    // header to take the caret via a window-level custom event.
    navigate("/");
    window.dispatchEvent(new CustomEvent("focus-search-input"));
  }, [navigate]);

  // The window is raised even when nothing could be copied, so the shortcut
  // always does something visible; this explains why no lookup ran.
  const handleQuickQuery = useCallback(
    (payload: QuickQueryPayload) => {
      if (payload.text) {
        navigate("/");
        search(payload.text);
        return;
      }

      focusQueryBar();

      if (payload.copyError === "permission_denied") {
        toast.error(t("settings.keyboard.toast.copy_permission"), {
          action: isMacPlatform()
            ? {
                label: t("settings.keyboard.toast.open_settings"),
                onClick: () => {
                  void invoke("open_shortcut_permission_settings").catch(
                    (error) => {
                      console.warn(
                        "Failed to open permission settings:",
                        error
                      );
                    }
                  );
                },
              }
            : undefined,
        });
      } else if (payload.copyError === "unavailable") {
        toast.error(t("settings.keyboard.toast.copy_unavailable"));
      } else {
        toast.info(t("settings.keyboard.toast.copy_empty"));
      }
    },
    [focusQueryBar, navigate, search, t]
  );

  // A shortcut the OS refused to register would otherwise look bound in
  // settings while doing nothing at all.
  const handleSetupReport = useCallback(
    (report: ShortcutSetupReport) => {
      if (report.quickQueryError) {
        toast.error(
          t("settings.keyboard.toast.register_failed", {
            shortcut: formatShortcut(settings.keyboard.quickQuery).join(" "),
          })
        );
      }
      if (report.newQueryError) {
        toast.error(
          t("settings.keyboard.toast.register_failed", {
            shortcut: formatShortcut(settings.keyboard.newQuery).join(" "),
          })
        );
      }
    },
    [settings.keyboard.newQuery, settings.keyboard.quickQuery, t]
  );

  // Global keyboard shortcuts are wired here so they work regardless of
  // which main tab (dictionary/statistics/settings) is currently active.
  useGlobalShortcuts({
    quickQuery: settings.keyboard.quickQuery,
    newQuery: settings.keyboard.newQuery,
    enabled: settings.keyboard.enabled,
    onQuickQuery: handleQuickQuery,
    onNewQuery: focusQueryBar,
    onSetupReport: handleSetupReport,
  });

  // React to tray menu "About" clicks by navigating to Settings → About.
  useEffect(() => {
    const unlistenPromise = listen("open-settings-about", () => {
      navigate("/settings/about");
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [navigate]);

  // Republish the Android system-bar insets as CSS variables before anything
  // measures itself against them.
  useSafeArea();

  // The shell is pinned to the viewport and never scrolls itself; each page
  // owns its own scroll region (and the gutter around it), so a page can
  // decide which part of it moves under the fixed header.
  //
  // Two shapes share this markup. On a pointer-sized window the query bar and
  // the section links ride one 48px row. On a phone that row cannot hold both
  // - three tracked uppercase labels alone overrun a 411px viewport - so the
  // query bar takes the full width and navigation drops to a thumb-reachable
  // bar at the bottom. Header and bottom bar carry the vertical system-bar
  // insets themselves, which lets their background run under the bars while
  // their content stays clear of them.
  return (
    <div className="bg-background text-foreground flex h-screen flex-col overflow-hidden pl-[var(--safe-area-left)] pr-[var(--safe-area-right)]">
      <header className="z-40 shrink-0 border-b bg-background pt-[var(--safe-area-top)]">
        <div className="flex h-12 w-full items-center gap-6 px-4 md:px-6">
          <div className="min-w-0 flex-1 md:w-full md:max-w-sm md:flex-none">
            <SearchForm
              onSearch={handleSearch}
              // While a reverse lookup is alive the query bar keeps the
              // Chinese text that produced it: clicking through a candidate
              // answers the question, it doesn't replace it.
              initialValue={reverseLookup?.term ?? result?.entry.headword}
            />
          </div>
          <div className="hidden flex-1 md:block" />
          <div className="hidden shrink-0 items-center gap-6 md:flex">
            {NAV_ITEMS.map(({ to, labelKey }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "focus-visible:ring-ring relative inline-flex h-12 items-center text-xs font-medium uppercase tracking-[0.15em] transition-colors focus-visible:outline-none focus-visible:ring-2",
                    isActive
                      ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                {t(labelKey)}
              </NavLink>
            ))}
          </div>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
      <nav
        aria-label={t("nav.dictionary")}
        className="z-40 shrink-0 border-t bg-background pb-[var(--safe-area-bottom)] md:hidden"
      >
        <div className="grid grid-cols-3">
          {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  // 56px clears the 44px minimum touch target with room for
                  // the label underneath.
                  "flex h-14 flex-col items-center justify-center gap-1 transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground active:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className="size-5"
                    strokeWidth={isActive ? 2.25 : 1.75}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "text-[0.625rem] uppercase tracking-[0.12em]",
                      isActive && "font-semibold"
                    )}
                  >
                    {t(labelKey)}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
