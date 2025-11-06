import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppearanceTab } from "@/features/settings/components/appearance-tab";
import { LlmProvidersTab } from "@/features/settings/components/llm-tab";
import { DictionaryTab } from "@/features/settings/components/dictionary-tab";
import { KeyboardTab } from "@/features/settings/components/keyboard-tab";
import { AboutTab } from "@/features/settings/components/about-tab";

const tabs = [
  { value: "appearance", label: "Appearance" },
  { value: "llm", label: "LLM Providers" },
  { value: "dictionary", label: "Dictionary" },
  { value: "keyboard", label: "Keyboard" },
  { value: "about", label: "About" },
] as const;

export function SettingsPage() {
  return (
    <Tabs defaultValue="appearance" className="flex flex-1 flex-col gap-6">
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
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
