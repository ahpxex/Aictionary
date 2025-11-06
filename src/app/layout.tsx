import { Outlet, NavLink } from "react-router";
import { BookOpenText, LineChart, Settings } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
        <nav className="mx-auto flex h-14 w-full max-w-6xl items-center justify-center gap-1 px-4 text-sm font-medium">
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
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
