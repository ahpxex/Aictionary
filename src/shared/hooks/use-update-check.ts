import { useCallback, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import {
  getLatestAppRelease,
  type AppReleaseInfo,
} from "@/shared/services/github-service";
import { isNewerVersion } from "@/shared/lib/version";

export type UpdateCheckStatus = "idle" | "checking" | "current" | "available" | "error";

export type UpdateCheckResult = {
  status: UpdateCheckStatus;
  /** The installed version, resolved from the bundle. */
  currentVersion: string | null;
  /** Populated whenever the lookup succeeded, newer or not. */
  latest: AppReleaseInfo | null;
  error: string | null;
};

const INITIAL: UpdateCheckResult = {
  status: "idle",
  currentVersion: null,
  latest: null,
  error: null,
};

/**
 * Ask GitHub whether a newer release exists. Detection only - the user is
 * pointed at the release page rather than having anything installed for them,
 * so no update signing infrastructure is involved.
 */
export function useUpdateCheck() {
  const [result, setResult] = useState<UpdateCheckResult>(INITIAL);

  const check = useCallback(async (): Promise<UpdateCheckResult> => {
    setResult((previous) => ({ ...previous, status: "checking", error: null }));

    try {
      const [currentVersion, latest] = await Promise.all([
        getVersion(),
        getLatestAppRelease(),
      ]);

      const next: UpdateCheckResult = {
        status: isNewerVersion(latest.tag, currentVersion)
          ? "available"
          : "current",
        currentVersion,
        latest,
        error: null,
      };
      setResult(next);
      return next;
    } catch (error) {
      console.warn("Failed to check for updates:", error);
      const next: UpdateCheckResult = {
        status: "error",
        currentVersion: null,
        latest: null,
        error: error instanceof Error ? error.message : String(error),
      };
      setResult(next);
      return next;
    }
  }, []);

  return { ...result, check };
}
