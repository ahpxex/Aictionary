import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Frequency = { zipf: number; perMillion: number };

export function WordFrequency({ word, language }: { word: string; language: string }) {
  const { t, i18n } = useTranslation();
  const [result, setResult] = useState<{ word: string; language: string; frequency: Frequency } | null>(null);
  useEffect(() => {
    let current = true;
    invoke<Frequency | null>("word_frequency", { word, language })
      .then((frequency) => { if (current) setResult(frequency ? { word, language, frequency } : null); })
      .catch(() => { if (current) setResult(null); });
    return () => { current = false; };
  }, [word, language]);
  if (!result || result.word !== word || result.language !== language) return null;
  const { frequency } = result;
  const level = frequency.zipf >= 5 ? "high" : frequency.zipf >= 3 ? "medium" : "low";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground">
          {t(`main.frequency.${level}`)} · {frequency.zipf.toFixed(2)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="space-y-2 text-sm">
        <p>{t("main.frequency.explanation", { frequency: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(frequency.perMillion) })}</p>
        <p className="text-xs text-muted-foreground">{t("main.frequency.scope")}</p>
        <button type="button" className="text-xs underline" onClick={() => void openUrl("https://github.com/rspeer/wordfreq")}>
          wordfreq 3.1.1 · Robyn Speer · CC BY-SA 4.0
        </button>
      </PopoverContent>
    </Popover>
  );
}
