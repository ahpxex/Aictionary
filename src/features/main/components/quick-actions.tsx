import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Settings, LineChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function QuickActions() {
  const { t } = useTranslation();

  const CARDS = [
    {
      title: t("main.quick_actions.statistics.title"),
      description: t("main.quick_actions.statistics.description"),
      to: "/statistics",
      icon: <LineChart className="size-4" />,
      variant: "default" as const,
    },
    {
      title: t("main.quick_actions.settings.title"),
      description: t("main.quick_actions.settings.description"),
      to: "/settings",
      icon: <Settings className="size-4" />,
      variant: "outline" as const,
    },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {CARDS.map((card) => (
        <Card key={card.to} className="h-full">
          <CardHeader className="gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              {card.icon}
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-muted-foreground text-sm">{card.description}</p>
            <Button asChild variant={card.variant}>
              <Link to={card.to}>{t("main.quick_actions.button")}</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
