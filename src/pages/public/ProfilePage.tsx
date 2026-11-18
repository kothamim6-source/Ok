import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { supabase } from '../../lib/supabase';
import { auth } from '../../lib/firebase';
import { signOut, updatePassword } from 'firebase/auth';
import {  UserCircle, Upload, Save, CheckCircle, LogOut, History, Heart, Crown, Settings, LifeBuoy, CreditCard, ArrowLeft, Users, Copy, Gift, ShieldAlert, Phone, DownloadCloud, Video, FolderTree, MessageSquare, Flag, Megaphone, Bell, Activity, Send, Key, Sparkles, ShieldCheck, ExternalLink, Shield } from 'lucide-react';
import { User } from '../../types';
import { VIPPurchase } from '../../components/ui/VIPPurchase';
import { UserBadge } from '../../components/ui/UserBadge';
import { VIPCountdown } from '../../components/profile/VIPCountdown';
import { PaymentHistory } from '../../components/profile/PaymentHistory';
import { SupportSection } from '../../components/profile/SupportSection';
import { RedeemSection } from '../../components/profile/RedeemSection';

const ALL_MODERATOR_TOOLS = [
  {
    id: 'blogger_import',
    matchKeys: ['blogger_import', 'blogger', 'bloggerimport'],
    title: 'Blogger Import Engine',
    titleBn: 'ব্লগার ভিডিও ইমপোর্ট',
    desc: 'ব্লগার লিংক দিয়ে ভিডিও, একাধিক পর্ব, ক্যাপশন ও এইচডি থাম্বনেইল সরাসরি এক ক্লিকে ইমপোর্ট করুন।',
    href: '/admin/videos/blogger-import',
    icon: DownloadCloud,
    badge: 'Auto Scraper',
    color: 'from-orange-500/25 via-amber-500/10 to-transparent border-orange-500/40 text-orange-400'
  },
  {
    id: 'upload',
    matchKeys: ['upload', 'upload_video', 'uploadvideo'],
    title: 'Upload Video',
    titleBn: 'ভিডিও আপলোড',
    desc: 'সরাসরি নতুন ভিডিও ফাইল বা ডিরেক্ট এমপি৪ লিংক আপলোড ও পাবলিশ করুন।',
    href: '/admin/videos/upload',
    icon: Upload,
    badge: 'Media',
    color: 'from-blue-500/25 via-cyan-500/10 to-transparent border-blue-500/40 text-blue-400'
  },
  {
    id: 'videos',
    matchKeys: ['videos', 'all_videos', 'allvideos'],
    title: 'All Videos Library',
    titleBn: 'ভিডিও লাইব্রেরি ও এডিট',
    desc: 'সাইটের সমস্ত ভিডিও তালিকা দেখুন, ভিউজ পর্যবেক্ষণ, এডিট বা ডিলিট করুন।',
    href: '/admin/videos',
    icon: Video,
    badge: 'Library',
    color: 'from-red-500/25 via-rose-500/10 to-transparent border-red-500/40 text-red-400'
  },
  {
    id: 'categories',
    matchKeys: ['categories', 'category'],
    title: 'Categories & Tags',
    titleBn: 'ক্যাটাগরি ও ফিল্টার',
    desc: 'নতুন ভিডিও ক্যাটাগরি এবং ফিল্টারিং ট্যাগ তৈরি ও পরিচালনা করুন।',
    href: '/admin/categories',
    icon: FolderTree,
    badge: 'Taxonomy',
    color: 'from-emerald-500/25 via-teal-500/10 to-transparent border-emerald-500/40 text-emerald-400'
  },
  {
    id: 'comments',
    matchKeys: ['comments', 'comment'],
    title: 'Comments Moderation',
    titleBn: 'কমেন্ট মডারেশন',
    desc: 'ভিডিওর নিচে ইউজারদের করা মন্তব্য পর্যালোচনা ও অনাকাঙ্ক্ষিত মন্তব্য মুছে দিন।',
    href: '/admin/comments',
    icon: MessageSquare,
    badge: 'Community',
    color: 'from-yellow-500/25 via-amber-500/10 to-transparent border-yellow-500/40 text-yellow-400'
  },
  {
    id: 'reports',
    matchKeys: ['reports', 'report'],
    title: 'User Reports & Flags',
    titleBn: 'ইউজার রিপোর্ট',
    desc: 'ইউজারদের পাঠানো অভিযোগ ও ফ্ল্যাগ রিভিউ করে প্রয়োজনীয় ব্যবস্থা নিন।',
    href: '/admin/reports',
    icon: Flag,
    badge: 'Safety',
    color: 'from-pink-500/25 via-rose-500/10 to-transparent border-pink-500/40 text-pink-400'
  },
  {
    id: 'banners',
    matchKeys: ['banners', 'banner'],
    title: 'Promotional Banners',
    titleBn: 'প্রমোশনাল ব্যানার',
    desc: 'হোম স্ক্রিন ও ভিআইপি সেকশনের ব্যানার ও লিংক পরিচালনা করুন।',
    href: '/admin/banners',
    icon: Sparkles,
    badge: 'Promo',
    color: 'from-purple-500/25 via-violet-500/10 to-transparent border-purple-500/40 text-purple-400'
  },
  {
    id: 'notice',
    matchKeys: ['notice', 'noticeboard', 'marquee', 'notice_settings'],
    title: 'Notice Board (Marquee)',
    titleBn: 'স্ক্রল নোটিশ বোর্ড',
    desc: 'সাইটের শীর্ষভাগের রানিং স্ক্রল নোটিশ এবং এনাউন্সমেন্ট আপডেট করুন।',
    href: '/admin/notice-settings',
    icon: Megaphone,
    badge: 'Announcement',
    color: 'from-cyan-500/25 via-sky-500/10 to-transparent border-cyan-500/40 text-cyan-400'
  },
  {
    id: 'notifications',
    matchKeys: ['notifications', 'notification'],
    title: 'Push Notifications',
    titleBn: 'পুশ নোটিফিকেশন',
    desc: 'সকল ব্যবহারকারীর ডিভাইসে রিয়েল-টাইম পুশ নোটিফিকেশন অ্যালার্ট পাঠান।',
    href: '/admin/notifications',
    icon: Bell,
    badge: 'Broadcast',
    color: 'from-violet-500/25 via-purple-500/10 to-transparent border-violet-500/40 text-violet-400'
  },
  {
    id: 'online_users',
    matchKeys: ['online_users', 'onlineusers', 'online'],
    title: 'Real-Time Online Users',
    titleBn: 'লাইভ অনলাইন ইউজার',
    desc: 'এই মুহূর্তে সাইটে কতজন ব্যবহারকারী লাইভ ব্রাউজ করছেন তা পর্যবেক্ষণ করুন।',
    href: '/admin/online-users',
    icon: Activity,
    badge: 'Live',
    color: 'from-green-500/25 via-emerald-500/10 to-transparent border-green-500/40 text-green-400'
  },
  {
    id: 'telegram',
    matchKeys: ['telegram', 'telegramautopost', 'telegram_auto_post'],
    title: 'Telegram Auto Post',
    titleBn: 'টেলিগ্রাম অটো পোস্ট',
    desc: 'নতুন ভিডিও স্বয়ংক্রিয়ভাবে টেলিগ্রাম চ্যানেল বা গ্রুপে পোস্ট করুন।',
    href: '/admin/telegram-auto-post',
    icon: Send,
    badge: 'Bot',
    color: 'from-sky-500/25 via-blue-500/10 to-transparent border-sky-500/40 text-sky-400'
  },
  {
    id: 'vip_requests',
    matchKeys: ['vip_requests', 'viprequests', 'vip'],
    title: 'VIP Requests',
    titleBn: 'ভিআইপি মেম্বারশিপ আবেদন',
    desc: 'ইউজারদের পাঠানো TrxID এবং পেমেন্ট অনুমোদন বা বাতিল করুন।',
    href: '/admin/vip-requests',
    icon: Crown,
    badge: 'VIP',
    color: 'from-amber-500/25 via-yellow-500/10 to-transparent border-amber-500/40 text-amber-400'
  },
  {
    id: 'gift_premium',
    matchKeys: ['gift_premium', 'giftpremium', 'gift'],
    title: 'Gift VIP Access',
    titleBn: 'গিফট প্রিমিয়াম',
    desc: 'নির্দিষ্ট কোনো ইউজারকে সরাসরি নির্দিষ্ট দিনের জন্য প্রিমিয়াম উপহার দিন।',
    href: '/admin/gift-premium',
    icon: Gift,
    badge: 'Gift',
    color: 'from-pink-500/25 via-rose-500/10 to-transparent border-pink-500/40 text-pink-400'
  },
  {
    id: 'redeem_codes',
    matchKeys: ['redeem_codes', 'redeemcodes', 'redeem'],
    title: 'Redeem Codes',
    titleBn: 'রিডিম কোড জেনারেটর',
    desc: 'গিফট ভাউচার কোড তৈরি করুন যা ইউজাররা রিডিম করে ভিআইপি হতে পারবে।',
    href: '/admin/redeem-codes',
    icon: Key,
    badge: 'Codes',
    color: 'from-indigo-500/25 via-violet-500/10 to-transparent border-indigo-500/40 text-indigo-400'
  },
  {
    id: 'users',
    matchKeys: ['users', 'usermanagement'],
    title: 'User Management',
    titleBn: 'ইউজার ম্যানেজমেন্ট',
    desc: 'সাইটের রেজিস্টার্ড ইউজারদের তালিকা দেখুন ও পরিচালনা করুন।',
    href: '/admin/users',
    icon: Users,
    badge: 'Accounts',
    color: 'from-zinc-500/25 via-stone-500/10 to-transparent border-zinc-500/40 text-zinc-300'
  }
];

