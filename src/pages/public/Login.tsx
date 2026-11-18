import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { LogIn, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      if (auth) {
        await signInWithEmailAndPassword(auth, email, password);
        navigate('/');
      } else {
        throw new Error('Firebase Auth is not initialized');
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('আপনার এই জিমেইল দিয়ে কোনো অ্যাকাউন্ট নেই, নতুন করে অ্যাকাউন্ট খুলুন।');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-email') {
        setError('আপনি ভুল পাসওয়ার্ড দিয়েছেন অনুগ্রহ করে সঠিক পাসওয়ার্ডটি দিন ।');
      } else if (err.code === 'auth/too-many-requests') {
        setError('অনেকবার ভুল চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।');
      } else {
        setError('আপনি ভুল পাসওয়ার্ড দিয়েছেন অনুগ্রহ করে সঠিক পাসওয়ার্ডটি দিন ।');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow effects for premium adult look */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-900/20 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute top-0 right-0 w-72 h-72 bg-red-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-yellow-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      
      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="rounded-3xl border border-white/10 bg-[#0a0a0a]/80 p-8 sm:p-10 backdrop-blur-2xl shadow-[0_0_50px_rgba(220,38,38,0.15)] relative overflow-hidden">
          
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-900 via-red-600 to-red-900"></div>
          
          <div className="mb-8 text-center">
            {/* 18+ Warning Badge */}
            <div className="inline-block mb-4 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-black tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.2)]">
              WARNING: 18+ ADULT CONTENT
            </div>
            
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-red-600 to-red-900 shadow-lg shadow-red-600/30 ring-4 ring-red-500/10">
              <LogIn className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-black tracking-tight text-white mb-2">
              স্বাগতম!
            </h2>
            <p className="text-sm text-gray-400">
              আপনার অ্যাকাউন্টে প্রবেশ করতে লগইন করুন
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl bg-red-500/10 p-4 border border-red-500/20 flex items-start gap-3">
              <div className="text-red-500 font-medium text-sm">{error}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
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

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider" htmlFor="password">
                  পাসওয়ার্ড
                </label>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-500 group-focus-within:text-red-500 transition-colors">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-white/10 bg-black/60 py-3.5 pl-11 pr-4 text-white placeholder-gray-600 focus:border-red-500 focus:bg-black focus:outline-none focus:ring-1 focus:ring-red-500 transition-all sm:text-sm"
                  placeholder="আপনার পাসওয়ার্ড দিন"
                />
              </div>
              <div className="mt-2 text-right">
                <Link to="/forgot-password" className="text-xs font-bold text-red-500 hover:text-red-400 hover:underline transition-all">
                  পাসওয়ার্ড ভুলে গেছেন?
                </Link>
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
                  লগইন করুন
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-white/5 pt-6">
            <p className="text-sm text-gray-400">
              অ্যাকাউন্ট নেই?{' '}
              <Link to="/register" className="font-bold text-red-500 hover:text-red-400 hover:underline transition-all">
                নতুন অ্যাকাউন্ট তৈরি করুন
              </Link>
            </p>
          </div>
          
          <p className="mt-6 text-center text-[10px] text-gray-600 uppercase tracking-widest max-w-[80%] mx-auto leading-relaxed">
            এই সাইটে প্রবেশ করে আপনি নিশ্চিত করছেন যে আপনার বয়স অন্তত ১৮ বছর বা তার বেশি।
          </p>
        </div>
      </div>
    </div>
  );
}
