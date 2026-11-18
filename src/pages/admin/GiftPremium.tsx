import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Gift, User, Award, CheckCircle, AlertCircle, Copy, Download, X, Send, Save, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { UserBadge } from '../../components/ui/UserBadge';
import { drawPremiumInvoice } from '../../utils/invoiceGenerator';
import { 
  fetchEligibleUsersForDailyGift, 
  executeDaily10GiftProcess, 
  sendTelegramWithFallbacks,
  EligibleGiftUser 
} from '../../lib/giftService';

export { drawPremiumInvoice };

export function GiftPremium() {
  const [eligibleUsers, setEligibleUsers] = useState<EligibleGiftUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isProcessingRef = useRef(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copyMsg, setCopyMsg] = useState('');
  const [generatedInvoice, setGeneratedInvoice] = useState<string | null>(null);
  const [invoiceName, setInvoiceName] = useState<string>('');
  
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [customText, setCustomText] = useState('আমাদের সকল ইউজারদের মধ্য থেকে লটারির মাধ্যমে প্রতিদিন ১০ জন লাকি ইউজারকে ১ দিনের প্রিমিয়াম উপহার দেওয়া হয়েছে।');
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingTg, setIsTestingTg] = useState(false);
  
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();

  useEffect(() => {
    loadUsers();
    loadTgSettings();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const users = await fetchEligibleUsersForDailyGift(10);
      setEligibleUsers(users);
    } catch (err) {
      console.error('Error fetching eligible users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTgSettings = async () => {
    try {
      let bToken = '';
      let cId = '';

      // 1. Try telegram_secrets first
      const { data: secretData } = await supabase.from('settings').select('*').eq('id', 'telegram_secrets').single();
      if (secretData?.data) {
        bToken = secretData.data.botToken || '';
        cId = secretData.data.channelId || secretData.data.chatId || '';
      }

      // 2. Fallback to general settings if empty
      const { data: generalDoc } = await supabase.from('settings').select('*').eq('id', 'general').single();
      const tgGiftSettings = generalDoc?.data?.telegramGiftSettings;
      if (tgGiftSettings) {
        if (!bToken && tgGiftSettings.botToken) bToken = tgGiftSettings.botToken;
        if (!cId && tgGiftSettings.chatId) cId = tgGiftSettings.chatId;
        if (tgGiftSettings.customText) setCustomText(tgGiftSettings.customText);
      }

      if (bToken) setBotToken(bToken);
      if (cId) setChatId(cId);
    } catch (e) {
      console.warn('Error loading Telegram settings:', e);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setErrorMsg('');
    try {
      const cleanToken = botToken.trim();
      const cleanChat = chatId.trim();

      const { data: generalDoc } = await supabase.from('settings').select('*').eq('id', 'general').single();
      const existingData = generalDoc?.data || {};

      const updatedGeneral = {
        ...existingData,
        telegramGiftSettings: {
          botToken: cleanToken,
          chatId: cleanChat,
          customText,
          autoGiftEnabled: false
        }
      };

      await supabase.from('settings').upsert({
        id: 'general',
        data: updatedGeneral
      });

      await supabase.from('settings').upsert({
        id: 'telegram_secrets',
        data: {
          botToken: cleanToken,
          channelId: cleanChat,
          chatId: cleanChat
        }
      });

      if (settings) {
        useSettingsStore.getState().setSettings(updatedGeneral as any);
      }

      setSuccessMsg('টেলিগ্রাম সেটিংস সফলভাবে সেভ করা হয়েছে!');
    } catch (e: any) {
      console.error(e);
      setErrorMsg('সেটিংস সেভ করতে সমস্যা হয়েছে: ' + (e.message || ''));
    } finally {
      setIsSaving(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  const handleTestTelegramPost = async () => {
    if (isTestingTg) return;
    setIsTestingTg(true);
    setErrorMsg('');
    setSuccessMsg('');

    const cleanToken = botToken.trim();
    const cleanChat = chatId.trim();

    if (!cleanToken || !cleanChat) {
      setErrorMsg('টেলিগ্রাম বট টোকেন এবং চ্যানেল/চ্যাট আইডি উভয়টি পূরণ করুন।');
      setIsTestingTg(false);
      return;
    }

    try {
      const testUsers = [
        { name: 'Demo User 1', email: 'user1@example.com' },
        { name: 'Demo User 2', email: 'user2@example.com' },
        { name: 'Demo User 3', email: 'user3@example.com' },
        { name: 'Lucky Member (Test)', email: 'lucky@example.com' }
      ];

      const siteName = settings?.siteName || '19-20 Streaming';
      const canvas = document.createElement('canvas');
      drawPremiumInvoice(canvas, siteName, testUsers, 'Telegram Test Connection');

      const blob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(b => resolve(b), 'image/jpeg', 0.9);
      });

      const caption = `🧪 <b>Telegram Bot Test Connection</b>\n\n✅ আপনার টেলিগ্রাম বট ও চ্যানেল কনফিগারেশন সফলভাবে কাজ করছে!\n🌐 Website: ${window.location.hostname}\n⏰ সময়: ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })} (BD Time)\n\n🎁 প্রিমিয়াম গিফটের পোস্ট এই চ্যানেলে স্বয়ংক্রিয়ভাবে পাবলিশ হবে।`;

      const result = await sendTelegramWithFallbacks({
        botToken: cleanToken,
        chatId: cleanChat,
        caption,
        imageBlob: blob
      });

      if (result.success) {
        setSuccessMsg('টেলিগ্রামে টেস্ট পোস্ট সফলভাবে সেন্ড হয়েছে! আপনার চ্যানেল/গ্রুপ চেক করুন।');
      } else {
        setErrorMsg('টেলিগ্রাম টেস্ট ব্যর্থ: ' + (result.error || 'Unknown error. Check bot admin rights.'));
      }
    } catch (e: any) {
      setErrorMsg('টেলিগ্রাম এরর: ' + (e.message || 'Failed'));
    } finally {
      setIsTestingTg(false);
      setTimeout(() => {
        setSuccessMsg('');
      }, 6000);
    }
  };

  const handleSendAndPostTelegram = async () => {
    if (isProcessingRef.current || eligibleUsers.length === 0) return;
    isProcessingRef.current = true;
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const cleanToken = botToken.trim();
      const cleanChat = chatId.trim();
      const siteName = settings?.siteName || '19-20 Streaming';

      const result = await executeDaily10GiftProcess({
        usersToGift: eligibleUsers,
        botToken: cleanToken,
        chatId: cleanChat,
        customText,
        siteName,
        isManual: true // allow manual trigger
      });

      if (result.success) {
        setSuccessMsg(result.message);
        // Refresh pool of users
        await loadUsers();
      } else {
        setErrorMsg(result.message);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('গিফট প্রদানে সমস্যা হয়েছে: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
      isProcessingRef.current = false;
      setTimeout(() => {
        setSuccessMsg('');
      }, 7000);
    }
  };

  const handleSendGiftsOnlyNoTg = async () => {
    if (isProcessingRef.current || eligibleUsers.length === 0) return;
    isProcessingRef.current = true;
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const siteName = settings?.siteName || '19-20 Streaming';
      const result = await executeDaily10GiftProcess({
        usersToGift: eligibleUsers,
        botToken: '', // empty to skip telegram
        chatId: '',
        customText: '',
        siteName,
        isManual: true
      });

      if (result.success) {
        setSuccessMsg(`${result.count} জন ইউজারকে ১ দিনের প্রিমিয়াম গিফট প্রদান সম্পন্ন হয়েছে (টেলিগ্রাম ছাড়া)।`);
        await loadUsers();
      } else {
        setErrorMsg(result.message);
      }
    } catch (err: any) {
      setErrorMsg('এরর: ' + (err.message || 'Failed'));
    } finally {
      setIsLoading(false);
      isProcessingRef.current = false;
      setTimeout(() => setSuccessMsg(''), 5000);
    }
  };

  const handleCopyUsers = (usersList: EligibleGiftUser[], label: string) => {
    if (!usersList || usersList.length === 0) return;
    const textToCopy = usersList.map((u, i) => {
      let displayName = u.name;
      if (!displayName || displayName.toLowerCase() === 'user' || displayName.trim() === '') {
        displayName = u.email?.split('@')[0] || 'User';
      }
      return `${i + 1}. ${displayName} (1 Day Premium)`;
    }).join('\n');
    
    navigator.clipboard.writeText(`Selected Users (${label}):\n${textToCopy}`);
    setCopyMsg(`${usersList.length} জন ইউজারের লিস্ট কপি করা হয়েছে!`);
    setTimeout(() => setCopyMsg(''), 3000);
  };

  const handleDownloadInvoice = (usersList: EligibleGiftUser[], label: string) => {
    if (!usersList || usersList.length === 0) return;
    
    const siteName = settings?.siteName || '19-20 Streaming';
    const canvas = document.createElement('canvas');
    drawPremiumInvoice(canvas, siteName, usersList, label);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const fileName = `${siteName.replace(/\s+/g, '_')}_Gift_Report_${label.replace(/\s+/g, '_')}.jpg`;
    
    setGeneratedInvoice(dataUrl);
    setInvoiceName(fileName);
    
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    link.click();
  };

  const renderUserItem = (u: EligibleGiftUser, index: number) => {
    let displayName = u.name;
    if (!displayName || displayName.toLowerCase() === 'user' || displayName.trim() === '') {
      displayName = u.email?.split('@')[0] || 'User';
    }
    
    return (
      <li key={u.id} className="text-xs text-gray-300 flex items-center justify-between p-2.5 hover:bg-white/5 rounded-xl transition-colors border border-white/5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-yellow-500/80 font-mono font-bold w-5">{index + 1}.</span>
          <div className="truncate">
            <span className="text-white font-medium truncate block">{displayName}</span>
            <span className="text-[11px] text-gray-500 font-mono truncate block">{u.email || 'No email'}</span>
          </div>
        </div>
        <span className="text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full whitespace-nowrap font-medium">
          1 Day Gift
        </span>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
            <span className="p-2 bg-gradient-to-tr from-yellow-600 to-amber-400 rounded-xl text-black shadow-lg shadow-yellow-500/20">
              <Gift className="w-6 h-6" />
            </span>
            Gift Premium Automation
          </h1>
          <p className="mt-1.5 text-sm text-gray-400">
            টোটাল ইউজারদের মধ্য থেকে প্রতিদিন ১০ জনকে স্বয়ংক্রিয় ১ দিনের প্রিমিয়াম গিফট ও টেলিগ্রাম পোস্ট।
          </p>
        </div>

        <button
          onClick={loadUsers}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-semibold transition"
          title="নতুন ১০ জন রেন্ডম ইউজার সিলেক্ট করুন"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Shuffle 10 Users</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 animate-in fade-in">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 animate-in fade-in">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{errorMsg}</p>
        </div>
      )}

      {copyMsg && (
        <div className="p-4 rounded-xl flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 text-blue-400">
          <Copy className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{copyMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Telegram Post & Automation Config */}
        <div className="lg:col-span-7 bg-[#111] rounded-2xl border border-white/10 p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
             <div className="flex items-center gap-3">
               <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
                 <Send className="w-5 h-5" />
               </div>
               <div>
                 <h3 className="text-lg font-bold text-white">Telegram Automation Settings</h3>
                 <p className="text-xs text-gray-400">বট টোকেন এবং চ্যানেল আইডি সেটআপ করুন</p>
               </div>
             </div>
             
             <button
               onClick={handleTestTelegramPost}
               disabled={isTestingTg || !botToken || !chatId}
               className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 hover:text-white text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-40"
             >
               <Send className={`w-3.5 h-3.5 ${isTestingTg ? 'animate-spin' : ''}`} />
               <span>{isTestingTg ? 'Testing...' : 'Test Bot Connection'}</span>
             </button>
          </div>
          
          <div className="space-y-4 text-sm">
             <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Telegram Bot Token <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-blue-500/60 pr-10"
                    value={botToken}
                    onChange={e => setBotToken(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[11px] text-gray-500 mt-1 block">BotFather থেকে পাওয়া বটের সিক্রেট টোকেন।</span>
             </div>

             <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Telegram Channel / Chat ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="@your_channel_username or -1001234567890"
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-blue-500/60"
                  value={chatId}
                  onChange={e => setChatId(e.target.value)}
                />
                <span className="text-[11px] text-gray-500 mt-1 block">বটটিকে অবশ্যই আপনার চ্যানেলে Admin বানাতে হবে।</span>
             </div>

             <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Custom Telegram Post Caption (বিজ্ঞপ্তি বার্তা)
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-blue-500/60 leading-relaxed"
                  value={customText}
                  onChange={e => setCustomText(e.target.value)}
                  placeholder="আমাদের সকল ইউজারদের মধ্য থেকে লটারির মাধ্যমে প্রতিদিন ১০ জন লাকি ইউজারকে ১ দিনের প্রিমিয়াম উপহার দেওয়া হয়েছে..."
                />
             </div>

             {/* Manual Trigger Information Banner */}
             <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                  <Gift className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-amber-300 text-xs font-bold block">
                    ১০০% ম্যানুয়াল নিয়ন্ত্রণ (Manual Trigger Only)
                  </span>
                  <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">
                    কোনো ব্যাকগ্রাউন্ড বা ক্রন নিজ থেকে কাউকে গিফট দেবে না বা টেলিগ্রামে পোস্ট করবে না। আপনি যখন নিচে "Send 10 Gifts &amp; Post to Telegram" বাটনে ক্লিক করবেন, ঠিক তখনই নির্বাচিত ১০ জনকে ১ দিনের ফ্রি প্রিমিয়াম দেওয়া হবে এবং সাথে সাথে ইনভয়েস সহ টেলিগ্রাম চ্যানেলে পোস্ট হয়ে যাবে।
                  </p>
                </div>
             </div>

             <div className="flex flex-wrap gap-3 pt-2">
               <button
                 onClick={handleSaveSettings}
                 disabled={isSaving}
                 className="flex-1 py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
               >
                 <Save className="w-4 h-4" />
                 <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
               </button>

               <button
                 onClick={handleSendAndPostTelegram}
                 disabled={isLoading || eligibleUsers.length === 0}
                 className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20 disabled:opacity-50"
               >
                 <Send className="w-4 h-4" />
                 <span>Send 10 Gifts & Post to Telegram</span>
               </button>
             </div>
          </div>
        </div>

        {/* Right Column: 10 Selected Users from Total Pool */}
        <div className="lg:col-span-5 bg-[#111] rounded-2xl border border-white/10 p-6 space-y-5 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
               <div className="flex items-center gap-3">
                 <div className="p-2.5 bg-yellow-500/10 rounded-xl border border-yellow-500/20 text-yellow-400">
                   <User className="w-5 h-5" />
                 </div>
                 <div>
                   <h3 className="text-lg font-bold text-white">Daily 10 Lucky Users</h3>
                   <p className="text-xs text-gray-400">টোটাল ইউজার থেকে নির্বাচিত (যারা কখনো গিফট পায়নি)</p>
                 </div>
               </div>

               <div className="flex items-center gap-1.5">
                 <button
                   onClick={() => handleCopyUsers(eligibleUsers, 'Daily 10 Users')}
                   disabled={eligibleUsers.length === 0}
                   className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition disabled:opacity-40"
                   title="Copy User Names"
                 >
                   <Copy className="w-4 h-4" />
                 </button>
                 <button
                   onClick={() => handleDownloadInvoice(eligibleUsers, 'Daily 10 Users')}
                   disabled={eligibleUsers.length === 0}
                   className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition disabled:opacity-40"
                   title="Download Invoice JPG"
                 >
                   <Download className="w-4 h-4" />
                 </button>
               </div>
            </div>

            <div className="bg-black/50 rounded-xl p-3 border border-white/5 min-h-[300px] max-h-[420px] overflow-y-auto">
              {isLoading ? (
                <div className="py-12 text-center text-xs text-gray-500 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-yellow-500" />
                  <span>Checking total user base and finding 10 eligible members...</span>
                </div>
              ) : eligibleUsers.length > 0 ? (
                <ul className="space-y-1.5">
                  {eligibleUsers.map((u, i) => renderUserItem(u, i))}
                </ul>
              ) : (
                <div className="py-12 text-center text-xs text-gray-500">
                  <p className="font-semibold text-gray-400">কোনো যোগ্য ইউজার পাওয়া যায়নি।</p>
                  <p className="text-[11px] mt-1 text-gray-600">সবাই ইতিমধ্যে গিফট পেয়ে গেছে অথবা প্রিমিয়াম মেম্বার।</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleSendGiftsOnlyNoTg}
              disabled={isLoading || eligibleUsers.length === 0}
              className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-semibold transition border border-white/5 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Gift className="w-4 h-4 text-yellow-500" />
              <span>Send Gifts Only (টেলিগ্রাম পোস্ট ছাড়া গিফট দিন)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Modal Preview */}
      {generatedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#161616]">
              <h3 className="text-base font-bold text-white">Daily Gift Invoice Preview</h3>
              <button 
                onClick={() => setGeneratedInvoice(null)}
                className="p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 flex flex-col items-center">
              <img 
                src={generatedInvoice} 
                alt="Premium Gift Invoice" 
                className="max-w-full h-auto rounded-lg border border-white/10 shadow-2xl"
              />
            </div>
            
            <div className="p-4 border-t border-white/10 bg-[#161616] flex justify-end gap-3">
              <button 
                onClick={() => setGeneratedInvoice(null)}
                className="px-4 py-2 text-xs font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg transition"
              >
                Close
              </button>
              <a 
                href={generatedInvoice}
                download={invoiceName}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg transition flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download Invoice Image</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
