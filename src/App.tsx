/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigationType } from 'react-router-dom';
import { PublicLayout } from './components/layout/PublicLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { Home } from './pages/public/Home';
import { RedirectPage } from './pages/public/RedirectPage';
import { VideoPage } from './pages/public/VideoPage';
import { CategoriesPage } from './pages/public/CategoriesPage';
import { CategoryView } from './pages/public/CategoryView';
import { Dashboard } from './pages/admin/Dashboard';
import { UploadVideo } from './pages/admin/UploadVideo';
import { BloggerImport } from './pages/admin/BloggerImport';
import { Settings } from './pages/admin/Settings';
import { VIPSettings } from './pages/admin/VIPSettings';
import { SupportSettings } from './pages/admin/SupportSettings';
import { TelegramSettings } from './pages/admin/TelegramSettings';
import { TelegramCustomPosts } from './pages/admin/TelegramCustomPosts';
import { NoticeSettings } from './pages/admin/NoticeSettings';
import { Login } from './pages/public/Login';
import { Register } from './pages/public/Register';
import { ForgotPassword } from './pages/public/ForgotPassword';
import { HistoryPage } from './pages/public/HistoryPage';
import { FavoritesPage } from './pages/public/FavoritesPage';
import { WatchLaterPage } from './pages/public/WatchLaterPage';
import { ProfilePage } from './pages/public/ProfilePage';
import { PremiumPage } from './pages/public/PremiumPage';
import { SearchPage } from './pages/public/SearchPage';
import { TrendingPage } from './pages/public/TrendingPage';
import { DownloadAppPage } from './pages/public/DownloadAppPage';

import { useAuthStore } from './store/authStore';
import { useSettingsStore } from './store/settingsStore';
import { useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { auth, isFirebaseConfigured } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { SiteSettings } from './types';
import { DEFAULT_SITE_NAME, getConfiguredAdminEmail, isAdminUser } from './lib/adminConfig';

import { AdminVideos } from './pages/admin/AdminVideos';
import { OnlineUsers } from './pages/admin/OnlineUsers';
import { Categories } from './pages/admin/Categories';
import { PremiumUsers } from './pages/admin/PremiumUsers';
import { Users } from './pages/admin/Users';
import { Moderators } from './pages/admin/Moderators';
import { Comments } from './pages/admin/Comments';
import { Reports } from './pages/admin/Reports';
import { Advertisements } from './pages/admin/Advertisements';
import { Banners } from './pages/admin/Banners';
import { VIPRequests } from './pages/admin/VIPRequests';
import { GiftPremium } from './pages/admin/GiftPremium';
import { AdminNotifications } from './pages/admin/Notifications';
import { AdminLogs } from './pages/admin/AdminLogs';
import { ReferralSettings } from './pages/admin/ReferralSettings';
import { RedeemCodes } from './pages/admin/RedeemCodes';
import { SupabaseMigration } from './pages/admin/SupabaseMigration';
import { PlatformSetup } from './pages/admin/PlatformSetup';
import { GlobalAds } from './components/ui/GlobalAds';
import { OnlineTracker } from './components/ui/OnlineTracker';
import { AdultWarningModal } from './components/ui/AdultWarningModal';
import { WelcomeNoticeModal } from './components/ui/WelcomeNoticeModal';
import { TelegramLauncherModal } from './components/ui/TelegramLauncherModal';

import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { PhoneNumberPrompt } from './components/auth/PhoneNumberPrompt';

function ScrollManager() {
  const location = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    // Scroll to top on standard navigation. 
    // Leave alone on 'POP' (back button) so the browser can natively restore scroll.
    if (navType !== 'POP') {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, navType]);

  return null;
}

function SetupRouteGuard() {
  const user = useAuthStore(state => state.user);
  const settings = useSettingsStore(state => state.settings);

  const needsInitialSetup = !isSupabaseConfigured() || !isFirebaseConfigured();
  if (needsInitialSetup || isAdminUser(user, settings)) {
    return <PlatformSetup standalone />;
  }

  return <Navigate to="/" replace />;
}

