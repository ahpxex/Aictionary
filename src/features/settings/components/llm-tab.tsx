import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Section } from "@/shared/components/section";
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
  CUSTOM_PROVIDER_ID,
  LLM_PROVIDER_PRESETS,
  presetIdForBaseUrl,
} from "@/shared/lib/llm-providers";
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

  const canReachProvider = Boolean(settings.llm.apiKey.trim());

  // Picking a provider should just show its models. The fingerprint covers
  // both halves of the credentials, and the delay keeps a key being typed
  // character by character from firing a request per keystroke.
  useEffect(() => {
    setModels([]);
    setHasLoadedModels(false);

    if (!settings.llm.apiKey.trim()) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void loadModels({ silent: true, isCancelled: () => cancelled });
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // loadModels reads the same credentials this effect keys on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentialFingerprint]);
  // Derived rather than stored: the base URL stays the single source of
  // truth, so a hand-typed URL that matches a preset still selects it.
  const presetId = presetIdForBaseUrl(settings.llm.baseUrl);
  const selectedProviderLabel =
    LLM_PROVIDER_PRESETS.find((preset) => preset.id === presetId)?.label ??
    t("settings.llm.provider.custom");

  const handlePresetChange = (value: string) => {
    if (value === CUSTOM_PROVIDER_ID) {
      updateLlm({ baseUrl: "" });
      return;
    }
    const preset = LLM_PROVIDER_PRESETS.find((item) => item.id === value);
    if (preset) {
      // The model list belongs to the old provider; drop it so the picker
      // cannot offer a model the new endpoint has never heard of.
      updateLlm({ baseUrl: preset.baseUrl, model: "" });
    }
  };

  const loadModels = async (options?: {
    /** The automatic refresh reports failures quietly; the button does not. */
    silent?: boolean;
    isCancelled?: () => boolean;
  }) => {
    const cancelled = () => options?.isCancelled?.() ?? false;

    setIsLoadingModels(true);
    try {
      const list = await fetchAvailableModels(settings.llm);
      if (cancelled()) {
        return;
      }
      setModels(list);
      setHasLoadedModels(true);

      if (
        list.length > 0 &&
        !list.some((model) => model.id === settings.llm.model.trim())
      ) {
        updateLlm({ model: list[0].id });
      }

      if (!options?.silent) {
        toast.success(
          t("settings.llm.toast.models_success", { count: list.length })
        );
      }
    } catch (error) {
      if (cancelled()) {
        return;
      }
      if (options?.silent) {
        console.warn("Failed to refresh models:", error);
        return;
      }
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
    <div className="flex flex-col">
      <Section
        title={t("settings.llm.title")}
        description={t("settings.llm.description")}
        contentClassName="grid gap-4"
      >
          <div className="grid gap-2">
            <Label htmlFor="llm-provider">{t("settings.llm.provider.label")}</Label>
            <Select value={presetId} onValueChange={handlePresetChange}>
              <SelectTrigger id="llm-provider" className="w-full">
                <SelectValue>{selectedProviderLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {LLM_PROVIDER_PRESETS.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{preset.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {preset.baseUrl}
                      </span>
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_PROVIDER_ID}>
                  {t("settings.llm.provider.custom")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {presetId === CUSTOM_PROVIDER_ID && (
            <div className="grid gap-2">
              <Label htmlFor="llm-base-url">
                {t("settings.llm.base_url.label")}
              </Label>
              <Input
                id="llm-base-url"
                placeholder={t("settings.llm.base_url.placeholder")}
                value={settings.llm.baseUrl}
                onChange={(event) =>
                  updateLlm({ baseUrl: event.target.value.trim() })
                }
              />
            </div>
          )}
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
              <SelectTrigger id="llm-model" className="w-full">
                <SelectValue placeholder={t("settings.llm.model.placeholder")}>
                  {settings.llm.model}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>{renderModelItems()}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("settings.llm.models.helper")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => void loadModels()}
                disabled={!canReachProvider || isLoadingModels}
              >
                {isLoadingModels
                  ? t("settings.llm.models.loading")
                  : t("settings.llm.models.refresh")}
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
        </Section>
    </div>
  );
}
