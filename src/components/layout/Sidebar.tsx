import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Upload, 
  Video, 
  FolderTree, 
  Users, 
  MessageSquare, 
  Flag, 
  Megaphone, 
  Settings, 
  LogOut,
  Image as ImageIcon,
  Globe,
  CreditCard,
  Crown,
  FileText,
  Headphones,
  Send,
  Bell,
  Gift,
  Database,
  Activity,
  Search,
  ChevronRight,
  ShieldCheck,
  Download,
  Sparkles,
  ExternalLink,
  X,
  KeyRound
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  badge?: string | number;
  highlight?: boolean;
}

interface NavGroup {
  groupName: string;
  items: NavItem[];
}

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const { settings } = useSettingsStore();
  const { user } = useAuthStore();
  const [pendingVIPCount, setPendingVIPCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [moderatorPermissions, setModeratorPermissions] = useState<string[]>([]);

  useEffect(() => {
    let intervalId: any;
    
    async function fetchVIPCount() {
      try {
        const { count, error } = await supabase
          .from('vip_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        if (!error && count !== null) {
          setPendingVIPCount(count);
        }
      } catch (err) {
        console.error(err);
      }
    }

    async function fetchModeratorPermissions() {
      if (user?.role !== 'moderator') return;
      try {
        const { data } = await supabase.from('settings').select('*').eq('id', 'moderator_permissions').maybeSingle();
        if (data?.data?.assignments) {
          const userAssignment = data.data.assignments[user.id] || (user.email ? data.data.assignments[user.email.toLowerCase()] : null);
          if (userAssignment?.permissions && Array.isArray(userAssignment.permissions)) {
            setModeratorPermissions(userAssignment.permissions);
          }
        }
      } catch (e) {
        console.warn("Could not load moderator permissions", e);
      }
    }
    
    fetchVIPCount();
    fetchModeratorPermissions();
    intervalId = setInterval(fetchVIPCount, 30000);
    return () => clearInterval(intervalId);
  }, [user?.role, user?.id, user?.email]);

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
    }
  };

  const siteName = settings?.siteName || '19-20 Streaming';

  const navGroups: NavGroup[] = useMemo(() => [
    {
      groupName: 'Overview',
      items: [
        { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
        { name: 'Moderators', href: '/admin/moderators', icon: ShieldCheck },
        { name: 'Online Users', href: '/admin/online-users', icon: Activity },
        { name: 'Activity Logs', href: '/admin/logs', icon: FileText },
        { name: 'Users', href: '/admin/users', icon: Users },
      ]
    },
    {
      groupName: 'Content & Media',
      items: [
        { name: 'All Videos', href: '/admin/videos', icon: Video },
        { name: 'Upload Video', href: '/admin/videos/upload', icon: Upload, highlight: true },
        { name: 'Blogger Import', href: '/admin/videos/blogger-import', icon: Globe },
        { name: 'Categories', href: '/admin/categories', icon: FolderTree },
        { name: 'Banners', href: '/admin/banners', icon: ImageIcon },
        { name: 'Comments', href: '/admin/comments', icon: MessageSquare },
      ]
    },
    {
      groupName: 'VIP & Monetization',
      items: [
        { 
          name: 'VIP Requests', 
          href: '/admin/vip-requests', 
          icon: FileText, 
          badge: pendingVIPCount > 0 ? pendingVIPCount : undefined,
          highlight: pendingVIPCount > 0
        },
        { name: 'VIP & Payments', href: '/admin/vip-settings', icon: Crown },
        { name: 'Premium Users', href: '/admin/premium-users', icon: Crown },
        { name: 'Gift Premium', href: '/admin/gift-premium', icon: Gift },
        { name: 'Redeem Codes', href: '/admin/redeem-codes', icon: Gift },
        { name: 'Refer & Earn', href: '/admin/referral-settings', icon: Gift },
        { name: 'Advertisements', href: '/admin/ads', icon: Megaphone },
      ]
    },
    {
      groupName: 'Automation & Alerts',
      items: [
        { name: 'Telegram Settings', href: '/admin/telegram-settings', icon: Send },
        { name: 'Telegram Auto Post', href: '/admin/telegram-auto-post', icon: Send },
        { name: 'Notice Board (Marquee)', href: '/admin/notice-settings', icon: Megaphone },
        { name: 'Notifications', href: '/admin/notifications', icon: Bell },
        { name: 'Reports', href: '/admin/reports', icon: Flag },
        { name: 'Support Settings', href: '/admin/support-settings', icon: Headphones },
      ]
    },
    {
      groupName: 'System & Hosting',
      items: [
        { name: 'Platform Setup & Keys', href: '/admin/platform-setup', icon: KeyRound },
        { name: 'General Settings', href: '/admin/settings', icon: Settings },
        { name: 'Database Migration', href: '/admin/migrate-supabase', icon: Database },
      ]
    }
  ], [pendingVIPCount]);

  // Filter based on moderator permission & search query
  const filteredGroups = useMemo(() => {
    const activePerms = [
      ...(Array.isArray(moderatorPermissions) ? moderatorPermissions : []),
      ...(Array.isArray(user?.permissions) ? user.permissions : [])
    ];

    const isAllowed = (item: NavItem) => {
      // Moderators cannot manage other moderators
      if (item.name === 'Moderators') return false;

      // Dashboard visibility: ONLY visible if explicitly granted 'dashboard' permission
      if (item.name === 'Dashboard') {
        const hasDashboardPerm = activePerms.some((p: string) => {
          const cleanP = String(p).toLowerCase().replace(/[\s\-_()]+/g, '');
          return cleanP === 'dashboard';
        });
        return hasDashboardPerm;
      }

      // If specific permissions were configured by the admin
      if (activePerms.length > 0) {
        const cleanName = item.name.toLowerCase().replace(/[\s\-_()]+/g, '');
        const cleanHref = item.href.toLowerCase().replace('/admin/', '').replace(/[\s\-_/]+/g, '');

        for (const p of activePerms) {
          const cleanP = String(p).toLowerCase().replace(/[\s\-_()]+/g, '');
          if (cleanP === 'dashboard' && (cleanName.includes('dashboard') || cleanHref === '' || cleanHref === 'admin')) return true;
          if ((cleanP === 'bloggerimport' || cleanP === 'blogger') && cleanHref.includes('blogger')) return true;
          if ((cleanP === 'uploadvideo' || cleanP === 'upload') && cleanHref.includes('upload')) return true;
          if ((cleanP === 'allvideos' || cleanP === 'videos') && (cleanHref === 'videos' || cleanHref.includes('video'))) return true;
          if ((cleanP === 'categories' || cleanP === 'category') && cleanHref.includes('categories')) return true;
          if (cleanP === 'banners' && cleanHref.includes('banners')) return true;
          if (cleanP === 'comments' && cleanHref.includes('comments')) return true;
          if (cleanP === 'reports' && cleanHref.includes('reports')) return true;
          if (cleanP === 'notifications' && cleanHref.includes('notifications')) return true;
          if (cleanP === 'users' && cleanHref === 'users') return true;
          if (cleanP === 'onlineusers' && cleanHref.includes('online')) return true;
          if ((cleanP === 'noticeboard' || cleanP === 'marquee' || cleanP === 'noticesettings' || cleanP === 'notice') && cleanHref.includes('notice')) return true;
          if ((cleanP === 'telegram' || cleanP === 'telegramautopost') && cleanHref.includes('telegram')) return true;
          if ((cleanP === 'viprequests' || cleanP === 'vip') && cleanHref.includes('vip-requests')) return true;
          if ((cleanP === 'giftpremium' || cleanP === 'gift') && cleanHref.includes('gift-premium')) return true;
          if ((cleanP === 'redeemcodes' || cleanP === 'redeem') && cleanHref.includes('redeem-codes')) return true;
        }
        return false;
      }

      // Default allowed if NO specific permissions set:
      // Dashboard is NOT allowed by default for moderators
      const defaultAllowed = [
        'All Videos',
        'Upload Video', 
        'Blogger Import', 
        'Categories', 
        'Banners', 
        'Comments', 
        'Reports', 
        'Notifications'
      ];
      return defaultAllowed.includes(item.name);
    };

    return navGroups.map(group => {
      const filteredItems = group.items.filter(item => {
        if (user?.role === 'moderator') {
          if (!isAllowed(item)) return false;
        }
        if (searchQuery.trim()) {
          return item.name.toLowerCase().includes(searchQuery.toLowerCase());
        }
        return true;
      });
      return { ...group, items: filteredItems };
    }).filter(group => group.items.length > 0);
  }, [navGroups, user?.role, user?.permissions, moderatorPermissions, searchQuery]);

  return (
    <aside className="flex h-screen w-full flex-col border-r border-white/[0.08] bg-[#090a0f]/95 backdrop-blur-2xl select-none">
      {/* Brand Header */}
      <div className="relative flex h-16 shrink-0 items-center justify-between border-b border-white/[0.08] px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 via-red-700 to-red-900 shadow-md shadow-red-900/30 ring-1 ring-white/20">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
              {siteName}
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 bg-red-600/20 text-red-400 border border-red-500/30 rounded">
                {user?.role === 'moderator' ? 'Moderator' : 'Admin'}
              </span>
            </span>
            <span className="text-[11px] text-zinc-400 font-medium">
              {user?.role === 'moderator' ? 'Moderator Panel' : 'Control Center'}
            </span>
          </div>
        </div>

        {onClose && (
          <button 
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white lg:hidden transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Quick Search */}
      <div className="px-4 pt-3.5 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-red-500/50 focus:bg-white/[0.06] focus:outline-none transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Links with Categorized Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {filteredGroups.map((group) => (
          <div key={group.groupName} className="space-y-1">
            <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {group.groupName}
            </div>
            {group.items.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={onClose}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-150',
                    isActive
                      ? 'bg-gradient-to-r from-red-600/20 via-red-600/10 to-transparent text-white border-l-2 border-red-500 shadow-sm shadow-red-950/40'
                      : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      isActive 
                        ? 'text-red-400' 
                        : item.highlight 
                          ? 'text-amber-400 group-hover:text-amber-300' 
                          : 'text-zinc-500 group-hover:text-zinc-300'
                    )}
                  />
                  <span className="flex-1 truncate">{item.name}</span>
                  
                  {item.badge !== undefined && (
                    <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white shadow-sm shadow-red-900/60 animate-pulse">
                      {item.badge}
                    </span>
                  )}

                  {isActive && (
                    <ChevronRight className="h-3.5 w-3.5 text-red-500 shrink-0 opacity-75" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer / User Profile & Actions */}
      <div className="shrink-0 border-t border-white/[0.08] p-3 bg-black/40 space-y-2">
        {/* User Card */}
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-600 font-bold text-xs text-white ring-1 ring-white/10">
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-zinc-200 truncate">{user?.name || 'Administrator'}</p>
            <p className="text-[10px] text-zinc-500 truncate capitalize">{user?.role || 'Admin'} Role</p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-1.5">
          <Link
            to="/"
            target="_blank"
            className="flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Live Site
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-zinc-400 bg-white/[0.04] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 border border-white/[0.06] transition-colors"
          >
            <LogOut className="h-3 w-3" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}

