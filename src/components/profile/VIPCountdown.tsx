import React, { useState, useEffect } from 'react';
import { Clock, Crown, Sparkles, AlertTriangle, ShieldCheck } from 'lucide-react';

interface VIPCountdownProps {
  expiresAt?: number | string | null;
  variant?: 'compact' | 'card' | 'detailed';
  showExpiryDate?: boolean;
}

export function VIPCountdown({ expiresAt, variant = 'compact', showExpiryDate = true }: VIPCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{ 
    days: number; 
    hours: number; 
    minutes: number; 
    seconds: number;
    isExpired: boolean;
    isLifetime: boolean;
  } | null>(null);

  // Safely parse timestamp whether it's a number, ISO string, or null
  const numericExpiry = React.useMemo(() => {
    if (!expiresAt) return null;
    if (typeof expiresAt === 'number') return expiresAt;
    const parsed = new Date(expiresAt).getTime();
    return isNaN(parsed) ? null : parsed;
  }, [expiresAt]);

  useEffect(() => {
    // If no expiration timestamp is set or timestamp is extremely far in future, it's lifetime VIP
    if (!numericExpiry || numericExpiry > 3000000000000) {
      setTimeLeft({
        days: 9999,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: false,
        isLifetime: true
      });
      return;
    }

    const calculateTimeLeft = () => {
      const difference = numericExpiry - Date.now();
      
      if (difference <= 0) {
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
          isLifetime: false
        });
        return;
      }

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isExpired: false,
        isLifetime: false
      });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [numericExpiry]);

  if (!timeLeft) return null;

  // 1. Lifetime VIP State
  if (timeLeft.isLifetime) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
        <Crown className="w-4 h-4 text-amber-400 drop-shadow" />
        <span className="text-xs sm:text-sm font-bold tracking-wide">
          আজীবন ভিআইপি সদস্য (Lifetime Access)
        </span>
      </div>
    );
  }

  // 2. Expired State
  if (timeLeft.isExpired) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-red-500/40 bg-red-950/40 text-red-300">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
        <span className="text-xs sm:text-sm font-bold">
          ভিআইপি মেয়াদ শেষ হয়েছে (Expired)
        </span>
      </div>
    );
  }

  // Formatted Expiry Date in Bengali
  const formattedExpiryDate = numericExpiry ? new Date(numericExpiry).toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }) : '';

  // 3. Compact View (e.g. Header profile badge)
  if (variant === 'compact') {
    return (
      <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/35 bg-gradient-to-r from-amber-950/40 via-yellow-950/20 to-black/60 px-3 py-1.5 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
        <div className="flex items-center gap-1.5 text-amber-400">
          <Clock className="h-3.5 w-3.5 animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400/90">মেয়াদ বাকি:</span>
        </div>
        
        <div className="flex items-center gap-1.5 font-mono text-xs sm:text-sm font-black text-amber-200">
          <span>{timeLeft.days} দিন</span>
          <span className="text-amber-500/60">·</span>
          <span>{String(timeLeft.hours).padStart(2, '0')} ঘ.</span>
          <span className="text-amber-500/60">·</span>
          <span>{String(timeLeft.minutes).padStart(2, '0')} মি.</span>
        </div>

        {showExpiryDate && formattedExpiryDate && (
          <span className="text-[10px] text-amber-400/70 border-l border-amber-500/30 pl-2 hidden sm:inline">
            শেষ: {formattedExpiryDate}
          </span>
        )}
      </div>
    );
  }

  // 4. Detailed / Card View (e.g. VIP Purchase / Upgrade tab)
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/35 bg-gradient-to-br from-[#1c1202] via-[#0d0901] to-[#140b02] p-4 sm:p-6 text-amber-300 shadow-[0_0_30px_rgba(245,158,11,0.18)]">
      {/* Top Luminous Gold Line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_10px_rgba(245,158,11,0.8)]" />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-amber-500/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
              VIP Time Countdown
            </span>
            <h4 className="text-sm sm:text-base font-bold text-white">
              আপনার প্রিমিয়াম মেয়াদ কাউন্টডাউন
            </h4>
          </div>
        </div>

        {formattedExpiryDate && (
          <div className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/25 px-3 py-1 rounded-full self-start sm:self-auto font-medium">
            📅 মেয়াদের শেষ তারিখ: <strong className="text-amber-200">{formattedExpiryDate}</strong>
          </div>
        )}
      </div>

      {/* Digits Block Grid (Bengali & English labels) */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 text-center">
        {/* Days */}
        <div className="rounded-xl border border-amber-500/30 bg-black/50 p-2 sm:p-3 shadow-inner">
          <div className="font-mono text-xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-100 to-amber-400">
            {String(timeLeft.days).padStart(2, '0')}
          </div>
          <div className="text-[10px] sm:text-xs font-bold text-amber-400 uppercase mt-0.5 tracking-wider">
            দিন (Days)
          </div>
        </div>

        {/* Hours */}
        <div className="rounded-xl border border-amber-500/30 bg-black/50 p-2 sm:p-3 shadow-inner">
          <div className="font-mono text-xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-100 to-amber-400">
            {String(timeLeft.hours).padStart(2, '0')}
          </div>
          <div className="text-[10px] sm:text-xs font-bold text-amber-400 uppercase mt-0.5 tracking-wider">
            ঘণ্টা (Hrs)
          </div>
        </div>

        {/* Minutes */}
        <div className="rounded-xl border border-amber-500/30 bg-black/50 p-2 sm:p-3 shadow-inner">
          <div className="font-mono text-xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-100 to-amber-400">
            {String(timeLeft.minutes).padStart(2, '0')}
          </div>
          <div className="text-[10px] sm:text-xs font-bold text-amber-400 uppercase mt-0.5 tracking-wider">
            মিনিট (Min)
          </div>
        </div>

        {/* Seconds */}
        <div className="rounded-xl border border-amber-500/30 bg-black/50 p-2 sm:p-3 shadow-inner">
          <div className="font-mono text-xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-100 to-amber-400">
            {String(timeLeft.seconds).padStart(2, '0')}
          </div>
          <div className="text-[10px] sm:text-xs font-bold text-amber-400 uppercase mt-0.5 tracking-wider">
            সেকেন্ড (Sec)
          </div>
        </div>
      </div>
    </div>
  );
}
