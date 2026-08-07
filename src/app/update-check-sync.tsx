import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { useUpdateCheck } from "@/shared/hooks/use-update-check";

/**
 * Looks for a newer release once per launch, when the user has left the
 * check enabled. Staying quiet unless something is actually available: an
 * "up to date" toast on every start would be noise.
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

    return () => {
      cancelled = true;
    };
  }, [check, enabled, t]);

  return null;
}
