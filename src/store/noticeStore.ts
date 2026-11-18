import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { SiteNoticeSettings } from '../types';

export const DEFAULT_NOTICE_SETTINGS: SiteNoticeSettings = {
  tickerEnabled: true,
  tickerText: '✦ সকল নতুন ভাইরাল ভিডিও সবার আগে পেতে এবং কোনো লিংক ব্লক হলে ব্যাকআপ ভিডিওর জন্য আমাদের অফিসিয়াল টেলিগ্রাম চ্যানেলে জয়েন থাকুন! ✦ ভিআইপি এক্সেস ও যেকোনো প্রয়োজনে সরাসরি যোগাযোগ করুন ✦',
  tickerBadgeText: '🔥 জরুরি নোটিশ',
  tickerLink: '',
  tickerSpeed: 'normal',
  tickerTheme: 'red',

  popupEnabled: true,
  popupTitle: '📢 জরুরি নোটিশ ও স্বাগতম!',
  popupMessage: 'আমাদের ওয়েবসাইটে আপনাকে স্বাগতম। প্রতিদিন নতুন নতুন ভিডিও এবং এক্সক্লুসিভ আপডেট পেতে আমাদের অফিসিয়াল টেলিগ্রাম চ্যানেলে এখনই জয়েন করুন। কোনো সমস্যা হলে সরাসরি এডমিনকে ইনবক্স করতে পারেন।',
  popupImageUrl: '',
  popupButtonText: 'টেলিগ্রাম চ্যানেলে জয়েন করুন',
  popupButtonLink: '',
  popupFrequency: 'once_per_session',
  popupVersion: '1',
  updatedAt: Date.now()
};

interface NoticeStoreState {
  noticeSettings: SiteNoticeSettings;
  isLoading: boolean;
  hasLoaded: boolean;
  fetchNoticeSettings: (force?: boolean) => Promise<void>;
  saveNoticeSettings: (newSettings: SiteNoticeSettings) => Promise<{ success: boolean; error?: string }>;
}

export const useNoticeStore = create<NoticeStoreState>((set, get) => ({
  noticeSettings: DEFAULT_NOTICE_SETTINGS,
  isLoading: false,
  hasLoaded: false,

  fetchNoticeSettings: async (force = false) => {
    // If already loaded and force is not specified, avoid extra network calls
    if (get().hasLoaded && !force) return;
    set({ isLoading: true });

    // Seed from local storage cache first for instant render
    try {
      const cached = localStorage.getItem('site_notice_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          set({
            noticeSettings: {
              ...DEFAULT_NOTICE_SETTINGS,
              ...parsed
            }
          });
        }
      }
    } catch (e) {}

    try {
      // 1. Try fetching from settings table with id 'site_notice'
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'site_notice')
        .single();

      if (!error && data?.data) {
        const merged: SiteNoticeSettings = {
          ...DEFAULT_NOTICE_SETTINGS,
          ...data.data
        };
        try {
          localStorage.setItem('site_notice_settings', JSON.stringify(merged));
        } catch (e) {}
        set({
          noticeSettings: merged,
          hasLoaded: true,
          isLoading: false
        });
        return;
      }

      // 2. Fallback check: check if it's saved inside 'general' settings.noticeSettings
      const { data: generalData } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'general')
        .single();

      if (generalData?.data?.noticeSettings) {
        const merged: SiteNoticeSettings = {
          ...DEFAULT_NOTICE_SETTINGS,
          ...generalData.data.noticeSettings
        };
        try {
          localStorage.setItem('site_notice_settings', JSON.stringify(merged));
        } catch (e) {}
        set({
          noticeSettings: merged,
          hasLoaded: true,
          isLoading: false
        });
        return;
      }

      // If no notice settings exist yet, keep default
      set({ hasLoaded: true, isLoading: false });
    } catch (err) {
      console.warn('Could not fetch site notice settings, using defaults:', err);
      set({ hasLoaded: true, isLoading: false });
    }
  },

  saveNoticeSettings: async (newSettings: SiteNoticeSettings) => {
    set({ isLoading: true });
    try {
      const payload: SiteNoticeSettings = {
        ...newSettings,
        popupVersion: newSettings.popupVersion || Date.now().toString(),
        updatedAt: Date.now()
      };

      try {
        localStorage.setItem('site_notice_settings', JSON.stringify(payload));
      } catch (e) {}

      // 1. Save to dedicated 'site_notice' row in settings table
      const { error: noticeErr } = await supabase.from('settings').upsert({
        id: 'site_notice',
        data: payload
      });

      if (noticeErr) {
        console.warn('Notice row upsert error, trying fallback to general:', noticeErr);
        // Fallback to general settings
        const { data: genRow } = await supabase.from('settings').select('*').eq('id', 'general').single();
        const genData = genRow?.data || {};
        const { error: genErr } = await supabase.from('settings').upsert({
          id: 'general',
          data: {
            ...genData,
            noticeSettings: payload
          }
        });
        if (genErr) {
          throw new Error(noticeErr.message || genErr.message);
        }
      } else {
        // Also sync to 'general' settings if possible so everything stays consistent
        try {
          const { data: generalRow } = await supabase.from('settings').select('*').eq('id', 'general').single();
          if (generalRow?.data) {
            await supabase.from('settings').update({
              data: {
                ...generalRow.data,
                noticeSettings: payload
              }
            }).eq('id', 'general');
          }
        } catch (e) {
          // Silently ignore secondary sync error
        }
      }

      set({
        noticeSettings: payload,
        isLoading: false,
        hasLoaded: true
      });

      // Dispatch event to all listeners in app for instant UI update
      try {
        window.dispatchEvent(new CustomEvent('site_notice_updated', { detail: payload }));
      } catch (e) {}

      return { success: true };
    } catch (error: any) {
      console.error('Failed to save notice settings:', error);
      set({ isLoading: false });
      return { success: false, error: error?.message || 'Failed to save settings' };
    }
  }
}));
