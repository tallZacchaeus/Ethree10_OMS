export const defaultLocale = "en";
export const locales = ["en", "pcm", "yo", "ig"] as const;
export type Locale = typeof locales[number];

type Dictionary = Record<string, string>;

const dictionaries: Record<Locale, Dictionary> = {
  en: {
    "hero.title": "Ethree10 Operations Management System",
    "hero.subtitle": "Delivering scalable architecture and tech operations.",
    "nav.login": "Login",
    "nav.request": "Start Project",
  },
  pcm: {
    "hero.title": "Ethree10 Oga Operations System",
    "hero.subtitle": "We dey deliver baddest tech operations for you.",
    "nav.login": "Enter",
    "nav.request": "Start Work",
  },
  yo: {
    "hero.title": "Ethree10 Eto Isakoso",
    "hero.subtitle": "A n pese faaji iwọn ati awọn iṣẹ imọ-ẹrọ.",
    "nav.login": "Wọle",
    "nav.request": "Bẹrẹ Ise agbese",
  },
  ig: {
    "hero.title": "Ethree10 Usoro Nlekọta",
    "hero.subtitle": "Anyị na-enye ụkpụrụ ụlọ nwere ike gbasaa.",
    "nav.login": "Banye",
    "nav.request": "Malite oru ngo",
  },
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] || dictionaries.en;
}
