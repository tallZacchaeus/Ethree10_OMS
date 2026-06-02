"use client";

import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { type Locale, locales } from "@/lib/i18n";

const localeNames: Record<Locale, string> = {
  en: "English",
  pcm: "Pidgin",
  yo: "Yoruba",
  ig: "Igbo",
};

export function LanguageSwitcher() {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem("ethree10_locale") as Locale;
    if (saved && locales.includes(saved)) {
      setLocale(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem("ethree10_locale", newLocale);
    document.documentElement.lang = newLocale;
    // Dispatch event so marketing components can re-render
    window.dispatchEvent(new Event("localeChange"));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((l) => (
          <DropdownMenuItem 
            key={l} 
            onClick={() => changeLocale(l)}
            className={l === locale ? "font-bold" : ""}
          >
            {localeNames[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
