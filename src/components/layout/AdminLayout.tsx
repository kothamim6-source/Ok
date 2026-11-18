import { Navigate, Outlet, useLocation, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useState, useMemo } from 'react';
import { 
  Menu, 
  X, 
  Upload, 
  Globe, 
  ExternalLink, 
  Download, 
  ShieldCheck, 
  Activity, 
  Bell, 
  FileText,
  Sparkles,
  ChevronRight,
  Server
} from 'lucide-react';
import { AdminBackgroundTasks } from '../admin/AdminBackgroundTasks';
import { isAdminUser } from '../../lib/adminConfig';

export function AdminLayout() {
  const { user, isLoading } = useAuthStore();
  const { settings } = useSettingsStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const siteName = settings?.siteName || '19-20 Streaming';

  // Compute nice breadcrumb title based on path
  const currentTitle = useMemo(() => {
    const path = location.pathname;
    if (path === '/admin') return 'Dashboard Overview';
    if (path.includes('/admin/videos/upload')) return 'Upload Video';
    if (path.includes('/admin/videos/blogger-import')) return 'Blogger Import Engine';
    if (path.includes('/admin/videos')) return 'Video Library';
    if (path.includes('/admin/categories')) return 'Categories & Tags';
    if (path.includes('/admin/vip-requests')) return 'VIP Membership Requests';
    if (path.includes('/admin/vip-settings')) return 'VIP & Payment Gateways';
    if (path.includes('/admin/premium-users')) return 'Premium Users';
    if (path.includes('/admin/moderators')) return 'Moderator Team & Permissions';
    if (path.includes('/admin/users')) return 'User Management';
    if (path.includes('/admin/online-users')) return 'Real-Time Online Users';
    if (path.includes('/admin/ads')) return 'Advertisements & Monetization';
    if (path.includes('/admin/platform-setup')) return 'Platform Setup, API Keys & SEO';
    if (path.includes('/admin/settings')) return 'System & General Settings';
    if (path.includes('/admin/telegram-settings')) return 'Telegram Bot Settings';
    if (path.includes('/admin/telegram-auto-post')) return 'Telegram Auto Poster';
    if (path.includes('/admin/banners')) return 'Promotional Banners';
    if (path.includes('/admin/logs')) return 'Admin Activity Audit Logs';
    if (path.includes('/admin/comments')) return 'User Comments & Moderation';
    if (path.includes('/admin/reports')) return 'User Reports & Flags';
    if (path.includes('/admin/migrate-supabase')) return 'Supabase Database Migration';
    if (path.includes('/admin/notice-settings')) return 'Marquee & Notice Board';
    if (path.includes('/admin/redeem-codes')) return 'Redeem Gift Codes';
    if (path.includes('/admin/referral-settings')) return 'Referral & Earnings';
    if (path.includes('/admin/gift-premium')) return 'Gift VIP Access';
    if (path.includes('/admin/support-settings')) return 'Live Support Settings';
    return 'Admin Panel';
  }, [location.pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07080c] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
          <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">Loading Admin Portal...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdminUser(user, settings) && user.role !== 'moderator') {
    return <Navigate to="/" replace />;
  }

  // If user is moderator without dashboard permission and navigates to /admin, redirect to first allowed route (/admin/videos)
  const isModeratorWithoutDashboard = user.role === 'moderator' && !(
    Array.isArray(user.permissions) && user.permissions.some(p => String(p).toLowerCase().includes('dashboard'))
  );

  if (isModeratorWithoutDashboard && (location.pathname === '/admin' || location.pathname === '/admin/')) {
    return <Navigate to="/admin/videos" replace />;
  }

  return (
    <div className="flex min-h-screen bg-[#07080c] font-sans text-zinc-100 antialiased overflow-hidden">
      {/* Ambient gradient lighting */}
      <div className="fixed top-0 left-64 right-0 h-96 bg-gradient-to-b from-red-600/[0.04] via-transparent to-transparent pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-purple-600/[0.03] rounded-full blur-3xl pointer-events-none" />

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <main className="flex flex-1 flex-col overflow-y-auto min-w-0 relative">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#090a0f]/80 px-4 sm:px-6 lg:px-8 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile hamburger */}
            <button
              type="button"
              className="rounded-lg p-2 text-zinc-400 hover:bg-white/[0.05] hover:text-white lg:hidden transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumbs / Page Title */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="hidden sm:inline-block text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Admin
              </span>
              <ChevronRight className="hidden sm:inline-block h-3.5 w-3.5 text-zinc-600" />
              <h1 className="text-sm sm:text-base font-bold text-white truncate tracking-tight">
                {currentTitle}
              </h1>
            </div>
          </div>

          {/* Quick Actions & Status */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Status Pill */}
            <div className="hidden md:flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 shadow-sm shadow-emerald-950/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-medium tracking-wide">Live System</span>
            </div>

            {/* Quick Upload Button */}
            <Link
              to="/admin/videos/upload"
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-gradient-to-r from-red-600 to-red-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm shadow-red-950/50 hover:brightness-110 transition-all"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Video</span>
            </Link>

            {/* Blogger Import Shortcut */}
            <Link
              to="/admin/videos/blogger-import"
              className="hidden lg:flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors"
            >
              <Globe className="h-3.5 w-3.5 text-blue-400" />
              <span>Blogger Import</span>
            </Link>

            {/* View Live Site */}
            <Link
              to="/"
              target="_blank"
              title="Open public website in new tab"
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-emerald-400" />
              <span className="hidden sm:inline">View Site</span>
            </Link>
          </div>
        </header>

        {/* Page Content Viewport */}
        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
      
      {/* Background Tasks Manager (runs in background for admin) */}
      <AdminBackgroundTasks />
    </div>
  );
}

