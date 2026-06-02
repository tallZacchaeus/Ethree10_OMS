"use client";

import { useState, useEffect } from "react";
import { getDictionary, type Locale, defaultLocale, locales } from "@/lib/i18n";

export function useTranslation() {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [dict, setDict] = useState(getDictionary(defaultLocale));

  useEffect(() => {
    // Initial load
    const saved = localStorage.getItem("ethree10_locale") as Locale;
    if (saved && locales.includes(saved)) {
      setLocale(saved);
      setDict(getDictionary(saved));
    }

    // Listen for changes
    const handleLocaleChange = () => {
      const newSaved = localStorage.getItem("ethree10_locale") as Locale;
      if (newSaved && locales.includes(newSaved)) {
        setLocale(newSaved);
        setDict(getDictionary(newSaved));
      }
    };

    window.addEventListener("localeChange", handleLocaleChange);
    return () => window.removeEventListener("localeChange", handleLocaleChange);
  }, []);

  const t = (key: string) => {
    return dict[key] || key;
  };

  return { t, locale };
}
