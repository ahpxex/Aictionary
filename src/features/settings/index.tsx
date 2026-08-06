import { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { AppearanceTab } from "@/features/settings/components/appearance-tab";
import { AudioTab } from "@/features/settings/components/audio-tab";
import { LlmProvidersTab } from "@/features/settings/components/llm-tab";
import { DictionaryTab } from "@/features/settings/components/dictionary-tab";
import { KeyboardTab } from "@/features/settings/components/keyboard-tab";
import { AboutTab } from "@/features/settings/components/about-tab";
import { AnkiTab } from "@/features/settings/components/anki-tab";

const tabs = [
  { value: "appearance", labelKey: "settings.tabs.appearance" },
  { value: "llm", labelKey: "settings.tabs.llm" },
  { value: "audio", labelKey: "settings.tabs.audio" },
  { value: "anki", labelKey: "settings.tabs.anki" },
  { value: "dictionary", labelKey: "settings.tabs.dictionary" },
  { value: "keyboard", labelKey: "settings.tabs.keyboard" },
  { value: "about", labelKey: "settings.tabs.about" },
] as const;

type SettingsTabValue = (typeof tabs)[number]["value"];

const TAB_COMPONENTS: Record<SettingsTabValue, ComponentType> = {
  appearance: AppearanceTab,
  llm: LlmProvidersTab,
  audio: AudioTab,
  anki: AnkiTab,
  dictionary: DictionaryTab,
  keyboard: KeyboardTab,
  about: AboutTab,
};

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

  const handleTabChange = (value: SettingsTabValue) => {
    const path = value === "appearance" ? "/settings" : `/settings/${value}`;
    navigate(path);
  };

  const ActiveTab = TAB_COMPONENTS[currentTab];

  return (
    <div className="grid flex-1 grid-cols-[10rem_1fr] items-start">
      {/* Section directory: right-aligned labels against the spine, the
          active entry marked by a tick crossing it. */}
      <nav className="sticky top-8 flex flex-col py-1" aria-label={t("nav.settings")}>
        {tabs.map((tab) => {
          const isActive = tab.value === currentTab;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleTabChange(tab.value)}
              className={cn(
                "relative py-2 pr-5 text-right text-sm transition-colors focus-visible:outline-none",
                isActive
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t(tab.labelKey)}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute -right-px top-1/2 h-4 w-0.5 -translate-y-1/2 bg-foreground"
                />
              )}
            </button>
          );
        })}
      </nav>
      <div className="min-h-[60vh] border-l border-border py-1 pl-8">
        <ActiveTab />
      </div>
    </div>
  );
}
