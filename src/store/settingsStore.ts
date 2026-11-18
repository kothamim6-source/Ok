import { create } from 'zustand';
import { SiteSettings } from '../types';

interface SettingsState {
  settings: SiteSettings | null;
  isLoading: boolean;
  setSettings: (settings: SiteSettings) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  isLoading: true,
  setSettings: (settings) => {
    set({ settings });
    if (settings?.customAds) {
      try {
        window.localStorage.setItem('site_custom_ads', JSON.stringify(settings.customAds));
      } catch (e) {
        console.error('Failed to save ads to local storage', e);
      }
    }
  },
  setLoading: (isLoading) => set({ isLoading }),
}));
