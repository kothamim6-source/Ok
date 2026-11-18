import React, { useEffect, useState } from 'react';
import { useNoticeStore } from '../../store/noticeStore';
import { getSafeTelegramWebUrl, parseTelegramInput, executeTelegramJoin } from '../../lib/telegramUtils';
import { 
  Megaphone, 
  ExternalLink, 
  Sparkles, 
  X, 
  Send, 
  FileText, 
  Play, 
  Pause, 
  Copy, 
  Check, 
  Radio, 
  Volume2, 
  Flame, 
  ArrowUpRight 
} from 'lucide-react';

interface MarqueeNoticeProps {
  className?: string;
}

export function MarqueeNotice({ className = '' }: MarqueeNoticeProps) {
  const { noticeSettings, fetchNoticeSettings } = useNoticeStore();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showFullModal, setShowFullModal] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  useEffect(() => {
    fetchNoticeSettings();
  }, [fetchNoticeSettings]);

  if (!noticeSettings.tickerEnabled || !noticeSettings.tickerText || isDismissed) {
    return null;
  }

  // Ultra-luxurious dark glassmorphic themes matching BD Viral platform
  const themeConfig: Record<string, {
    shellBg: string;
    shellBorder: string;
    shellShadow: string;
    topGlow: string;
    iconBg: string;
    iconColor: string;
    beaconColor: string;
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
    textColor: string;
    fadeLeft: string;
    fadeRight: string;
    accentBtnBg: string;
    accentBtnBorder: string;
    accentBtnText: string;
    accentBtnHover: string;
  }> = {
    red: {
      shellBg: 'bg-gradient-to-r from-[#140608]/95 via-[#1a080d]/90 to-[#120507]/95',
      shellBorder: 'border-red-500/35 hover:border-red-500/55',
      shellShadow: 'shadow-[0_4px_30px_rgba(220,38,38,0.2),inset_0_1px_1px_rgba(255,255,255,0.08)]',
      topGlow: 'from-transparent via-red-500/80 to-transparent',
      iconBg: 'bg-gradient-to-br from-red-500 via-rose-600 to-red-700 shadow-[0_0_16px_rgba(239,68,68,0.6)]',
      iconColor: 'text-white',
      beaconColor: 'bg-red-400',
      badgeBg: 'bg-red-950/80',
      badgeBorder: 'border-red-500/40',
      badgeText: 'text-red-200',
      textColor: 'text-gray-100',
      fadeLeft: 'from-[#140608]',
      fadeRight: 'from-[#120507]',
      accentBtnBg: 'bg-red-600/20',
      accentBtnBorder: 'border-red-500/40',
      accentBtnText: 'text-red-300',
      accentBtnHover: 'hover:bg-red-600/35 hover:text-white hover:border-red-400'
    },
    'dark-red': {
      shellBg: 'bg-gradient-to-r from-[#0d0203]/95 via-[#160407]/90 to-[#0a0203]/95',
      shellBorder: 'border-rose-600/30 hover:border-rose-500/50',
      shellShadow: 'shadow-[0_4px_25px_rgba(225,29,72,0.18),inset_0_1px_1px_rgba(255,255,255,0.06)]',
      topGlow: 'from-transparent via-rose-500/70 to-transparent',
      iconBg: 'bg-gradient-to-br from-rose-600 via-red-700 to-rose-800 shadow-[0_0_14px_rgba(225,29,72,0.5)]',
      iconColor: 'text-white',
      beaconColor: 'bg-rose-400',
      badgeBg: 'bg-rose-950/80',
      badgeBorder: 'border-rose-500/40',
      badgeText: 'text-rose-200',
      textColor: 'text-gray-100',
      fadeLeft: 'from-[#0d0203]',
      fadeRight: 'from-[#0a0203]',
      accentBtnBg: 'bg-rose-600/20',
      accentBtnBorder: 'border-rose-500/40',
      accentBtnText: 'text-rose-300',
      accentBtnHover: 'hover:bg-rose-600/35 hover:text-white'
    },
    orange: {
      shellBg: 'bg-gradient-to-r from-[#180a03]/95 via-[#230f05]/90 to-[#140803]/95',
      shellBorder: 'border-orange-500/35 hover:border-orange-500/55',
      shellShadow: 'shadow-[0_4px_25px_rgba(249,115,22,0.2),inset_0_1px_1px_rgba(255,255,255,0.08)]',
      topGlow: 'from-transparent via-orange-500/80 to-transparent',
      iconBg: 'bg-gradient-to-br from-orange-500 via-amber-600 to-orange-700 shadow-[0_0_16px_rgba(249,115,22,0.6)]',
      iconColor: 'text-white',
      beaconColor: 'bg-orange-400',
      badgeBg: 'bg-orange-950/80',
      badgeBorder: 'border-orange-500/40',
      badgeText: 'text-orange-200',
      textColor: 'text-gray-100',
      fadeLeft: 'from-[#180a03]',
      fadeRight: 'from-[#140803]',
      accentBtnBg: 'bg-orange-600/20',
      accentBtnBorder: 'border-orange-500/40',
      accentBtnText: 'text-orange-300',
      accentBtnHover: 'hover:bg-orange-600/35 hover:text-white'
    },
    amber: {
      shellBg: 'bg-gradient-to-r from-[#171103]/95 via-[#241a04]/90 to-[#140f03]/95',
      shellBorder: 'border-amber-500/35 hover:border-amber-500/55',
      shellShadow: 'shadow-[0_4px_25px_rgba(245,158,11,0.2),inset_0_1px_1px_rgba(255,255,255,0.08)]',
      topGlow: 'from-transparent via-amber-400/80 to-transparent',
      iconBg: 'bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 shadow-[0_0_16px_rgba(245,158,11,0.6)]',
      iconColor: 'text-black',
      beaconColor: 'bg-amber-400',
      badgeBg: 'bg-amber-950/80',
      badgeBorder: 'border-amber-500/40',
      badgeText: 'text-amber-200',
      textColor: 'text-gray-100',
      fadeLeft: 'from-[#171103]',
      fadeRight: 'from-[#140f03]',
      accentBtnBg: 'bg-amber-500/20',
      accentBtnBorder: 'border-amber-500/40',
      accentBtnText: 'text-amber-300',
      accentBtnHover: 'hover:bg-amber-500/35 hover:text-white'
    },
    purple: {
      shellBg: 'bg-gradient-to-r from-[#120619]/95 via-[#1b0a26]/90 to-[#100516]/95',
      shellBorder: 'border-purple-500/35 hover:border-purple-500/55',
      shellShadow: 'shadow-[0_4px_25px_rgba(168,85,247,0.2),inset_0_1px_1px_rgba(255,255,255,0.08)]',
      topGlow: 'from-transparent via-purple-500/80 to-transparent',
      iconBg: 'bg-gradient-to-br from-purple-500 via-fuchsia-600 to-purple-700 shadow-[0_0_16px_rgba(168,85,247,0.6)]',
      iconColor: 'text-white',
      beaconColor: 'bg-purple-400',
      badgeBg: 'bg-purple-950/80',
      badgeBorder: 'border-purple-500/40',
      badgeText: 'text-purple-200',
      textColor: 'text-gray-100',
      fadeLeft: 'from-[#120619]',
      fadeRight: 'from-[#100516]',
      accentBtnBg: 'bg-purple-600/20',
      accentBtnBorder: 'border-purple-500/40',
      accentBtnText: 'text-purple-300',
      accentBtnHover: 'hover:bg-purple-600/35 hover:text-white'
    },
    blue: {
      shellBg: 'bg-gradient-to-r from-[#051020]/95 via-[#081a33]/90 to-[#040e1c]/95',
      shellBorder: 'border-blue-500/35 hover:border-blue-500/55',
      shellShadow: 'shadow-[0_4px_25px_rgba(59,130,246,0.2),inset_0_1px_1px_rgba(255,255,255,0.08)]',
      topGlow: 'from-transparent via-blue-500/80 to-transparent',
      iconBg: 'bg-gradient-to-br from-blue-500 via-sky-600 to-blue-700 shadow-[0_0_16px_rgba(59,130,246,0.6)]',
      iconColor: 'text-white',
      beaconColor: 'bg-blue-400',
      badgeBg: 'bg-blue-950/80',
      badgeBorder: 'border-blue-500/40',
      badgeText: 'text-blue-200',
      textColor: 'text-gray-100',
      fadeLeft: 'from-[#051020]',
      fadeRight: 'from-[#040e1c]',
      accentBtnBg: 'bg-blue-600/20',
      accentBtnBorder: 'border-blue-500/40',
      accentBtnText: 'text-blue-300',
      accentBtnHover: 'hover:bg-blue-600/35 hover:text-white'
    },
    emerald: {
      shellBg: 'bg-gradient-to-r from-[#03140e]/95 via-[#052217]/90 to-[#02100b]/95',
      shellBorder: 'border-emerald-500/35 hover:border-emerald-500/55',
      shellShadow: 'shadow-[0_4px_25px_rgba(16,185,129,0.2),inset_0_1px_1px_rgba(255,255,255,0.08)]',
      topGlow: 'from-transparent via-emerald-500/80 to-transparent',
      iconBg: 'bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 shadow-[0_0_16px_rgba(16,185,129,0.6)]',
      iconColor: 'text-white',
      beaconColor: 'bg-emerald-400',
      badgeBg: 'bg-emerald-950/80',
      badgeBorder: 'border-emerald-500/40',
      badgeText: 'text-emerald-200',
      textColor: 'text-gray-100',
      fadeLeft: 'from-[#03140e]',
      fadeRight: 'from-[#02100b]',
      accentBtnBg: 'bg-emerald-600/20',
      accentBtnBorder: 'border-emerald-500/40',
      accentBtnText: 'text-emerald-300',
      accentBtnHover: 'hover:bg-emerald-600/35 hover:text-white'
    }
  };

  const themeKey = noticeSettings.tickerTheme || 'red';
  const theme = themeConfig[themeKey] || themeConfig.red;

  const speedClass = 
    noticeSettings.tickerSpeed === 'slow' 
      ? 'animate-marquee-slow' 
      : noticeSettings.tickerSpeed === 'fast' 
        ? 'animate-marquee-fast' 
        : 'animate-marquee-normal';

  const safeLink = noticeSettings.tickerLink ? getSafeTelegramWebUrl(noticeSettings.tickerLink) : undefined;
  const telegramMeta = safeLink ? parseTelegramInput(noticeSettings.tickerLink) : null;

  const handleCopyText = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(noticeSettings.tickerText);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {}
  };

  return (
    <>
      {/* 1. Main Home Marquee Notice Banner */}
      <div 
        className={`group-marquee relative flex items-center w-full overflow-hidden rounded-2xl p-2 sm:p-2.5 border ${theme.shellBg} ${theme.shellShadow} ${theme.shellBorder} backdrop-blur-xl transition-all duration-300 select-none ${className}`}
      >
        {/* Luminous Top Accent Line */}
        <div className={`absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r ${theme.topGlow} pointer-events-none opacity-80`} />

        {/* Ambient Subtle Background Shimmer Bar */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent pointer-events-none" />

        {/* Left Badge: Glowing Live Radar Icon + Refined Tag */}
        <div 
          onClick={() => setShowFullModal(true)}
          className="flex items-center gap-2 shrink-0 z-20 cursor-pointer active:scale-95 transition-transform"
          title="সম্পূর্ণ নোটিশ পড়তে ক্লিক করুন"
        >
          {/* Luminous Icon Box with Radar Beacon */}
          <div className="relative flex items-center justify-center">
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${theme.iconBg} ${theme.iconColor} flex items-center justify-center shrink-0 border border-white/20 transition-transform group-hover:scale-105`}>
              <Flame className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-current" />
            </div>

            {/* Live Ping Beacon */}
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 pointer-events-none">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${theme.beaconColor} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${theme.beaconColor} border border-black/40`} />
            </span>
          </div>

          {/* Badge Label Pill */}
          <div className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 border shadow-inner ${theme.badgeBg} ${theme.badgeBorder} ${theme.badgeText}`}>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span>{noticeSettings.tickerBadgeText || 'জরুরি নোটিশ'}</span>
          </div>

          {/* Hairline Divider */}
          <div className="h-5 w-[1px] bg-gradient-to-b from-transparent via-white/20 to-transparent mx-1 hidden xs:block" />
        </div>

        {/* Center: Infinite Seamless Smooth Scrolling Ticker with Fade Masks */}
        <div 
          className="relative flex-1 overflow-hidden py-0.5 cursor-pointer"
          onClick={() => setShowFullModal(true)}
          title="ক্লিক করে সম্পূর্ণ নোটিশ পড়ুন"
        >
          {/* Left Fade Mask */}
          <div className={`pointer-events-none absolute left-0 top-0 bottom-0 w-6 sm:w-10 bg-gradient-to-r ${theme.fadeLeft} to-transparent z-10`} />

          {/* Right Fade Mask */}
          <div className={`pointer-events-none absolute right-0 top-0 bottom-0 w-6 sm:w-10 bg-gradient-to-l ${theme.fadeRight} to-transparent z-10`} />

          <div 
            className={`flex w-max ${speedClass} ${isPaused ? '[animation-play-state:paused]' : 'hover:[animation-play-state:paused]'}`}
          >
            {/* First Loop Text Block */}
            <div className="flex items-center gap-6 pr-10">
              <span className={`text-xs sm:text-sm md:text-[14px] font-semibold ${theme.textColor} tracking-wide drop-shadow-sm whitespace-nowrap flex items-center gap-2.5`}>
                <span>{noticeSettings.tickerText}</span>
              </span>
              <span className="text-red-400/80 font-black text-xs select-none drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">✦</span>
            </div>

            {/* Second Identical Loop Block for Seamless 100% Scroll */}
            <div className="flex items-center gap-6 pr-10">
              <span className={`text-xs sm:text-sm md:text-[14px] font-semibold ${theme.textColor} tracking-wide drop-shadow-sm whitespace-nowrap flex items-center gap-2.5`}>
                <span>{noticeSettings.tickerText}</span>
              </span>
              <span className="text-red-400/80 font-black text-xs select-none drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">✦</span>
            </div>
          </div>
        </div>

        {/* Right Actions: Direct Link Pill + Full Reader Trigger + Dismiss */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 z-20 ml-2">
          {/* Optional Direct Link Button (e.g. Telegram or Website Link) */}
          {safeLink && (
            <a
              href={safeLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                if (telegramMeta) {
                  e.preventDefault();
                  executeTelegramJoin(noticeSettings.tickerLink);
                }
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold border transition-all active:scale-95 shadow-sm ${theme.accentBtnBg} ${theme.accentBtnBorder} ${theme.accentBtnText} ${theme.accentBtnHover}`}
              title={telegramMeta ? 'টেলিগ্রাম চ্যানেলে জয়েন করুন' : 'লিংক ওপেন করুন'}
            >
              {telegramMeta ? (
                <>
                  <Send className="w-3 h-3 fill-current" />
                  <span className="hidden sm:inline">টেলিগ্রাম</span>
                </>
              ) : (
                <>
                  <span>দেখুন</span>
                  <ArrowUpRight className="w-3 h-3" />
                </>
              )}
            </a>
          )}

          {/* Expand / Read Full Notice Trigger */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowFullModal(true);
            }}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="সম্পূর্ণ নোটিশ পড়তে ক্লিক করুন"
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Dismiss Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDismissed(true);
            }}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
            title="নোটিশ লুকান"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {/* 2. Interactive Full Notice Reader Modal (Ultra-Modern Popup) */}
      {showFullModal && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowFullModal(false)}
        >
          <div 
            className="relative w-full max-w-lg overflow-hidden rounded-2xl sm:rounded-3xl bg-[#0c0d14] border border-red-500/30 shadow-[0_0_60px_rgba(220,38,38,0.25)] p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Glowing Header Accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-rose-500 to-red-600" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-red-600/40">
                  <Flame className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-red-400">
                      Official Notice
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {noticeSettings.tickerBadgeText || 'জরুরি সাইট নোটিশ'}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowFullModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Full Message Body */}
            <div className="bg-[#13141f] border border-white/5 rounded-2xl p-4 sm:p-5 text-sm sm:text-base text-gray-200 leading-relaxed font-normal whitespace-pre-line shadow-inner max-h-[60vh] overflow-y-auto custom-scrollbar select-text">
              {noticeSettings.tickerText}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              {/* Copy Notice Button */}
              <button
                type="button"
                onClick={handleCopyText}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {hasCopied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">কপি করা হয়েছে</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-gray-400" />
                    <span>টেক্সট কপি করুন</span>
                  </>
                )}
              </button>

              {/* Telegram or External Link Button */}
              {safeLink && (
                <a
                  href={safeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (telegramMeta) {
                      e.preventDefault();
                      setShowFullModal(false);
                      executeTelegramJoin(noticeSettings.tickerLink);
                    }
                  }}
                  className="w-full sm:flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:brightness-110 text-white text-xs sm:text-sm font-bold tracking-wide shadow-md shadow-red-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4 fill-current" />
                  <span>{telegramMeta ? 'অফিশিয়াল টেলিগ্রামে জয়েন করুন' : 'লিংক ওপেন করুন'}</span>
                </a>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowFullModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
