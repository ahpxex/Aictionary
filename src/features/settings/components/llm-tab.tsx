import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  fetchAvailableModels,
  LlmModelSummary,
  LlmServiceError,
  testLlmConnection,
} from "@/shared/services/llm-service";

export function LlmProvidersTab() {
  const { t } = useTranslation();
  const { settings, updateLlm } = useSettings();
  const [isTesting, setIsTesting] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [models, setModels] = useState<LlmModelSummary[]>([]);
  const [hasLoadedModels, setHasLoadedModels] = useState(false);

  const credentialFingerprint = useMemo(
    () => `${settings.llm.baseUrl}::${settings.llm.apiKey}`,
    [settings.llm.baseUrl, settings.llm.apiKey]
  );

  useEffect(() => {
    setModels([]);
    setHasLoadedModels(false);
  }, [credentialFingerprint]);

  const canReachProvider = Boolean(settings.llm.apiKey.trim());

  const handleLoadModels = async () => {
    if (!canReachProvider) {
      toast.error(t("settings.llm.models.missing_credentials"));
      return;
    }

    setIsLoadingModels(true);
    try {
      const list = await fetchAvailableModels(settings.llm);
      setModels(list);
      setHasLoadedModels(true);

      if (
        list.length > 0 &&
        !list.some((model) => model.id === settings.llm.model.trim())
      ) {
        updateLlm({ model: list[0].id });
      }

      toast.success(
        t("settings.llm.toast.models_success", { count: list.length })
      );
    } catch (error) {
      const message =
        error instanceof LlmServiceError
          ? error.message
          : t("settings.llm.toast.models_error");
      toast.error(message);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleTestConnection = async () => {
    if (!canReachProvider) {
      toast.error(t("settings.llm.models.missing_credentials"));
      return;
    }

    setIsTesting(true);
    try {
      await testLlmConnection(settings.llm);
      toast.success(t("settings.llm.toast.success"));
    } catch (error) {
      console.warn(error);
      const message =
        error instanceof LlmServiceError
          ? error.message
          : t("settings.llm.toast.error");
      toast.error(message);
    } finally {
      setIsTesting(false);
    }
  };

  const renderModelItems = () => {
    const items = models.map((model) => (
      <SelectItem key={model.id} value={model.id}>
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{model.id}</span>
          <span className="text-xs text-muted-foreground">{model.ownedBy}</span>
        </div>
      </SelectItem>
    ));

    if (
      settings.llm.model &&
      !models.some((model) => model.id === settings.llm.model)
    ) {
      items.push(
        <SelectItem key="custom-model" value={settings.llm.model}>
          {t("settings.llm.model.custom", { model: settings.llm.model })}
        </SelectItem>
      );
    }

    return items;
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.llm.title")}</CardTitle>
          <CardDescription>{t("settings.llm.description")}</CardDescription>
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
              disabled={models.length === 0 && !settings.llm.model}
            >
              <SelectTrigger id="llm-model">
                <SelectValue
                  placeholder={t("settings.llm.model.placeholder")}
                />
              </SelectTrigger>
              <SelectContent>{renderModelItems()}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("settings.llm.models.helper")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleLoadModels}
                disabled={!canReachProvider || isLoadingModels}
              >
                {isLoadingModels
                  ? t("settings.llm.models.loading")
                  : t("settings.llm.models.load")}
              </Button>
              <Button
                onClick={handleTestConnection}
                disabled={!canReachProvider || isTesting}
              >
                {isTesting
                  ? t("settings.llm.testing")
                  : t("settings.llm.test_connection")}
              </Button>
            </div>
            {hasLoadedModels && models.length === 0 && (
              <p className="text-xs text-destructive">
                {t("settings.llm.models.empty")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
