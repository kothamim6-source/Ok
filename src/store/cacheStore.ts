import { create } from 'zustand';
import { Video, Banner, Category } from '../types';

interface CacheState {
  homeVideos: Video[];
  homeBanners: Banner[];
  homeCategories: Category[];
  lastFetchTime: number;
  hasLoaded: boolean;
  setHomeData: (videos: Video[], banners: Banner[], categories: Category[]) => void;
  updateVideos: (videos: Video[]) => void;
  shouldFetch: () => boolean;
}

const getInitialBanners = (): Banner[] => {
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('site_cached_banners');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch (e) {}
  return [];
};

export const useCacheStore = create<CacheState>((set, get) => ({
  homeVideos: [],
  homeBanners: getInitialBanners(),
  homeCategories: [],
  lastFetchTime: 0,
  hasLoaded: false,
  
  setHomeData: (videos, banners, categories) => {
    try {
      if (typeof window !== 'undefined' && Array.isArray(banners) && banners.length > 0) {
        localStorage.setItem('site_cached_banners', JSON.stringify(banners));
      }
    } catch (e) {}
    set({ 
      homeVideos: videos, 
      homeBanners: banners, 
      homeCategories: categories,
      lastFetchTime: Date.now(),
      hasLoaded: true
    });
  },

  updateVideos: (videos) => set({
    homeVideos: videos
  }),
  
  shouldFetch: () => {
    const { hasLoaded, lastFetchTime } = get();
    // Fetch if never loaded before, or if data is older than 5 minutes (300000 ms)
    if (!hasLoaded || lastFetchTime === 0) return true;
    return Date.now() - lastFetchTime > 300000;
  }
}));
