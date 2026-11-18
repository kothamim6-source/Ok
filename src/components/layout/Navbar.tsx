import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Menu, UserCircle, ShieldAlert, LogOut, History, Crown, Globe, Moon, Sun, Clock, Upload } from 'lucide-react';
import { NotificationBell } from '../NotificationBell';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { supabase } from '../../lib/supabase';
import { auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { useState } from 'react';
import { useDevice } from '../../hooks/useDevice';

export function Navbar() {
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const { t, lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { isMobile } = useDevice();

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
    }
    navigate('/');
  };

  const siteName = settings?.siteName || '19-20 Streaming';
  const logoText = settings?.logo || 'SH';

  return (
    <nav 
      className="fixed top-0 left-0 right-0 z-[2147483647] flex h-14 sm:h-16 w-full items-center justify-between border-b border-white/[0.08] bg-black px-2.5 sm:px-6 md:px-8 backdrop-blur-2xl shrink-0 shadow-lg shadow-black/60"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Left: Circular Brand Logo & Site Title */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <Link to="/" className="flex items-center gap-2 group">
          {settings?.logoImageUrl ? (
            <img src={settings.logoImageUrl} alt={siteName} className="h-8 w-8 object-cover rounded-full border-2 border-red-600 shadow-md group-hover:scale-105 transition-transform" />
          ) : (
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-red-500/80 bg-black p-0.5 shadow-[0_0_12px_rgba(220,38,38,0.5)] group-hover:scale-105 transition-transform">
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-red-600 via-rose-600 to-red-500 flex items-center justify-center text-[8px] sm:text-[9px] font-black text-white leading-tight text-center">
                18+
              </div>
            </div>
          )}
          <span className="text-sm sm:text-base md:text-lg font-black tracking-tight text-white uppercase whitespace-nowrap group-hover:text-red-400 transition-colors">
            {siteName}
          </span>
        </Link>
        
        {!isMobile && (
          <div className="ml-4 flex items-center gap-1">
            <Link to="/" className="text-xs font-bold text-gray-200 hover:text-white hover:bg-white/[0.06] px-3 py-1.5 rounded-lg transition-all">{t('home')}</Link>
            <Link to="/premium" className="text-xs font-black text-amber-300 hover:text-amber-200 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all shadow-[0_0_12px_rgba(245,158,11,0.15)] group relative">
              <Crown className="w-3 h-3 text-amber-300" />
              <span>VIP Premium</span>
            </Link>
            <Link to="/categories" className="text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.06] px-3 py-1.5 rounded-lg transition-all">{t('categories')}</Link>
            <Link to="/trending" className="text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.06] px-3 py-1.5 rounded-lg transition-all">{t('trending')}</Link>
            {user && <Link to="/history" className="text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.06] px-3 py-1.5 rounded-lg transition-all">{t('history')}</Link>}
          </div>
        )}
      </div>

      {/* Middle: Compact Search Pill matching Screenshot */}
      <div className="flex flex-1 items-center justify-end sm:justify-center px-1.5 sm:px-4">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const query = formData.get('q');
            if (query) {
              navigate(`/search?q=${encodeURIComponent(query.toString())}`);
            }
          }}
          className="relative block w-28 sm:w-64 md:w-80 group"
        >
          <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
            <Search className="h-3.5 w-3.5 text-gray-400 group-focus-within:text-red-500 transition-colors" />
          </div>
          <input
            type="text"
            name="q"
            placeholder="Search..."
            className="w-full rounded-full border border-white/10 bg-[#141620] py-1.5 pl-8 pr-2.5 text-xs text-white placeholder-gray-500 shadow-inner transition-all duration-200 focus:border-red-500/60 focus:bg-[#1a1d2b] focus:outline-none"
          />
        </form>
      </div>

      {/* Right Side: Red Shield Button + Circular Profile Badge */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Red Shield Button - Exact match to screenshot */}
        <button
          type="button"
          onClick={() => {
            // Trigger 18+ alert or panic
            window.dispatchEvent(new CustomEvent('open_adult_warning'));
          }}
          className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg sm:rounded-xl bg-red-600 text-white shadow-md shadow-red-600/30 hover:bg-red-500 active:scale-95 transition-all"
          title="18+ Security Shield"
        >
          <ShieldAlert className="h-4 w-4 fill-white text-red-600" />
        </button>

        {/* Global Download APK Button (Visible on desktop) */}
        {settings?.appDownloadLink && (
          <Link
            to="/download-app"
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-600/10 px-2.5 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-600 hover:text-white transition-all cursor-pointer"
            title="Download Android APK"
          >
            <Upload className="h-3.5 w-3.5 rotate-180" />
            <span>APK</span>
          </Link>
        )}

        {(user?.role === 'admin' || user?.role === 'moderator') && (
          <Link 
            to="/admin" 
            className="flex items-center gap-1 sm:gap-2 rounded-lg bg-red-600 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold text-white hover:bg-red-700 shadow-md shadow-red-600/20 active:scale-95 transition-all"
          >
            <span className="hidden sm:inline-block">
              {user.role === 'admin' ? (t('admin_panel') || 'ADMIN') : 'MOD PANEL'}
            </span>
            <span className="sm:hidden">
              {user.role === 'admin' ? 'ADM' : 'MOD'}
            </span>
          </Link>
        )}
        
        {user ? (
          <div className="relative">
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-red-500/60 bg-black overflow-hidden hover:opacity-80 transition-opacity"
            >
              {user.profileImage ? (
                <img src={user.profileImage} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-gray-800 to-gray-700 flex items-center justify-center text-[11px] font-bold text-white">
                  {user.name?.charAt(0) || 'U'}
                </div>
              )}
            </button>
            
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg border border-white/10 bg-black/90 p-2 backdrop-blur-xl shadow-xl z-[2147483647]">
                
                <div className="px-3 py-2 text-xs text-gray-400 border-b border-white/10 mb-2 truncate">
                  {user.email}
                </div>

                {(user.role === 'admin' || user.role === 'moderator') && (
                  <Link 
                    to="/admin" 
                    onClick={() => setShowDropdown(false)} 
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 font-bold border border-red-500/20 mb-2 transition-colors"
                  >
                    <ShieldAlert className="h-4 w-4 text-red-500" />
                    {user.role === 'admin' ? 'Admin Panel' : 'Moderator Panel'}
                  </Link>
                )}
                
                <button 
                  onClick={() => { setLang(lang === 'en' ? 'bn' : 'en'); setShowDropdown(false); }} 
                  className="flex w-full items-center justify-between rounded px-3 py-2 text-sm text-white hover:bg-white/10"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Language
                  </div>
                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded font-bold uppercase">{lang}</span>
                </button>
                
                <Link to="/profile" onClick={() => setShowDropdown(false)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-white hover:bg-white/10">
                  <UserCircle className="h-4 w-4" />
                  My Profile
                </Link>

                {settings?.appDownloadLink && (
                  <Link 
                    to="/download-app"
                    onClick={() => setShowDropdown(false)}
                    className="flex w-full items-center justify-between rounded px-3 py-2 text-sm text-white hover:bg-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-red-500 rotate-180" />
                      Download App
                    </div>
                    <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-semibold border border-red-500/30">APK</span>
                  </Link>
                )}

                <Link to="/history" onClick={() => setShowDropdown(false)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-white hover:bg-white/10">
                  <History className="h-4 w-4" />
                  Watch History
                </Link>

                <Link to="/watch-later" onClick={() => setShowDropdown(false)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-white hover:bg-white/10">
                  <Clock className="h-4 w-4" />
                  Watch Later
                </Link>

                <button 
                  onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setShowDropdown(false); }} 
                  className="flex w-full items-center justify-between rounded px-3 py-2 text-sm text-white hover:bg-white/10"
                >
                  <div className="flex items-center gap-2">
                    {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    {t('theme') || 'Theme'}
                  </div>
                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded font-bold capitalize">{theme}</span>
                </button>
                <button 
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-white hover:bg-white/10"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>

            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition-colors"
            >
              <UserCircle className="h-4 w-4" />
              <span>Login</span>
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
