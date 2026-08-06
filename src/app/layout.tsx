import { Outlet, NavLink, useNavigate } from "react-router";
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { useDictionarySearch } from "@/features/main/hooks/use-dictionary-search";
import { SearchForm } from "@/features/main/components/search-form";
import { useGlobalShortcuts } from "@/shared/hooks/use-global-shortcuts";

type NavItem = {
  to: string;
  labelKey: string;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", labelKey: "nav.dictionary" },
  { to: "/statistics", labelKey: "nav.statistics" },
  { to: "/settings", labelKey: "nav.settings" },
];

export function AppLayout() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const { search, isSearching, result } = useDictionarySearch();

  // Searching from any tab jumps back to the dictionary view.
  const handleSearch = (word: string) => {
    navigate("/");
    search(word);
  };

  // Global keyboard shortcuts are wired here so they work regardless of
  // which main tab (dictionary/statistics/settings) is currently active.
  useGlobalShortcuts({
    quickQuery: settings.keyboard.quickQuery,
    newQuery: settings.keyboard.newQuery,
    enabled: settings.keyboard.enabled,
    onQuickQuery: (text) => {
      // Ensure we're on the dictionary tab, then run the search.
      navigate("/");
      search(text);
    },
    onNewQuery: () => {
      // Switch to the dictionary tab first, then ask the main page
      // to focus the search input via a window-level custom event.
      navigate("/");
      window.dispatchEvent(new CustomEvent("focus-search-input"));
    },
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

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="flex h-12 w-full items-center gap-6 px-6">
          <div className="w-full max-w-sm">
            <SearchForm
              onSearch={handleSearch}
              isSearching={isSearching}
              initialValue={result?.entry.headword}
            />
          </div>
          <div className="flex-1" />
          <div className="flex shrink-0 items-center gap-6">
            {NAV_ITEMS.map(({ to, labelKey }) => (
              <NavLink
                key={to}
                to={to}
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
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
