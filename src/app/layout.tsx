import { Outlet, NavLink } from "react-router";
import { BookOpenText, LineChart, Settings } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/shared/components/theme-toggle";

type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dictionary", icon: <BookOpenText className="size-4" /> },
  { to: "/statistics", label: "Statistics", icon: <LineChart className="size-4" /> },
  { to: "/settings", label: "Settings", icon: <Settings className="size-4" /> },
];

export function AppLayout() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <NavLink to="/" className="flex items-center gap-2 font-semibold">
            <BookOpenText className="size-5" />
            <span>AIctionary</span>
          </NavLink>
          <nav className="flex items-center gap-1 text-sm font-medium">
            {NAV_ITEMS.map(({ to, label, icon }) => (
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
                {label}
              </NavLink>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

