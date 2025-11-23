import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppearanceTab } from "@/features/settings/components/appearance-tab";
import { AudioTab } from "@/features/settings/components/audio-tab";
import { LlmProvidersTab } from "@/features/settings/components/llm-tab";
import { DictionaryTab } from "@/features/settings/components/dictionary-tab";
import { KeyboardTab } from "@/features/settings/components/keyboard-tab";
import { AboutTab } from "@/features/settings/components/about-tab";

const tabs = [
  { value: "appearance", labelKey: "settings.tabs.appearance" },
  { value: "llm", labelKey: "settings.tabs.llm" },
  { value: "audio", labelKey: "settings.tabs.audio" },
  { value: "dictionary", labelKey: "settings.tabs.dictionary" },
  { value: "keyboard", labelKey: "settings.tabs.keyboard" },
  { value: "about", labelKey: "settings.tabs.about" },
] as const;

type SettingsTabValue = (typeof tabs)[number]["value"];

export function SettingsPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const pathSegment = location.pathname.split("/")[2] || "appearance";
  const currentTab: SettingsTabValue = tabs.some(
    (tab) => tab.value === pathSegment
  )
    ? (pathSegment as SettingsTabValue)
    : "appearance";

  const handleTabChange = (value: string) => {
    const tab = value as SettingsTabValue;
    const path = tab === "appearance" ? "/settings" : `/settings/${tab}`;
    navigate(path);
  };

  return (
    <Tabs
      value={currentTab}
      onValueChange={handleTabChange}
      className="flex flex-1 flex-col gap-6"
    >
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {t(tab.labelKey)}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="appearance">
        <AppearanceTab />
      </TabsContent>
      <TabsContent value="llm">
        <LlmProvidersTab />
      </TabsContent>
      <TabsContent value="audio">
        <AudioTab />
      </TabsContent>
      <TabsContent value="dictionary">
        <DictionaryTab />
      </TabsContent>
      <TabsContent value="keyboard">
        <KeyboardTab />
      </TabsContent>
      <TabsContent value="about">
        <AboutTab />
      </TabsContent>
    </Tabs>
  );
}
