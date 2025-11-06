import { Link } from "react-router";
import { Settings, LineChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const CARDS = [
  {
    title: "Open statistics",
    description: "Review learned words and export your study log.",
    to: "/statistics",
    icon: <LineChart className="size-4" />,
    variant: "default" as const,
  },
  {
    title: "Configure settings",
    description: "Adjust appearance, providers, and keyboard shortcuts.",
    to: "/settings",
    icon: <Settings className="size-4" />,
    variant: "outline" as const,
  },
];

export function QuickActions() {
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
              <Link to={card.to}>Go</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
