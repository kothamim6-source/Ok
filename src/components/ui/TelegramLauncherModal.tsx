import { useState, useEffect } from 'react';
import { Send, Copy, Check, X, Smartphone, Globe, ShieldCheck, Compass } from 'lucide-react';
import { parseTelegramInput, TelegramLinkInfo } from '../../lib/telegramUtils';

export function TelegramLauncherModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [telegramInfo, setTelegramInfo] = useState<TelegramLinkInfo | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [appAttempted, setAppAttempted] = useState(false);

  useEffect(() => {
    const handleOpen = (e: CustomEvent<{ input?: string }>) => {
      const raw = (e.detail?.input || '').trim();
      if (!raw) return;
      const parsed = parseTelegramInput(raw);
      if (!parsed) return;
      setTelegramInfo(parsed);
      setIsOpen(true);
      setHasCopied(false);
      setAppAttempted(false);
    };

    window.addEventListener('open_telegram_launcher' as any, handleOpen as any);
    return () => {
      window.removeEventListener('open_telegram_launcher' as any, handleOpen as any);
    };
  }, []);

  if (!isOpen || !telegramInfo) return null;

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(telegramInfo.displayHandle);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2500);
    } catch (err) {}
  };

  const handleOpenApp = () => {
    setAppAttempted(true);

    // 1. Auto-copy handle for convenience
    try {
      navigator.clipboard.writeText(telegramInfo.displayHandle);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 3000);
    } catch (err) {}

    // 2. Safely attempt to trigger Telegram app via an isolated invisible iframe.
    // In Android WebViews, top-level navigation to tg: causes net::ERR_UNKNOWN_URL_SCHEME,
    // whereas an iframe isolates the scheme trigger without replacing the webview page with an error.
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';
      iframe.src = telegramInfo.appUrl;
      document.body.appendChild(iframe);

      setTimeout(() => {
        try {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        } catch (e) {}
      }, 1500);
    } catch (e) {
      // Ignored
    }
  };

  const handleOpenWeb = () => {
    // Pure HTTPS web client - 100% immune to ERR_UNKNOWN_URL_SCHEME in WebViews
    try {
      const win = window.open(telegramInfo.webClientUrl, '_blank', 'noopener,noreferrer');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        window.location.href = telegramInfo.webClientUrl;
      }
    } catch (e) {
      window.location.href = telegramInfo.webClientUrl;
    }
  };

  const handleOpenBrowser = () => {
    // Attempt opening in system external browser (Chrome) using _system target (standard in Web2App / Cordova / Capacitor)
    try {
      window.open(telegramInfo.mirrorWebUrl, '_system');
    } catch (e) {
      window.open(telegramInfo.mirrorWebUrl, '_blank');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
    >
      <div className="relative w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#161a29] via-[#0f121d] to-[#0a0c14] border border-sky-500/30 p-5 shadow-[0_10px_50px_rgba(0,136,204,0.35)] text-center text-white">
        
        {/* Close Button */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Telegram Glowing Icon */}
        <div className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0088cc] via-[#009ae6] to-[#00b0ff] shadow-[0_0_25px_rgba(0,136,204,0.7)]">
          <Send className="h-7 w-7 text-white fill-current translate-x-[-1px] translate-y-[-1px]" />
          <div className="absolute -inset-1 rounded-2xl border border-sky-400/40 animate-pulse pointer-events-none" />
        </div>

        <h3 className="text-lg font-black tracking-wide text-white mb-1">
          টেলিগ্রাম চ্যানেল / গ্রুপ
        </h3>
        <p className="text-xs text-gray-400 mb-3 px-2 leading-relaxed">
          ওয়েব অ্যাপ অথবা ব্রাউজার থেকে সরাসরি যুক্ত হতে নিচের যেকোনো একটি অপশন ব্যবহার করুন:
        </p>

        {/* Handle Display Box with 1-Click Copy */}
        <div className="mb-3.5 flex items-center justify-between rounded-xl bg-black/60 border border-sky-500/30 p-2.5 shadow-inner">
          <div className="text-left pl-1 overflow-hidden">
            <span className="block text-[10px] uppercase font-bold text-gray-400">টেলিগ্রাম ইউজারনেম</span>
            <span className="font-mono text-sm font-bold text-sky-400 tracking-wide select-all truncate block">
              {telegramInfo.displayHandle}
            </span>
          </div>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer ${
              hasCopied 
                ? 'bg-emerald-600 text-white' 
                : 'bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 border border-sky-500/40'
            }`}
          >
            {hasCopied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>কপি হয়েছে!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>কপি করুন</span>
              </>
            )}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {/* Button 1: Safe Open in Native Telegram App */}
          <button
            onClick={handleOpenApp}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#0088cc] via-[#009ae6] to-[#00b0ff] hover:brightness-110 font-bold text-sm tracking-wide text-white shadow-lg shadow-[#0088cc]/30 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            <span>টেলিগ্রাম অ্যাপে ওপেন করুন</span>
          </button>

          {/* Button 2: Open in Telegram Web (Safe HTTPS) */}
          <button
            onClick={handleOpenWeb}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 hover:text-white font-semibold text-xs tracking-wide transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span>টেলিগ্রাম ওয়েব (Telegram Web এ দেখুন)</span>
          </button>

          {/* Button 3: Open in External Browser */}
          <button
            onClick={handleOpenBrowser}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-white/[0.02] hover:bg-white/5 border border-white/5 text-gray-400 hover:text-gray-200 text-xs transition-colors cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>Chrome বা বাইরের ব্রাউজারে খুলুন</span>
          </button>
        </div>

        {/* Helpful Tip */}
        <div className="mt-3 flex items-start text-left gap-2 text-[11px] text-gray-300 bg-white/[0.03] p-2.5 rounded-xl border border-white/5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-white font-medium">সহজ উপায়: </strong> 
            উপরে <b>"কপি করুন"</b> বাটনে চাপ দিয়ে ইউজারনেম কপি করে নিন, তারপর আপনার ফোনের Telegram অ্যাপে গিয়ে সার্চ বক্সে পেস্ট করলেই সাথে সাথে চ্যানেল/গ্রুপ পেয়ে যাবেন।
          </p>
        </div>

        {appAttempted && (
          <p className="mt-2 text-[11px] text-sky-300/80 animate-in fade-in">
            টেলিগ্রাম অ্যাপ না খুললে ইউজারনেম কপি করে সরাসরি টেলিগ্রামে সার্চ করুন।
          </p>
        )}
      </div>
    </div>
  );
}
