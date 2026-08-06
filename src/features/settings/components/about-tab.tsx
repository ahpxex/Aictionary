import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Section } from "@/shared/components/section";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { getName, getVersion } from "@tauri-apps/api/app";

export function AboutTab() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [appVersion, setAppVersion] = useState(settings.about.version);
  const [appName, setAppName] = useState("AIctionary");

  useEffect(() => {
    getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion(settings.about.version));
    getName()
      .then(setAppName)
      .catch(() => setAppName("AIctionary"));
  }, [settings.about.version]);

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
                <TableCell>{appVersion}</TableCell>
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

