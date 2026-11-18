import React, { useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { Save, AlertCircle, RefreshCw, Sparkles, TrendingUp, CheckCircle2, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';

import { SiteSettings } from '../../types';

export function Advertisements() {
  const { settings, setSettings } = useSettingsStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [adsEnabled, setAdsEnabled] = useState(settings?.adsEnabled ?? false);
  const [customAds, setCustomAds] = useState({
    smartlink: settings?.customAds?.smartlink || '',
    socialBar: settings?.customAds?.socialBar || '',
    popunder: settings?.customAds?.popunder || '',
    nativeBanner: settings?.customAds?.nativeBanner || '',
    banner468x60: settings?.customAds?.banner468x60 || '',
    banner300x250: settings?.customAds?.banner300x250 || '',
    banner160x300: settings?.customAds?.banner160x300 || '',
    banner160x600: settings?.customAds?.banner160x600 || '',
    banner320x50: settings?.customAds?.banner320x50 || '',
    banner728x90: settings?.customAds?.banner728x90 || '',
    vastUrl: settings?.customAds?.vastUrl || '',
    premiumUnlockLink: settings?.customAds?.premiumUnlockLink || '',
  });
  const [customAdsToggles, setCustomAdsToggles] = useState<Record<string, boolean>>({
    smartlink: settings?.customAds?.toggles?.smartlink ?? true,
    socialBar: settings?.customAds?.toggles?.socialBar ?? true,
    popunder: settings?.customAds?.toggles?.popunder ?? true,
    nativeBanner: settings?.customAds?.toggles?.nativeBanner ?? true,
    banner468x60: settings?.customAds?.toggles?.banner468x60 ?? true,
    banner300x250: settings?.customAds?.toggles?.banner300x250 ?? true,
    banner160x300: settings?.customAds?.toggles?.banner160x300 ?? true,
    banner160x600: settings?.customAds?.toggles?.banner160x600 ?? true,
    banner320x50: settings?.customAds?.toggles?.banner320x50 ?? true,
    banner728x90: settings?.customAds?.toggles?.banner728x90 ?? true,
    vastUrl: settings?.customAds?.toggles?.vastUrl ?? true,
    premiumUnlockLink: settings?.customAds?.toggles?.premiumUnlockLink ?? true,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const updatedSettings: SiteSettings = {
        ...settings,
        adsEnabled,
        customAds: {
          ...customAds,
          toggles: customAdsToggles
        }
      };

      const { error } = await supabase.from('settings').upsert({
        id: 'general',
        ads_enabled: adsEnabled,
        custom_ads: {
          ...customAds,
          toggles: customAdsToggles
        },
        data: updatedSettings
      });
      if (error) throw error;
      
      setSettings(updatedSettings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error("Error saving ads:", err);
      setError("Failed to save advertisement settings");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: keyof typeof customAds, value: string) => {
    setCustomAds(prev => ({ ...prev, [key]: value }));
  };

  const handleToggleChange = (key: string, value: boolean) => {
    setCustomAdsToggles(prev => ({ ...prev, [key]: value }));
  };

  if (!settings) return <div>Loading settings...</div>;

  const scriptAds = [
    { 
      key: 'socialBar', 
      label: 'Social Bar', 
      badge: 'Highest CTR 🔥',
      desc: 'Floating push/chat notification ads. Adsterra-তে সবচেয়ে বেশি ক্লিক এবং উচ্চ CPM দেয়।' 
    },
    { 
      key: 'popunder', 
      label: 'Popunder', 
      badge: 'Highest Earning 💰',
      desc: 'ভিডিও সাইটের জন্য এক নম্বর আয়ের উৎস। ব্যবহারকারী যেকোনো জায়গায় প্রথম ক্লিক করলে নতুন ট্যাবে খোলে।' 
    },
    { 
      key: 'smartlink', 
      label: 'Smartlink (Direct Link)', 
      badge: 'High Conversion 🚀',
      desc: 'ডাইরেক্ট লিংক পেস্ট করুন। সাইটে স্বয়ংক্রিয়ভাবে ব্যাকগ্রাউন্ড ও ক্লিকে সর্বোচ্চ রেভিনিউ তৈরি করবে।' 
    },
    { 
      key: 'premiumUnlockLink', 
      label: 'Premium Unlock Ads', 
      badge: 'VIP Monetization 👑',
      desc: 'প্রিমিয়াম ভিডিও আনলক করতে ইউজারকে বিজ্ঞাপন দেখাতে Adsterra-র Web Script বা Direct Link পেস্ট করুন।' 
    },
    { 
      key: 'vastUrl', 
      label: 'VAST Video Pre-Roll Ad URL', 
      badge: 'Video Player Ad 🎬',
      desc: 'ভিডিও প্লেয়ার চালু হওয়ার আগে ভিডিও বিজ্ঞাপন (VAST Tag XML URL) দেখাতে আপনার Adsterra বা VAST URL এখানে দিন।' 
    }
  ];

  const bannerAds = [
    { 
      key: 'nativeBanner', 
      label: 'Native Banner (4:1)', 
      badge: 'Natural & Clean 💎',
      desc: 'উইজেট লেআউট 4:1 ও Font: Inherit দিয়ে কোড আনুন। হোমপেজের ফিড এবং ভিডিও পেজের নিচে চমৎকার দেখাবে।' 
    },
    { 
      key: 'banner300x250', 
      label: 'Banner 300x250', 
      badge: 'Sidebar & Feed 🎯',
      desc: 'ভিডিও পেজের সাইডবার এবং সম্পর্কিত ভিডিওগুলোর মাঝে দেখানোর জন্য সবচেয়ে জনপ্রিয় সাইজ।' 
    },
    { 
      key: 'banner728x90', 
      label: 'Banner 728x90', 
      badge: 'Desktop Header 💻',
      desc: 'কম্পিউটার ও ল্যাপটপে সাইটের উপরে বা ভিডিওর নিচে প্রদর্শন করার জন্য লিডারবোর্ড ব্যানার।' 
    },
    { 
      key: 'banner320x50', 
      label: 'Banner 320x50', 
      badge: 'Mobile Sticky 📱',
      desc: 'মোবাইলে স্ক্রিনের উপরে ও নিচে স্টিকি বার হিসেবে প্রদর্শিত হয়।' 
    },
    { 
      key: 'banner468x60', 
      label: 'Banner 468x60', 
      desc: 'সাইটের ফুটারের কাছে মাঝারি অনুভূমিক ব্যানার।' 
    },
    { 
      key: 'banner160x600', 
      label: 'Banner 160x600', 
      desc: 'ভিডিও পেজের সাইডবারে লম্বা স্কাইস্ক্র্যাপার ব্যানার।' 
    },
    { 
      key: 'banner160x300', 
      label: 'Banner 160x300', 
      desc: 'সাইডবারের ছোট স্কাইস্ক্র্যাপার ব্যানার।' 
    }
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Adsterra Ad Setup</h2>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <form onSubmit={handleSave} className="p-6 space-y-8">
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
            <div>
              <h3 className="text-lg font-medium text-white mb-1">Enable Advertisements</h3>
              <p className="text-sm text-gray-400">Turn on or off all ads across the website globally</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={adsEnabled}
                onChange={(e) => setAdsEnabled(e.target.checked)}
              />
              <div className="w-14 h-7 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-500"></div>
            </label>
          </div>

          {/* High Income Strategy Banner */}
          <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-red-500/10 border border-amber-500/30 rounded-xl p-5 shadow-lg">
            <div className="flex items-start gap-3.5">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg shrink-0 mt-0.5">
                <DollarSign className="w-6 h-6" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                    Adsterra সর্বোচ্চ আয়ের সেরা সেটআপ গাইড
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                    RECOMMENDED
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                  ভিডিও সাইট থেকে সর্বোচ্চ ইনকাম (High CPM + High CTR) পেতে Adsterra-তে নিচের ফরম্যাটগুলো ব্যবহার করুন:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                  <div className="bg-black/40 border border-white/10 rounded-lg p-2.5">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 1. Social Bar
                    </span>
                    <p className="text-[11px] text-gray-400 mt-1">সবচেয়ে বেশি ক্লিক ও উচ্চ CPM দেয়। মোবাইলে সুন্দর নোটিফিকেশন বার হিসেবে দেখায়।</p>
                  </div>
                  <div className="bg-black/40 border border-white/10 rounded-lg p-2.5">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 2. Popunder
                    </span>
                    <p className="text-[11px] text-gray-400 mt-1">ভিডিও সাইটের সবচেয়ে বড় আয়ের উৎস। ব্যাকগ্রাউন্ডে নতুন ট্যাবে খোলে।</p>
                  </div>
                  <div className="bg-black/40 border border-white/10 rounded-lg p-2.5">
                    <span className="text-xs font-bold text-blue-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 3. Native 4:1
                    </span>
                    <p className="text-[11px] text-gray-400 mt-1">হোম ও ভিডিও পেজের মাঝে মানানসই দেখায়, বিজ্ঞাপন মনে হয় না।</p>
                  </div>
                  <div className="bg-black/40 border border-white/10 rounded-lg p-2.5">
                    <span className="text-xs font-bold text-purple-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 4. Smartlink
                    </span>
                    <p className="text-[11px] text-gray-400 mt-1">ভিআইপি ভিডিও আনলক ও ক্লিকে ডাইরেক্ট কনভার্সন দিয়ে রেভিনিউ বাড়ায়।</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Global Scripts (Popups & Clicks)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {scriptAds.map(ad => (
                <div key={ad.key} className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <label className="block text-sm font-bold text-white">{ad.label}</label>
                      {ad.badge && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-white/10 text-amber-300 rounded border border-white/15">
                          {ad.badge}
                        </span>
                      )}
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={customAdsToggles[ad.key] ?? true}
                        onChange={(e) => handleToggleChange(ad.key, e.target.checked)}
                      />
                      <div className="w-9 h-5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{ad.desc}</p>
                  <textarea
                    rows={3}
                    value={customAds[ad.key as keyof typeof customAds]}
                    onChange={(e) => handleChange(ad.key as keyof typeof customAds, e.target.value)}
                    placeholder="Paste Script code here..."
                    className={`w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:ring-1 focus:ring-red-500 ${!(customAdsToggles[ad.key] ?? true) ? 'opacity-50' : ''}`}
                    disabled={!(customAdsToggles[ad.key] ?? true)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Banner Ads</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {bannerAds.map(ad => (
                <div key={ad.key} className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <label className="block text-sm font-bold text-white">{ad.label}</label>
                      {ad.badge && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-white/10 text-emerald-300 rounded border border-white/15">
                          {ad.badge}
                        </span>
                      )}
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={customAdsToggles[ad.key] ?? true}
                        onChange={(e) => handleToggleChange(ad.key, e.target.checked)}
                      />
                      <div className="w-9 h-5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{ad.desc}</p>
                  <textarea
                    rows={3}
                    value={customAds[ad.key as keyof typeof customAds]}
                    onChange={(e) => handleChange(ad.key as keyof typeof customAds, e.target.value)}
                    placeholder="Paste Banner HTML code here..."
                    className={`w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:ring-1 focus:ring-red-500 ${!(customAdsToggles[ad.key] ?? true) ? 'opacity-50' : ''}`}
                    disabled={!(customAdsToggles[ad.key] ?? true)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end pt-6 border-t border-white/10 sticky bottom-0 bg-[#050505]/90 p-4 rounded-b-xl backdrop-blur-md">
            {error && <p className="text-red-500 text-sm mr-4">{error}</p>}
            {success && <p className="text-green-500 text-sm mr-4">Ads saved successfully!</p>}
            
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-bold transition-colors disabled:opacity-70"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {loading ? 'Saving...' : 'Save All Ads'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
