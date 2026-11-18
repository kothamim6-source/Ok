import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
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

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      if (!auth) throw new Error('Firebase Auth is not initialized');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Google লগইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।');
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

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[#0a0a0a] px-2 text-gray-500">অথবা</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/5 py-3 px-4 text-sm font-bold text-white transition-all hover:bg-white/10 disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google দিয়ে লগইন করুন
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