const getCachedPhone = (uid?: string, email?: string) => {
  if (typeof window === 'undefined') return null;
  if (uid) {
    const p = localStorage.getItem(`verified_phone_${uid}`);
    if (p) return p;
  }
  if (email) {
    const p = localStorage.getItem(`verified_phone_${email.toLowerCase()}`);
    if (p) return p;
  }
  return null;
};

const setCachedPhone = (uid?: string, email?: string, phoneVal?: string) => {
  if (typeof window === 'undefined' || !phoneVal) return;
  if (uid) localStorage.setItem(`verified_phone_${uid}`, phoneVal);
  if (email) localStorage.setItem(`verified_phone_${email.toLowerCase()}`, phoneVal);
};

export default function App() {

  const isLoading = useAuthStore(state => state.isLoading);
  const user = useAuthStore(state => state.user);
  const { setLoading, setUser, setFirebaseUser } = useAuthStore();
  const { settings, setSettings } = useSettingsStore();

  // Synchronize is-admin class on document.body so admin can tap & hold to copy anywhere
  useEffect(() => {
    const isAdmin = isAdminUser(user, settings);
    if (isAdmin) {
      document.body.classList.add('is-admin');
    } else {
      document.body.classList.remove('is-admin');
    }
  }, [user, settings]);

  // Synchronize document title, meta tags, and favicon dynamically from admin settings
  useEffect(() => {
    const siteName = settings?.seoSettings?.siteTitle || settings?.siteName || DEFAULT_SITE_NAME;
    const description =
      settings?.seoSettings?.metaDescription ||
      settings?.siteDescription ||
      'Modern video streaming platform with creator management and VIP memberships.';

    document.title = siteName;

    const setMeta = (selector: string, content: string) => {
      const el = document.querySelector(selector);
      if (el && content) el.setAttribute('content', content);
    };

    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', siteName);
    setMeta('meta[property="og:description"]', description);

    if (settings?.favicon) {
      let iconEl = document.querySelector('link[rel~="icon"]') as HTMLLinkElement | null;
      if (!iconEl) {
        iconEl = document.createElement('link');
        iconEl.rel = 'icon';
        document.head.appendChild(iconEl);
      }
      iconEl.href = settings.favicon;
    }
  }, [settings]);

  // Anti-Piracy / Content Protection (Exempts Admin: Admin can tap & hold to copy any text)
  useEffect(() => {
    const checkIsAdmin = () => {
      const u = useAuthStore.getState().user;
      const s = useSettingsStore.getState().settings;
      return isAdminUser(u, s);
    };

    // Disable right click globally for non-admins
    const handleContextMenu = (e: MouseEvent) => {
      if (checkIsAdmin()) return; // Admin has full right-click access
      if (!window.location.pathname.startsWith('/admin')) {
        e.preventDefault();
      }
    };

    // Disable keyboard shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+C) for non-admins
    const handleKeyDown = (e: KeyboardEvent) => {
      if (checkIsAdmin()) return; // Admin can use all copy shortcuts
      if (window.location.pathname.startsWith('/admin')) return;
      
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
      }
      // Ctrl+Shift+I (Inspector) / Ctrl+Shift+J (Console) / Ctrl+Shift+C (Element selector)
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
      }
      // Ctrl+U (View Source)
      if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
      }
      // Ctrl+C (Copy)
      if (e.ctrlKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
      }
    };

    // Prevent text selection for non-admins (Admin can tap and select any text)
    const handleSelectStart = (e: Event) => {
      if (checkIsAdmin()) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
    };

    // Prevent clipboard copy event for non-admins
    const handleCopy = (e: ClipboardEvent) => {
      if (checkIsAdmin()) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
    };

    // Disable Dragging of Images/Links for non-admins
    const handleDragStart = (e: DragEvent) => {
      if (checkIsAdmin()) return;
      if (window.location.pathname.startsWith('/admin')) return;
      if (e.target && ((e.target as HTMLElement).tagName === 'IMG' || (e.target as HTMLElement).tagName === 'A')) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('copy', handleCopy);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('copy', handleCopy);
    };
  }, []);

  // Notification system
  useEffect(() => {
    try {
      if ('Notification' in window && typeof Notification.requestPermission === 'function') {
        if (Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }
      }
    } catch (e) {}
    
    if (!isSupabaseConfigured()) return;

    // Subscribe to new videos
    const channel = supabase.channel('public:videos')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'videos' },
        (payload) => {
          const video = payload.new;
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('নতুন ভিডিও আপলোড হয়েছে!', {
                body: video.title || 'এখনই দেখুন আমাদের ওয়েবসাইটে',
                icon: video.thumbnail_url || '/icon.png'
              });
            } catch (e) {
              console.error('Notification error', e);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    // Load Global Settings
    async function loadSettings() {
      const defaultSettings: Partial<SiteSettings> = {
        siteName: DEFAULT_SITE_NAME,
        logo: 'SH',
        cloudinaryCloudName: '',
        cloudinaryUploadPreset: '',
        adsEnabled: true,
        customAds: {
          vastUrl: '',
          popunder: '',
          socialBar: '',
          nativeBanner: '',
          banner300x250: '',
          banner468x60: '',
          banner320x50: '',
          banner728x90: '',
          toggles: {
            vastUrl: false,
          }
        }
      };

      if (!isSupabaseConfigured()) {
        setSettings(defaultSettings as SiteSettings);
        document.title = defaultSettings.siteName || DEFAULT_SITE_NAME;
        return;
      }

      try {
        const { data } = await supabase
          .from('settings')
          .select('*')
          .eq('id', 'general')
          .single();

        if (data) {
          let sd;
          if (data.data) {
            sd = data.data as SiteSettings;
          } else {
            sd = {
              siteName: data.site_name || DEFAULT_SITE_NAME,
              logo: data.logo || 'SH',
              cloudinaryCloudName: data.cloudinary_cloud_name || '',
              cloudinaryUploadPreset: data.cloudinary_upload_preset || '',
              adsEnabled: data.ads_enabled !== false,
              requireLoginToWatch: data.require_login_to_watch,
              siteDescription: data.site_description,
              logoImageUrl: data.logo_image_url,
              telegramUrl: data.telegram_url,
              favicon: data.favicon,
              allowUserUpload: data.allow_user_upload !== false,
              allowComments: data.allow_comments !== false,
              customAds: data.custom_ads
            } as SiteSettings;
          }
          
          setSettings(sd);
          document.title = sd.siteName || DEFAULT_SITE_NAME;
        } else {
          setSettings(defaultSettings as SiteSettings);
          document.title = defaultSettings.siteName || DEFAULT_SITE_NAME;
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
        setSettings(defaultSettings as SiteSettings);
      }
    }
    
    loadSettings();

    const checkUser = async () => {
      // Firebase auth handles session check automatically
    };

    let userSubscriptionChannel: any = null;
    let userSyncInterval: any = null;
    let focusListener: (() => void) | null = null;
    let customUpdateListener: (() => void) | null = null;

    const cleanupListeners = () => {
      if (userSubscriptionChannel) {
        supabase.removeChannel(userSubscriptionChannel);
        userSubscriptionChannel = null;
      }
      if (userSyncInterval) {
        clearInterval(userSyncInterval);
        userSyncInterval = null;
      }
      if (focusListener) {
        window.removeEventListener('focus', focusListener);
        focusListener = null;
      }
      if (customUpdateListener) {
        window.removeEventListener('user-vip-updated', customUpdateListener);
        customUpdateListener = null;
      }
    };

    const handleAuthSession = async (firebaseUser: any) => {
      cleanupListeners();

      if (firebaseUser) {
        setFirebaseUser(firebaseUser);
        if (!isSupabaseConfigured()) {
          const userEmail = (firebaseUser.email || '').toLowerCase();
          const configuredAdmin = getConfiguredAdminEmail(useSettingsStore.getState().settings);
          setUser({
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'User',
            email: userEmail,
            role: configuredAdmin && userEmail === configuredAdmin ? 'admin' : 'user',
            status: 'active',
            createdAt: Date.now(),
            isVIP: false,
            vipExpiresAt: null
          } as any);
          setLoading(false);
          return;
        }
        try {
          let resolvedUser: any = null;

          const { data: userDoc, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', firebaseUser.uid)
            .single();

          if (userDoc && !error) {
            resolvedUser = userDoc;
            const isVIPExpired = resolvedUser.is_vip && resolvedUser.vip_expires_at && resolvedUser.vip_expires_at < Date.now();
            
            // Auto-revoke VIP if expired
            if (isVIPExpired) {
               supabase.from('users').update({ is_vip: false, vip_expires_at: null, device_limit: 1, devices: [] }).eq('id', resolvedUser.id).then();
               resolvedUser.is_vip = false;
               resolvedUser.vip_expires_at = null;
               resolvedUser.device_limit = 1;
               resolvedUser.devices = [];
            }

            const cachedPhone = getCachedPhone(resolvedUser.id, resolvedUser.email) || getCachedPhone(firebaseUser.uid, firebaseUser.email);
            const finalPhone = resolvedUser.phone || resolvedUser.phone_number || resolvedUser.mobile || cachedPhone || undefined;
            if (finalPhone) {
              setCachedPhone(resolvedUser.id, resolvedUser.email, finalPhone);
              if (!resolvedUser.phone) {
                supabase.from('users').update({ phone: finalPhone }).eq('id', resolvedUser.id).then();
              }
            }

            const isModOrAdmin = resolvedUser.role === 'admin' || resolvedUser.role === 'moderator';
            let modPerms: string[] = [];
            if (resolvedUser.role === 'moderator') {
              try {
                const { data: modSetting } = await supabase.from('settings').select('data').eq('id', 'moderator_permissions').maybeSingle();
                if (modSetting?.data?.assignments) {
                  const assignment = modSetting.data.assignments[resolvedUser.id] || (resolvedUser.email ? modSetting.data.assignments[resolvedUser.email.toLowerCase()] : null);
                  if (assignment?.permissions && Array.isArray(assignment.permissions)) {
                    modPerms = assignment.permissions;
                  }
                }
              } catch (e) {
                console.warn("Could not load moderator permissions", e);
              }
            }

            const mappedUser = { 
               ...resolvedUser, 
               isVIP: isModOrAdmin ? false : (!isVIPExpired && Boolean(resolvedUser.is_vip)),
               vipExpiresAt: isModOrAdmin ? undefined : resolvedUser.vip_expires_at,
               permissions: modPerms.length > 0 ? modPerms : (resolvedUser.permissions || []),
               phone: finalPhone,
               createdAt: resolvedUser.created_at,
               profileImage: resolvedUser.profile_image,
               referralCode: resolvedUser.referral_code,
               isBannedFromComments: resolvedUser.is_banned_from_comments,
               socialLinks: resolvedUser.social_links,
               deviceLimit: resolvedUser.device_limit || 1,
               devices: resolvedUser.devices || []
            };
            setUser(mappedUser as any);
 
          } else {
            // Create user if doc doesn't exist, checking email first and auto-bootstrapping the first admin on a fresh DB
            const userEmail = (firebaseUser.email || '').toLowerCase();
            const configuredAdmin = getConfiguredAdminEmail(useSettingsStore.getState().settings);
            let isAdmin = Boolean(configuredAdmin && userEmail === configuredAdmin);
            if (!isAdmin) {
              const { count: adminCount } = await supabase
                .from('users')
                .select('id', { count: 'exact', head: true })
                .eq('role', 'admin');
              if (adminCount === 0) {
                isAdmin = true;
              }
            }
            
            const { data: existingUsers } = await supabase.from('users').select('*').eq('email', userEmail).order('created_at', { ascending: true });
            
            if (existingUsers && existingUsers.length > 0) {
              resolvedUser = existingUsers[0];
              
              const isVIPExpired = resolvedUser.is_vip && resolvedUser.vip_expires_at && resolvedUser.vip_expires_at < Date.now();
              if (isVIPExpired) {
                 supabase.from('users').update({ is_vip: false, vip_expires_at: null, device_limit: 1, devices: [] }).eq('id', resolvedUser.id).then();
                 resolvedUser.is_vip = false;
                 resolvedUser.vip_expires_at = null;
                 resolvedUser.device_limit = 1;
                 resolvedUser.devices = [];
              }

              const cachedPhone = getCachedPhone(resolvedUser.id, resolvedUser.email) || getCachedPhone(firebaseUser.uid, firebaseUser.email);
              const finalPhone = resolvedUser.phone || resolvedUser.phone_number || resolvedUser.mobile || cachedPhone || undefined;
              if (finalPhone) {
                setCachedPhone(resolvedUser.id, resolvedUser.email, finalPhone);
                if (!resolvedUser.phone) {
                  supabase.from('users').update({ phone: finalPhone }).eq('id', resolvedUser.id).then();
                }
              }

              const isModOrAdmin = resolvedUser.role === 'admin' || resolvedUser.role === 'moderator';
              let modPerms: string[] = [];
              if (resolvedUser.role === 'moderator') {
                try {
                  const { data: modSetting } = await supabase.from('settings').select('data').eq('id', 'moderator_permissions').maybeSingle();
                  if (modSetting?.data?.assignments) {
                    const assignment = modSetting.data.assignments[resolvedUser.id] || (resolvedUser.email ? modSetting.data.assignments[resolvedUser.email.toLowerCase()] : null);
                    if (assignment?.permissions && Array.isArray(assignment.permissions)) {
                      modPerms = assignment.permissions;
                    }
                  }
                } catch (e) {
                  console.warn("Could not load moderator permissions", e);
                }
              }

              const mappedUser = { 
                 ...resolvedUser, 
                 isVIP: isModOrAdmin ? false : (!isVIPExpired && Boolean(resolvedUser.is_vip)),
                 vipExpiresAt: isModOrAdmin ? undefined : resolvedUser.vip_expires_at,
                 permissions: modPerms.length > 0 ? modPerms : (resolvedUser.permissions || []),
                 phone: finalPhone,
                 createdAt: resolvedUser.created_at,
                 profileImage: resolvedUser.profile_image,
                 referralCode: resolvedUser.referral_code,
                 isBannedFromComments: resolvedUser.is_banned_from_comments,
                 socialLinks: resolvedUser.social_links,
                 deviceLimit: resolvedUser.device_limit || 1,
                 devices: resolvedUser.devices || []
              };
              setUser(mappedUser as any);
            } else {
              const cachedPhone = getCachedPhone(firebaseUser.uid, userEmail);
              const newUser = {
                id: firebaseUser.uid,
                name: firebaseUser.displayName || 'User',
                email: userEmail,
                phone: cachedPhone || null,
                role: isAdmin ? 'admin' : 'user', 
                status: 'active',
                created_at: Date.now(),
                is_vip: false,
                vip_expires_at: null
              };
              resolvedUser = newUser;
              
              await supabase.from('users').upsert([newUser]);
              setUser({ 
                ...newUser, 
                phone: cachedPhone || undefined,
                isVIP: false,
                vipExpiresAt: null,
                createdAt: newUser.created_at,
                deviceLimit: 1,
                devices: []
              } as any);
            }
          }

          // Active sync function to refresh user state when time is extended by admin
          const syncCurrentUserData = async () => {
            try {
              const current = useAuthStore.getState().user;
              const targetId = current?.id || resolvedUser?.id || firebaseUser.uid;
              const targetEmail = current?.email || firebaseUser.email;
              
              let doc: any = null;
              if (targetId) {
                const { data } = await supabase.from('users').select('*').eq('id', targetId).maybeSingle();
                doc = data;
              }
              if (!doc && targetEmail) {
                const { data } = await supabase.from('users').select('*').eq('email', targetEmail.toLowerCase()).order('created_at', { ascending: false }).limit(1);
                if (data && data.length > 0) doc = data[0];
              }

              if (doc) {
                const currentState = useAuthStore.getState().user;
                const activeRole = doc.role || currentState?.role || 'user';
                const isModOrAdmin = activeRole === 'admin' || activeRole === 'moderator';

                let modPerms: string[] = [];
                if (activeRole === 'moderator') {
                  try {
                    const { data: modSetting } = await supabase.from('settings').select('data').eq('id', 'moderator_permissions').maybeSingle();
                    if (modSetting?.data?.assignments) {
                      const assignment = modSetting.data.assignments[doc.id] || (doc.email ? modSetting.data.assignments[doc.email.toLowerCase()] : null);
                      if (assignment?.permissions && Array.isArray(assignment.permissions)) {
                        modPerms = assignment.permissions;
                      }
                    }
                  } catch (e) {}
                }

                const isVIPExpired = !isModOrAdmin && doc.is_vip && doc.vip_expires_at && doc.vip_expires_at < Date.now();
                const activeVIP = !isModOrAdmin && (!isVIPExpired && Boolean(doc.is_vip));
                const activeExpiry = isModOrAdmin ? null : (isVIPExpired ? null : doc.vip_expires_at);

                const cachedPhone = getCachedPhone(doc.id, doc.email) || currentState?.phone;
                const finalPhone = doc.phone || doc.phone_number || doc.mobile || currentState?.phone || cachedPhone;

                const roleChanged = doc.role && currentState.role !== doc.role;
                const finalPerms = modPerms.length > 0 ? modPerms : (doc.permissions || currentState.permissions || []);
                const permissionsChanged = JSON.stringify(currentState.permissions || []) !== JSON.stringify(finalPerms);

                if (currentState && (roleChanged || permissionsChanged || currentState.isVIP !== activeVIP || currentState.vipExpiresAt !== activeExpiry || currentState.points !== doc.points || (!currentState.phone && finalPhone))) {
                  setUser({
                    ...currentState,
                    ...doc,
                    isVIP: activeVIP,
                    vipExpiresAt: activeExpiry,
                    points: doc.points ?? currentState.points,
                    role: activeRole,
                    permissions: finalPerms,
                    phone: finalPhone || undefined
                  } as any);
                }
              }
            } catch (err) {
              // Ignore background polling errors
            }
          };

          // Poll every 3.5 seconds and listen to window focus / custom events
          userSyncInterval = setInterval(syncCurrentUserData, 3500);
          focusListener = syncCurrentUserData;
          customUpdateListener = syncCurrentUserData;
          window.addEventListener('focus', focusListener);
          window.addEventListener('user-vip-updated', customUpdateListener);

          // Subscribe to real-time changes for this user's record
          const targetSubId = resolvedUser?.id || firebaseUser.uid;
          userSubscriptionChannel = supabase.channel(`public:users:${targetSubId}`)
            .on(
              'postgres_changes',
              { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${targetSubId}` },
              async (payload) => {
                const updatedDoc = payload.new;
                const currentUser = useAuthStore.getState().user;
                if (currentUser) {
                  const activeRole = updatedDoc.role || currentUser.role;
                  const isModOrAdmin = activeRole === 'admin' || activeRole === 'moderator';

                  let modPerms: string[] = [];
                  if (activeRole === 'moderator') {
                    try {
                      const { data: modSetting } = await supabase.from('settings').select('data').eq('id', 'moderator_permissions').maybeSingle();
                      if (modSetting?.data?.assignments) {
                        const assignment = modSetting.data.assignments[updatedDoc.id] || (updatedDoc.email ? modSetting.data.assignments[updatedDoc.email.toLowerCase()] : null);
                        if (assignment?.permissions && Array.isArray(assignment.permissions)) {
                          modPerms = assignment.permissions;
                        }
                      }
                    } catch (e) {}
                  }

                  const isVIPExpired = !isModOrAdmin && updatedDoc.is_vip && updatedDoc.vip_expires_at && updatedDoc.vip_expires_at < Date.now();
                  const cachedPhone = getCachedPhone(updatedDoc.id, updatedDoc.email) || currentUser.phone;
                  const finalPhone = updatedDoc.phone || updatedDoc.phone_number || updatedDoc.mobile || currentUser.phone || cachedPhone;
                  setUser({
                    ...currentUser,
                    ...updatedDoc,
                    role: activeRole,
                    permissions: modPerms.length > 0 ? modPerms : (currentUser.permissions || []),
                    isVIP: !isModOrAdmin && (!isVIPExpired && Boolean(updatedDoc.is_vip)),
                    vipExpiresAt: isModOrAdmin ? null : (isVIPExpired ? null : updatedDoc.vip_expires_at),
                    createdAt: updatedDoc.created_at,
                    profileImage: updatedDoc.profile_image,
                    referralCode: updatedDoc.referral_code,
                    isBannedFromComments: updatedDoc.is_banned_from_comments,
                    socialLinks: updatedDoc.social_links,
                    phone: finalPhone || undefined
                  } as any);
                }
              }
            )
            .subscribe();

        } catch (error) {
          console.error("Error fetching user data:", error);
          const userEmail = (firebaseUser.email || '').toLowerCase();
          const configuredAdmin = getConfiguredAdminEmail(useSettingsStore.getState().settings);
          const isAdmin = Boolean(configuredAdmin && userEmail === configuredAdmin);
          const cachedPhone = getCachedPhone(firebaseUser.uid, userEmail);
          
          setUser({
            id: firebaseUser.uid,
            name: 'User',
            email: userEmail,
            role: isAdmin ? 'admin' : 'user',
            status: 'active',
            createdAt: Date.now(),
            isVIP: false,
            vipExpiresAt: null,
            phone: cachedPhone || undefined
          } as any);
        }
      } else {
        setFirebaseUser(null);
        setUser(null);
      }
      setLoading(false);
    };

    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        handleAuthSession(user);
      });
      return () => {
        unsubscribe();
        cleanupListeners();
      };
    } else {
      setLoading(false);
    }
  }, [setLoading, setUser, setFirebaseUser]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] text-white">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-400 font-medium tracking-widest animate-pulse">LOADING...</p>
      </div>
    );
  }

  return (
    <ThemeProvider>
    <LanguageProvider>
    <Router>
      <ScrollManager />
      <AdultWarningModal />
      <WelcomeNoticeModal />
      <TelegramLauncherModal />
      {Boolean(
        user &&
        user.role !== 'admin' &&
        user.role !== 'moderator' &&
        (!user.phone || user.phone.trim().length < 10)
      ) && <PhoneNumberPrompt />}
      <GlobalAds />
      <OnlineTracker />
      <Routes>
        {/* Public Routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/redirect" element={<RedirectPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/trending" element={<TrendingPage />} />
          <Route path="/premium" element={<PremiumPage />} />
          <Route path="/video/:slug" element={<VideoPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/category/:categoryName" element={<CategoryView />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/watch-later" element={<WatchLaterPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/download-app" element={<DownloadAppPage />} />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>

        {/* Buyer Initial Setup Route (public only until DB + Firebase configured, otherwise admin-only) */}
        <Route path="/setup" element={<SetupRouteGuard />} />

        {/* Admin Routes (Protected via AdminLayout) */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="videos" element={<AdminVideos />} />
          <Route path="videos/upload" element={<UploadVideo />} />
          <Route path="videos/blogger-import" element={<BloggerImport />} />
          <Route path="settings" element={<Settings />} />
          <Route path="platform-setup" element={<PlatformSetup />} />
          <Route path="notice-settings" element={<NoticeSettings />} />
          <Route path="vip-settings" element={<VIPSettings />} />
          <Route path="support-settings" element={<SupportSettings />} />
          <Route path="telegram-settings" element={<TelegramSettings />} />
          <Route path="telegram-auto-post" element={<TelegramCustomPosts />} />
          <Route path="referral-settings" element={<ReferralSettings />} />
          
          {/* Manage Application Data */}
          <Route path="vip-requests" element={<VIPRequests />} />
          <Route path="gift-premium" element={<GiftPremium />} />
          <Route path="redeem-codes" element={<RedeemCodes />} />
          <Route path="categories" element={<Categories />} />
          <Route path="users" element={<Users />} />
          <Route path="moderators" element={<Moderators />} />
          <Route path="online-users" element={<OnlineUsers />} />
          <Route path="premium-users" element={<PremiumUsers />} />
          <Route path="banners" element={<Banners />} />
          <Route path="comments" element={<Comments />} />
          <Route path="reports" element={<Reports />} />
          <Route path="ads" element={<Advertisements />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="logs" element={<AdminLogs />} />
          <Route path="migrate-supabase" element={<SupabaseMigration />} />
          
          {/* Catch-all for other admin routes during MVP */}
          <Route path="*" element={<Dashboard />} />
        </Route>

        {/* 404 Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
    </LanguageProvider>
    </ThemeProvider>
  );
}
