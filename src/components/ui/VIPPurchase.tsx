import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle, 
  Copy, 
  Check, 
  Clock, 
  Crown, 
  Sparkles, 
  Shield, 
  Zap, 
  PlayCircle, 
  Send, 
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { supabase } from '../../lib/supabase';
import { VIPCountdown } from '../profile/VIPCountdown';
import { parseTelegramInput, executeTelegramJoin } from '../../lib/telegramUtils';

export function VIPPurchase() {
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();
  const [paymentMethod, setPaymentMethod] = useState<'bKash' | 'Nagad' | 'Rocket'>('bKash');
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [transactionId, setTransactionId] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error' | 'pending_exist'>('idle');
  const [submitErrorText, setSubmitErrorText] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<any | null>(null);
  const [showRechargeForm, setShowRechargeForm] = useState(false);

  // VIP Subscription packages (defaults to trial ৳20 as shown in screenshots)
  const packages = useMemo(() => {
    return settings?.vipSettings?.packages || [
      { id: 'pkg-1', name: '১ দিনের ট্রায়াল', price: 20, durationDays: 1 },
      { id: 'pkg-2', name: '৭ দিনের উইকলি পাস', price: 70, durationDays: 7 },
      { id: 'pkg-3', name: '৩০ দিনের ভিআইপি মান্থলি', price: 150, durationDays: 30 },
      { id: 'pkg-4', name: 'আজীবন ভিআইপি মেম্বারশিপ', price: 500, durationDays: 365 }
    ];
  }, [settings?.vipSettings?.packages]);
  
  const defaultPackage = packages.length > 0 
    ? packages.find(p => p.id === selectedPackageId) || packages[0] 
    : null;

  const paymentDetails = {
    amount: defaultPackage ? defaultPackage.price : 20,
    durationDays: defaultPackage ? defaultPackage.durationDays : 1,
    durationText: defaultPackage ? `${defaultPackage.durationDays} দিন` : '১ দিন',
    accounts: {
      bKash: settings?.vipSettings?.bkash || '',
      Nagad: settings?.vipSettings?.nagad || '',
      Rocket: settings?.vipSettings?.rocket || ''
    },
    features: [
      { icon: PlayCircle, title: '১০০% বিজ্ঞাপনমুক্ত স্ট্রিমিং', desc: 'কোনো বিজ্ঞাপন বা পপআপ ছাড়াই নিশ্চিন্তে সব ভিডিও উপভোগ করুন।' },
      { icon: Crown, title: 'এক্সক্লুসিভ ভিআইপি কন্টেন্ট', desc: 'লক করা সমস্ত প্রিমিয়াম ও ভাইরাল ভিডিও সরাসরি দেখার সুযোগ।' },
      { icon: Zap, title: 'আনলিমিটেড হাই-স্পিড ডাউনলোড', desc: 'এক ক্লিকে আপনার পছন্দের ভিডিও ডাউনলোড করুন সর্বোচ্চ গতিতে।' },
      { icon: Shield, title: 'গোল্ডেন ভিআইপি ব্যাজ', desc: 'আপনার প্রোফাইলে সম্মানিত গোল্ডেন ক্রাউন ব্যাজ যুক্ত হবে।' }
    ]
  };

  // Set default package on mount
  useEffect(() => {
    if (packages.length > 0 && !selectedPackageId) {
      setSelectedPackageId(packages[0].id);
    }
  }, [packages, selectedPackageId]);

  // Check for any pending VIP request for this user and auto-sync when approved
  useEffect(() => {
    let intervalId: any = null;

    async function checkPendingRequest() {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from('vip_requests')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          setPendingRequest(data[0]);
        } else {
          // If request was approved, refresh user state in authStore
          setPendingRequest(null);
          const { data: updatedDoc } = await supabase.from('users').select('*').eq('id', user.id).single();
          if (updatedDoc && updatedDoc.is_vip) {
            const isVIPExpired = updatedDoc.is_vip && updatedDoc.vip_expires_at && updatedDoc.vip_expires_at < Date.now();
            useAuthStore.getState().setUser({
              ...user,
              ...updatedDoc,
              isVIP: !isVIPExpired && Boolean(updatedDoc.is_vip),
              vipExpiresAt: isVIPExpired ? null : updatedDoc.vip_expires_at
            } as any);
          }
        }
      } catch (e) {
        console.error('Error checking pending VIP request:', e);
      }
    }

    checkPendingRequest();
    intervalId = setInterval(checkPendingRequest, 5000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user?.id, submitStatus]);

  const [isQuickApproving, setIsQuickApproving] = useState(false);

  const handleAdminQuickApprove = async (req: any) => {
    if (!req || !user?.id) return;
    setIsQuickApproving(true);
    try {
      const grantDays = req.amount === 20 ? 1 : req.amount === 70 ? 7 : req.amount >= 500 ? 365 : 30;
      const now = Date.now();
      const currentExpiry = user.vipExpiresAt && user.vipExpiresAt > now ? user.vipExpiresAt : now;
      const newExpiry = currentExpiry + (grantDays * 24 * 60 * 60 * 1000);

      const { error: userError } = await supabase.from('users').update({
        is_vip: true,
        vip_expires_at: newExpiry
      }).eq('id', req.user_id);

      if (userError) throw userError;

      await supabase.from('vip_requests').update({ status: 'approved' }).eq('id', req.id);

      useAuthStore.getState().setUser({
        ...user,
        isVIP: true,
        vipExpiresAt: newExpiry
      } as any);

      setPendingRequest(null);
      setSubmitStatus('idle');
    } catch (e) {
      console.error('Error approving recharge:', e);
    } finally {
      setIsQuickApproving(false);
    }
  };

  const handleCopy = (text: string) => {
    if (!text || text === 'সেট করা হয়নি') return;
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('পেমেন্ট ভেরিফাই করতে দয়া করে প্রথমে আপনার অ্যাকাউন্টে লগইন করুন।');
      return;
    }
    if (!transactionId.trim()) {
      alert('দয়া করে সঠিক ট্রানজেকশন আইডি লিখুন।');
      return;
    }
    
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setSubmitErrorText('');
    try {
      const id = crypto.randomUUID();
      const cleanTrx = transactionId.trim().toUpperCase();
      const numAmount = Number(paymentDetails.amount) || 20;

      // Ensure user row exists in 'users' table
      try {
        await supabase.from('users').upsert([{
          id: user.id,
          name: user.name || 'User',
          email: user.email || '',
          role: user.role || 'user',
          status: 'active',
          created_at: Date.now()
        }], { onConflict: 'id', ignoreDuplicates: true });
      } catch (upsertErr) {
        console.warn('User upsert check warning:', upsertErr);
      }

      // Insert into 'vip_requests'
      const { error } = await supabase.from('vip_requests').insert([{
        id,
        user_id: user.id,
        user_name: user.name || 'User',
        user_email: user.email || '',
        payment_method: paymentMethod,
        transaction_id: cleanTrx,
        amount: numAmount,
        status: 'pending',
        created_at: Date.now()
      }]);
      
      if (error) throw error;

      setSubmitStatus('success');
      setTransactionId('');
      setPendingRequest({
        id,
        user_id: user.id,
        payment_method: paymentMethod,
        transaction_id: cleanTrx,
        amount: numAmount,
        status: 'pending',
        created_at: Date.now()
      });
    } catch (error: any) {
      console.error("Error submitting VIP request:", error);
      if (error?.message?.includes('duplicate key') || error?.code === '23505') {
        setSubmitStatus('pending_exist');
      } else {
        setSubmitStatus('error');
        setSubmitErrorText(error?.message || '');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const telegramInfo = parseTelegramInput(settings?.supportLinks?.telegram || settings?.telegramUrl || '');

  // Dynamic method config with logo links configured from Admin panel
  const methodConfigs = {
    bKash: {
      name: 'bKash',
      nameBn: 'বিকাশ',
      dialCode: '**247##',
      themeColor: '#e2136e', // bKash Pink
      btnColor: '#df6e79',
      accountNumber: paymentDetails.accounts.bKash,
      logoUrl: settings?.vipSettings?.bkashLogo || '',
      fallbackText: 'bKash',
      fallbackTextColor: '#e2136e'
    },
    Nagad: {
      name: 'Nagad',
      nameBn: 'নগদ',
      dialCode: '**167##',
      themeColor: '#e52b2b', // Nagad Red
      btnColor: '#df6e79',
      accountNumber: paymentDetails.accounts.Nagad,
      logoUrl: settings?.vipSettings?.nagadLogo || '',
      fallbackText: 'নগদ',
      fallbackTextColor: '#e52b2b'
    },
    Rocket: {
      name: 'Rocket',
      nameBn: 'রকেট',
      dialCode: '**322##',
      themeColor: '#8c1488', // Rocket Purple
      btnColor: '#df6e79',
      accountNumber: paymentDetails.accounts.Rocket,
      logoUrl: settings?.vipSettings?.rocketLogo || '',
      fallbackText: 'রকেট',
      fallbackTextColor: '#8c1488'
    }
  };

  const activeMethod = methodConfigs[paymentMethod];

  // The Exact Payment UI Component (Identical to Screenshots)
  const renderNativePaymentSystem = () => (
    <div className="w-full max-w-md mx-auto space-y-3.5 select-none animate-in fade-in duration-200">
      
      {/* 1. Payment Method Switcher Tabs */}
      <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-md">
        {(['bKash', 'Nagad', 'Rocket'] as const).map((method) => {
          const isActive = paymentMethod === method;
          return (
            <button
              key={method}
              type="button"
              onClick={() => {
                setPaymentMethod(method);
                setSubmitStatus('idle');
              }}
              className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isActive 
                  ? method === 'bKash'
                    ? 'bg-[#e2136e] text-white shadow-lg shadow-[#e2136e]/40'
                    : method === 'Nagad'
                    ? 'bg-[#e52b2b] text-white shadow-lg shadow-[#e52b2b]/40'
                    : 'bg-[#8c1488] text-white shadow-lg shadow-[#8c1488]/40'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{method}</span>
            </button>
          );
        })}
      </div>

      {/* Package Selector Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
        {packages.map((pkg) => {
          const isSelected = selectedPackageId === pkg.id;
          return (
            <button
              key={pkg.id}
              type="button"
              onClick={() => setSelectedPackageId(pkg.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                isSelected 
                  ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/30' 
                  : 'bg-white/5 text-zinc-300 border-white/10 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              {pkg.name} (৳{pkg.price})
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        
        {/* 2. Top Box: Brand Logo from Admin URL or Clean Text Fallback */}
        <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-center min-h-[76px] transition-all">
          {activeMethod.logoUrl ? (
            <img 
              src={activeMethod.logoUrl} 
              alt={activeMethod.name} 
              className="max-h-12 max-w-[220px] object-contain drop-shadow-sm"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
                const fallback = (e.target as HTMLElement).parentElement?.querySelector('.logo-fallback-text');
                if (fallback) fallback.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`logo-fallback-text ${activeMethod.logoUrl ? 'hidden' : 'flex'} items-center justify-center`}>
            <span 
              className="text-3xl sm:text-4xl font-black tracking-tight"
              style={{ color: activeMethod.fallbackTextColor }}
            >
              {activeMethod.fallbackText}
            </span>
          </div>
        </div>

        {/* 3. Middle Box: Amount (Exact match to screenshot) */}
        <div className="bg-white rounded-2xl px-6 py-4 shadow-sm flex items-center justify-between transition-all">
          <div className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-1 font-sans">
            <span>৳</span>
            <span>{paymentDetails.amount}</span>
          </div>
          {defaultPackage && (
            <span className="text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
              {defaultPackage.name}
            </span>
          )}
        </div>

        {/* 4. Bottom Main Payment Card (Exact match to screenshots for bKash, Nagad, Rocket) */}
        <div 
          className="rounded-3xl p-6 sm:p-7 text-white space-y-4 shadow-xl transition-all duration-300 relative overflow-hidden"
          style={{ backgroundColor: activeMethod.themeColor }}
        >
          {/* Card Title */}
          <h3 className="text-center font-bold text-lg sm:text-xl text-white tracking-wide">
            ট্রানজেকশন আইডি দিন
          </h3>

          {/* White Centered Input Box */}
          <div>
            <input
              type="text"
              required
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="ট্রানজেকশন আইডি দিন"
              className="w-full rounded-xl bg-white py-3.5 px-4 text-center text-gray-900 placeholder-gray-400 font-bold text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-white/80 uppercase shadow-inner"
            />
          </div>

          {/* Bulleted Instructions List */}
          <div className="space-y-2 text-sm sm:text-[15px] font-medium leading-relaxed pt-1">
            <p>
              • <span className="font-bold">{activeMethod.dialCode}</span> ডায়াল করে আপনার {activeMethod.name} মোবাইল মেনুতে যান অথবা {activeMethod.name} অ্যাপ খুলুন।
            </p>
            <p>
              • <span className="font-bold">Send Money</span> -এ ক্লিক করুন।
            </p>

            {/* Target Account Number with Copy Button */}
            <div className="pt-0.5">
              <div className="text-sm sm:text-[15px]">
                এই নম্বরে টাকা পাঠান।{' '}
                <span className="text-yellow-300 font-bold text-base sm:text-lg ml-1 font-mono select-all">
                  {activeMethod.accountNumber ? activeMethod.accountNumber : 'সেট করা হয়নি'}
                </span>
              </div>
              <button
                type="button"
                disabled={!activeMethod.accountNumber}
                onClick={() => handleCopy(activeMethod.accountNumber)}
                className="mt-1.5 inline-flex items-center gap-1.5 bg-black/35 hover:bg-black/50 text-white rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                {copiedText === activeMethod.accountNumber ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>কপি হয়েছে</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>কপি</span>
                  </>
                )}
              </button>
            </div>

            <p>
              • টাকার পরিমাণঃ <span className="text-yellow-300 font-bold text-base sm:text-lg">{paymentDetails.amount}</span>
            </p>
            <p>
              • নিশ্চিত করে এখন আপনার {activeMethod.name} PIN লিখুন।
            </p>
            <p>
              • টাকা পাঠান এবং ট্রানজ্যাকশন আইডি কপি করুন।
            </p>
            <p>
              • ট্রানজ্যাকশন আইডি লিখে ভেরিফাই চাপুন।
            </p>
          </div>
        </div>

        {/* 5. Bottom Verify Action Button (Dynamic activation when TrxID is typed) */}
        <div>
          {(() => {
            const hasTrx = Boolean(transactionId.trim());
            return (
              <button
                type="submit"
                disabled={isSubmitting || !hasTrx}
                className={`w-full rounded-2xl py-4 font-black text-white text-base sm:text-lg shadow-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] ${
                  !hasTrx 
                    ? 'opacity-40 cursor-not-allowed saturate-50' 
                    : 'opacity-100 hover:brightness-110 shadow-2xl animate-pulse ring-2 ring-white/30'
                }`}
                style={{ 
                  backgroundColor: hasTrx ? activeMethod.themeColor : (activeMethod.btnColor || '#df6e79'),
                  boxShadow: hasTrx ? `0 10px 25px -5px ${activeMethod.themeColor}80` : undefined
                }}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>ভেরিফাই হচ্ছে...</span>
                  </>
                ) : (
                  <span className="tracking-wide">ভেরিফাই</span>
                )}
              </button>
            );
          })()}
        </div>

        {/* Submission Feedback Notices */}
        {submitStatus === 'success' && (
          <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm font-bold flex items-start gap-2.5 animate-in fade-in">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-white font-black mb-0.5">🎉 রিকোয়েস্ট জমা হয়েছে!</div>
              <div>আপনার ট্রানজেকশন আইডি অ্যাডমিনের কাছে পাঠানো হয়েছে। অনুমোদন হওয়া মাত্র ভিআইপি সক্রিয় হয়ে যাবে।</div>
            </div>
          </div>
        )}

        {submitStatus === 'pending_exist' && (
          <div className="p-4 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs sm:text-sm font-bold flex items-start gap-2.5">
            <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <span>আপনার একটি পেমেন্ট রিকোয়েস্ট ইতোমধ্যে রিভিউতে রয়েছে। এডমিন যাচাই করার জন্য অনুগ্রহ করে অপেক্ষা করুন।</span>
          </div>
        )}

        {submitStatus === 'error' && (
          <div className="p-4 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs sm:text-sm font-bold text-center">
            <div>রিকোয়েস্ট জমা দিতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।</div>
            {submitErrorText && <div className="text-[11px] font-mono text-red-400/80 mt-1">{submitErrorText}</div>}
          </div>
        )}
      </form>
    </div>
  );

  // 1. ADMIN & MODERATOR STATE
  // Admin & Moderator have perpetual VIP access by role, but can purchase/recharge packages anytime
  if (user?.role === 'admin' || user?.role === 'moderator') {
    return (
      <div className="mt-4 max-w-2xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
        {/* Admin/Moderator Lifetime Status Banner */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/60 via-[#181005] to-amber-950/40 border border-amber-500/40 shadow-lg shadow-amber-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Crown className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-bold text-sm sm:text-base">
                  {user.role === 'admin' ? '👑 অ্যাডমিন আনলিমিটেড প্রিমিয়াম সক্রিয়' : '🛡️ মডারেটর আনলিমিটেড প্রিমিয়াম সক্রিয়'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30">
                  Always VIP Access
                </span>
              </div>
              <p className="text-xs text-amber-200/80 mt-0.5">
                অ্যাডমিন ও মডারেটর হিসেবে আপনি সাইটের সমস্ত প্রিমিয়াম ও এক্সক্লুসিভ ভিডিও সবসময় সম্পূর্ণ ফ্রিতে দেখতে পারবেন। এছাড়া আপনি চাইলে নিজের অ্যাকাউন্টে যে কোনো প্রিমিয়াম প্যাকেজ ক্রয় বা রিচার্জ করতে পারেন।
              </p>
            </div>
          </div>
        </div>

        {/* Pending Request Alert Box (if submitted) */}
        {pendingRequest && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/60 via-[#181104] to-amber-950/40 border border-amber-500/40 text-amber-300 shadow-[0_0_30px_rgba(245,158,11,0.15)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                    Verification In Progress
                  </span>
                  <h4 className="text-sm sm:text-base font-bold text-white">
                    ⏳ আপনার পেমেন্ট রিকোয়েস্টটি পর্যালোচনায় রয়েছে
                  </h4>
                </div>
              </div>

              <span className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full font-bold border border-amber-500/30">
                Pending
              </span>
            </div>

            <div className="bg-black/50 border border-white/5 rounded-xl p-3 text-xs space-y-1 text-gray-300">
              <div className="flex justify-between">
                <span className="text-gray-400">পেমেন্ট মেথড:</span>
                <strong className="text-white">{pendingRequest.payment_method}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Transaction ID (TrxID):</span>
                <strong className="font-mono text-amber-400">{pendingRequest.transaction_id}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">টাকার পরিমাণ:</span>
                <strong className="text-white">৳{pendingRequest.amount}</strong>
              </div>
            </div>

            {user.role === 'admin' && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => handleAdminQuickApprove(pendingRequest)}
                  disabled={isQuickApproving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 text-xs font-bold transition-colors cursor-pointer"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{isQuickApproving ? 'অনুমোদন হচ্ছে...' : 'কুইক অনুমোদন (এডমিন টেস্ট)'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Payment Title Header */}
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-black text-white">
            ভিআইপি প্রিমিয়াম প্যাকেজ নির্বাচন করুন
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            বিকাশ, নগদ বা রকেটে পেমেন্ট করে যেকোনো প্যাকেজ ক্রয় বা রিচার্জ করুন।
          </p>
        </div>

        {/* Native Payment System UI */}
        {renderNativePaymentSystem()}

        {/* VIP Features Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-6 max-w-md mx-auto">
          {paymentDetails.features.map((feature, idx) => (
            <div key={idx} className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-start gap-3">
              <div className="p-2 bg-amber-500/15 rounded-xl text-amber-400 shrink-0 border border-amber-500/25">
                <feature.icon className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white mb-0.5">{feature.title}</h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 1. ACTIVE VIP STATE (Regular users only)
  if (user?.isVIP) {
    return (
      <div className="mt-4 max-w-3xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
        {/* Main Golden VIP Status Showcase Card */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/40 bg-gradient-to-b from-[#1c1303]/95 via-[#0e0a02]/95 to-black p-6 sm:p-8 text-center shadow-[0_0_50px_rgba(245,158,11,0.2)]">
          {/* Top Luminous Gold Line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.8)]" />

          {/* Golden Crown Icon */}
          <div className="relative inline-flex items-center justify-center mb-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-black shadow-[0_0_35px_rgba(245,158,11,0.6)] border-2 border-amber-300">
              <Crown className="w-9 h-9 sm:w-11 sm:h-11 fill-current" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-black" />
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-amber-400 mb-2">
            🎉 অভিনন্দন! আপনার ভিআইপি মেম্বারশিপ সক্রিয় রয়েছে
          </h2>
          <p className="text-amber-200/80 text-xs sm:text-sm max-w-lg mx-auto font-medium leading-relaxed mb-6">
            আপনি বর্তমানে আমাদের বিশেষ ভিআইপি প্রিমিয়াম মেম্বার। সাইটের সমস্ত এক্সক্লুসিভ ভাইরাল ভিডিও এবং ফিচার ১০০% বিজ্ঞাপনমুক্তভাবে উপভোগ করুন।
          </p>

          {/* Pending Recharge Alert for Active VIP */}
          {pendingRequest && (
            <div className="max-w-xl mx-auto mb-6 p-4.5 rounded-2xl bg-gradient-to-r from-amber-950/90 via-[#1e1404] to-amber-950/70 border-2 border-amber-500/50 text-amber-200 shadow-[0_0_35px_rgba(245,158,11,0.25)] text-left animate-in fade-in">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
                  <h4 className="font-black text-white text-sm sm:text-base">
                    ⏳ আপনার রিচার্জ / মেয়াদ বৃদ্ধির রিকোয়েস্টটি পর্যালোচনায় রয়েছে
                  </h4>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[11px] border border-amber-500/30 whitespace-nowrap">
                  Pending Verification
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-black/60 p-2.5 rounded-xl text-xs mb-2.5 border border-white/5">
                <div>
                  <span className="text-gray-400 block text-[10px]">পেমেন্ট মেথড:</span>
                  <strong className="text-white font-bold">{pendingRequest.payment_method}</strong>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Transaction ID:</span>
                  <strong className="text-amber-300 font-mono font-bold select-all">{pendingRequest.transaction_id}</strong>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">টাকার পরিমাণ:</span>
                  <strong className="text-emerald-400 font-bold">৳{pendingRequest.amount}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Live Countdown Component */}
          <div className="max-w-xl mx-auto mb-6 text-left">
            <VIPCountdown expiresAt={user.vipExpiresAt} variant="detailed" />
          </div>

          {/* Toggle to Extend / Recharge Duration */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowRechargeForm(!showRechargeForm)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs sm:text-sm transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-amber-400" />
              <span>{showRechargeForm ? 'রিচার্জ ফর্ম বন্ধ করুন' : 'মেয়াদ বাড়ানোর জন্য রিচার্জ করুন (Extend VIP Days)'}</span>
              {showRechargeForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* If user clicks to extend VIP, show payment form below */}
        {showRechargeForm && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-white">মেয়াদ বৃদ্ধি করতে পেমেন্ট করুন</h3>
              <p className="text-xs text-zinc-400 mt-1">পছন্দের পেমেন্ট মাধ্যম বেছে নিয়ে ট্রানজেকশন আইডি দিন।</p>
            </div>
            {renderNativePaymentSystem()}
          </div>
        )}
      </div>
    );
  }

  // 2. NON-VIP USER STATE
  return (
    <div className="mt-4 max-w-2xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Hero Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs mb-3 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
          <Sparkles className="w-4 h-4" />
          <span>VIP Premium Access</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
          আপগ্রেড প্রিমিয়াম ভিআইপি এক্সেস
        </h2>
        <p className="text-zinc-400 text-xs sm:text-sm max-w-md mx-auto">
          বিকাশ, নগদ বা রকেটে টাকা পাঠিয়ে মুহূর্তেই আপনার অ্যাকাউন্ট আপগ্রেড করুন সম্পূর্ণ বিজ্ঞাপনমুক্ত ভিডিও দেখতে।
        </p>
      </div>

      {/* Pending Request Alert Box (If user has submitted TrxID and waiting) */}
      {pendingRequest && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/60 via-[#181104] to-amber-950/40 border border-amber-500/40 text-amber-300 shadow-[0_0_30px_rgba(245,158,11,0.15)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                  Verification In Progress
                </span>
                <h4 className="text-sm sm:text-base font-bold text-white">
                  ⏳ আপনার পেমেন্ট রিকোয়েস্টটি পর্যালোচনায় রয়েছে
                </h4>
              </div>
            </div>

            <span className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full font-bold border border-amber-500/30">
              Pending
            </span>
          </div>

          <div className="bg-black/50 border border-white/5 rounded-xl p-3 text-xs space-y-1 text-gray-300">
            <div className="flex justify-between">
              <span className="text-gray-400">পেমেন্ট মেথড:</span>
              <strong className="text-white">{pendingRequest.payment_method}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Transaction ID (TrxID):</span>
              <strong className="font-mono text-amber-400">{pendingRequest.transaction_id}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">টাকার পরিমাণ:</span>
              <strong className="text-white">৳{pendingRequest.amount}</strong>
            </div>
          </div>

          <p className="text-xs text-amber-200/90 leading-relaxed font-medium">
            আমাদের এডমিন টিম আপনার ট্রানজেকশন আইডিটি যাচাই করছে। সাধারণত ৫-১৫ মিনিটের মধ্যে ভেরিফিকেশন সম্পন্ন হয়ে আপনার একাউন্টে ভিআইপি প্রিমিয়াম মেম্বারশিপ সক্রিয় হয়ে যাবে।
          </p>

          {telegramInfo && (
            <div className="pt-1 flex items-center gap-2">
              <a
                href={telegramInfo.mirrorWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  executeTelegramJoin(telegramInfo.rawInput || telegramInfo.mirrorWebUrl);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-500/30 text-sky-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>এডমিনকে টেলিগ্রামে জানান</span>
              </a>
            </div>
          )}
        </div>
      )}

      {/* Main Native Payment UI (Exact match to screenshots) */}
      {renderNativePaymentSystem()}

      {/* VIP Features Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-6 max-w-md mx-auto">
        {paymentDetails.features.map((feature, idx) => (
          <div key={idx} className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-start gap-3">
            <div className="p-2 bg-amber-500/15 rounded-xl text-amber-400 shrink-0 border border-amber-500/25">
              <feature.icon className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white mb-0.5">{feature.title}</h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed">{feature.desc}</p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
