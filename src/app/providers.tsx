import { ThemeProvider as NextThemeProvider } from "next-themes";
import { type PropsWithChildren } from "react";
import { Provider as JotaiProvider } from "jotai";
import { Toaster } from "@/components/ui/sonner";
import { AppearanceSync } from "@/app/appearance-sync";
import { DictionaryCacheSync } from "@/app/dictionary-cache-sync";
import { SystemSync } from "@/app/system-sync";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <JotaiProvider>
      <NextThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey="aictionary-theme"
      >
        <AppearanceSync />
        <DictionaryCacheSync />
        <SystemSync />
        {children}
        <Toaster position="bottom-center" />
      </NextThemeProvider>
    </JotaiProvider>
  );
}
