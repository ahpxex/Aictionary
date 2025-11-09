import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppearanceTab } from "@/features/settings/components/appearance-tab";
import { LlmProvidersTab } from "@/features/settings/components/llm-tab";
import { DictionaryTab } from "@/features/settings/components/dictionary-tab";
import { KeyboardTab } from "@/features/settings/components/keyboard-tab";
import { AboutTab } from "@/features/settings/components/about-tab";

const tabs = [
  { value: "appearance", labelKey: "settings.tabs.appearance" },
  { value: "llm", labelKey: "settings.tabs.llm" },
  { value: "dictionary", labelKey: "settings.tabs.dictionary" },
  { value: "keyboard", labelKey: "settings.tabs.keyboard" },
  { value: "about", labelKey: "settings.tabs.about" },
] as const;

export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <Tabs defaultValue="appearance" className="flex flex-1 flex-col gap-6">
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
