import React, { useState, useEffect } from 'react';
import { Download, ShieldCheck, Smartphone, Zap, AlertTriangle, ArrowLeft, Loader2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSettingsStore } from '../../store/settingsStore';
import { supabase } from '../../lib/supabase';

export function DownloadAppPage() {
  const { settings } = useSettingsStore();
  const [isDownloading, setIsDownloading] = useState(false);
  
  let downloadUrl = settings?.appDownloadLink || '';
  
  // Format Dropbox Links
  if (downloadUrl.includes('dropbox.com')) {
    if (downloadUrl.includes('dl=0')) downloadUrl = downloadUrl.replace('dl=0', 'dl=1');
    else if (!downloadUrl.includes('dl=1')) downloadUrl = downloadUrl.includes('?') ? `${downloadUrl}&dl=1` : `${downloadUrl}?dl=1`;
  }
  
  // Format Google Drive Links
  if (downloadUrl.includes('drive.google.com/file/d/')) {
    const match = downloadUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      downloadUrl = `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }
  }

  const handleDownload = async () => {
    if (!downloadUrl || isDownloading) return;
    
    setIsDownloading(true);
    
    try {
      // Increment download counter
      const { data: existing } = await supabase.from('settings').select('*').eq('id', 'general').single();
      if (existing) {
        const updatedData = {
          ...(existing.data || {}),
          appDownloadsCount: (existing.data?.appDownloadsCount || 0) + 1
        };
        await supabase.from('settings').upsert({ id: 'general', data: updatedData });
      }
    } catch (e) {
      console.error('Failed to increment download count:', e);
    }
    
    // Use a hidden iframe for direct download so the user doesn't leave the current page
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = downloadUrl;
    document.body.appendChild(iframe);
        
    // Clean up iframe after a delay
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 5000);
    
    // Reset loading state instantly
    setIsDownloading(false);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6">
      <Link to="/" className="inline-flex items-center text-sm text-gray-400 hover:text-white mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
      </Link>

      <div className="bg-[#111] rounded-3xl border border-white/10 p-6 sm:p-10 text-center relative overflow-hidden">
        {/* Background elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-red-500/20 blur-[100px] pointer-events-none" />

        <div className="relative z-10">
          {settings?.logoImageUrl ? (
            <img src={settings.logoImageUrl} alt="App Logo" className="w-24 h-24 sm:w-32 sm:h-32 object-contain mx-auto mb-6 drop-shadow-2xl" />
          ) : (
            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-red-600 rounded-3xl flex items-center justify-center text-4xl font-black text-white mx-auto mb-6 shadow-[0_0_30px_rgba(220,38,38,0.3)]">
              {settings?.logo || 'SH'}
            </div>
          )}

          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-2">
            {(settings?.siteName || '19-20 Streaming').toUpperCase()} APP
          </h1>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            আমাদের অফিশিয়াল অ্যান্ড্রয়েড অ্যাপটি ডাউনলোড করে যেকোনো সময় হাই কোয়ালিটি ভিডিও উপভোগ করুন।
          </p>

          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full sm:w-auto mx-auto flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-2xl font-bold text-lg shadow-[0_0_40px_rgba(220,38,38,0.4)] hover:shadow-[0_0_60px_rgba(220,38,38,0.6)] transition-all transform hover:scale-105 active:scale-95 disabled:opacity-75 disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            {isDownloading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Download className="w-6 h-6" />
            )}
            {isDownloading ? 'Downloading...' : 'Download APK Now'}
            {!isDownloading && (
              <span className="text-xs bg-black/30 px-2 py-1 rounded-lg ml-2 border border-white/10 font-mono">
                {settings?.appSizeLabel || 'APK'}
              </span>
            )}
          </button>
          
          {/* Download Count */}
          <div className="mt-4 flex items-center justify-center gap-2 text-gray-400">
            <Users className="w-4 h-4 text-red-500" />
            <span className="text-sm">ইতোমধ্যে <strong>{settings?.appDownloadsCount || 0}</strong> জন অ্যাপটি ডাউনলোড করেছেন</span>
          </div>

          {/* Security Warning Box */}
          <div className="mt-8 bg-black/50 border border-yellow-500/30 rounded-xl p-4 text-left max-w-md mx-auto shadow-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-yellow-500 font-bold text-sm mb-1">গুরুত্বপূর্ণ নোটিশ</h3>
                <p className="text-gray-400 text-[11px] sm:text-xs leading-relaxed">
                  যেহেতু অ্যাপটি প্লে-স্টোর থেকে নামানো হচ্ছে না, তাই ডাউনলোডের সময় আপনার ব্রাউজার <strong>"File might be harmful"</strong> লেখা দেখাতে পারে। এটি সব APK ফাইলের ক্ষেত্রেই দেখায়। অ্যাপটি ১০০% নিরাপদ। দয়া করে <strong>"Download anyway"</strong> তে ক্লিক করুন।
                </p>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 border-t border-white/5 pt-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mb-3 text-red-500">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="text-white font-bold text-sm mb-1">Super Fast</h4>
              <p className="text-gray-500 text-xs">ব্রাউজারের চেয়ে দ্রুত লোড হবে</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mb-3 text-red-500">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-white font-bold text-sm mb-1">100% Safe</h4>
              <p className="text-gray-500 text-xs">সম্পূর্ণ নিরাপদ এবং সিকিউর</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mb-3 text-red-500">
                <Smartphone className="w-5 h-5" />
              </div>
              <h4 className="text-white font-bold text-sm mb-1">Full Screen</h4>
              <p className="text-gray-500 text-xs">ফুল স্ক্রিন অ্যাপ এক্সপেরিয়েন্স</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
