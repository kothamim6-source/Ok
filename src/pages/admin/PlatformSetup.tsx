import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Database,
  Flame,
  ShieldCheck,
  Cloud,
  Globe,
  Download,
  Copy,
  Check,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  ArrowRight,
  DollarSign
} from 'lucide-react';
import {
  supabase,
  isSupabaseConfigured,
  getSupabaseConfigInfo,
  saveBuyerSupabaseConfig,
  clearBuyerSupabaseConfig
} from '../../lib/supabase';
import {
  isFirebaseConfigured,
  getFirebaseConfigInfo,
  saveBuyerFirebaseConfig,
  clearBuyerFirebaseConfig
} from '../../lib/firebase';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { SiteSettings } from '../../types';
import { DEFAULT_SITE_NAME } from '../../lib/adminConfig';

export function PlatformSetup({ standalone = false }: { standalone?: boolean }) {
  const { settings, setSettings } = useSettingsStore();
  const { user } = useAuthStore();

  const sbInfo = getSupabaseConfigInfo();
  const fbInfo = getFirebaseConfigInfo();

  // Supabase & Firebase credentials (stored locally in browser for instant preview or exported to .env)
  const [sbUrl, setSbUrl] = useState(sbInfo.url);
  const [sbAnonKey, setSbAnonKey] = useState(sbInfo.anonKey);
  const [fbApiKey, setFbApiKey] = useState(fbInfo.config.apiKey);
  const [fbAuthDomain, setFbAuthDomain] = useState(fbInfo.config.authDomain);
  const [fbProjectId, setFbProjectId] = useState(fbInfo.config.projectId);
  const [fbStorageBucket, setFbStorageBucket] = useState(fbInfo.config.storageBucket);
  const [fbMessagingSenderId, setFbMessagingSenderId] = useState(fbInfo.config.messagingSenderId);
  const [fbAppId, setFbAppId] = useState(fbInfo.config.appId);
  const [fbMeasurementId, setFbMeasurementId] = useState(fbInfo.config.measurementId || '');

  // Platform settings stored in Supabase `settings`
  const [adminEmail, setAdminEmail] = useState(settings?.adminEmail || '');
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState(settings?.cloudinaryCloudName || '');
  const [cloudinaryUploadPreset, setCloudinaryUploadPreset] = useState(settings?.cloudinaryUploadPreset || '');
  const [adsterraApiToken, setAdsterraApiToken] = useState('');
  const [showAdsterraToken, setShowAdsterraToken] = useState(false);

  const [seoTitle, setSeoTitle] = useState(settings?.seoSettings?.siteTitle || '');
  const [seoDescription, setSeoDescription] = useState(settings?.seoSettings?.metaDescription || settings?.siteDescription || '');
  const [seoKeywords, setSeoKeywords] = useState(settings?.seoSettings?.keywords || '');
  const [seoSocialImage, setSeoSocialImage] = useState(settings?.seoSettings?.socialImage || '');
  const [favicon, setFavicon] = useState(settings?.favicon || '');
  const [appSizeLabel, setAppSizeLabel] = useState(settings?.appSizeLabel || '');
  const [giftSupportLink, setGiftSupportLink] = useState(settings?.giftSupportLink || '');

  const [isSavingRemote, setIsSavingRemote] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedEnv, setCopiedEnv] = useState(false);

  useEffect(() => {
    if (settings) {
      setAdminEmail(settings.adminEmail || '');
      setCloudinaryCloudName(settings.cloudinaryCloudName || '');
      setCloudinaryUploadPreset(settings.cloudinaryUploadPreset || '');
      setSeoTitle(settings.seoSettings?.siteTitle || '');
      setSeoDescription(settings.seoSettings?.metaDescription || settings.siteDescription || '');
      setSeoKeywords(settings.seoSettings?.keywords || '');
      setSeoSocialImage(settings.seoSettings?.socialImage || '');
      setFavicon(settings.favicon || '');
      setAppSizeLabel(settings.appSizeLabel || '');
      setGiftSupportLink(settings.giftSupportLink || '');
    }
  }, [settings]);

  useEffect(() => {
    async function loadSecrets() {
      if (!isSupabaseConfigured()) return;
      try {
        const { data } = await supabase
          .from('settings')
          .select('*')
          .eq('id', 'adsterra_secrets')
          .maybeSingle();
        if (data?.data?.apiToken) {
          setAdsterraApiToken(String(data.data.apiToken));
        }
      } catch (err) {
        console.warn('Could not read adsterra_secrets:', err);
      }
    }
    loadSecrets();
  }, []);

  const handleSavePlatformSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
      setStatusMsg({ type: 'error', text: 'আগে নিচে Supabase URL এবং Anon Key সেট করে সেভ করুন।' });
      return;
    }

    setIsSavingRemote(true);
    setStatusMsg(null);
    try {
      const updatedSettings: SiteSettings = {
        ...(settings || ({} as SiteSettings)),
        siteName: settings?.siteName || DEFAULT_SITE_NAME,
        siteDescription: seoDescription.trim(),
        allowUserUpload: settings?.allowUserUpload ?? true,
        allowComments: settings?.allowComments ?? true,
        adsEnabled: settings?.adsEnabled ?? true,
        maintenanceMode: settings?.maintenanceMode ?? false,
        adminEmail: adminEmail.trim().toLowerCase(),
        cloudinaryCloudName: cloudinaryCloudName.trim(),
        cloudinaryUploadPreset: cloudinaryUploadPreset.trim(),
        favicon: favicon.trim(),
        appSizeLabel: appSizeLabel.trim(),
        giftSupportLink: giftSupportLink.trim(),
        seoSettings: {
          siteTitle: seoTitle.trim(),
          metaDescription: seoDescription.trim(),
          keywords: seoKeywords.trim(),
          socialImage: seoSocialImage.trim()
        }
      };

      const { error } = await supabase.from('settings').upsert({
        id: 'general',
        data: updatedSettings
      });
      if (error) throw error;

      // Save Adsterra API Token to dedicated secrets row
      const { error: adErr } = await supabase.from('settings').upsert({
        id: 'adsterra_secrets',
        data: {
          apiToken: adsterraApiToken.trim(),
          updatedAt: Date.now()
        }
      });
      if (adErr) {
        console.warn('Could not save adsterra_secrets row:', adErr);
      }

      setSettings(updatedSettings);
      setStatusMsg({ type: 'success', text: 'Platform settings, API keys & SEO configuration saved to Supabase!' });
    } catch (err: any) {
      console.error('Error saving platform setup:', err);
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to save settings. Check database permissions.' });
    } finally {
      setIsSavingRemote(false);
    }
  };

  const handleSaveLocalKeysAndReload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sbUrl.trim() || !sbAnonKey.trim()) {
      setStatusMsg({ type: 'error', text: 'Supabase URL এবং Anon Key উভয়টি দিন।' });
      return;
    }
    if (!fbApiKey.trim() || !fbProjectId.trim()) {
      setStatusMsg({ type: 'error', text: 'Firebase API Key এবং Project ID দিন।' });
      return;
    }

    saveBuyerSupabaseConfig(sbUrl, sbAnonKey);
    saveBuyerFirebaseConfig({
      apiKey: fbApiKey.trim(),
      authDomain: fbAuthDomain.trim(),
      projectId: fbProjectId.trim(),
      storageBucket: fbStorageBucket.trim(),
      messagingSenderId: fbMessagingSenderId.trim(),
      appId: fbAppId.trim(),
      measurementId: fbMeasurementId.trim()
    });

    window.location.reload();
  };

  const handleClearLocalKeys = () => {
    clearBuyerSupabaseConfig();
    clearBuyerFirebaseConfig();
    window.location.reload();
  };

  const generateEnvContent = () => {
    return [
      `VITE_ADMIN_EMAIL="${adminEmail.trim()}"`,
      `VITE_SUPABASE_URL="${sbUrl.trim()}"`,
      `VITE_SUPABASE_ANON_KEY="${sbAnonKey.trim()}"`,
      `VITE_FIREBASE_API_KEY="${fbApiKey.trim()}"`,
      `VITE_FIREBASE_AUTH_DOMAIN="${fbAuthDomain.trim()}"`,
      `VITE_FIREBASE_PROJECT_ID="${fbProjectId.trim()}"`,
      `VITE_FIREBASE_STORAGE_BUCKET="${fbStorageBucket.trim()}"`,
      `VITE_FIREBASE_MESSAGING_SENDER_ID="${fbMessagingSenderId.trim()}"`,
      `VITE_FIREBASE_APP_ID="${fbAppId.trim()}"`,
      `VITE_FIREBASE_MEASUREMENT_ID="${fbMeasurementId.trim()}"`,
      `ADSTERRA_API_TOKEN="${adsterraApiToken.trim()}"`,
      `TELEGRAM_BOT_TOKEN=""`,
      `TELEGRAM_CHANNEL_ID=""`,
      `APP_URL="${typeof window !== 'undefined' ? window.location.origin : ''}"`
    ].join('\n');
  };

  const handleCopyEnv = () => {
    navigator.clipboard.writeText(generateEnvContent());
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2500);
  };

  const handleDownloadEnv = () => {
    const blob = new Blob([generateEnvContent()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '.env';
    a.click();
    URL.revokeObjectURL(url);
  };

  const checklist = [
    {
      label: 'Supabase Database Connection',
      ready: isSupabaseConfigured(),
      hint: isSupabaseConfigured() ? `Connected (${sbInfo.source})` : 'Add URL & Anon Key below or in .env'
    },
    {
      label: 'Firebase Authentication',
      ready: isFirebaseConfigured(),
      hint: isFirebaseConfigured() ? `Connected (${fbInfo.source})` : 'Add Firebase keys below or in .env'
    },
    {
      label: 'Website Name & Logo',
      ready: Boolean(settings?.siteName && settings.siteName !== DEFAULT_SITE_NAME),
      hint: settings?.siteName || 'Set in General Settings',
      to: '/admin/settings'
    },
    {
      label: 'Primary Admin Email',
      ready: Boolean(settings?.adminEmail || import.meta.env.VITE_ADMIN_EMAIL || user?.role === 'admin'),
      hint: settings?.adminEmail || import.meta.env.VITE_ADMIN_EMAIL || user?.email || 'Set below'
    },
    {
      label: 'VIP Payment Numbers (bKash/Nagad/Rocket)',
      ready: Boolean(settings?.vipSettings?.bkash || settings?.vipSettings?.nagad || settings?.vipSettings?.rocket),
      hint: settings?.vipSettings?.bkash ? 'Configured' : 'Set in VIP & Payments',
      to: '/admin/vip-settings'
    },
    {
      label: 'Official Telegram Link & Bot',
      ready: Boolean(settings?.telegramUrl),
      hint: settings?.telegramUrl ? 'Configured' : 'Set in General & Telegram Settings',
      to: '/admin/telegram-settings'
    },
    {
      label: 'Adsterra Ads & Publisher Token',
      ready: Boolean(settings?.customAds?.popunder || settings?.customAds?.socialBar || settings?.customAds?.vastUrl || adsterraApiToken),
      hint: adsterraApiToken ? 'API Token Set' : 'Set in Advertisements & below',
      to: '/admin/ads'
    },
    {
      label: 'Support & App Download Link',
      ready: Boolean(settings?.supportLinks?.telegram || settings?.supportLinks?.whatsapp || settings?.appDownloadLink),
      hint: settings?.appDownloadLink ? 'APK Link Set' : 'Set in Support & General Settings',
      to: '/admin/support-settings'
    }
  ];

  return (
    <div className={`space-y-6 ${standalone ? 'max-w-5xl mx-auto p-4 sm:p-8' : 'max-w-5xl pb-12'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <KeyRound className="w-6 h-6 text-red-500" />
            Platform Setup, API Keys & Buyer Checklist
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            নতুন ওয়েবসাইট চালু করতে প্রয়োজনীয় সকল ক্রেডেনশিয়াল, এডমিন ইমেইল, এপিআই কী এবং এসইও এখান থেকেই সেটআপ করুন।
          </p>
        </div>

        {!standalone && (
          <Link
            to="/admin/settings"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-200 transition-colors shrink-0"
          >
            <span>General Settings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center gap-2.5 ${
            statusMsg.type === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}
        >
          {statusMsg.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Setup Progress Checklist */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Buyer Setup Checklist ({checklist.filter(c => c.ready).length}/{checklist.length} Ready)
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {checklist.map((item) => (
            <div
              key={item.label}
              className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                item.ready ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {item.ready ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{item.label}</p>
                  <p className="text-[11px] text-gray-400 truncate">{item.hint}</p>
                </div>
              </div>
              {item.to && !standalone && (
                <Link
                  to={item.to}
                  className="text-[11px] font-bold text-red-400 hover:text-red-300 shrink-0"
                >
                  Open
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Section 1: Supabase & Firebase Credentials */}
      <form onSubmit={handleSaveLocalKeysAndReload} className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-400" />
              1. Database (Supabase) &amp; Auth (Firebase) Keys
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              এখানে আপনার নিজের Supabase ও Firebase প্রজেক্টের কী বসিয়ে সরাসরি টেস্ট করুন অথবা নিচ থেকে <code>.env</code> ফাইল ডাউনলোড করে হোস্টিং-এ আপলোড করুন।
            </p>
          </div>
          {(sbInfo.source === 'local' || fbInfo.source === 'local') && (
            <button
              type="button"
              onClick={handleClearLocalKeys}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset Browser Keys</span>
            </button>
          )}
        </div>

        {/* Supabase Inputs */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" /> Supabase Project
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Supabase Project URL</label>
              <input
                type="url"
                value={sbUrl}
                onChange={(e) => setSbUrl(e.target.value)}
                placeholder="https://xxxxxxxxxxxx.supabase.co"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3.5 py-2 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Supabase Anon Public Key</label>
              <input
                type="text"
                value={sbAnonKey}
                onChange={(e) => setSbAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3.5 py-2 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Firebase Inputs */}
        <div className="space-y-3 pt-2 border-t border-white/10">
          <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5" /> Firebase Web App Config
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">API Key</label>
              <input
                type="text"
                value={fbApiKey}
                onChange={(e) => setFbApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Auth Domain</label>
              <input
                type="text"
                value={fbAuthDomain}
                onChange={(e) => setFbAuthDomain(e.target.value)}
                placeholder="your-app.firebaseapp.com"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Project ID</label>
              <input
                type="text"
                value={fbProjectId}
                onChange={(e) => setFbProjectId(e.target.value)}
                placeholder="your-project-id"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Storage Bucket</label>
              <input
                type="text"
                value={fbStorageBucket}
                onChange={(e) => setFbStorageBucket(e.target.value)}
                placeholder="your-app.firebasestorage.app"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Messaging Sender ID</label>
              <input
                type="text"
                value={fbMessagingSenderId}
                onChange={(e) => setFbMessagingSenderId(e.target.value)}
                placeholder="123456789012"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">App ID</label>
              <input
                type="text"
                value={fbAppId}
                onChange={(e) => setFbAppId(e.target.value)}
                placeholder="1:123456789:web:abcdef..."
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Measurement ID (Optional)</label>
              <input
                type="text"
                value={fbMeasurementId}
                onChange={(e) => setFbMeasurementId(e.target.value)}
                placeholder="G-XXXXXXXXXX"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyEnv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-colors"
            >
              {copiedEnv ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedEnv ? 'Copied .env' : 'Copy .env'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadEnv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .env</span>
            </button>
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Save Keys &amp; Reload App</span>
          </button>
        </div>
      </form>

      {/* Section 2: Remote Admin Config saved to Supabase */}
      {!standalone && (
        <form onSubmit={handleSavePlatformSettings} className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-6">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Cloud className="w-5 h-5 text-sky-400" />
              2. Admin Ownership, Adsterra API, Cloudinary &amp; SEO
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              এগুলো সরাসরি Supabase ডাটাবেসে সেভ হবে এবং সব ইউজার/ডিভাইসে কাজ করবে।
            </p>
          </div>

          {/* Admin Email & Adsterra API */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Primary Admin Email
              </label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="owner@yourdomain.com"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2 text-sm text-white focus:border-red-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                এই ইমেইল দিয়ে লগইন করলে স্বয়ংক্রিয়ভাবে ফুল Admin এক্সেস ও কনটেন্ট-কপি সুবিধা পাওয়া যাবে।
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-amber-400" />
                Adsterra Publisher API Token
              </label>
              <div className="relative">
                <input
                  type={showAdsterraToken ? 'text' : 'password'}
                  value={adsterraApiToken}
                  onChange={(e) => setAdsterraApiToken(e.target.value)}
                  placeholder="Paste Adsterra Publisher API key..."
                  className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2 pr-10 text-sm text-white font-mono focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowAdsterraToken(!showAdsterraToken)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showAdsterraToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Dashboard-এ লাইভ Adsterra আয়ের হিসাব দেখতে এখানে API টোকেন সেভ করুন।
              </p>
            </div>
          </div>

          {/* Cloudinary Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-white/10">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Cloudinary Cloud Name</label>
              <input
                type="text"
                value={cloudinaryCloudName}
                onChange={(e) => setCloudinaryCloudName(e.target.value)}
                placeholder="e.g. your_cloud_name"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2 text-sm text-white font-mono focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Cloudinary Upload Preset (Unsigned)</label>
              <input
                type="text"
                value={cloudinaryUploadPreset}
                onChange={(e) => setCloudinaryUploadPreset(e.target.value)}
                placeholder="e.g. your_unsigned_preset"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2 text-sm text-white font-mono focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          {/* App & Gift Extra Config */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 border-t border-white/10">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Favicon URL</label>
              <input
                type="text"
                value={favicon}
                onChange={(e) => setFavicon(e.target.value)}
                placeholder="https://example.com/favicon.png"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2 text-sm text-white focus:border-red-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">APK File Size Label</label>
              <input
                type="text"
                value={appSizeLabel}
                onChange={(e) => setAppSizeLabel(e.target.value)}
                placeholder="e.g. 25 MB"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2 text-sm text-white focus:border-red-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Gift Post Support Link</label>
              <input
                type="text"
                value={giftSupportLink}
                onChange={(e) => setGiftSupportLink(e.target.value)}
                placeholder="https://t.me/your_support"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2 text-sm text-white focus:border-red-500 focus:outline-none"
              />
            </div>
          </div>

          {/* SEO Settings */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-purple-400" />
              SEO &amp; Social Share Metadata
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">SEO Site Title</label>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="My Streaming Platform"
                  className="w-full rounded-lg border border-white/10 bg-black/50 px-3.5 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">SEO Keywords</label>
                <input
                  type="text"
                  value={seoKeywords}
                  onChange={(e) => setSeoKeywords(e.target.value)}
                  placeholder="videos, streaming, vip, entertainment"
                  className="w-full rounded-lg border border-white/10 bg-black/50 px-3.5 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Meta Description</label>
                <textarea
                  rows={2}
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder="Short description shown on Google and social links..."
                  className="w-full rounded-lg border border-white/10 bg-black/50 px-3.5 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Social Preview Image URL (OG Image)</label>
                <input
                  type="text"
                  value={seoSocialImage}
                  onChange={(e) => setSeoSocialImage(e.target.value)}
                  placeholder="https://example.com/og-cover.jpg"
                  className="w-full rounded-lg border border-white/10 bg-black/50 px-3.5 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-white/10">
            <button
              type="submit"
              disabled={isSavingRemote}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 px-6 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingRemote ? 'Saving...' : 'Save Platform Setup'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
