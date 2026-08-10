import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { check as checkForUpdate } from "@tauri-apps/plugin-updater";
import { Loader2 } from "lucide-react";
import { installUpdate } from "@/app/update-check-sync";
import { isMobileHost } from "@/shared/lib/platform";
import { Button } from "@/components/ui/button";
import { Section } from "@/shared/components/section";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { useUpdateCheck } from "@/shared/hooks/use-update-check";
import { getName, getVersion } from "@tauri-apps/api/app";

export function AboutTab() {
  const { t } = useTranslation();
  const { settings, updateSystem } = useSettings();
  // The bundle is the only source of the version; there is no local copy to
  // fall back to, so this stays empty until Tauri answers.
  const [appVersion, setAppVersion] = useState("");
  const [appName, setAppName] = useState("Aictionary");
  const update = useUpdateCheck();

  useEffect(() => {
    getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion(""));
    getName()
      .then(setAppName)
      .catch(() => setAppName("Aictionary"));
  }, []);

  return (
    <div className="flex flex-col">
      <Section
        title={t("settings.about.info.title")}
        description="Build details for debugging and support references."
      >
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">{t("settings.about.info.table.name")}</TableCell>
                <TableCell>{appName}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">{t("settings.about.info.table.version")}</TableCell>
                <TableCell>{appVersion || "—"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">{t("settings.about.info.table.build")}</TableCell>
                <TableCell>{settings.about.build}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">{t("settings.about.info.table.environment")}</TableCell>
                <TableCell>{import.meta.env.MODE}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Section>

      <Section
        title={t("settings.about.updates.title")}
        description={t("settings.about.updates.description")}
        contentClassName="grid gap-4"
      >
        <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/40 px-4 py-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {t("settings.about.updates.auto_label")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("settings.about.updates.auto_helper")}
            </p>
          </div>
          <Switch
            checked={settings.system.checkUpdatesOnStart}
            onCheckedChange={(checked) =>
              updateSystem({ checkUpdatesOnStart: checked })
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => void update.check()}
            disabled={update.status === "checking"}
          >
            {update.status === "checking" && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {t("settings.about.updates.check_now")}
          </Button>

          {update.status === "current" && (
            <p className="text-muted-foreground text-sm">
              {t("settings.about.updates.up_to_date")}
            </p>
          )}
          {update.status === "error" && (
            <p className="text-destructive text-sm">
              {t("settings.about.updates.failed")}
            </p>
          )}
          {update.status === "available" && update.latest && (
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => {
                const fallbackToReleasePage = () => {
                  void openUrl(update.latest!.htmlUrl).catch((error) => {
                    console.warn("Failed to open the release page:", error);
                  });
                };

                // Desktop installs in place; Android (and any release
                // published before the updater shipped) falls back to the
                // release page for a manual download.
                if (isMobileHost()) {
                  fallbackToReleasePage();
                  return;
                }
                checkForUpdate()
                  .then((available) =>
                    available ? installUpdate(available, t) : fallbackToReleasePage()
                  )
                  .catch(fallbackToReleasePage);
              }}
            >
              {t("settings.about.updates.available", {
                version: update.latest.tag,
              })}
            </Button>
          )}
        </div>
      </Section>

      {/* The dictionary is someone else's work under a share-alike licence,
          so the attribution belongs in the app, not only in the README. */}
      <Section
        title={t("settings.about.data.title")}
        contentClassName="grid gap-3"
      >
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("settings.about.data.body")}
        </p>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">
                {t("settings.about.data.data_license")}
              </TableCell>
              <TableCell>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => {
                    void openUrl(
                      "https://creativecommons.org/licenses/by-sa/4.0/"
                    ).catch((error) => {
                      console.warn("Failed to open the licence:", error);
                    });
                  }}
                >
                  CC BY-SA 4.0
                </Button>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">
                {t("settings.about.data.code_license")}
              </TableCell>
              <TableCell>MIT</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Section>

      <Section
        title={t("settings.about.resources.title")}
        contentClassName="grid gap-3"
      >
          <p className="text-muted-foreground text-sm">
            For support or feature requests, open an issue in the repository or
            contact the maintainer.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a
                href="https://tauri.app"
                target="_blank"
                rel="noreferrer"
              >
                {t("settings.about.resources.tauri")}
              </a>
            </Button>
            <Button asChild variant="outline">
              <a
                href="https://github.com/shadcn/ui"
                target="_blank"
                rel="noreferrer"
              >
                {t("settings.about.resources.shadcn")}
              </a>
            </Button>
            <Button asChild variant="outline">
              <a
                href="https://github.com/ahpxex/open-dictionary"
                target="_blank"
                rel="noreferrer"
              >
                {t("settings.about.resources.open_dictionary")}
              </a>
            </Button>
          </div>
        </Section>
    </div>
  );
}

