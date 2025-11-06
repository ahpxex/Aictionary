import { lazy, Suspense, type ReactNode } from "react";
import {
  Route,
  RouterProvider,
  createHashRouter,
  createRoutesFromElements,
} from "react-router";
import { Loader2 } from "lucide-react";
import { AppLayout } from "./layout";
import { Button } from "@/components/ui/button";

const MainPage = lazy(() =>
  import("@/features/main").then((module) => ({ default: module.MainPage }))
);
const SettingsPage = lazy(() =>
  import("@/features/settings").then((module) => ({
    default: module.SettingsPage,
  }))
);
const StatisticsPage = lazy(() =>
  import("@/features/statistics").then((module) => ({
    default: module.StatisticsPage,
  }))
);

function SuspenseBoundary({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Loading…
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function NotFoundRoute() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div>
        <p className="text-2xl font-semibold">Page not found</p>
        <p className="text-muted-foreground">
          We could not find the page you were looking for.
        </p>
      </div>
      <Button variant="default" asChild>
        <a href="#/">Go back home</a>
      </Button>
    </div>
  );
}

const router = createHashRouter(
  createRoutesFromElements(
    <Route path="/" element={<AppLayout />}>
      <Route
        index
        element={
          <SuspenseBoundary>
            <MainPage />
          </SuspenseBoundary>
        }
      />
      <Route
        path="settings/*"
        element={
          <SuspenseBoundary>
            <SettingsPage />
          </SuspenseBoundary>
        }
      />
      <Route
        path="statistics"
        element={
          <SuspenseBoundary>
            <StatisticsPage />
          </SuspenseBoundary>
        }
      />
      <Route path="*" element={<NotFoundRoute />} />
    </Route>
  )
);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
