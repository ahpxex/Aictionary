import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { check as checkForUpdate, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { useUpdateCheck } from "@/shared/hooks/use-update-check";
import { isMobileHost } from "@/shared/lib/platform";

/**
 * Download the update with a progress toast, install it, and restart.
 * Exported for the About tab so the manual check offers the same flow.
 */
export async function installUpdate(
  update: Update,
  t: (key: string, options?: Record<string, unknown>) => string
): Promise<void> {
  const toastId = toast.loading(t("settings.about.updates.downloading"), {
    duration: Infinity,
  });

  try {
    let total = 0;
    let received = 0;
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          total = event.data.contentLength ?? 0;
          break;
        case "Progress": {
          received += event.data.chunkLength;
          if (total > 0) {
            toast.loading(
              t("settings.about.updates.downloading_progress", {
                percent: Math.min(100, Math.round((received / total) * 100)),
              }),
              { id: toastId, duration: Infinity }
            );
          }
          break;
        }
        case "Finished":
          toast.loading(t("settings.about.updates.installing"), {
            id: toastId,
            duration: Infinity,
          });
          break;
      }
    });

    toast.success(t("settings.about.updates.restarting"), { id: toastId });
    // On Windows the installer has already taken over and exited the app by
    // now; everywhere else this swaps in the new version.
    await relaunch();
  } catch (error) {
    console.error("Update installation failed:", error);
    toast.error(t("settings.about.updates.install_error"), { id: toastId });
  }
}

/**
 * Looks for a newer release once per launch, when the user has left the
 * check enabled. Staying quiet unless something is actually available: an
 * "up to date" toast on every start would be noise.
 *
 * Desktop goes through the updater plugin — signed artifact, in-app install,
 * relaunch. Android has no in-app install, so it keeps pointing at the
 * release page for a manual APK download.
 */
export function UpdateCheckSync() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { check } = useUpdateCheck();
  const hasChecked = useRef(false);

  const enabled = settings.system.checkUpdatesOnStart;

  useEffect(() => {
    // Settings load from storage asynchronously, so this effect can run again
    // once they arrive; the ref keeps it to a single request per launch.
    if (!enabled || hasChecked.current) {
      return;
    }
    hasChecked.current = true;

    let cancelled = false;

    if (isMobileHost()) {
      void check().then((result) => {
        if (cancelled || result.status !== "available" || !result.latest) {
          return;
        }

        const release = result.latest;
        toast.info(t("settings.about.updates.available", { version: release.tag }), {
          duration: 10_000,
          action: {
            label: t("settings.about.updates.view"),
            onClick: () => {
              void openUrl(release.htmlUrl).catch((error) => {
                console.warn("Failed to open the release page:", error);
              });
            },
          },
        });
      });
    } else {
      checkForUpdate()
        .then((update) => {
          if (cancelled || !update) {
            return;
          }

          toast.info(
            t("settings.about.updates.available", { version: `v${update.version}` }),
            {
              duration: 15_000,
              action: {
                label: t("settings.about.updates.install"),
                onClick: () => void installUpdate(update, t),
              },
            }
          );
        })
        .catch((error) => {
          // A dead network or a release without updater artifacts (anything
          // before the updater shipped) is not worth a toast on startup.
          console.warn("Update check failed:", error);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [check, enabled, t]);

  return null;
}
