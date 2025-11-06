import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { getName, getVersion } from "@tauri-apps/api/app";

export function AboutTab() {
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
    <div className="grid gap-6 md:grid-cols-[1fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Application info</CardTitle>
          <CardDescription>
            Build details for debugging and support references.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Name</TableCell>
                <TableCell>{appName}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Version</TableCell>
                <TableCell>{appVersion}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Build</TableCell>
                <TableCell>{settings.about.build}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Environment</TableCell>
                <TableCell>{import.meta.env.MODE}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resources</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
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
                Tauri documentation
              </a>
            </Button>
            <Button asChild variant="outline">
              <a
                href="https://github.com/shadcn/ui"
                target="_blank"
                rel="noreferrer"
              >
                shadcn/ui
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

