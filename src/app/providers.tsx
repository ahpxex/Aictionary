import { ThemeProvider as NextThemeProvider } from "next-themes";
import { type PropsWithChildren } from "react";
import { Provider as JotaiProvider } from "jotai";
import { Toaster } from "@/components/ui/sonner";
import { AppearanceSync } from "@/app/appearance-sync";
import { DictionaryCacheSync } from "@/app/dictionary-cache-sync";

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
        {children}
        <Toaster position="top-center" />
      </NextThemeProvider>
    </JotaiProvider>
  );
}
