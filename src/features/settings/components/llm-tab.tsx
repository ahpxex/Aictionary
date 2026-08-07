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
} from "@/shared/lib/llm-providers";
import {
  credentialsForProvider,
  resolveActiveLlmProvider,
} from "@/shared/state/settings";
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

  // The selected provider and the credentials filed under it. Switching
  // providers swaps both, so a key is never sent to the wrong endpoint.
  const presetId = settings.llm.providerId;
  const credentials = credentialsForProvider(settings.llm, presetId);
  const activeProvider = resolveActiveLlmProvider(settings.llm);

  const selectedProviderLabel =
    LLM_PROVIDER_PRESETS.find((preset) => preset.id === presetId)?.label ??
    t("settings.llm.provider.custom");

  const credentialFingerprint = useMemo(
    () => `${activeProvider.baseUrl}::${activeProvider.apiKey}`,
    [activeProvider.baseUrl, activeProvider.apiKey]
  );

  const canReachProvider = Boolean(credentials.apiKey.trim());

  const updateCredentials = (changes: Partial<typeof credentials>) => {
    updateLlm((prev) => ({
      ...prev,
      credentials: {
        ...prev.credentials,
        [presetId]: { ...credentialsForProvider(prev, presetId), ...changes },
      },
    }));
  };

  // Picking a provider should just show its models. The delay keeps a key
  // being typed character by character from firing a request per keystroke.
  useEffect(() => {
    setModels([]);
    setHasLoadedModels(false);

    if (!activeProvider.apiKey.trim()) {
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

  const handlePresetChange = (value: string) => {
    // Only the selection moves: each provider keeps its own key and model,
    // so switching back finds them still there.
    updateLlm((prev) => ({ ...prev, providerId: value }));
  };

  const loadModels = async (options?: {
    /** The automatic refresh reports failures quietly; the button does not. */
    silent?: boolean;
    isCancelled?: () => boolean;
  }) => {
    const cancelled = () => options?.isCancelled?.() ?? false;

    setIsLoadingModels(true);
    try {
      const list = await fetchAvailableModels(activeProvider);
      if (cancelled()) {
        return;
      }
      setModels(list);
      setHasLoadedModels(true);

      if (
        list.length > 0 &&
        !list.some((model) => model.id === credentials.model.trim())
      ) {
        updateCredentials({ model: list[0].id });
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
      await testLlmConnection(activeProvider);
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
      credentials.model &&
      !models.some((model) => model.id === credentials.model)
    ) {
      items.push(
        <SelectItem key="custom-model" value={credentials.model}>
          {t("settings.llm.model.custom", { model: credentials.model })}
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
                value={settings.llm.customBaseUrl}
                onChange={(event) =>
                  updateLlm((prev) => ({
                    ...prev,
                    customBaseUrl: event.target.value.trim(),
                  }))
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
              value={credentials.apiKey}
              onChange={(event) => updateCredentials({ apiKey: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="llm-model">{t("settings.llm.model.label")}</Label>
            <Select
              value={credentials.model}
              onValueChange={(value) => updateCredentials({ model: value })}
              disabled={models.length === 0 && !credentials.model}
            >
              <SelectTrigger id="llm-model" className="w-full">
                <SelectValue placeholder={t("settings.llm.model.placeholder")}>
                  {credentials.model}
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
