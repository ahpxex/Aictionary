import { Outlet, NavLink, useNavigate } from "react-router";
import { BookOpenText, LineChart, Settings } from "lucide-react";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { useDictionarySearch } from "@/features/main/hooks/use-dictionary-search";
import { useGlobalShortcuts } from "@/shared/hooks/use-global-shortcuts";

type NavItem = {
  to: string;
  labelKey: string;
  icon: ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", labelKey: "nav.dictionary", icon: <BookOpenText className="size-4" /> },
  { to: "/statistics", labelKey: "nav.statistics", icon: <LineChart className="size-4" /> },
  { to: "/settings", labelKey: "nav.settings", icon: <Settings className="size-4" /> },
];

export function AppLayout() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const { search } = useDictionarySearch();

  // Global keyboard shortcuts are wired here so they work regardless of
  // which main tab (dictionary/statistics/settings) is currently active.
  useGlobalShortcuts({
    quickQuery: settings.keyboard.quickQuery,
    newQuery: settings.keyboard.newQuery,
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

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="border-b">
        <nav className="mx-auto flex h-14 w-full max-w-6xl items-center justify-center gap-1 px-4 text-sm font-medium">
          {NAV_ITEMS.map(({ to, labelKey, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "hover:bg-muted/60 focus-visible:ring-ring inline-flex items-center gap-2 rounded-md px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  isActive
                    ? "bg-muted text-primary"
                    : "text-muted-foreground"
                )
              }
            >
              {icon}
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
