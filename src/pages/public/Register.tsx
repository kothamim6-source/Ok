import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { auth } from '../../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { UserPlus, User, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { getConfiguredAdminEmail } from '../../lib/adminConfig';

export function Register() {
  const { settings } = useSettingsStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const lowerName = name.trim().toLowerCase();
      if (!lowerName || lowerName === 'user' || lowerName === 'admin' || lowerName.includes('user') || lowerName.includes('admin')) {
        throw new Error('দয়া করে আপনার আসল নাম ব্যবহার করুন। "User" বা "Admin" নাম হিসেবে ব্যবহার করা যাবে না।');
      }

      if (!auth) throw new Error('Firebase Auth is not initialized');

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await updateProfile(user, {
        displayName: name.trim()
      });

      const configuredAdminEmail = getConfiguredAdminEmail(settings);
      let isAdmin = Boolean(configuredAdminEmail && email.trim().toLowerCase() === configuredAdminEmail);
      if (!isAdmin) {
        try {
          const { count } = await supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'admin');
          if (count === 0) {
            isAdmin = true;
          }
        } catch (err) {}
      }
      // Upsert user in Supabase
      const { error: insertError } = await supabase.from('users').upsert([{
        id: user.uid,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: isAdmin ? 'admin' : 'user',
        status: 'active',
        created_at: Date.now()
      }]);
      if (insertError) {
        console.error("Error creating user profile", insertError);
      }

      // Handle Referral Code
      const refCode = searchParams.get('ref');
      const refEnabled = settings?.referralSettings?.enabled ?? true;
      const hasDeviceRegistered = localStorage.getItem('device_used_for_referral');
      
      if (refCode && refEnabled && !hasDeviceRegistered) {
        try {
          const referrerReward = settings?.referralSettings?.referrerReward ?? 50;
          const refereeReward = settings?.referralSettings?.refereeReward ?? 20;
          
          const { data: referrers } = await supabase
             .from('users')
             .select('*')
             .eq('referral_code', refCode);
          
          if (referrers && referrers.length > 0) {
            const referrerDoc = referrers[0];
            const referrerId = referrerDoc.id;
            
            // Add points to referrer
            const currentPoints = referrerDoc.points || 0;
            await supabase.from('users').update({ points: currentPoints + referrerReward }).eq('id', referrerId);
            
            // Give the new user bonus points
            await supabase.from('users').update({ points: refereeReward }).eq('id', user.uid);
            
            // Mark this device as used for referral
            localStorage.setItem('device_used_for_referral', 'true');
          }
        } catch (refError) {
          console.error("Error processing referral:", refError);
        }
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to register. Please try again.');
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
              <UserPlus className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-black tracking-tight text-white mb-2">
              অ্যাকাউন্ট তৈরি করুন
            </h2>
            <p className="text-sm text-gray-400">
              প্রিমিয়াম সুবিধা পেতে আমাদের সাথে যুক্ত হোন
            </p>
          </div>
          
          <form className="space-y-6" onSubmit={handleRegister}>
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-medium text-red-500 flex items-start gap-3">
                <div className="mt-0.5">•</div>
                <p>{error}</p>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-300" htmlFor="name">
                  পুরো নাম
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500">
                    <User className="h-5 w-5" />
                  </div>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    className="block w-full rounded-xl border border-white/10 bg-white/5 py-3.5 pl-12 pr-4 text-white placeholder-gray-500 transition-all focus:border-red-500 focus:bg-black/50 focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="আপনার পুরো নাম লিখুন"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-300" htmlFor="email-address">
                  ইমেইল অ্যাড্রেস
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="block w-full rounded-xl border border-white/10 bg-white/5 py-3.5 pl-12 pr-4 text-white placeholder-gray-500 transition-all focus:border-red-500 focus:bg-black/50 focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="আপনার ইমেইল লিখুন"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-300" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    className="block w-full rounded-xl border border-white/10 bg-white/5 py-3.5 pl-12 pr-4 text-white placeholder-gray-500 transition-all focus:border-red-500 focus:bg-black/50 focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="পাসওয়ার্ড তৈরি করুন"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-4 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition-all hover:from-red-500 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:hover:scale-100"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  অ্যাকাউন্ট তৈরি করুন
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
              onClick={async () => {
                setIsLoading(true);
                setError('');
                try {
                  if (!auth) throw new Error('Firebase Auth is not initialized');
                  const provider = new GoogleAuthProvider();
                  await signInWithPopup(auth, provider);
                  navigate('/');
                } catch (err: any) {
                  setError(err.message || 'Google সাইন-আপ ব্যর্থ হয়েছে। আবার চেষ্টা করুন।');
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/5 py-3.5 px-4 text-sm font-bold text-white transition-all hover:bg-white/10 disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google দিয়ে অ্যাকাউন্ট খুলুন
            </button>
          </form>
          
          <div className="mt-8 text-center text-sm">
            <span className="text-gray-400">আগে থেকেই অ্যাকাউন্ট আছে? </span>
            <Link to="/login" className="font-bold text-red-500 transition-colors hover:text-red-400">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
