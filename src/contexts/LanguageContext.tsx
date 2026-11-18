import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'bn';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const dictionary: Record<Language, Record<string, string>> = {
  en: {
    home: 'Home',
    premium: 'Premium',
    categories: 'Categories',
    trending: 'Trending',
    history: 'History',
    search_placeholder: 'Search videos...',
    admin_panel: 'ADMIN PANEL',
    admin: 'ADMIN',
    my_profile: 'My Profile',
    watch_history: 'Watch History',
    sign_out: 'Sign Out',
    theme: 'Theme',
    dark: 'Dark',
    light: 'Light'
  },
  bn: {
    home: 'হোম',
    premium: 'প্রিমিয়াম',
    categories: 'ক্যাটাগরি',
    trending: 'ট্রেন্ডিং',
    history: 'হিস্ট্রি',
    search_placeholder: 'ভিডিও খুঁজুন...',
    admin_panel: 'অ্যাডমিন প্যানেল',
    admin: 'অ্যাডমিন',
    my_profile: 'আমার প্রোফাইল',
    watch_history: 'দেখার ইতিহাস',
    sign_out: 'লগআউট',
    theme: 'থিম',
    dark: 'ডার্ক',
    light: 'লাইট'
  }
};

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key
});

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState<Language>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return (localStorage.getItem('preferred_lang') as Language) || 'en';
      }
    } catch {}
    return 'en';
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('preferred_lang', lang);
      }
    } catch {}
  }, [lang]);

  const t = (key: string) => dictionary[lang][key] || key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
