import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { useSettings } from "../hooks/use-settings";
import { Section } from "@/shared/components/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ProxyMode } from "@/shared/types/settings";

export function NetworkTab() {
  const { t } = useTranslation();
  const { settings, updateNetwork } = useSettings();
  const network = settings.network;
  const [pem, setPem] = useState(network.customCaPem);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await invoke("validate_custom_ca", { pem });
      updateNetwork({ customCaPem: pem.trim() });
      setPem(pem.trim());
      setStatus(t("settings.network.saved"));
    } catch (error) {
      setStatus(t("settings.network.invalid", { detail: String(error) }));
    } finally { setSaving(false); }
  };
  return (
    <div className="flex flex-col">
      <Section title={t("settings.audio.proxy.title")} description={t("settings.audio.proxy.description")} contentClassName="grid gap-4">
        <Label>{t("settings.audio.proxy.mode.label")}</Label>
        <ToggleGroup type="single" variant="outline" value={network.proxyMode}
          onValueChange={(value) => { if (value) updateNetwork({ proxyMode: value as ProxyMode }); }}>
          {(["auto", "manual", "direct"] as const).map((mode) => (
            <ToggleGroupItem key={mode} value={mode}>{t(`settings.audio.proxy.mode.${mode}`)}</ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">{t(`settings.audio.proxy.mode.${network.proxyMode}_helper`)}</p>
        {network.proxyMode === "manual" && (
          <div className="grid gap-2">
            <Label htmlFor="proxy-url">{t("settings.audio.proxy.url.label")}</Label>
            <Input id="proxy-url" value={network.proxyUrl} placeholder={t("settings.audio.proxy.url.placeholder")}
              onChange={(event) => updateNetwork({ proxyUrl: event.target.value.trim() })} />
          </div>
        )}
      </Section>
      <Section title={t("settings.network.ca_title")} description={t("settings.network.ca_description")} contentClassName="grid gap-3">
        <Label htmlFor="custom-ca">{t("settings.network.ca_label")}</Label>
        <Textarea id="custom-ca" value={pem} onChange={(event) => { setPem(event.target.value); setStatus(null); }}
          rows={7} spellCheck={false} className="font-mono text-xs" disabled={saving} />
        <p className="text-xs text-muted-foreground">{t("settings.network.ca_scope")}</p>
        <div className="flex gap-2">
          <Button onClick={() => void save()} disabled={saving || pem.trim() === network.customCaPem}>{t("settings.network.save")}</Button>
          <Button variant="outline" disabled={saving || (!pem && !network.customCaPem)} onClick={() => {
            setPem(""); updateNetwork({ customCaPem: "" }); setStatus(t("settings.network.removed"));
          }}>{t("settings.network.remove")}</Button>
        </div>
        {status && <p role="status" className="text-sm">{status}</p>}
      </Section>
    </div>
  );
}
