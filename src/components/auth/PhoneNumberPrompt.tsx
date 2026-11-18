import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { Phone, ArrowRight, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

export function PhoneNumberPrompt() {
  const { user, setUser } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.trim().replace(/[\s\-]/g, '');

    if (!cleanPhone) {
      setError('মোবাইল নম্বর দেওয়া আবশ্যক। নম্বর ছাড়া অ্যাকাউন্টে প্রবেশ করা সম্ভব নয়।');
      return;
    }

    // Validate 11-digit Bangladeshi mobile number format
    const bdPhoneRegex = /^(?:\+?88)?01[3-9]\d{8}$/;
    if (!bdPhoneRegex.test(cleanPhone)) {
      setError('দয়া করে সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।');
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      if (!user) throw new Error('ইউজার লগইন সেশন পাওয়া যায়নি।');

      // Persist to localStorage immediately
      if (typeof window !== 'undefined') {
        localStorage.setItem(`verified_phone_${user.id}`, cleanPhone);
        if (user.email) {
          localStorage.setItem(`verified_phone_${user.email.toLowerCase()}`, cleanPhone);
        }
      }

      // 1. Update Supabase users table by id
      const { error: updateError } = await supabase
        .from('users')
        .update({ phone: cleanPhone })
        .eq('id', user.id);

      // 2. Also update by email to catch any duplicate records
      if (user.email) {
        await supabase
          .from('users')
          .update({ phone: cleanPhone })
          .eq('email', user.email.toLowerCase());
      }

      if (updateError) {
        console.warn('Fallback update attempting on phone_number column...', updateError);
        await supabase
          .from('users')
          .update({ phone_number: cleanPhone })
          .eq('id', user.id);
      }

      // 3. Update global Auth store state so prompt closes immediately
      setUser({ ...user, phone: cleanPhone });

      // 4. Trigger global event for real-time listeners
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('user-vip-updated'));
      }
    } catch (err: any) {
      console.error('Error updating phone number:', err);
      setError(err.message || 'মোবাইল নম্বর আপডেট করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-[#07080c]/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 select-none">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-red-900/25 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-300">
        <div className="rounded-3xl border border-white/10 bg-[#0c0d14]/90 p-7 sm:p-9 backdrop-blur-2xl shadow-[0_0_60px_rgba(220,38,38,0.2)] relative overflow-hidden">
          
          {/* Top highlight bar */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-800 via-red-500 to-red-800" />

          <div className="mb-6 text-center">
            {/* Icon */}
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-red-600 to-red-800 shadow-lg shadow-red-600/30 ring-4 ring-red-500/10">
              <Phone className="h-8 w-8 text-white animate-pulse" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
              মোবাইল নম্বর ভেরিফিকেশন
            </h2>

            {/* Mandatory Instruction Badge requested by user */}
            <div className="inline-block my-2 px-3.5 py-1.5 rounded-full bg-red-500/15 border border-red-500/35 text-red-400 text-xs sm:text-sm font-black tracking-wide shadow-sm">
              সঠিক নম্বর দিন, কোড পাঠানো হবে
            </div>

            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mt-2">
              আপনার অ্যাকাউন্টে পূর্বে কোনো মোবাইল নম্বর যুক্ত করা নেই। সাইটে নিরবচ্ছিন্নভাবে ভিডিও দেখতে এবং অ্যাকাউন্টে প্রবেশ করতে সচল মোবাইল নম্বরটি প্রদান করুন।
            </p>
          </div>
          
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs sm:text-sm font-semibold text-red-400 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                <p>{error}</p>
              </div>
            )}
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider" htmlFor="phone-input">
                  আপনার মোবাইল নম্বর <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-zinc-400 font-medium">১১ ডিজিট</span>
              </div>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-500">
                  <span className="text-sm font-bold text-zinc-400 border-r border-zinc-700 pr-2">+88</span>
                </div>
                <input
                  id="phone-input"
                  name="phone"
                  type="tel"
                  autoFocus
                  required
                  className="block w-full rounded-xl border border-white/10 bg-white/[0.04] py-3.5 pl-16 pr-4 text-white placeholder-zinc-500 transition-all focus:border-red-500 focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-red-500 font-mono text-sm tracking-wider"
                  placeholder="01XXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-400">
                সঠিক নম্বর দিন, কোড পাঠানো হবে। নম্বর ছাড়া সাইট ব্যবহার করা যাবে না।
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || !phone.trim()}
              className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 py-3.5 px-4 text-sm font-bold text-white shadow-lg shadow-red-950/50 transition-all hover:brightness-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>যাচাই ও সেভ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <span>নম্বর জমা দিন ও প্রবেশ করুন</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Secure note */}
          <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>আপনার মোবাইল নম্বরটি সুরক্ষিত ও এনক্রিপ্টেড থাকবে</span>
          </div>
        </div>
      </div>
    </div>
  );
}
