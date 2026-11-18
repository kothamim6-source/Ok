import React, { useState, useEffect } from 'react';
import { useNoticeStore, DEFAULT_NOTICE_SETTINGS } from '../../store/noticeStore';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { SiteNoticeSettings } from '../../types';
import { getSafeTelegramWebUrl } from '../../lib/telegramUtils';
import { MarqueeNotice } from '../../components/ui/MarqueeNotice';
import { WelcomeNoticeModal } from '../../components/ui/WelcomeNoticeModal';
import { 
  Megaphone, 
  Bell, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  Link as LinkIcon, 
  Palette, 
  Gauge, 
  Layers,
  Image as ImageIcon,
  RotateCcw
} from 'lucide-react';

export function NoticeSettings() {
  const { noticeSettings, fetchNoticeSettings, saveNoticeSettings, isLoading } = useNoticeStore();
  const { user } = useAuthStore();

  const [formData, setFormData] = useState<SiteNoticeSettings>(noticeSettings);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [resetDismissSuccess, setResetDismissSuccess] = useState(false);

  useEffect(() => {
    fetchNoticeSettings(true).then(() => {
      const current = useNoticeStore.getState().noticeSettings;
      setFormData(current);
    });
  }, [fetchNoticeSettings]);

  const updateField = <K extends keyof SiteNoticeSettings>(key: K, value: SiteNoticeSettings[K]) => {
    setIsDirty(true);
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    // Update popup version whenever popup settings are updated so users immediately receive the fresh notice
    const payload: SiteNoticeSettings = {
      ...formData,
      tickerLink: formData.tickerLink ? getSafeTelegramWebUrl(formData.tickerLink, formData.tickerLink) : '',
      popupButtonLink: formData.popupButtonLink ? getSafeTelegramWebUrl(formData.popupButtonLink, formData.popupButtonLink) : '',
      popupVersion: Date.now().toString(),
      updatedAt: Date.now()
    };

    const res = await saveNoticeSettings(payload);

    if (res.success) {
      setIsDirty(false);
      setSaveSuccess(true);
      setFormData(payload);
      setTimeout(() => setSaveSuccess(false), 4000);

      // Log admin activity
      if (user) {
        try {
          await supabase.from('admin_logs').insert([{
            admin_id: user.id,
            action: 'UPDATE_NOTICE_SETTINGS',
            details: 'Updated marquee ticker and welcome popup notice settings',
            created_at: Date.now()
          }]);
        } catch (err) {
          console.warn('Failed to record admin log', err);
        }
      }
    } else {
      setSaveError(res.error || 'Failed to save settings');
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('সব নোটিশ সেটিংস ডিফল্ট মানে রিসেট করতে চান?')) {
      setIsDirty(true);
      setFormData(DEFAULT_NOTICE_SETTINGS);
    }
  };

  const handleClearDismissalHistory = () => {
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('site_popup_dismissed_')) localStorage.removeItem(k);
      });
      Object.keys(sessionStorage).forEach(k => {
        if (k.startsWith('site_popup_dismissed_')) sessionStorage.removeItem(k);
      });
      setResetDismissSuccess(true);
      setTimeout(() => setResetDismissSuccess(false), 3000);
    } catch (e) {}
  };

  return (
    <div className="space-y-8 max-w-5xl pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-red-600/10 text-red-500 border border-red-600/20">
              <Megaphone className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Notice Board & Announcements
            </h1>
          </div>
          <p className="text-sm text-gray-400">
            হোমপেজের স্ক্রলিং হেডলাইন নোটিশ বার, ডিসক্লেইমার এবং ওয়েবসাইটে প্রবেশকারী ভিজিটরদের নোটিশ নিয়ন্ত্রণ করুন।
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTestModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/10 transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4 text-red-400" />
            <span>Test Popup Modal</span>
          </button>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-medium border border-white/5 transition-colors cursor-pointer"
            title="Reset to default"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Default</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>নোটিশ সেটিংস সফলভাবে সেভ করা হয়েছে! ওয়েবসাইটে পরিবর্তন কার্যকর হয়েছে।</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Live Preview Box */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            Live Marquee Ticker Preview (ওয়েবসাইটে যেমন দেখাবে)
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${formData.tickerEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {formData.tickerEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {formData.tickerEnabled ? (
          <div className="pt-1">
            <MarqueeNotice />
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-center text-gray-500 text-xs font-medium">
            Marquee Ticker বর্তমানে বন্ধ রয়েছে। চালু করতে নিচের সুইচটি অন করুন।
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* SECTION 1: MARQUEE SCROLLING NOTICE */}
        <div className="rounded-2xl border border-red-600/20 bg-[#0e0e11] p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-600/10 text-red-500 flex items-center justify-center border border-red-600/20">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  ১. হোমপেজ স্ক্রলিং নোটিশ (Marquee Ticker)
                </h2>
                <p className="text-xs text-gray-400">
                  স্ক্রিনে ডানে থেকে বামে অনবরত লেখা স্ক্রল হতে থাকবে (বাংলা টেক্সট ও ডিসক্লেইমার পুরোপুরি সাপোর্ট করে)।
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.tickerEnabled}
                onChange={(e) => updateField('tickerEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>

          <div className="space-y-4">
            {/* Notice Text */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-bold text-gray-200">
                  নোটিশের মূল বার্তা ও ডিসক্লেইমার (Notice Message)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const disclaimer = '📌 Disclaimer: কনটেন্ট শুধু বিনোদনের জন্য। আপনার কোনো কনটেন্ট থাকলে অপসারণের জন্য আমাদের সাথে যোগাযোগ করুন।';
                    if (!formData.tickerText.includes('Disclaimer')) {
                      updateField('tickerText', formData.tickerText ? `${disclaimer} ✦ ${formData.tickerText}` : disclaimer);
                    }
                  }}
                  className="text-xs px-2.5 py-1 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 transition-colors flex items-center gap-1 font-medium cursor-pointer"
                  title="Insert official disclaimer text"
                >
                  <span>📌 Disclaimer টেক্সট যোগ করুন</span>
                </button>
              </div>
              <textarea
                rows={3}
                value={formData.tickerText}
                onChange={(e) => updateField('tickerText', e.target.value)}
                placeholder="যেমন: 📌 Disclaimer: কনটেন্ট শুধু বিনোদনের জন্য। আপনার কোনো কনটেন্ট থাকলে অপসারণের জন্য আমাদের সাথে যোগাযোগ করুন।..."
                className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-3 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
                required={formData.tickerEnabled}
              />
              <p className="text-xs text-gray-500 mt-1">
                এখানে আপনি বাংলা বা ইংরেজিতে যেকোনো মেসেজ ও ডিসক্লেইমার দিতে পারেন।
              </p>
            </div>

            {/* Badge Text & Link Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-200 mb-1.5">
                  ব্যাজ টেক্সট (Badge Label)
                </label>
                <input
                  type="text"
                  value={formData.tickerBadgeText}
                  onChange={(e) => updateField('tickerBadgeText', e.target.value)}
                  placeholder="📢 NOTICE বা 📢 নোটিশ"
                  className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-200 mb-1.5 flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-red-400" />
                  ক্লিক লিংক (Optional Click URL)
                </label>
                <input
                  type="url"
                  value={formData.tickerLink || ''}
                  onChange={(e) => updateField('tickerLink', e.target.value)}
                  placeholder="https://t.me/firearenatournament"
                  className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                <p className="text-[11px] text-gray-500 mt-1">নোটিশে ক্লিক করলে এই লিংকে রিডাইরেক্ট হবে।</p>
              </div>
            </div>

            {/* Theme and Speed */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-sm font-bold text-gray-200 mb-1.5 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-red-400" />
                  কালার থিম (Color Gradient)
                </label>
                <select
                  value={formData.tickerTheme}
                  onChange={(e) => updateField('tickerTheme', e.target.value as any)}
                  className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none"
                >
                  <option value="red">🔥 Website Dark Red (ওয়েবসাইটের সাথে মেলানো ডার্ক রেড ও ব্ল্যাক - রেকমেন্ডেড)</option>
                  <option value="dark-red">🍷 Deep Crimson (গাঢ় লাল)</option>
                  <option value="orange">⚡ Vibrant Orange (উজ্জ্বল কমলা)</option>
                  <option value="amber">⭐ Amber Gold (গোল্ডেন হলুদ)</option>
                  <option value="purple">🔮 Royal Purple (বেগুনী প্রিমিয়াম)</option>
                  <option value="blue">🌊 Electric Blue (নীল)</option>
                  <option value="emerald">🌿 Emerald Green (সবুজ)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-200 mb-1.5 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-red-400" />
                  স্ক্রলিং স্পিড (Scroll Speed)
                </label>
                <select
                  value={formData.tickerSpeed}
                  onChange={(e) => updateField('tickerSpeed', e.target.value as any)}
                  className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none"
                >
                  <option value="slow">🐢 Slow (ধীরে ধীরে)</option>
                  <option value="normal">⚡ Normal (স্বাভাবিক - রেকমেন্ডেড)</option>
                  <option value="fast">🚀 Fast (দ্রুত)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: WELCOME / FIRST-VISIT POPUP NOTICE */}
        <div className="rounded-2xl border border-yellow-500/20 bg-[#0e0e11] p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 text-yellow-500 flex items-center justify-center border border-yellow-500/20">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  ২. প্রথমবার ঢুকলে পপ-আপ নোটিশ (Welcome Popup Modal)
                </h2>
                <p className="text-xs text-gray-400">
                  যেকোনো ভিজিটর প্রথমবার ওয়েবসাইটে প্রবেশ করলে স্ক্রিনের মাঝে এই নোটিশটি আসবে এবং ক্রস (✕) বাটন দিয়ে কেটে দিতে পারবে।
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              {/* Quick Live Preview Button */}
              <button
                type="button"
                onClick={() => setTestModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-xs font-bold border border-yellow-500/30 transition-colors cursor-pointer"
                title="বর্তমানে টাইপ করা তথ্যের লাইভ প্রিভিউ দেখুন"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>লাইভ প্রিভিউ (Live Preview)</span>
              </button>

              {/* Reset dismissed storage for easy testing */}
              <button
                type="button"
                onClick={handleClearDismissalHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-medium border border-white/10 transition-colors cursor-pointer"
                title="ব্রাউজারে নোটিশ কাটার হিস্ট্রি ক্লিয়ার করুন যাতে হোমপেজে রিলোড দিলে সাথে সাথে আবার দেখা যায়"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>টেস্ট হিস্ট্রি ক্লিয়ার</span>
              </button>

              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer ml-1">
                <input
                  type="checkbox"
                  checked={formData.popupEnabled}
                  onChange={(e) => updateField('popupEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
              </label>
            </div>
          </div>

          {resetDismissSuccess && (
            <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-yellow-400" />
              <span>টেস্ট হিস্ট্রি সফলভাবে ক্লিয়ার হয়েছে! এখন হোমপেজে গেলে বা রিফ্রেশ করলে সাথে সাথে পপ-আপ দেখতে পাবেন।</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Popup Title */}
            <div>
              <label className="block text-sm font-bold text-gray-200 mb-1.5">
                পপ-আপ টাইটেল (Modal Title)
              </label>
              <input
                type="text"
                value={formData.popupTitle}
                onChange={(e) => updateField('popupTitle', e.target.value)}
                placeholder="যেমন: 📢 জরুরি নোটিশ ও স্বাগতম!"
                className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                required={formData.popupEnabled}
              />
            </div>

            {/* Popup Message */}
            <div>
              <label className="block text-sm font-bold text-gray-200 mb-1.5">
                পপ-আপ বিস্তারিত বার্তা (Modal Notice Message)
              </label>
              <textarea
                rows={4}
                value={formData.popupMessage}
                onChange={(e) => updateField('popupMessage', e.target.value)}
                placeholder="ওয়েবসাইটে ভিজিট করার জন্য ধন্যবাদ। প্রতিদিন নতুন নতুন ভিডিও পেতে আমাদের টেলিগ্রাম চ্যানেলে যুক্ত থাকুন..."
                className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-3 text-sm text-white focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                required={formData.popupEnabled}
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter চেপে নতুন লাইন দিলে পপ-আপেও সুন্দরভাবে প্যারাগ্রাফ আকারে দেখাবে।
              </p>
            </div>

            {/* Optional Image */}
            <div>
              <label className="block text-sm font-bold text-gray-200 mb-1.5 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-yellow-400" />
                ছবি / ব্যানার ইমেজ লিংক (Optional Image URL)
              </label>
              <input
                type="url"
                value={formData.popupImageUrl || ''}
                onChange={(e) => updateField('popupImageUrl', e.target.value)}
                placeholder="https://example.com/banner.jpg"
                className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-yellow-500 focus:outline-none"
              />
            </div>

            {/* Action Button Label & Link */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-200 mb-1.5">
                  বাটন টেক্সট (Action Button Text)
                </label>
                <input
                  type="text"
                  value={formData.popupButtonText || ''}
                  onChange={(e) => updateField('popupButtonText', e.target.value)}
                  placeholder="টেলিগ্রাম চ্যানেলে জয়েন করুন"
                  className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-200 mb-1.5 flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-yellow-400" />
                  বাটন লিংক (Action Button URL)
                </label>
                <input
                  type="url"
                  value={formData.popupButtonLink || ''}
                  onChange={(e) => updateField('popupButtonLink', e.target.value)}
                  placeholder="https://t.me/firearenatournament"
                  className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-yellow-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Frequency Selector */}
            <div className="pt-2">
              <label className="block text-sm font-bold text-gray-200 mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-yellow-400" />
                কত ঘন ঘন পপ-আপ দেখাবে? (Show Frequency)
              </label>
              <select
                value={formData.popupFrequency}
                onChange={(e) => updateField('popupFrequency', e.target.value as any)}
                className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-yellow-500 focus:outline-none"
              >
                <option value="once_per_session">
                  প্রতি সেশনে একবার (একবার ক্রস দিয়ে কাটলে ওই ব্রাউজিং সেশনে আর ডিস্টার্ব করবে না) - রেকমেন্ডেড
                </option>
                <option value="every_visit">
                  প্রতিবার ভিজিটে (ওয়েবসাইটে যখনই ঢুকবে বা রিলোড দেবে তখনই পপ-আপ আসবে)
                </option>
                <option value="once_until_updated">
                  নোটিশ আপডেট না হওয়া পর্যন্ত একবার (একবার কাটলে আর কখনোই আসবে না, শুধু আপনি এডমিন প্যানেলে নতুন নোটিশ দিলে তখন সবার কাছে আবার আসবে)
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit Save Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black text-sm uppercase tracking-wider shadow-[0_4px_25px_rgba(220,38,38,0.35)] transition-all disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isLoading ? 'সংরক্ষণ হচ্ছে...' : 'Save All Notices'}</span>
          </button>
        </div>
      </form>

      {/* Admin Test Popup Modal */}
      {testModalOpen && (
        <WelcomeNoticeModal 
          forceOpen={true} 
          previewSettings={formData}
          onForceClose={() => setTestModalOpen(false)} 
        />
      )}
    </div>
  );
}
