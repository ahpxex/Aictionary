import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppearanceTab } from "@/features/settings/components/appearance-tab";
import { LlmProvidersTab } from "@/features/settings/components/llm-tab";
import { DictionaryTab } from "@/features/settings/components/dictionary-tab";
import { KeyboardTab } from "@/features/settings/components/keyboard-tab";
import { AboutTab } from "@/features/settings/components/about-tab";
import { Card, CardContent } from "@/components/ui/card";

const tabs = [
  { value: "appearance", label: "Appearance" },
  { value: "llm", label: "LLM Providers" },
  { value: "dictionary", label: "Dictionary" },
  { value: "keyboard", label: "Keyboard" },
  { value: "about", label: "About" },
] as const;

export function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">
          Tailor the dictionary experience to your workflow.
        </p>
      </div>
      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="appearance" className="flex flex-col gap-6">
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
        </CardContent>
      </Card>
    </div>
  );
}

