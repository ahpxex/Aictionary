import { useState } from "react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
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
  { value: "gpt-4o-mini", labelKey: "settings.llm.models.gpt-4o-mini" },
  { value: "gpt-4.1", labelKey: "settings.llm.models.gpt-4.1" },
  { value: "claude-3.7-sonnet", labelKey: "settings.llm.models.claude-3.7-sonnet" },
  { value: "deepseek-r1", labelKey: "settings.llm.models.deepseek-r1" },
] as const;

export function LlmProvidersTab() {
  const { t } = useTranslation();
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
      toast.success(t("settings.llm.toast.success"));
    } catch (error) {
      console.warn(error);
      toast.error(t("settings.llm.toast.error"));
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.llm.title")}</CardTitle>
          <CardDescription>
            {t("settings.llm.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="llm-base-url">{t("settings.llm.base_url.label")}</Label>
            <Input
              id="llm-base-url"
              placeholder={t("settings.llm.base_url.placeholder")}
              value={settings.llm.baseUrl}
              onChange={(event) =>
                updateLlm({ baseUrl: event.target.value.trim() })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="llm-api-key">{t("settings.llm.api_key.label")}</Label>
            <Input
              id="llm-api-key"
              type="password"
              placeholder={t("settings.llm.api_key.placeholder")}
              value={settings.llm.apiKey}
              onChange={(event) => updateLlm({ apiKey: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="llm-model">{t("settings.llm.model.label")}</Label>
            <Select
              value={settings.llm.model}
              onValueChange={(value) => updateLlm({ model: value })}
            >
              <SelectTrigger id="llm-model">
                <SelectValue placeholder={t("settings.llm.model.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {t(model.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleTestConnection} disabled={isTesting}>
            {isTesting ? t("settings.llm.testing") : t("settings.llm.test_connection")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

