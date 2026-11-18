import { Outlet, Link, useLocation } from 'react-router-dom';
import { Settings, AlertTriangle } from 'lucide-react';
import { Navbar } from './Navbar';
import { BottomNav } from './BottomNav';
import { AdBanner } from '../ui/AdBanner';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { useDevice } from '../../hooks/useDevice';

export function PublicLayout() {
  const { settings } = useSettingsStore();
  const { user } = useAuthStore();
  const { isMobile } = useDevice();
  const location = useLocation();

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  const siteName = settings?.siteName || '19-20 Streaming';

  if (settings?.maintenanceMode && user?.role !== 'admin') {
    return (
      <div className="flex min-h-screen flex-col bg-[#050505] font-sans text-gray-100 overflow-x-hidden items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
            <Settings className="w-10 h-10 text-red-500 animate-spin" />
          </div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight">রক্ষণাবেক্ষণ চলছে</h1>
          <p className="text-gray-400">
            আপনার অভিজ্ঞতা উন্নত করতে আমরা বর্তমানে সাইটের রক্ষণাবেক্ষণের কাজ করছি। 
            দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন।
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-ambient-dark font-sans text-gray-100 overflow-x-hidden pt-14 sm:pt-16 pb-16 sm:pb-0" style={{ paddingTop: 'max(3.5rem, env(safe-area-inset-top, 3.5rem))' }}>
      <Navbar />
      <div className="mx-auto w-full max-w-7xl flex-1 px-3 py-3 sm:px-6 lg:px-8">
        {!isAuthPage && (
          <div className="w-full flex justify-center mb-2">
            {isMobile ? (
              <div className="w-full">
                <AdBanner placement="banner320x50" />
              </div>
            ) : (
              <div className="w-full max-w-[728px]">
                <AdBanner placement="banner728x90" />
              </div>
            )}
          </div>
        )}
        <Outlet />
      </div>
      <footer className="mt-auto border-t border-white/5 bg-black py-8 text-center shrink-0">
        <div className="mx-auto max-w-7xl px-6">
          {!isAuthPage && (
            <div className="w-full flex justify-center mb-8">
              <AdBanner placement="banner468x60" />
            </div>
          )}
          
          <p className="text-[10px] tracking-widest text-gray-600 uppercase mb-8 sm:mb-0">
            © {new Date().getFullYear()} {siteName}. All rights reserved.
          </p>
        </div>
      </footer>
      
      {/* Quick Exit / Panic Button */}
      <button
        onClick={() => window.location.replace('https://www.google.com')}
        className="fixed bottom-20 sm:bottom-8 right-4 sm:right-8 z-50 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 bg-red-600 text-white rounded-full shadow-[0_4px_25px_rgba(220,38,38,0.7)] hover:bg-red-500 hover:scale-105 active:scale-95 transition-all group"
        title="Quick Exit"
      >
        <span className="hidden sm:group-hover:block absolute right-16 bg-black/90 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border border-white/10 shadow-lg">Quick Exit (Panic)</span>
        <AlertTriangle className="w-5 h-5" />
      </button>

      {isMobile && <BottomNav />}
    </div>
  );
}