export function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const { settings } = useSettingsStore();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isUploading, setIsUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [activeTab, setActiveTab] = useState<'menu' | 'edit' | 'vip' | 'payments' | 'support' | 'referral' | 'privacy' | 'redeem' | 'moderator_tools'>('menu');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['menu', 'edit', 'vip', 'payments', 'support', 'referral', 'privacy', 'redeem', 'moderator_tools'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [location.search]);
  const [newName, setNewName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [facebookUrl, setFacebookUrl] = useState(user?.socialLinks?.facebook || '');
  const [twitterUrl, setTwitterUrl] = useState(user?.socialLinks?.twitter || '');
  const [newPassword, setNewPassword] = useState('');
  const [referralCopied, setReferralCopied] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState({ type: '', text: '' });

  const userModeratorTools = useMemo(() => {
    if (user?.role !== 'moderator') return [];
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    
    // If specific permissions were assigned by the admin
    if (perms.length > 0) {
      const cleanPerms = perms.map(p => String(p).toLowerCase().replace(/[\s\-_()]+/g, ''));
      return ALL_MODERATOR_TOOLS.filter(tool => {
        return tool.matchKeys.some(key => {
          const cleanKey = key.toLowerCase().replace(/[\s\-_()]+/g, '');
          return cleanPerms.includes(cleanKey) || cleanPerms.some(cp => cp.includes(cleanKey) || cleanKey.includes(cp));
        });
      });
    }

    // Default tools if no restrictions
    return ALL_MODERATOR_TOOLS.slice(0, 6);
  }, [user?.role, user?.permissions]);

  useEffect(() => {
    if (user?.name) setNewName(user.name);
    if (user?.phone) setPhone(user.phone);
    if (user?.socialLinks?.facebook) setFacebookUrl(user.socialLinks.facebook);
    if (user?.socialLinks?.twitter) setTwitterUrl(user.socialLinks.twitter);
  }, [user]);

  // Always refresh latest user data from Supabase periodically when viewing profile
  useEffect(() => {
    async function syncUserData() {
      if (!user?.id && !user?.email) return;
      try {
        let userDoc: any = null;
        if (user?.id) {
          const { data } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
          userDoc = data;
        }
        if (!userDoc && user?.email) {
          const { data } = await supabase.from('users').select('*').eq('email', user.email).order('created_at', { ascending: false }).limit(1);
          if (data && data.length > 0) userDoc = data[0];
        }

        if (userDoc) {
          const activeRole = userDoc.role || user?.role || 'user';
          const isModOrAdmin = activeRole === 'admin' || activeRole === 'moderator';

          let modPerms: string[] = [];
          if (activeRole === 'moderator') {
            try {
              const { data: modSetting } = await supabase.from('settings').select('data').eq('id', 'moderator_permissions').maybeSingle();
              if (modSetting?.data?.assignments) {
                const assignment = modSetting.data.assignments[userDoc.id] || (userDoc.email ? modSetting.data.assignments[userDoc.email.toLowerCase()] : null);
                if (assignment?.permissions && Array.isArray(assignment.permissions)) {
                  modPerms = assignment.permissions;
                }
              }
            } catch (e) {}
          }

          const isVIPExpired = !isModOrAdmin && userDoc.is_vip && userDoc.vip_expires_at && userDoc.vip_expires_at < Date.now();
          setUser({
            ...user,
            ...userDoc,
            role: activeRole,
            permissions: modPerms.length > 0 ? modPerms : (userDoc.permissions || user?.permissions || []),
            isVIP: isModOrAdmin || (!isVIPExpired && Boolean(userDoc.is_vip)),
            vipExpiresAt: isModOrAdmin ? null : (isVIPExpired ? null : userDoc.vip_expires_at),
            phone: userDoc.phone || userDoc.phone_number || userDoc.mobile || undefined,
            profileImage: userDoc.profile_image,
            points: userDoc.points ?? user.points,
          } as any);
        }
      } catch (err) {
        console.error('Failed to sync user data in ProfilePage:', err);
      }
    }
    syncUserData();
    const intervalId = setInterval(syncUserData, 3000);
    window.addEventListener('user-vip-updated', syncUserData);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('user-vip-updated', syncUserData);
    };
  }, [user?.id, user?.email]);

  const fallbackPackages = [
    { days: 1, cost: 100 },
    { days: 7, cost: 500 },
    { days: 30, cost: 1500 }
  ];
  const redeemPackages = settings?.referralSettings?.redeemPackages || (settings?.referralSettings?.pointsToPremiumCost ? [{ days: settings.referralSettings.pointsToPremiumDurationDays || 30, cost: settings.referralSettings.pointsToPremiumCost }] : fallbackPackages);

  const handleRedeemPoints = async (cost: number, durationDays: number) => {
    if (!user) return;
    
    if ((user.points || 0) < cost) {
      setRedeemMessage({ type: 'error', text: `You need ${cost} points to redeem Premium.` });
      return;
    }
    
    setIsRedeeming(true);
    setRedeemMessage({ type: '', text: '' });
    
    try {
      const now = Date.now();
      const currentExpiry = user.vipExpiresAt && user.vipExpiresAt > now ? user.vipExpiresAt : now;
      const newExpiry = currentExpiry + (durationDays * 24 * 60 * 60 * 1000);
      const newPoints = (user.points || 0) - cost;
      
      await supabase.from('users').update({
        is_vip: true,
        vip_expires_at: newExpiry,
        points: newPoints
      }).eq('id', user.id);
      
      setUser({
        ...user,
        isVIP: true,
        vipExpiresAt: newExpiry,
        points: newPoints
      } as User);
      
      setRedeemMessage({ type: 'success', text: `Successfully redeemed ${durationDays} days of Premium!` });
    } catch (e: any) {
      setRedeemMessage({ type: 'error', text: 'Failed to redeem points.' });
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleGenerateReferral = async () => {
    if (!user) return;
    try {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      await supabase.from('users').update({
        referral_code: code
      }).eq('id', user.id);
      setUser({ ...user, referralCode: code } as User);
    } catch(e) {}
  };

  useEffect(() => {
    if (user && !user.referralCode) {
      handleGenerateReferral();
    }
  }, [user?.id, user?.referralCode]);

  const handleCopyReferral = async () => {
    if (!user?.referralCode) return;
    const link = `${window.location.origin}/register?ref=${user.referralCode}`;
    
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        setReferralCopied(true);
      } else {
        // Fallback for in-app browsers like Telegram/Facebook
        const textArea = document.createElement("textarea");
        textArea.value = link;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          setReferralCopied(true);
        } catch (err) {
          console.error('Fallback: Oops, unable to copy', err);
        }
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
    
    setTimeout(() => setReferralCopied(false), 2000);
  };

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
    }
    navigate('/');
  };

  if (!user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center">
        <UserCircle className="mb-4 h-16 w-16 text-gray-600" />
        <h2 className="text-xl font-bold text-white mb-2">Not Logged In</h2>
        <p className="text-gray-400">Please log in to view your profile.</p>
      </div>
    );
  }

  const handleChangeAvatar = async () => {
    
    const url = window.prompt("Enter direct image URL for your avatar:");
    if (!url) return;
    
    setIsUploading(true);
    try {
      await supabase.from('users').update({
        profile_image: url
      }).eq('id', user.id);
      setUser({ ...user, profileImage: url } as User);
    } catch (error) {
      console.error("Error updating profile picture:", error);
      alert("Failed to update avatar.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (newName.trim() === '') return;
    
    setSaveStatus('saving');
    try {
      if (newPassword && newPassword.length >= 6) {
        if (!auth.currentUser) throw new Error("No active auth session");
        await updatePassword(auth.currentUser, newPassword);
      } else if (newPassword && newPassword.length < 6) {
        alert("Password must be at least 6 characters long.");
        setSaveStatus('idle');
        return;
      }

      const socialLinks = {
        facebook: facebookUrl.trim(),
        twitter: twitterUrl.trim()
      };
      const cleanPhone = phone.trim();
      await supabase.from('users').update({
        name: newName.trim(),
        phone: cleanPhone || null,
        social_links: socialLinks
      }).eq('id', user.id);

      if (user.email) {
        await supabase.from('users').update({
          name: newName.trim(),
          phone: cleanPhone || null,
          social_links: socialLinks
        }).eq('email', user.email);
      }

      setUser({ ...user, name: newName.trim(), phone: cleanPhone || undefined, socialLinks } as User);
      
      if (newPassword) {
        setNewPassword(''); // clear field after successful update
      }
      
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      if (error.code === 'auth/requires-recent-login') {
        alert("For security reasons, you must log out and log back in before changing your password.");
      } else {
        alert("Failed to update profile. " + (error.message || ""));
      }
      setSaveStatus('idle');
    }
  };

  return (
    <div className="mx-auto max-w-4xl py-4 md:py-8 px-4 pb-24 sm:pb-8">
      {/* Header Info */}
      <div className="sticky top-[64px] z-30 -mx-4 px-4 py-4 mb-6 bg-[#050505]/95 backdrop-blur-xl border-b border-white/5 md:mx-0 md:bg-white/5 md:border md:border-white/10 md:p-6 md:rounded-2xl">
        <div className="flex flex-row gap-4 items-center md:items-start">
          <div className="relative h-16 w-16 md:h-24 md:w-24 overflow-hidden rounded-full border-2 md:border-4 border-white/10 bg-gray-800 shrink-0">
          {user.profileImage ? (
            <img src={user.profileImage} alt={user.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white">
              {user.name?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 text-left">
          <div className="flex flex-row items-center gap-3 mb-1">
            <h1 className="text-xl md:text-3xl font-black text-white">{user.name}</h1>
            <UserBadge role={user.role} isVIP={user.isVIP} />
          </div>
          <p className="text-gray-400 text-sm md:text-base">{user.email}</p>
          {user.phone && (
            <p className="text-emerald-400 text-xs md:text-sm flex items-center gap-1.5 mt-1 font-medium">
              <Phone className="w-3.5 h-3.5 shrink-0" /> {user.phone}
            </p>
          )}
          {user.role !== 'admin' && user.role !== 'moderator' && user.isVIP && (
             <div className="inline-block mt-2">
               <VIPCountdown expiresAt={user.vipExpiresAt} variant="compact" />
             </div>
          )}
        </div>
      </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Menu */}
        <div className={`w-full md:w-64 shrink-0 flex-col gap-6 pb-2 md:pb-0 ${activeTab === 'menu' ? 'flex' : 'hidden md:flex'}`}>
          
          {/* Admin / Moderator Panel Access */}
          {(user.role === 'admin' || user.role === 'moderator') && (
            <div className="flex flex-col gap-2">
              <Link 
                to="/admin" 
                className="w-full flex items-center justify-between px-4 py-3.5 transition-all bg-gradient-to-r from-red-600/25 via-red-700/15 to-transparent border border-red-500/30 rounded-2xl text-white font-bold hover:border-red-500/60 shadow-lg shadow-red-900/20 active:scale-95"
              >
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
                  <span className="text-sm font-bold text-red-400">
                    {user.role === 'admin' ? 'Admin Panel (অ্যাডমিন)' : 'Moderator Panel (মডারেটর)'}
                  </span>
                </div>
                <ArrowLeft className="w-4 h-4 opacity-75 rotate-180 text-red-400" />
              </Link>

              {user.role === 'moderator' && (
                <button 
                  onClick={() => setActiveTab('moderator_tools')}
                  className={`w-full flex items-center justify-between px-4 py-3.5 transition-all rounded-2xl border font-bold shadow-lg active:scale-95 ${activeTab === 'moderator_tools' ? 'bg-gradient-to-r from-red-600/35 via-purple-600/25 to-pink-600/20 border-red-500/60 text-white' : 'bg-red-950/20 border-red-500/30 text-red-400 hover:bg-red-950/40'}`}
                >
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-red-400 shrink-0 animate-pulse" />
                    <span className="text-sm font-bold">
                      মডারেটর অপশন (Mod Tools)
                    </span>
                  </div>
                  <span className="text-[10px] bg-red-500/30 text-white px-2 py-0.5 rounded-full font-bold">
                    {userModeratorTools.length} Tools
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Premium & VIP Group */}
          <div className="bg-[#111]/80 backdrop-blur-md rounded-2xl border border-yellow-500/20 overflow-hidden shadow-lg shadow-yellow-500/5">
            <button 
              onClick={() => setActiveTab('vip')}
              className={`w-full flex items-center justify-between px-4 py-4 transition-all border-b border-yellow-500/10 ${activeTab === 'vip' ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 text-yellow-400' : 'text-yellow-500 hover:bg-yellow-500/10'}`}
            >
              <div className="flex items-center gap-3 font-bold">
                <Crown className="w-5 h-5 text-amber-400" /> 
                {user.role === 'admin' || user.role === 'moderator'
                  ? 'VIP Packages (প্যাকেজ ক্রয় / রিচার্জ)'
                  : user.isVIP 
                  ? 'VIP Status (সক্রিয়)' 
                  : 'Upgrade to VIP (আপগ্রেড)'}
              </div>
              <ArrowLeft className="w-4 h-4 opacity-50 rotate-180" />
            </button>
            <button 
              onClick={() => setActiveTab('redeem')}
              className={`w-full flex items-center justify-between px-4 py-4 transition-all ${activeTab === 'redeem' ? 'bg-gradient-to-r from-indigo-500/20 to-indigo-600/10 text-indigo-400' : 'text-indigo-400 hover:bg-indigo-500/10'}`}
            >
              <div className="flex items-center gap-3 font-bold">
                <Gift className="w-5 h-5" /> 
                Redeem Code
              </div>
              <ArrowLeft className="w-4 h-4 opacity-50 rotate-180" />
            </button>
          </div>

          {/* Account Group */}
          <div className="bg-[#111]/80 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden flex flex-col">
            <button 
              onClick={() => setActiveTab('edit')}
              className={`w-full flex items-center justify-between px-4 py-4 transition-all border-b border-white/5 ${activeTab === 'edit' ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
            >
              <div className="flex items-center gap-3 font-semibold">
                <Settings className="w-5 h-5 text-gray-400" /> Edit Profile
              </div>
              <ArrowLeft className="w-4 h-4 opacity-30 rotate-180" />
            </button>

            <Link 
              to="/history"
              className="w-full flex items-center justify-between px-4 py-4 transition-all border-b border-white/5 text-gray-300 hover:bg-white/5 hover:text-white"
            >
              <div className="flex items-center gap-3 font-semibold">
                <History className="w-5 h-5 text-gray-400" /> Watch History
              </div>
              <ArrowLeft className="w-4 h-4 opacity-30 rotate-180" />
            </Link>

            <Link 
              to="/favorites"
              className="w-full flex items-center justify-between px-4 py-4 transition-all text-gray-300 hover:bg-white/5 hover:text-white"
            >
              <div className="flex items-center gap-3 font-semibold">
                <Heart className="w-5 h-5 text-gray-400" /> Saved Videos
              </div>
              <ArrowLeft className="w-4 h-4 opacity-30 rotate-180" />
            </Link>
          </div>

          {/* Engagement Group */}
          <div className="bg-[#111]/80 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden flex flex-col">
            <button 
              onClick={() => setActiveTab('referral')}
              className={`w-full flex items-center justify-between px-4 py-4 transition-all border-b border-white/5 ${activeTab === 'referral' ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
            >
              <div className="flex items-center gap-3 font-semibold">
                <Users className="w-5 h-5 text-blue-400" /> Refer & Earn
              </div>
              <ArrowLeft className="w-4 h-4 opacity-30 rotate-180" />
            </button>

            <button 
              onClick={() => setActiveTab('payments')}
              className={`w-full flex items-center justify-between px-4 py-4 transition-all border-b border-white/5 ${activeTab === 'payments' ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
            >
              <div className="flex items-center gap-3 font-semibold">
                <CreditCard className="w-5 h-5 text-green-400" /> Payments
              </div>
              <ArrowLeft className="w-4 h-4 opacity-30 rotate-180" />
            </button>

            <button 
              onClick={() => setActiveTab('support')}
              className={`w-full flex items-center justify-between px-4 py-4 transition-all ${activeTab === 'support' ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
            >
              <div className="flex items-center gap-3 font-semibold">
                <LifeBuoy className="w-5 h-5 text-purple-400" /> Support
              </div>
              <ArrowLeft className="w-4 h-4 opacity-30 rotate-180" />
            </button>
          </div>

          {/* App & Legal Group */}
          <div className="bg-[#111]/80 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden flex flex-col">
            {settings?.appDownloadLink && (
              <Link 
                to="/download-app"
                className="w-full flex items-center justify-between px-4 py-4 transition-all border-b border-white/5 text-gray-300 hover:bg-white/5 hover:text-red-400 group cursor-pointer"
              >
                <div className="flex items-center gap-3 font-semibold group-hover:text-red-400 transition-colors">
                  <Upload className="w-5 h-5 rotate-180 text-red-500" /> Download App
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-semibold border border-red-500/30">Direct APK</span>
                  <ArrowLeft className="w-4 h-4 opacity-30 rotate-180" />
                </div>
              </Link>
            )}

            <button 
              onClick={() => setActiveTab('privacy')}
              className={`w-full flex items-center justify-between px-4 py-4 transition-all border-b border-white/5 ${activeTab === 'privacy' ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
            >
              <div className="flex items-center gap-3 font-semibold">
                <ShieldAlert className="w-5 h-5 text-gray-400" /> Privacy Policy
              </div>
              <ArrowLeft className="w-4 h-4 opacity-30 rotate-180" />
            </button>

            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-between px-4 py-4 transition-all text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <div className="flex items-center gap-3 font-semibold">
                <LogOut className="w-5 h-5" /> Log Out
              </div>
              <ArrowLeft className="w-4 h-4 opacity-30 rotate-180" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className={`flex-1 w-full min-w-0 ${activeTab === 'menu' ? 'hidden md:block' : 'block'}`}>
          {/* Mobile Back Button */}
          {activeTab !== 'menu' && (
            <div className="md:hidden mb-6">
              <button 
                onClick={() => setActiveTab('menu')}
                className="flex items-center gap-2 text-white font-bold bg-white/10 px-4 py-2 rounded-xl hover:bg-white/20 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" /> Back to Menu
              </button>
            </div>
          )}

          {/* Moderator Tools Workspace Section */}
          {((activeTab === 'menu' && user.role === 'moderator') || activeTab === 'moderator_tools') && (
            <div className="rounded-3xl border border-red-500/30 bg-gradient-to-b from-[#180a0f] via-[#0d090d] to-black p-5 sm:p-7 shadow-2xl shadow-red-950/20 animate-in fade-in slide-in-from-bottom-4 duration-500 mb-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-red-600/30 shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl sm:text-2xl font-black text-white">
                        মডারেটর অপশন ও ওয়ার্কস্পেস
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold text-[11px] border border-red-500/30">
                        Active
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                      এডমিন কর্তৃক আপনাকে অনুমোদিত সকল মডারেটর অপশন নিচে সাজানো রয়েছে:
                    </p>
                  </div>
                </div>

                <Link
                  to="/admin"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/25 active:scale-95 transition-all whitespace-nowrap"
                >
                  <span>সম্পূর্ণ প্যানেলে যান</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>


              {/* Tools Grid */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-red-400" />
                    আপনার অনুমোদিত অপশনসমূহ ({userModeratorTools.length} টি)
                  </h3>
                </div>

                {userModeratorTools.length === 0 ? (
                  <div className="text-center py-12 rounded-2xl bg-white/[0.02] border border-white/5">
                    <ShieldAlert className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                    <h4 className="text-white font-bold text-base mb-1">কোনো নির্দিষ্ট অপশন এসাইন করা হয়নি</h4>
                    <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                      এডমিন এখনও আপনাকে কোনো নির্দিষ্ট অপশন এসাইন করেননি। আপনি ডিফল্ট মডারেটর হিসেবে কাজ করতে পারবেন।
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {userModeratorTools.map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <div
                          key={tool.id}
                          className={`relative group flex flex-col justify-between p-4.5 rounded-2xl border bg-gradient-to-br ${tool.color} transition-all duration-300 hover:scale-[1.01] hover:border-red-500/50 shadow-md`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="p-2.5 rounded-xl bg-black/50 border border-white/10 text-white group-hover:border-red-500/40 transition-colors">
                                  <Icon className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-white text-sm sm:text-base group-hover:text-red-400 transition-colors">
                                    {tool.titleBn}
                                  </h4>
                                  <span className="text-[11px] text-zinc-400 block font-mono">
                                    {tool.title}
                                  </span>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-bold text-zinc-300 uppercase">
                                {tool.badge}
                              </span>
                            </div>

                            <p className="text-xs text-zinc-300/80 leading-relaxed mb-4">
                              {tool.desc}
                            </p>
                          </div>

                          <Link
                            to={tool.href}
                            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/10 hover:bg-red-600 text-white font-bold text-xs transition-all active:scale-95 shadow-sm"
                          >
                            <span>অপশনে যান</span>
                            <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'menu' && user.role !== 'moderator' && (
            <div className="hidden md:flex flex-col items-center justify-center h-full min-h-[400px] text-gray-500 border border-white/5 rounded-2xl bg-white/5">
              <Crown className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg">Select an option from the menu</p>
            </div>
          )}

          {activeTab === 'edit' && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl font-bold text-white mb-6">Edit Profile</h2>
              
              <div className="mb-8">
                <label className="mb-2 block text-sm font-medium text-gray-400">Profile Picture</label>
                <button 
                  onClick={handleChangeAvatar}
                  disabled={isUploading}
                  className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" /> 
                  {isUploading ? 'Updating...' : 'Change Picture URL'}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-400">Email Address</label>
                  <input 
                    type="text" 
                    value={user.email} 
                    disabled 
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2 text-white opacity-60"
                  />
                  <p className="mt-1 text-xs text-gray-500">Email cannot be changed.</p>
                </div>
                
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-400">Display Name (Username)</label>
                  <input 
                    type="text" 
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black px-4 py-2 text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-400">Mobile Number (মোবাইল নাম্বার)</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-500">
                      <Phone className="h-4 w-4" />
                    </div>
                    <input 
                      type="tel" 
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      className="w-full rounded-lg border border-white/10 bg-black pl-10 pr-4 py-2 text-white placeholder:text-gray-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-400">New Password (leave blank to keep current)</label>
                  <input 
                    type="password" 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                    className="w-full rounded-lg border border-white/10 bg-black px-4 py-2 text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>

                <div className="pt-4 border-t border-white/5">
                  <h3 className="text-sm font-bold text-white mb-4">Social Links</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-400">Facebook URL (Optional)</label>
                      <input 
                        type="url" 
                        value={facebookUrl} 
                        onChange={(e) => setFacebookUrl(e.target.value)}
                        placeholder="https://facebook.com/..."
                        className="w-full rounded-lg border border-white/10 bg-black px-4 py-2 text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-400">Twitter URL (Optional)</label>
                      <input 
                        type="url" 
                        value={twitterUrl} 
                        onChange={(e) => setTwitterUrl(e.target.value)}
                        placeholder="https://twitter.com/..."
                        className="w-full rounded-lg border border-white/10 bg-black px-4 py-2 text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleSaveProfile}
                  disabled={saveStatus === 'saving' || newName.trim() === ''}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {saveStatus === 'saving' ? (
                    'Saving...'
                  ) : saveStatus === 'saved' ? (
                    <><CheckCircle className="h-5 w-5" /> Saved Successfully</>
                  ) : (
                    <><Save className="h-5 w-5" /> Save Changes</>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'vip' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <VIPPurchase />
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl font-bold text-white mb-6">Payment History</h2>
              <PaymentHistory userId={user.id} />
            </div>
          )}

          {activeTab === 'support' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <SupportSection />
            </div>
          )}

          {activeTab === 'redeem' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <RedeemSection />
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-[#111]/80 backdrop-blur-md rounded-2xl border border-white/5 p-6 md:p-8">
                <div className="flex flex-col items-center text-center mb-8 pb-6 border-b border-white/5">
                  <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20">
                    <ShieldAlert className="w-8 h-8 text-red-500" />
                  </div>
                  <h2 className="text-2xl font-black text-white mb-2">Privacy Policy & Disclaimer</h2>
                  <p className="text-sm text-gray-400">Important rules and information regarding our service</p>
                </div>

                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                      <span className="text-blue-400 text-lg">💡</span>
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-base mb-1">সাধারণ সতর্কতা</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">এই ওয়েবসাইটের সকল কন্টেন্ট শুধুমাত্র সাধারণ বিনোদনের উদ্দেশ্যে শেয়ার করা হয়েছে।</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0 border border-purple-500/20">
                      <span className="text-purple-400 text-lg">📌</span>
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-base mb-1">মালিকানা দাবি</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">কোনো ভিডিও বা কন্টেন্টের মালিকানা আমরা দাবি করি না। সমস্ত অধিকার তাদের নিজ নিজ মালিকদের কাছে সংরক্ষিত (No ownership claimed. All rights belong to respective owners)।</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20">
                      <span className="text-red-400 text-lg">⚠️</span>
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-base mb-1">বয়সসীমা (১৮+)</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">এই ওয়েবসাইটটি শুধুমাত্র প্রাপ্তবয়স্কদের (১৮+) জন্য তৈরি করা হয়েছে। আপনার বয়স যদি ১৮ বছরের কম হয়ে থাকে, তবে দয়া করে এখনই এই ওয়েবসাইটটি ত্যাগ করুন।</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 border border-green-500/20">
                      <span className="text-green-400 text-lg">🛡️</span>
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-base mb-1">কমপ্লায়েন্স</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">এখানে প্রদর্শিত সকল মডেল বা অভিনয়শিল্পীর বয়স চিত্রগ্রহণের সময় নূন্যতম ১৮ বছর বা তার বেশি ছিল। আমরা বেআইনি বা অনুমতিবিহীন কোনো কন্টেন্ট সমর্থন করি না।</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'referral' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 shrink-0">
                     <Users className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Refer & Earn VIP</h2>
                    <p className="text-sm text-gray-400">Invite friends and get free premium days</p>
                  </div>
                </div>
                
                {user.referralCode && (
                  <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 border border-yellow-500/20 px-5 py-2 rounded-2xl text-center shrink-0 self-start sm:self-auto">
                    <p className="text-[10px] text-yellow-500/80 font-bold uppercase tracking-widest mb-1">Your Points</p>
                    <p className="text-2xl font-black text-yellow-500 leading-none">{user.points || 0}</p>
                  </div>
                )}
              </div>

              {!user.referralCode ? (
                <div className="bg-white/5 rounded-3xl p-8 border border-white/10 text-center mt-8">
                   <div className="animate-pulse w-16 h-16 bg-white/10 rounded-full mx-auto mb-4" />
                   <h3 className="text-xl font-bold text-gray-500 mb-2">Generating Link...</h3>
                   <div className="h-4 w-48 bg-white/5 rounded mx-auto" />
                </div>
              ) : (
                <div className="space-y-6">
                   <div className="bg-white/5 rounded-3xl p-6 md:p-8 border border-white/10">
                     <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">Your Unique Referral Link</h3>
                     <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                       <div className="bg-black/50 flex-1 p-4 rounded-xl font-mono text-sm text-gray-300 border border-white/5 truncate flex items-center">
                         {`${window.location.origin}/register?ref=${user.referralCode}`}
                       </div>
                       <button 
                         onClick={handleCopyReferral}
                         className="flex shrink-0 items-center justify-center gap-2 px-6 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors font-bold text-sm"
                         title="Copy Link"
                       >
                         {referralCopied ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                         {referralCopied ? 'Copied' : 'Copy'}
                       </button>
                     </div>
                     <p className="text-xs text-gray-500 mt-4">
                       Earn <strong className="text-white">{settings?.referralSettings?.referrerReward || 50} points</strong> for every new user who signs up with this link.
                     </p>
                   </div>

                   <div className="bg-black/20 rounded-3xl p-6 md:p-8 border border-white/5">
                     <div className="flex items-center gap-2 mb-6">
                       <Crown className="w-5 h-5 text-yellow-500" />
                       <h3 className="text-lg font-bold text-white">Redeem Points</h3>
                     </div>
                     
                     {redeemMessage.text && (
                       <div className={`text-sm mb-6 p-4 rounded-xl border ${redeemMessage.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                         {redeemMessage.text}
                       </div>
                     )}
                     
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {redeemPackages.map((pkg, idx) => (
                           <div key={idx} className="bg-gradient-to-b from-white/10 to-transparent border border-white/10 hover:border-white/20 rounded-2xl p-5 flex flex-col relative overflow-hidden group transition-all">
                              <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-bl-full -z-10 group-hover:bg-yellow-500/10 transition-colors"></div>
                              <h4 className="font-bold text-white text-2xl mb-1">{pkg.days} {pkg.days === 1 ? 'Day' : 'Days'}</h4>
                              <p className="text-yellow-500 text-sm font-bold mb-6 flex items-center gap-1.5">
                                <Gift className="w-4 h-4" /> {pkg.cost} pts
                              </p>
                              <button
                                onClick={() => handleRedeemPoints(pkg.cost, pkg.days)}
                                disabled={isRedeeming || (user.points || 0) < pkg.cost}
                                className="mt-auto w-full bg-white/10 hover:bg-yellow-500 hover:text-black text-white font-bold py-2.5 px-4 rounded-xl transition-all disabled:opacity-50 disabled:bg-white/5 disabled:text-gray-500 text-sm flex items-center justify-center gap-2"
                              >
                                {isRedeeming ? 'Processing...' : 'Redeem'}
                              </button>
                           </div>
                        ))}
                     </div>
                   </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
