import { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { isMobileHost } from "@/shared/lib/platform";
import { ScrollRegion } from "@/shared/components/scroll-region";
import { AppearanceTab } from "@/features/settings/components/appearance-tab";
import { AudioTab } from "@/features/settings/components/audio-tab";
import { LlmProvidersTab } from "@/features/settings/components/llm-tab";
import { DictionaryTab } from "@/features/settings/components/dictionary-tab";
import { KeyboardTab } from "@/features/settings/components/keyboard-tab";
import { AboutTab } from "@/features/settings/components/about-tab";
import { AnkiTab } from "@/features/settings/components/anki-tab";

const ALL_TABS = [
  { value: "appearance", labelKey: "settings.tabs.appearance" },
  { value: "llm", labelKey: "settings.tabs.llm" },
  { value: "audio", labelKey: "settings.tabs.audio" },
  { value: "anki", labelKey: "settings.tabs.anki" },
  { value: "dictionary", labelKey: "settings.tabs.dictionary" },
  { value: "keyboard", labelKey: "settings.tabs.keyboard" },
  { value: "about", labelKey: "settings.tabs.about" },
] as const;

type SettingsTabValue = (typeof ALL_TABS)[number]["value"];

/** System-wide hotkeys need a keyboard and a window manager to bind them. */
const DESKTOP_ONLY_TABS: readonly SettingsTabValue[] = ["keyboard"];

const tabs = ALL_TABS.filter(
  (tab) => !(isMobileHost() && DESKTOP_ONLY_TABS.includes(tab.value))
);

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

  // The directory and the spine stay put for the full height of the window;
  // only the panel to the right of the spine scrolls. That panel runs all the
  // way to the window edge so its scrollbar rides the edge like every other
  // page's, with the panel's own gutter carried by the content inside it.
  //
  // A 10rem directory would take two fifths of a phone viewport, so below `md`
  // the same list turns on its side: a horizontally scrollable strip above the
  // panel, with the active tick moving from the spine to the underline.
  return (
    <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[10rem_1fr] md:grid-rows-[1fr] md:pl-6">
      {/* Section directory: right-aligned labels against the spine, the
          active entry marked by a tick crossing it. */}
      <nav
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] md:flex-col md:gap-0 md:overflow-visible md:border-b-0 md:px-0 md:py-8"
        aria-label={t("nav.settings")}
      >
        {tabs.map((tab) => {
          const isActive = tab.value === currentTab;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleTabChange(tab.value)}
              className={cn(
                "relative shrink-0 whitespace-nowrap px-2 py-3 text-sm transition-colors focus-visible:outline-none md:px-0 md:py-2 md:pr-5 md:text-right",
                isActive
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t(tab.labelKey)}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-x-2 bottom-0 h-0.5 bg-foreground md:inset-x-auto md:-right-px md:top-1/2 md:h-4 md:w-0.5 md:-translate-y-1/2"
                />
              )}
            </button>
          );
        })}
      </nav>
      <ScrollRegion className="min-h-0 md:border-l md:border-border">
        <div className="max-w-4xl px-4 py-6 md:py-8 md:pl-8 md:pr-6">
          <ActiveTab />
        </div>
      </ScrollRegion>
    </div>
  );
}
