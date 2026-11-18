import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Mail, ArrowRight, Loader2, KeyRound } from 'lucide-react';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess(false);
    
    try {
      if (auth) {
        await sendPasswordResetEmail(auth, email);
        setSuccess(true);
      } else {
        throw new Error('Firebase Auth is not initialized');
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('আপনার এই ইমেইল দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি।');
      } else if (err.code === 'auth/invalid-email') {
        setError('সঠিক ইমেইল এড্রেস দিন।');
      } else {
        setError('পাসওয়ার্ড রিসেট ইমেইল পাঠাতে সমস্যা হচ্ছে। আবার চেষ্টা করুন।');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-900/20 rounded-full blur-[150px] pointer-events-none"></div>
      
      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="rounded-3xl border border-white/10 bg-[#0a0a0a]/80 p-8 sm:p-10 backdrop-blur-2xl shadow-[0_0_50px_rgba(220,38,38,0.15)] relative overflow-hidden">
          
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-900 via-red-600 to-red-900"></div>
          
          <div className="mb-8 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-red-600 to-red-900 shadow-lg shadow-red-600/30 ring-4 ring-red-500/10">
              <KeyRound className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-black tracking-tight text-white mb-2">
              পাসওয়ার্ড ভুলে গেছেন?
            </h2>
            <p className="text-sm text-gray-400">
              আপনার ইমেইল দিন, আমরা পাসওয়ার্ড রিসেট লিংক পাঠিয়ে দেবো
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl bg-red-500/10 p-4 border border-red-500/20 flex items-start gap-3">
              <div className="text-red-500 font-medium text-sm">{error}</div>
            </div>
          )}

          {success && (
            <div className="mb-6 rounded-xl bg-green-500/10 p-4 border border-green-500/20 flex items-start gap-3">
              <div className="text-green-500 font-medium text-sm">পাসওয়ার্ড রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে। দয়া করে আপনার জিমেইলের স্প্যাম বক্স (Spam Box) চেক করুন।</div>
            </div>
          )}

          {!success && (
            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2" htmlFor="email">
                  ইমেইল এড্রেস
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-500 group-focus-within:text-red-500 transition-colors">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-xl border border-white/10 bg-black/60 py-3.5 pl-11 pr-4 text-white placeholder-gray-600 focus:border-red-500 focus:bg-black focus:outline-none focus:ring-1 focus:ring-red-500 transition-all sm:text-sm"
                    placeholder="আপনার ইমেইল দিন"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="group relative flex w-full justify-center items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-800 py-3.5 px-4 text-sm font-bold text-white transition-all hover:from-red-500 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(220,38,38,0.3)] mt-4"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    অপেক্ষা করুন...
                  </>
                ) : (
                  <>
                    রিসেট লিংক পাঠান
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-8 text-center border-t border-white/5 pt-6">
            <p className="text-sm text-gray-400">
              পাসওয়ার্ড মনে পড়েছে?{' '}
              <Link to="/login" className="font-bold text-red-500 hover:text-red-400 hover:underline transition-all">
                লগইন করুন
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
