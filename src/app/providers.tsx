import { ThemeProvider as NextThemeProvider } from "next-themes";
import { type PropsWithChildren } from "react";
import { Provider as JotaiProvider } from "jotai";
import { Toaster } from "@/components/ui/sonner";
import { AppearanceSync } from "@/app/appearance-sync";
import { AudioSync } from "@/app/audio-sync";
import { DictionaryCacheSync } from "@/app/dictionary-cache-sync";
import { SystemSync } from "@/app/system-sync";
import { UpdateCheckSync } from "@/app/update-check-sync";
import { AnkiSync } from "@/app/anki-sync";
import { isIosHost, isMobileHost } from "@/shared/lib/platform";

/**
 * What every window needs: state, theme and language, and the runtime
 * mirrors that audio, Anki and network services read outside React.
 */
export function WindowProviders({ children }: PropsWithChildren) {
  return (
    <JotaiProvider>
      <NextThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey="aictionary-theme"
      >
        <AppearanceSync />
        <AudioSync />
        <AnkiSync />
        {children}
        <Toaster position="bottom-center" />
      </NextThemeProvider>
    </JotaiProvider>
  );
}

/**
 * The main window. It also owns the app-wide duties that must run exactly
 * once however many windows are open: dictionary setup, tray and autostart,
 * and the update check.
 */
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <WindowProviders>
      <DictionaryCacheSync />
      {!isMobileHost() && <SystemSync />}
      {!isIosHost() && <UpdateCheckSync />}
      {children}
    </WindowProviders>
  );
}
