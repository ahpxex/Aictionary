import { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { ScrollRegion } from "@/shared/components/scroll-region";
import { AppearanceTab } from "@/features/settings/components/appearance-tab";
import { AudioTab } from "@/features/settings/components/audio-tab";
import { DictionaryTab } from "@/features/settings/components/dictionary-tab";
import { KeyboardTab } from "@/features/settings/components/keyboard-tab";
import { AboutTab } from "@/features/settings/components/about-tab";
import { AnkiTab } from "@/features/settings/components/anki-tab";

const tabs = [
  { value: "appearance", labelKey: "settings.tabs.appearance" },
  { value: "audio", labelKey: "settings.tabs.audio" },
  { value: "anki", labelKey: "settings.tabs.anki" },
  { value: "dictionary", labelKey: "settings.tabs.dictionary" },
  { value: "keyboard", labelKey: "settings.tabs.keyboard" },
  { value: "about", labelKey: "settings.tabs.about" },
] as const;

type SettingsTabValue = (typeof tabs)[number]["value"];

const TAB_COMPONENTS: Record<SettingsTabValue, ComponentType> = {
  appearance: AppearanceTab,
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

  // The directory and the spine stay put for the full height of the window;
  // only the panel to the right of the spine scrolls. That panel runs all the
  // way to the window edge so its scrollbar rides the edge like every other
  // page's, with the panel's own gutter carried by the content inside it.
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[10rem_1fr] grid-rows-[1fr] pl-6">
      {/* Section directory: right-aligned labels against the spine, the
          active entry marked by a tick crossing it. */}
      <nav className="flex flex-col py-8" aria-label={t("nav.settings")}>
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
      <ScrollRegion className="min-h-0 border-l border-border">
        <div className="max-w-4xl py-8 pl-8 pr-6">
          <ActiveTab />
        </div>
      </ScrollRegion>
    </div>
  );
}
