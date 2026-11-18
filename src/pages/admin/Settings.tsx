import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { SiteSettings, QuickLinkButton } from '../../types';
import { X, HardDrive, Megaphone, ArrowRight, KeyRound, Plus, Trash2, ArrowUp, ArrowDown, Link2 } from 'lucide-react';
import { QUICK_BUTTON_STYLES, QuickButtonsBar, DEFAULT_QUICK_BUTTONS } from '../../components/ui/QuickButtonsBar';

export function Settings() {
  const { settings, setSettings } = useSettingsStore();
  const { user } = useAuthStore();
  const [siteName, setSiteName] = useState(settings?.siteName || '19-20 Streaming');
  const [adminEmail, setAdminEmail] = useState(settings?.adminEmail || '');
  const [siteDescription, setSiteDescription] = useState(settings?.siteDescription || '');
  const [favicon, setFavicon] = useState(settings?.favicon || '');
  const [logoText, setLogoText] = useState(settings?.logo || 'SH');
  const [logoImageUrl, setLogoImageUrl] = useState(settings?.logoImageUrl || '');
  const [telegramUrl, setTelegramUrl] = useState(settings?.telegramUrl || '');
  const [maintenanceMode, setMaintenanceMode] = useState(settings?.maintenanceMode || false);
  const [maintenanceOnMessage, setMaintenanceOnMessage] = useState(settings?.maintenanceOnMessage || 'Our website is currently under maintenance. We will be back shortly!');
  const [maintenanceOffMessage, setMaintenanceOffMessage] = useState(settings?.maintenanceOffMessage || 'Maintenance is over! Our website is now live again.');
  const [requireLoginToWatch, setRequireLoginToWatch] = useState(settings?.requireLoginToWatch || false);
  const [appDownloadLink, setAppDownloadLink] = useState(settings?.appDownloadLink || '');
  const [defaultVideoDescription, setDefaultVideoDescription] = useState(settings?.defaultVideoDescription || '');
  const [defaultThumbnailUrl, setDefaultThumbnailUrl] = useState(settings?.defaultThumbnailUrl || '');
  const [quickButtons, setQuickButtons] = useState<QuickLinkButton[]>(settings?.quickButtons ?? DEFAULT_QUICK_BUTTONS);
  const [newBtnLabel, setNewBtnLabel] = useState('');
  const [newBtnUrl, setNewBtnUrl] = useState('');
  const [newBtnStyle, setNewBtnStyle] = useState<QuickLinkButton['style']>('red');
  const [newBtnNewTab, setNewBtnNewTab] = useState(true);
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (settings) {
      setSiteName(settings.siteName || '19-20 Streaming');
      setAdminEmail(settings.adminEmail || '');
      setSiteDescription(settings.siteDescription || '');
      setFavicon(settings.favicon || '');
      setLogoText(settings.logo || 'SH');
      setLogoImageUrl(settings.logoImageUrl || '');
      if (settings.telegramUrl) setTelegramUrl(settings.telegramUrl);
      setMaintenanceMode(settings.maintenanceMode || false);
      if (settings.maintenanceOnMessage) setMaintenanceOnMessage(settings.maintenanceOnMessage);
      if (settings.maintenanceOffMessage) setMaintenanceOffMessage(settings.maintenanceOffMessage);
      setRequireLoginToWatch(settings.requireLoginToWatch || false);
      setAppDownloadLink(settings.appDownloadLink || '');
      setDefaultVideoDescription(settings.defaultVideoDescription || '');
      setDefaultThumbnailUrl(settings.defaultThumbnailUrl || '');
      setQuickButtons(settings.quickButtons ?? DEFAULT_QUICK_BUTTONS);
    } else {
      async function loadSettings() {
        try {
          const { data } = await supabase
            .from('settings')
            .select('*')
            .eq('id', 'general')
            .single();
            
          if (data) {
            let sd;
            if (data.data) {
              sd = {
                ...(data.data as SiteSettings),
                appDownloadLink: (data.data as SiteSettings).appDownloadLink || data.app_download_link || ''
              };
            } else {
              sd = {
                siteName: data.site_name,
                logo: data.logo,
                cloudinaryCloudName: data.cloudinary_cloud_name,
                cloudinaryUploadPreset: data.cloudinary_upload_preset,
                adsEnabled: data.ads_enabled,
                requireLoginToWatch: data.require_login_to_watch,
                siteDescription: data.site_description,
                logoImageUrl: data.logo_image_url,
                telegramUrl: data.telegram_url,
                favicon: data.favicon,
                allowUserUpload: data.allow_user_upload,
                allowComments: data.allow_comments,
                customAds: data.custom_ads,
                appDownloadLink: data.app_download_link || ''
              } as SiteSettings;
            }
            
            setSiteName(sd.siteName || '19-20 Streaming');
            setAdminEmail(sd.adminEmail || '');
            setSiteDescription(sd.siteDescription || '');
            setFavicon(sd.favicon || '');
            setLogoText(sd.logo || 'SH');
            setLogoImageUrl(sd.logoImageUrl || '');
            if (sd.telegramUrl) setTelegramUrl(sd.telegramUrl);
            setMaintenanceMode(sd.maintenanceMode || false);
            setMaintenanceOnMessage(sd.maintenanceOnMessage || 'Our website is currently under maintenance. We will be back shortly!');
            setMaintenanceOffMessage(sd.maintenanceOffMessage || 'Maintenance is over! Our website is now live again.');
            setRequireLoginToWatch(sd.requireLoginToWatch || false);
            setAppDownloadLink(sd.appDownloadLink || '');
            setDefaultVideoDescription(sd.defaultVideoDescription || '');
            setDefaultThumbnailUrl(sd.defaultThumbnailUrl || '');
            setQuickButtons(sd.quickButtons ?? DEFAULT_QUICK_BUTTONS);
            setSettings(sd);
          }
        } catch (error) {
          console.error("Failed to load settings:", error);
        }
      }
      loadSettings();
    }
  }, [settings, setSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      let formattedAppDownloadLink = appDownloadLink.trim();
      if (formattedAppDownloadLink.includes('dropbox.com') && formattedAppDownloadLink.includes('dl=0')) {
        formattedAppDownloadLink = formattedAppDownloadLink.replace('dl=0', 'dl=1');
      } else if (formattedAppDownloadLink.includes('dropbox.com') && !formattedAppDownloadLink.includes('dl=1')) {
        formattedAppDownloadLink = formattedAppDownloadLink.includes('?') 
          ? `${formattedAppDownloadLink}&dl=1` 
          : `${formattedAppDownloadLink}?dl=1`;
      }

      const oldMaintenanceMode = settings?.maintenanceMode || false;

      const updatedSettings = {
        ...(settings || {}),
        siteName,
        adminEmail: adminEmail.trim().toLowerCase(),
        siteDescription: siteDescription.trim(),
        favicon: favicon.trim(),
        logo: logoText,
        logoImageUrl,
        telegramUrl,
        maintenanceMode,
        maintenanceOnMessage,
        maintenanceOffMessage,
        requireLoginToWatch,
        appDownloadLink: formattedAppDownloadLink,
        defaultVideoDescription,
        defaultThumbnailUrl,
        quickButtons,
        updatedAt: Date.now()
      };
      
      // Attempt to save using JSONB data structure
      let res = await supabase.from('settings').upsert({
        id: 'general',
        data: updatedSettings
      });
      
      // If it fails because data column doesn't exist, use flattened structure
      if (res.error && res.error.message.includes('data')) {
        res = await supabase.from('settings').upsert({
          id: 'general',
          site_name: updatedSettings.siteName,
          logo: updatedSettings.logo,
          cloudinary_cloud_name: updatedSettings.cloudinaryCloudName,
          cloudinary_upload_preset: updatedSettings.cloudinaryUploadPreset,
          ads_enabled: updatedSettings.adsEnabled,
          require_login_to_watch: updatedSettings.requireLoginToWatch,
          site_description: updatedSettings.siteDescription,
          logo_image_url: updatedSettings.logoImageUrl,
          telegram_url: updatedSettings.telegramUrl,
          app_download_link: updatedSettings.appDownloadLink,
          default_video_description: updatedSettings.defaultVideoDescription,
          default_thumbnail_url: updatedSettings.defaultThumbnailUrl,
          favicon: updatedSettings.favicon,
          allow_user_upload: updatedSettings.allowUserUpload,
          allow_comments: updatedSettings.allowComments,
          custom_ads: updatedSettings.customAds
        });
      }
      const { error } = res;

      
      if (error) throw error;

      if (user) {
        try {
          await supabase.from('admin_logs').insert([{
            admin_id: user.id,
            action: 'UPDATE_SETTINGS',
            details: `Updated general settings`,
            created_at: Date.now()
          }]);
        } catch (err) {
           console.warn("Failed to write to admin_logs", err);
        }
      }
      
      // Handle automatic telegram post when maintenance mode changes
      if (oldMaintenanceMode !== maintenanceMode) {
        try {
          const { data: secretDoc } = await supabase.from('settings').select('*').eq('id', 'telegram_secrets').single();
          if (secretDoc && secretDoc.data && secretDoc.data.botToken && secretDoc.data.channelId) {
            const messageToSend = maintenanceMode ? maintenanceOnMessage : maintenanceOffMessage;
            if (messageToSend && messageToSend.trim() !== '') {
              const textUrl = `https://api.telegram.org/bot${secretDoc.data.botToken}/sendMessage`;
              await fetch(textUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: secretDoc.data.channelId,
                  text: messageToSend,
                  parse_mode: 'HTML',
                  disable_web_page_preview: false
                })
              }).catch(e => console.error("Maintenance telegram post failed:", e));
            }
          }
        } catch (tgErr) {
          console.warn("Failed to post maintenance status to Telegram", tgErr);
        }
      }

      setSettings(updatedSettings as SiteSettings);
      document.title = siteName || '19-20 Streaming';
      setMessage('Settings saved successfully!');
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage('Error saving settings. Ensure you have admin permissions.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">General Settings</h1>
        <p className="text-sm text-gray-400">Manage your website's identity and global configuration.</p>
      </div>

      {/* Platform Setup & API Keys Quick Link Banner */}
      <div className="rounded-xl border border-emerald-600/30 bg-gradient-to-r from-emerald-950/40 via-black to-emerald-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Platform Setup, API Keys &amp; SEO Checklist</h3>
            <p className="text-xs text-gray-400">Supabase, Firebase, Adsterra API Token, Cloudinary এবং SEO সেটআপ করতে এখানে যান।</p>
          </div>
        </div>
        <Link
          to="/admin/platform-setup"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 transition-colors cursor-pointer shadow-md shadow-emerald-600/30"
        >
          <span>Open Platform Setup</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Notice Board Quick Link Banner */}
      <div className="rounded-xl border border-red-600/30 bg-gradient-to-r from-red-950/40 via-black to-red-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">হোমপেজ স্ক্রলিং নোটিশ ও ডিসক্লেইমার সেটিংস</h3>
            <p className="text-xs text-gray-400">হোমপেজের হেডলাইন নোটিশ বার, কনটেন্ট ডিসক্লেইমার এবং পপ-আপ মেসেজ এডিট করতে চান?</p>
          </div>
        </div>
        <Link
          to="/admin/notice-settings"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shrink-0 transition-colors cursor-pointer shadow-md shadow-red-600/30"
        >
          <span>নোটিশ বোর্ড এডিট করুন</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <form onSubmit={handleSave} className="space-y-6">
          {message && (
            <div className={`p-4 rounded-md text-sm ${message.includes('Error') ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
              {message}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="siteName" className="block text-sm font-medium text-gray-300">
                Website Name
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="siteName"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm"
                  placeholder="e.g. 19-20 Streaming"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">This will change the name in the header, footer, and page title.</p>
            </div>

            <div>
              <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-300">
                Primary Admin Email
              </label>
              <div className="mt-2">
                <input
                  type="email"
                  id="adminEmail"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm"
                  placeholder="admin@yourdomain.com"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">Owner email with full Admin privileges and ad-free access.</p>
            </div>

            <div>
              <label htmlFor="siteDescription" className="block text-sm font-medium text-gray-300">
                Website Description (SEO Meta)
              </label>
              <div className="mt-2">
                <textarea
                  id="siteDescription"
                  rows={2}
                  value={siteDescription}
                  onChange={(e) => setSiteDescription(e.target.value)}
                  className="block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm"
                  placeholder="Short description for search engines and social shares..."
                />
              </div>
            </div>

            <div>
              <label htmlFor="favicon" className="block text-sm font-medium text-gray-300">
                Favicon Image URL
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="favicon"
                  value={favicon}
                  onChange={(e) => setFavicon(e.target.value)}
                  className="block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm"
                  placeholder="https://example.com/favicon.png"
                />
              </div>
            </div>

            <div>
              <label htmlFor="logoText" className="block text-sm font-medium text-gray-300">
                Logo Badge Text
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="logoText"
                  value={logoText}
                  onChange={(e) => setLogoText(e.target.value)}
                  maxLength={5}
                  className="block w-32 rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm"
                  placeholder="e.g. SH"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">Short text to display in the logo badge when no logo image URL is set.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">
                Logo Image (URL)
              </label>
              <div className="mt-2 flex items-center gap-6">
                <div className="h-16 w-16 overflow-hidden rounded bg-black/50 border border-white/10 flex items-center justify-center shrink-0">
                  {logoImageUrl ? (
                    <img src={logoImageUrl} alt="Logo" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xs text-gray-500">No Image</span>
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={logoImageUrl}
                      onChange={(e) => setLogoImageUrl(e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    {logoImageUrl && (
                      <button
                        type="button"
                        onClick={() => setLogoImageUrl('')}
                        className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-500/20"
                      >
                        <X className="h-4 w-4" />
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Paste an image URL directly. Overrides the text badge.</p>
                </div>
              </div>
            </div>
            
            <div>
              <label htmlFor="telegramUrl" className="block text-sm font-medium text-gray-300">
                Telegram Group Link
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="telegramUrl"
                  value={telegramUrl}
                  onChange={(e) => setTelegramUrl(e.target.value)}
                  className="block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm"
                  placeholder="https://t.me/yourgroup"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">Will be displayed on the Home page.</p>
            </div>

            <div>
              <label htmlFor="appDownloadLink" className="block text-sm font-medium text-gray-300">
                App Download Link
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="appDownloadLink"
                  value={appDownloadLink}
                  onChange={(e) => setAppDownloadLink(e.target.value)}
                  className="block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm"
                  placeholder="https://play.google.com/store/apps/details?id=com.example.app"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">Link to download your app. Will be displayed in the user profile page.</p>
            </div>

            <div>
              <label htmlFor="defaultVideoDescription" className="block text-sm font-medium text-gray-300">
                Default Video Description (Website Only / শুধুমাত্র ওয়েবসাইটে)
              </label>
              <div className="mt-2">
                <textarea
                  id="defaultVideoDescription"
                  value={defaultVideoDescription}
                  onChange={(e) => setDefaultVideoDescription(e.target.value)}
                  rows={4}
                  className="block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm"
                  placeholder="ভিডিওর নিচে ওয়েবসাইটে দেখানোর জন্য ডিফল্ট ডেসক্রিপশন লিখুন..."
                />
              </div>
              <p className="mt-2 text-xs text-gray-400">
                এই ডেসক্রিপশনটি শুধুমাত্র ওয়েবসাইটের ভিডিও পেজে যুক্ত হবে। টেলিগ্রাম অটো-পোস্ট ক্যাপশনে এটি যাবে না (টেলিগ্রামের জন্য Telegram Settings ব্যবহার করুন)।
              </p>
            </div>
            <div>
              <label htmlFor="defaultThumbnailUrl" className="block text-sm font-medium text-gray-300">
                Default Video Thumbnail (URL)
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="defaultThumbnailUrl"
                  value={defaultThumbnailUrl}
                  onChange={(e) => setDefaultThumbnailUrl(e.target.value)}
                  className="block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm"
                  placeholder="https://example.com/default-thumbnail.jpg"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">Used as fallback when a video is uploaded or imported without a thumbnail.</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <div>
              <h3 className="text-white font-bold text-red-500">Maintenance Mode</h3>
              <p className="text-sm text-gray-400 mt-1">When enabled, regular users will see a maintenance screen. Admins can still access the site.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={maintenanceMode}
                onChange={(e) => setMaintenanceMode(e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>
          
          <div className="space-y-4 p-4 bg-white/5 rounded-lg border border-white/10">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Telegram Message (When Maintenance Mode turns ON)
              </label>
              <textarea
                value={maintenanceOnMessage}
                onChange={(e) => setMaintenanceOnMessage(e.target.value)}
                rows={2}
                className="block w-full rounded-md border border-gray-600 bg-gray-700 text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm p-2"
                placeholder="Our website is currently under maintenance..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Telegram Message (When Maintenance Mode turns OFF)
              </label>
              <textarea
                value={maintenanceOffMessage}
                onChange={(e) => setMaintenanceOffMessage(e.target.value)}
                rows={2}
                className="block w-full rounded-md border border-gray-600 bg-gray-700 text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm p-2"
                placeholder="Maintenance is over! Our website is now live again."
              />
            </div>
          </div>

          
          
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
            <div>
              <h3 className="text-white font-medium">Require Login to Watch</h3>
              <p className="text-gray-400 text-sm">Users must be logged in to watch videos. If disabled, guests can watch videos.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={requireLoginToWatch}
                onChange={(e) => setRequireLoginToWatch(e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>
          
          {/* Top Quick Buttons (Above Notice Bar) */}
          <div className="pt-6 border-t border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-red-500" />
                  Top Quick Buttons (Notice-এর উপরে ছোট বাটন)
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  সার্চ বারের নিচে ও নোটিশ বারের উপরে ছোট ছোট আলাদা ডিজাইনের লিংক বাটন যোগ করুন। সেভ করার পর সাথে সাথে হোমপেজে দেখাবে।
                </p>
              </div>
            </div>

            {/* Live Preview */}
            {quickButtons.length > 0 && (
              <div className="p-3 rounded-xl bg-black/60 border border-white/10 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Live Preview</p>
                <QuickButtonsBar buttonsOverride={quickButtons} />
              </div>
            )}

            {/* Add New Button Row */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-gray-300 mb-1">Button Name</label>
                <input
                  type="text"
                  value={newBtnLabel}
                  onChange={(e) => setNewBtnLabel(e.target.value)}
                  placeholder="e.g. Join Telegram"
                  className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-red-500 focus:outline-none"
                />
              </div>
              <div className="md:col-span-4">
                <label className="block text-xs font-medium text-gray-300 mb-1">Link / URL</label>
                <input
                  type="text"
                  value={newBtnUrl}
                  onChange={(e) => setNewBtnUrl(e.target.value)}
                  placeholder="https://... বা /premium"
                  className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-red-500 focus:outline-none"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-gray-300 mb-1">Button Style</label>
                <select
                  value={newBtnStyle}
                  onChange={(e) => setNewBtnStyle(e.target.value as QuickLinkButton['style'])}
                  className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs text-white focus:border-red-500 focus:outline-none"
                >
                  {(Object.keys(QUICK_BUTTON_STYLES) as QuickLinkButton['style'][]).map((styleKey) => (
                    <option key={styleKey} value={styleKey} className="bg-zinc-900">
                      {QUICK_BUTTON_STYLES[styleKey].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 flex flex-col justify-end gap-1.5">
                <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newBtnNewTab}
                    onChange={(e) => setNewBtnNewTab(e.target.checked)}
                    className="rounded border-white/20 bg-black text-red-600 focus:ring-red-500"
                  />
                  New tab
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const label = newBtnLabel.trim();
                    const url = newBtnUrl.trim();
                    if (!label || !url) return;
                    const stylesList = Object.keys(QUICK_BUTTON_STYLES) as QuickLinkButton['style'][];
                    setQuickButtons((prev) => [
                      ...prev,
                      {
                        id: `qb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                        label,
                        url,
                        style: newBtnStyle,
                        openInNewTab: newBtnNewTab,
                      },
                    ]);
                    setNewBtnLabel('');
                    setNewBtnUrl('');
                    const nextStyleIdx = (stylesList.indexOf(newBtnStyle) + 1) % stylesList.length;
                    setNewBtnStyle(stylesList[nextStyleIdx]);
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>

            {/* Existing Buttons List */}
            {quickButtons.length > 0 && (
              <div className="space-y-2">
                {quickButtons.map((btn, idx) => (
                  <div
                    key={btn.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/10"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className={`w-3 h-3 rounded-full shrink-0 ${QUICK_BUTTON_STYLES[btn.style]?.dotClass || 'bg-red-500'}`} />
                      <span className="text-xs font-bold text-white truncate">{btn.label}</span>
                      <span className="text-[11px] text-gray-400 truncate max-w-[220px]">{btn.url}</span>
                      <select
                        value={btn.style}
                        onChange={(e) => {
                          const updatedStyle = e.target.value as QuickLinkButton['style'];
                          setQuickButtons((prev) =>
                            prev.map((item) => (item.id === btn.id ? { ...item, style: updatedStyle } : item))
                          );
                        }}
                        className="rounded border border-white/10 bg-black/70 px-2 py-1 text-[11px] text-gray-200 focus:border-red-500 focus:outline-none"
                      >
                        {(Object.keys(QUICK_BUTTON_STYLES) as QuickLinkButton['style'][]).map((styleKey) => (
                          <option key={styleKey} value={styleKey} className="bg-zinc-900">
                            {QUICK_BUTTON_STYLES[styleKey].label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => {
                          setQuickButtons((prev) => {
                            const copy = [...prev];
                            [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
                            return copy;
                          });
                        }}
                        className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-300 disabled:opacity-30"
                        title="Move up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === quickButtons.length - 1}
                        onClick={() => {
                          setQuickButtons((prev) => {
                            const copy = [...prev];
                            [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
                            return copy;
                          });
                        }}
                        className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-300 disabled:opacity-30"
                        title="Move down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickButtons((prev) => prev.filter((item) => item.id !== btn.id))}
                        className="p-1.5 rounded bg-red-500/15 hover:bg-red-500/30 text-red-400"
                        title="Delete button"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-6 border-t border-white/10">
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-red-600 px-6 py-2 text-sm font-bold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/50 p-6 backdrop-blur-sm mt-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
          <HardDrive className="text-blue-500" /> System Management
        </h2>
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
          <div>
            <h3 className="text-white font-medium">Clear Website Cache</h3>
            <p className="text-gray-400 text-sm">Clear all local storage, session storage, and reload the application. Useful after updates.</p>
          </div>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to clear the website cache? You may be logged out.')) {
                localStorage.clear();
                sessionStorage.clear();
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for (let registration of registrations) {
                      registration.unregister();
                    }
                  });
                }
                window.location.reload();
              }
            }}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            Clear Cache
          </button>
        </div>
      </div>

    </div>
  );
}
