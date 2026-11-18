import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useNoticeStore } from '../../store/noticeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { SiteNoticeSettings } from '../../types';
import { parseTelegramInput, executeTelegramJoin } from '../../lib/telegramUtils';
import { X, Megaphone, Send, CheckCircle2, Copy, Check, ExternalLink, Smartphone } from 'lucide-react';

interface WelcomeNoticeModalProps {
  forceOpen?: boolean; // For admin preview mode
  onForceClose?: () => void;
  previewSettings?: SiteNoticeSettings; // Live preview from admin form
}

export function WelcomeNoticeModal({ forceOpen, onForceClose, previewSettings }: WelcomeNoticeModalProps) {
  const { noticeSettings: storeSettings, fetchNoticeSettings } = useNoticeStore();
  const { settings } = useSettingsStore();
  const noticeSettings = previewSettings || storeSettings;
  const [isOpen, setIsOpen] = useState(false);
  const [isOpeningTelegram, setIsOpeningTelegram] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const location = useLocation();

  const telegramLinkInput = noticeSettings.popupButtonLink || settings?.telegramUrl || '';
  const telegramInfo = parseTelegramInput(telegramLinkInput);

  useEffect(() => {
    fetchNoticeSettings();

    // Listen for live notice updates across the app
    const handleNoticeUpdated = () => {
      fetchNoticeSettings(true);
    };
    window.addEventListener('site_notice_updated', handleNoticeUpdated);
    return () => {
      window.removeEventListener('site_notice_updated', handleNoticeUpdated);
    };
  }, [fetchNoticeSettings]);

  const evaluateVisibility = useCallback(() => {
    if (forceOpen !== undefined) {
      setIsOpen(forceOpen);
      return;
    }

    // Do not show automatic popup in admin panel
    if (location.pathname.startsWith('/admin')) {
      setIsOpen(false);
      return;
    }

    if (!noticeSettings.popupEnabled || !noticeSettings.popupMessage) {
      setIsOpen(false);
      return;
    }

    // Wait if adult warning modal is still pending user interaction
    const isAdultWarningAccepted = typeof window !== 'undefined' && localStorage.getItem('adult_warning_accepted');
    if (!isAdultWarningAccepted) {
      setIsOpen(false);
      return;
    }

    // Check storage frequency
    const storageKey = `site_popup_dismissed_${noticeSettings.popupVersion || 'v1'}`;

    if (noticeSettings.popupFrequency === 'every_visit') {
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    } else if (noticeSettings.popupFrequency === 'once_until_updated') {
      const dismissed = localStorage.getItem(storageKey);
      if (!dismissed) {
        const timer = setTimeout(() => setIsOpen(true), 600);
        return () => clearTimeout(timer);
      }
    } else {
      // Default: once_per_session (sessionStorage)
      const dismissed = sessionStorage.getItem(storageKey);
      if (!dismissed) {
        const timer = setTimeout(() => setIsOpen(true), 600);
        return () => clearTimeout(timer);
      }
    }
  }, [forceOpen, location.pathname, noticeSettings]);

  useEffect(() => {
    const cleanup = evaluateVisibility();

    // If adult warning modal gets accepted, re-evaluate
    const handleAdultAccepted = () => {
      setTimeout(() => {
        evaluateVisibility();
      }, 400);
    };
    window.addEventListener('adult_warning_accepted', handleAdultAccepted);

    return () => {
      if (typeof cleanup === 'function') cleanup();
      window.removeEventListener('adult_warning_accepted', handleAdultAccepted);
    };
  }, [evaluateVisibility]);

  // Prevent background page from scrolling while modal is open (enables smooth touch scrolling inside modal)
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow || 'auto';
      };
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    if (onForceClose) {
      onForceClose();
    }

    // Remember dismissal
    const storageKey = `site_popup_dismissed_${noticeSettings.popupVersion || 'v1'}`;
    try {
      if (noticeSettings.popupFrequency === 'once_until_updated') {
        localStorage.setItem(storageKey, 'true');
      } else {
        sessionStorage.setItem(storageKey, 'true');
      }
    } catch (e) {
      // Ignore storage errors
    }
  };

  const handleJoinTelegram = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsOpeningTelegram(true);

    executeTelegramJoin(telegramLinkInput, settings?.telegramUrl || '');

    // Dismiss modal smoothly after a short delay so navigation is not canceled by DOM unmount
    setTimeout(() => {
      handleClose();
      setIsOpeningTelegram(false);
    }, 900);
  };

  const handleCopyHandle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const textToCopy = telegramInfo?.displayHandle || '';
    if (!textToCopy) return;
    try {
      navigator.clipboard.writeText(textToCopy);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2500);
    } catch (err) {
      // Fallback
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-sm flex min-h-full items-center justify-center p-3 sm:p-4 text-center custom-scrollbar animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Modal Container: Compact, elegant, fully scrollable without lock */}
      <div 
        className="relative w-full max-w-[420px] my-auto bg-[#0c0d14] border border-red-500/35 rounded-2xl sm:rounded-3xl shadow-[0_0_60px_rgba(220,38,38,0.28)] text-left overflow-hidden z-10 flex flex-col max-h-[85vh] sm:max-h-[82vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Luminous Accent Line */}
        <div className="h-1 w-full bg-gradient-to-r from-red-600 via-rose-500 to-red-600 shrink-0 shadow-[0_0_12px_rgba(220,38,38,0.8)]" />

        {/* Modal Sticky Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-white/10 bg-[#12131d]/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-red-600/40 border border-white/10">
              <Megaphone className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-wider text-red-400">Official Notice</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight">
                {noticeSettings.popupTitle || 'জরুরি নোটিশ'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close notice"
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Notice Content Area */}
        <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar p-4 sm:p-5 space-y-3.5 select-text">
          {/* Optional Image */}
          {noticeSettings.popupImageUrl && (
            <div className="overflow-hidden rounded-xl border border-white/10 max-h-44 shadow-md">
              <img 
                src={noticeSettings.popupImageUrl} 
                alt="Notice banner" 
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Formatted Notice Message Box */}
          <div className="bg-[#181926] border border-white/5 rounded-xl p-3.5 sm:p-4 text-xs sm:text-sm text-gray-200 leading-relaxed font-normal whitespace-pre-line shadow-inner">
            {noticeSettings.popupMessage}
          </div>

          {/* Feature Badge / Telegram Benefit Tip */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200 text-xs leading-relaxed">
            <Send className="w-4 h-4 text-[#0088cc] shrink-0 mt-0.5 fill-current" />
            <span>
              ওয়েবসাইটে কোনো লিংক মিসিং বা ব্লক থাকলে আমাদের টেলিগ্রাম চ্যানেলে সরাসরি সব ভিডিও এবং ব্যাকআপ লিঙ্ক পাবেন।
            </span>
          </div>
        </div>

        {/* Modal Sticky Footer (Always Accessible) */}
        <div className="p-3.5 sm:p-4 border-t border-white/10 bg-[#101118] shrink-0 space-y-2.5">
          {/* Quick Copy Channel Username Bar */}
          {telegramInfo?.displayHandle && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/5 text-xs">
              <span className="text-gray-400 text-[11px] font-medium">অফিশিয়াল চ্যানেল:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sky-400 text-xs select-all">
                  {telegramInfo.displayHandle}
                </span>
                <button
                  type="button"
                  onClick={handleCopyHandle}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-gray-200 text-[11px] font-medium transition-colors cursor-pointer"
                  title="কপি করতে ক্লিক করুন"
                >
                  {hasCopied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">কপি হয়েছে</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-gray-300" />
                      <span>কপি</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons: 1. Join Telegram, 2. Beautiful Styled Close Button */}
          <div className={`grid grid-cols-1 ${telegramInfo ? 'sm:grid-cols-2' : ''} gap-2 pt-0.5`}>
            {/* 1. Primary Telegram Join Button */}
            {telegramInfo && (
              <a
                href={telegramInfo.mirrorWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleJoinTelegram}
                className="w-full rounded-xl bg-gradient-to-r from-[#0088cc] via-[#009ae6] to-[#00b0ff] hover:brightness-110 text-white py-2.5 sm:py-3 px-3.5 font-bold text-xs sm:text-sm tracking-wide shadow-md shadow-[#0088cc]/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isOpeningTelegram ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>ওপেন হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 fill-current" />
                    <span>{noticeSettings.popupButtonText || 'টেলিগ্রামে জয়েন'}</span>
                  </>
                )}
              </a>
            )}

            {/* 2. Beautiful Styled Dismiss / Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 hover:text-white border border-white/10 hover:border-white/25 py-2.5 sm:py-3 px-3.5 font-semibold text-xs sm:text-sm tracking-wide active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
              <span>নোটিশ বন্ধ করুন (Close)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
