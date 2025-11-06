import { useState } from "react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/features/settings/hooks/use-settings";

const MODELS = [
  { value: "gpt-4o-mini", label: "OpenAI GPT-4o mini" },
  { value: "gpt-4.1", label: "OpenAI GPT-4.1" },
  { value: "claude-3.7-sonnet", label: "Anthropic Claude 3.7 Sonnet" },
  { value: "deepseek-r1", label: "DeepSeek R1" },
] as const;

export function LlmProvidersTab() {
  const { settings, updateLlm } = useSettings();
  const [isTesting, setIsTesting] = useState(false);

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      await invoke("test_llm_provider", {
        baseUrl: settings.llm.baseUrl,
        apiKey: settings.llm.apiKey,
        model: settings.llm.model,
      });
      toast.success("Provider settings look good!");
    } catch (error) {
      console.warn(error);
      toast.error(
        "Failed to reach the provider. Double-check the base URL and API key."
      );
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Provider connection</CardTitle>
          <CardDescription>
            Configure the base URL and authentication for your LLM endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="llm-base-url">Base URL</Label>
            <Input
              id="llm-base-url"
              placeholder="https://api.example.com"
              value={settings.llm.baseUrl}
              onChange={(event) =>
                updateLlm({ baseUrl: event.target.value.trim() })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="llm-api-key">API key</Label>
            <Input
              id="llm-api-key"
              type="password"
              placeholder="sk-..."
              value={settings.llm.apiKey}
              onChange={(event) => updateLlm({ apiKey: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="llm-model">Model</Label>
            <Select
              value={settings.llm.model}
              onValueChange={(value) => updateLlm({ model: value })}
            >
              <SelectTrigger id="llm-model">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleTestConnection} disabled={isTesting}>
            {isTesting ? "Testing…" : "Test connection"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage tips</CardTitle>
          <CardDescription>
            These settings control how AI is used for semantic explanations and
            comparisons.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground">
          <p>
            • Keep the base URL pointed to a gateway that is accessible from
            your machine.
          </p>
          <p>
            • The API key is stored locally only. Rotate it regularly for
            security.
          </p>
          <p>
            • Pick a model that balances accuracy and latency for your workflow.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

