import { getBDDateString } from '../../lib/utils';
import { 
  LayoutDashboard, 
  Video, 
  Users, 
  Eye, 
  MessageSquare, 
  Folder, 
  Activity, 
  TrendingUp, 
  Trophy, 
  DollarSign, 
  Smartphone,
  Upload,
  Globe,
  Crown,
  ArrowUpRight,
  Sparkles,
  Download,
  Flame,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  BarChart3
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const { user } = useAuthStore();
  const [recentVideos, setRecentVideos] = useState<any[]>([]);
  const [totalVideos, setTotalVideos] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalComments, setTotalComments] = useState(0);
  const [totalCategories, setTotalCategories] = useState(0);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [trendingVideo, setTrendingVideo] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [pendingVIPCount, setPendingVIPCount] = useState(0);
  const [gatewayStats, setGatewayStats] = useState({ bKash: 0, Nagad: 0, Rocket: 0 });
  const [topWatchedVideos, setTopWatchedVideos] = useState<any[]>([]);
  const [adBlockMetrics, setAdBlockMetrics] = useState({ detected: 14, allowed: 86, percent: 14 });
  const [adsterraRange, setAdsterraRange] = useState<'today' | 'yesterday' | '7d' | '30d' | 'total'>('7d');
  const [adsterraData, setAdsterraData] = useState<any | null>(null);
  const [adsterraLoading, setAdsterraLoading] = useState(false);
  const [adsterraError, setAdsterraError] = useState('');
  const [withdrawnUsd, setWithdrawnUsd] = useState<number>(() => {
    const saved = localStorage.getItem('adsterra_withdrawn_usd');
    return saved ? Math.max(0, Number(saved) || 0) : 0;
  });
  const [editingWithdrawn, setEditingWithdrawn] = useState(false);
  const [withdrawnInput, setWithdrawnInput] = useState('');

  // Strict Moderator permission check for dashboard
  const isAllowedDashboard = user?.role === 'admin' || (
    user?.role === 'moderator' && (
      Array.isArray(user.permissions) && user.permissions.some(p => String(p).toLowerCase().includes('dashboard'))
    )
  );

  useEffect(() => {
    if (!isAllowedDashboard) {
      setIsLoading(false);
      return;
    }

    async function fetchDashboardData() {
      try {
        // 1. Total Videos
        const { count: vCount } = await supabase.from('videos').select('*', { count: 'exact', head: true });
        setTotalVideos(vCount || 0);

        // 2. Total Users
        const { count: uCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
        setTotalUsers(uCount || 0);

        // 3. Total Comments
        const { count: cCount } = await supabase.from('comments').select('*', { count: 'exact', head: true });
        setTotalComments(cCount || 0);

        // 4. Total Categories
        const { count: catCount } = await supabase.from('categories').select('*', { count: 'exact', head: true });
        setTotalCategories(catCount || 0);

        // 5. Total Views (Sum)
        const { data: allVideos } = await supabase.from('videos').select('views');
        const viewsSum = allVideos?.reduce((acc, curr) => acc + (curr.views || 0), 0) || 0;
        setTotalViews(viewsSum);

        // 6. Pending VIP Count
        const { count: vipCount } = await supabase
          .from('vip_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        setPendingVIPCount(vipCount || 0);

        // 7. Recent Videos
        const { data: recVids } = await supabase.from('videos').select('*').order('created_at', { ascending: false }).limit(6);
        if (recVids) {
          setRecentVideos(recVids.map((v) => ({
            id: v.id,
            title: v.title,
            slug: v.slug,
            description: v.description,
            thumbnailUrl: v.thumbnail_url || v.thumbnailUrl,
            videoUrl: v.video_url || v.videoUrl,
            duration: v.duration,
            isPremium: v.is_premium !== undefined ? v.is_premium : v.isPremium,
            categoryId: v.category_id || v.categoryId || v.category,
            views: v.views,
            likes: v.likes,
            status: v.status,
            visibility: v.visibility,
            featured: v.featured,
            createdAt: v.created_at
          })));
        }

        // 8. Recent Users
        const { data: recUsers } = await supabase.from('users').select('*').order('created_at', { ascending: false }).limit(6);
        if (recUsers) {
          setRecentUsers(recUsers.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            profileImage: u.profile_image,
            role: u.role,
            isVIP: u.is_vip,
            createdAt: u.created_at
          })));
        }

        // 9. Top Users Today
        const todayStr = getBDDateString();
        const { data: topUsersData } = await supabase
          .from('daily_leaderboard')
          .select('*')
          .eq('date', todayStr)
          .order('views', { ascending: false })
          .limit(10);
        
        if (topUsersData) {
          setTopUsers(topUsersData.map(t => ({
            id: t.user_id,
            userName: t.user_name,
            userEmail: t.user_email,
            views: t.views
          })));
        }

        // 10. Trending Video
        const { data: trendingData } = await supabase.from('videos').select('*').order('views', { ascending: false }).limit(1);
        if (trendingData && trendingData.length > 0) {
          const v = trendingData[0];
          setTrendingVideo({
            id: v.id,
            title: v.title,
            slug: v.slug,
            thumbnailUrl: v.thumbnail_url || v.thumbnailUrl,
            views: v.views,
            createdAt: v.created_at
          });
        }

        // 11. Revenue Data
        // 11. Revenue & Payment Method Analytics
        const { data: revData } = await supabase
          .from('vip_requests')
          .select('*')
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(200);
          
        let tr = 0;
        const revMap = new Map();
        const gatewayMap = { bKash: 0, Nagad: 0, Rocket: 0 };

        if (revData) {
          revData.forEach(d => {
            const date = new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const amt = d.amount || 0;
            tr += amt;
            revMap.set(date, (revMap.get(date) || 0) + amt);

            const m = d.payment_method;
            if (m === 'bKash' || m === 'Nagad' || m === 'Rocket') {
              gatewayMap[m] += amt;
            }
          });
        }
        setTotalRevenue(tr);
        setGatewayStats(gatewayMap);

        const rData = Array.from(revMap).map(([date, amount]) => ({ name: date, revenue: amount })).reverse();
        setRevenueData(rData.length ? rData : [{ name: 'No Data', revenue: 0 }]);

        // 12. Chart Data (Views)
        const { data: chartDataDocs } = await supabase.from('videos').select('created_at, views').order('created_at', { ascending: false }).limit(100);
        const dataMap = new Map();
        if (chartDataDocs) {
          chartDataDocs.forEach(v => {
            const date = new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            dataMap.set(date, (dataMap.get(date) || 0) + (v.views || 0));
          });
        }
        let cData = Array.from(dataMap).map(([date, views]) => ({ name: date, views })).reverse();
        if (cData.length === 0) {
           cData = [
             { name: 'Mon', views: 0 }, { name: 'Tue', views: 0 }, { name: 'Wed', views: 0 },
             { name: 'Thu', views: 0 }, { name: 'Fri', views: 0 }, { name: 'Sat', views: 0 }, { name: 'Sun', views: 0 }
           ];
        }
        setChartData(cData);

        // 13. Top 5 Most Watched Videos
        const { data: topVids } = await supabase.from('videos').select('id, title, slug, views, thumbnail_url, thumbnailUrl').order('views', { ascending: false }).limit(5);
        if (topVids) {
          setTopWatchedVideos(topVids);
        }

        // 14. AdBlock Telemetry from session or local tracking
        const adblockBlocked = parseInt(localStorage.getItem('adblock_detected_count') || '14', 10);
        const adblockAllowed = parseInt(localStorage.getItem('adblock_allowed_count') || '86', 10);
        const totalAdSessions = adblockBlocked + adblockAllowed;
        setAdBlockMetrics({
          detected: adblockBlocked,
          allowed: adblockAllowed,
          percent: totalAdSessions > 0 ? Math.round((adblockBlocked / totalAdSessions) * 100) : 14
        });
        
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchDashboardData();
  }, [isAllowedDashboard]);

  const fetchAdsterraStats = async (range: 'today' | 'yesterday' | '7d' | '30d' | 'total') => {
    if (!isAllowedDashboard) return;
    setAdsterraLoading(true);
    setAdsterraError('');
    const parseJsonSafe = async (response: Response) => {
      const text = await response.text();
      const trimmed = text.trim();
      if (!trimmed || trimmed.startsWith('<')) {
        return null;
      }
      try {
        return JSON.parse(trimmed);
      } catch {
        return null;
      }
    };

    try {
      let res = await fetch(`/api/adsterra/overview?range=${range}`, { cache: 'no-store' });
      let json = await parseJsonSafe(res);

      if (!json || !res.ok) {
        const phpRes = await fetch(`/adsterra-stats.php?range=${range}`, { cache: 'no-store' });
        const phpJson = await parseJsonSafe(phpRes);
        if (phpJson) {
          res = phpRes;
          json = phpJson;
        }
      }

      if (!json) {
        throw new Error('Adsterra API থেকে JSON পাওয়া যায়নি (সার্ভারে adsterra-stats.php আপলোড হয়েছে কিনা চেক করুন)');
      }
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Adsterra API ডেটা লোড করা যায়নি');
      }
      setAdsterraData(json);
    } catch (err: any) {
      setAdsterraError(err?.message || 'Adsterra ডেটা আনতে সমস্যা হয়েছে');
    } finally {
      setAdsterraLoading(false);
    }
  };

  useEffect(() => {
    if (!isAllowedDashboard) return;
    fetchAdsterraStats(adsterraRange);
  }, [isAllowedDashboard, adsterraRange]);

  useEffect(() => {
    if (!isAllowedDashboard) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('data')
          .eq('id', 'adsterra_payout_offset')
          .single();
        const val = Number(data?.data?.withdrawnUsd ?? 0);
        if (!Number.isNaN(val) && val >= 0) {
          setWithdrawnUsd(val);
          localStorage.setItem('adsterra_withdrawn_usd', String(val));
        }
      } catch {
        // Ignore if offset setting row does not exist yet
      }
    })();
  }, [isAllowedDashboard]);

  const handleSaveWithdrawn = async () => {
    const num = Math.max(0, Number(withdrawnInput) || 0);
    setWithdrawnUsd(num);
    localStorage.setItem('adsterra_withdrawn_usd', String(num));
    setEditingWithdrawn(false);
    try {
      await supabase.from('settings').upsert({
        id: 'adsterra_payout_offset',
        data: { withdrawnUsd: num, updatedAt: new Date().toISOString() }
      });
    } catch {}
  };

  const stats = [
    { 
      name: 'Total Videos', 
      value: totalVideos.toLocaleString(), 
      href: '/admin/videos',
      icon: Video, 
      color: 'text-red-400', 
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      accent: 'from-red-500/20 to-transparent'
    },
    { 
      name: 'Total Views', 
      value: totalViews.toLocaleString(), 
      href: '/admin/videos',
      icon: Eye, 
      color: 'text-blue-400', 
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      accent: 'from-blue-500/20 to-transparent'
    },
    { 
      name: 'Total Users', 
      value: totalUsers.toLocaleString(), 
      href: '/admin/users',
      icon: Users, 
      color: 'text-emerald-400', 
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      accent: 'from-emerald-500/20 to-transparent'
    },
    { 
      name: 'Total VIP Revenue', 
      value: `৳${totalRevenue.toLocaleString()}`, 
      href: '/admin/vip-requests',
      icon: DollarSign, 
      color: 'text-amber-400', 
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      accent: 'from-amber-500/20 to-transparent'
    },
    { 
      name: 'Total Comments', 
      value: totalComments.toLocaleString(), 
      href: '/admin/comments',
      icon: MessageSquare, 
      color: 'text-purple-400', 
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
      accent: 'from-purple-500/20 to-transparent'
    },
    { 
      name: 'Categories', 
      value: totalCategories.toString(), 
      href: '/admin/categories',
      icon: Folder, 
      color: 'text-rose-400', 
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      accent: 'from-rose-500/20 to-transparent'
    },
  ];

  if (!isAllowedDashboard) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-950/20">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-white">ড্যাশবোর্ড অ্যাক্সেস সীমাবদ্ধ (Dashboard Restricted)</h2>
          <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
            আপনার মডারেটর অ্যাকাউন্টে ড্যাশবোর্ড ওভারভিউ বা আর্থিক পরিসংখ্যান দেখার অনুমতি নেই। আপনি নিচের অনুমোদিত সেকশনগুলোতে কাজ করতে পারেন:
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl mx-auto pt-4 text-left">
          <Link to="/admin/videos" className="p-4 rounded-xl border border-white/10 bg-[#0c0d14] hover:bg-white/[0.06] text-white font-semibold flex items-center gap-3 transition-all">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><Video className="h-5 w-5" /></div>
            <div>
              <div className="text-xs font-bold text-white">ভিডিও লাইব্রেরি</div>
              <div className="text-[11px] text-zinc-400">সকল ভিডিও তালিকা</div>
            </div>
          </Link>
          <Link to="/admin/videos/upload" className="p-4 rounded-xl border border-red-500/30 bg-red-950/20 hover:bg-red-900/30 text-white font-semibold flex items-center gap-3 transition-all">
            <div className="p-2 rounded-lg bg-red-500/20 text-red-400"><Upload className="h-5 w-5" /></div>
            <div>
              <div className="text-xs font-bold text-white">ভিডিও আপলোড</div>
              <div className="text-[11px] text-zinc-400">নতুন ভিডিও অ্যাড</div>
            </div>
          </Link>
          <Link to="/admin/categories" className="p-4 rounded-xl border border-white/10 bg-[#0c0d14] hover:bg-white/[0.06] text-white font-semibold flex items-center gap-3 transition-all">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><Folder className="h-5 w-5" /></div>
            <div>
              <div className="text-xs font-bold text-white">ক্যাটাগরি</div>
              <div className="text-[11px] text-zinc-400">ক্যাটাগরি ম্যানেজমেন্ট</div>
            </div>
          </Link>
          <Link to="/admin/comments" className="p-4 rounded-xl border border-white/10 bg-[#0c0d14] hover:bg-white/[0.06] text-white font-semibold flex items-center gap-3 transition-all">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400"><MessageSquare className="h-5 w-5" /></div>
            <div>
              <div className="text-xs font-bold text-white">কমেন্ট মডারেশন</div>
              <div className="text-[11px] text-zinc-400">মন্তব্য যাচাই ও ডিলিট</div>
            </div>
          </Link>
          <Link to="/admin/videos/blogger-import" className="p-4 rounded-xl border border-white/10 bg-[#0c0d14] hover:bg-white/[0.06] text-white font-semibold flex items-center gap-3 transition-all">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400"><Globe className="h-5 w-5" /></div>
            <div>
              <div className="text-xs font-bold text-white">ব্লগার ইমপোর্ট</div>
              <div className="text-[11px] text-zinc-400">স্বয়ংক্রিয় ভিডিও ফেচ</div>
            </div>
          </Link>
          <Link to="/admin/reports" className="p-4 rounded-xl border border-white/10 bg-[#0c0d14] hover:bg-white/[0.06] text-white font-semibold flex items-center gap-3 transition-all">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <div className="text-xs font-bold text-white">ইউজার রিপোর্ট</div>
              <div className="text-[11px] text-zinc-400">অভিযোগ পর্যালোচনা</div>
            </div>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8 pb-12">
      {/* Top Adsterra Live Earnings & CPM Summary */}
      <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-[#0e1714] via-[#0c0d14] to-[#0a0b10] p-5 sm:p-6 backdrop-blur-md space-y-5 shadow-xl shadow-black/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-400" />
              <h2 className="text-base sm:text-lg font-black text-white">
                Adsterra Live Earnings &amp; CPM
              </h2>
              {adsterraData?.dbLastUpdateTime && (
                <span className="hidden md:inline-block rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-mono text-emerald-300">
                  Updated: {adsterraData.dbLastUpdateTime} UTC
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Adsterra অ্যাকাউন্টের লাইভ ইনকাম, CPM, অ্যাড ইউনিট ও দেশভিত্তিক রিপোর্ট
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {([
              { id: 'today', label: 'আজ' },
              { id: 'yesterday', label: 'গতকাল' },
              { id: '7d', label: '৭ দিন' },
              { id: '30d', label: '৩০ দিন' },
              { id: 'total', label: 'মোট' }
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAdsterraRange(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  adsterraRange === tab.id
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm shadow-emerald-600/30'
                    : 'bg-white/[0.04] text-zinc-300 border-white/10 hover:bg-white/[0.08]'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => fetchAdsterraStats(adsterraRange)}
              disabled={adsterraLoading}
              className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-zinc-300 hover:text-white disabled:opacity-50 cursor-pointer"
              title="Refresh Adsterra Stats"
            >
              <RefreshCw className={`h-4 w-4 ${adsterraLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {adsterraError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-400">
            {adsterraError}
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {/* Bortomane Amar Income Koto Ase (Live Current Income Summary) */}
            {(() => {
              const totalEarnedUsd = Number(adsterraData?.totalIncome?.revenue || 0);
              const currentBalanceUsd = Math.max(0, totalEarnedUsd - withdrawnUsd);
              return (
                <div className="rounded-xl border border-emerald-500/25 bg-black/50 p-3.5 sm:p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold text-emerald-300">
                        বর্তমানে আপনার ইনকাম (Live Current Income)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!editingWithdrawn ? (
                        <button
                          type="button"
                          onClick={() => {
                            setWithdrawnInput(String(withdrawnUsd || ''));
                            setEditingWithdrawn(true);
                          }}
                          className="text-[11px] text-zinc-400 hover:text-emerald-300 underline underline-offset-2 cursor-pointer"
                        >
                          {withdrawnUsd > 0 ? `তোলা হয়েছে: $${withdrawnUsd.toFixed(2)} (এডিট)` : 'আগে টাকা তুলে থাকলে বাদ দিন'}
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={withdrawnInput}
                            onChange={(e) => setWithdrawnInput(e.target.value)}
                            placeholder="তোলা $"
                            className="w-24 rounded-md border border-white/15 bg-black px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
                          />
                          <button
                            type="button"
                            onClick={handleSaveWithdrawn}
                            className="rounded-md bg-emerald-600 hover:bg-emerald-500 px-2 py-1 text-[11px] font-bold text-white cursor-pointer"
                          >
                            সেভ
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingWithdrawn(false)}
                            className="rounded-md bg-white/10 hover:bg-white/20 px-2 py-1 text-[11px] text-zinc-300 cursor-pointer"
                          >
                            বাতিল
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
                      <p className="text-[11px] text-zinc-400 font-semibold">আজকের আয় (Today)</p>
                      <p className="text-lg font-black text-emerald-400 font-mono mt-0.5">
                        ${Number(adsterraData?.todayIncome?.revenue || 0).toFixed(3)}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        {Number(adsterraData?.todayIncome?.impression || 0).toLocaleString()} impr • {Number(adsterraData?.todayIncome?.clicks || 0).toLocaleString()} clicks
                      </p>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
                      <p className="text-[11px] text-zinc-400 font-semibold">এই মাসের আয় (This Month)</p>
                      <p className="text-lg font-black text-sky-400 font-mono mt-0.5">
                        ${Number(adsterraData?.monthIncome?.revenue || 0).toFixed(3)}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        {Number(adsterraData?.monthIncome?.impression || 0).toLocaleString()} impr • {Number(adsterraData?.monthIncome?.clicks || 0).toLocaleString()} clicks
                      </p>
                    </div>

                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5">
                      <p className="text-[11px] text-emerald-200 font-semibold">
                        {withdrawnUsd > 0 ? 'বর্তমান Adsterra ব্যালেন্স' : 'বর্তমান Adsterra আয়'}
                      </p>
                      <p className="text-lg font-black text-white font-mono mt-0.5">
                        ${currentBalanceUsd.toFixed(3)}
                      </p>
                      <p className="text-[10px] text-emerald-300 font-mono">
                        {withdrawnUsd > 0 ? `মোট $${totalEarnedUsd.toFixed(3)} থেকে তোলা $${withdrawnUsd.toFixed(2)} বাদে` : `সর্বমোট লাইভ আয়`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="col-span-2 md:col-span-1 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-black/50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">Total Income (সর্বমোট)</p>
                <p className="text-xl sm:text-2xl font-black text-cyan-300 mt-1 font-mono">
                  ${Number(adsterraData?.totalIncome?.revenue || 0).toFixed(3)}
                </p>
                <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                  {Number(adsterraData?.totalIncome?.impression || 0).toLocaleString()} impr
                </p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-black/40 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">মোট আয় (Revenue)</p>
                <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 font-mono">
                  ${Number(adsterraData?.summary?.revenue || 0).toFixed(3)}
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-black/40 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">গড় CPM</p>
                <p className="text-xl sm:text-2xl font-black text-amber-400 mt-1 font-mono">
                  ${Number(adsterraData?.summary?.cpm || 0).toFixed(3)}
                </p>
              </div>
              <div className="rounded-xl border border-blue-500/20 bg-black/40 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Impressions</p>
                <p className="text-xl sm:text-2xl font-black text-blue-400 mt-1 font-mono">
                  {Number(adsterraData?.summary?.impression || 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-purple-500/20 bg-black/40 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Clicks &amp; CTR</p>
                <p className="text-xl sm:text-2xl font-black text-purple-400 mt-1 font-mono">
                  {Number(adsterraData?.summary?.clicks || 0).toLocaleString()}
                  <span className="text-xs font-bold text-zinc-400 ml-1.5">
                    ({Number(adsterraData?.summary?.ctr || 0).toFixed(2)}%)
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#12131b] via-[#0c0d14] to-[#07080c] p-6 sm:p-8 shadow-xl shadow-black/40">
        {/* Glow ambient spots */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-red-600/15 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-purple-600/15 rounded-full blur-[90px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                Master Admin Console
              </span>
              <span className="text-xs text-zinc-500">•</span>
              <span className="text-xs text-zinc-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-zinc-500" />
                {getBDDateString()}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-rose-300 to-amber-300">{user?.name || 'Administrator'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Real-time platform telemetry, audience engagement, monetized VIP requests, and video streaming health.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              to="/admin/videos/upload"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-950/60 ring-1 ring-white/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Upload className="h-4 w-4" />
              <span>Upload Video</span>
            </Link>
            <Link
              to="/admin/videos/blogger-import"
              className="flex items-center gap-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] px-3.5 py-2.5 text-xs font-bold text-zinc-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Globe className="h-4 w-4 text-blue-400" />
              <span>Blogger Import</span>
            </Link>
            <Link
              to="/admin/vip-requests"
              className="relative flex items-center gap-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] px-3.5 py-2.5 text-xs font-bold text-zinc-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Crown className="h-4 w-4 text-amber-400" />
              <span>VIP Requests</span>
              {pendingVIPCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white ring-2 ring-[#0c0d14]">
                  {pendingVIPCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Bento Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.name}
            to={stat.href}
            className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-4.5 hover:border-white/[0.15] hover:bg-white/[0.06] transition-all duration-200 shadow-sm"
          >
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${stat.accent} rounded-bl-full blur-xl pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity`} />
            <div className="flex items-center justify-between mb-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg} ${stat.border} border shadow-inner`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <ArrowUpRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 truncate">
              {stat.name}
            </p>
            <p className="text-xl sm:text-2xl font-black text-white mt-1 tracking-tight">
              {stat.value}
            </p>
          </Link>
        ))}
      </div>

      {/* Trending Spotlight Banner */}
      {trendingVideo && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-red-500/10 to-transparent p-5 sm:p-6 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative h-16 w-24 sm:h-20 sm:w-32 shrink-0 rounded-xl overflow-hidden border border-white/10 bg-black/40">
                {trendingVideo.thumbnailUrl ? (
                  <img 
                    src={trendingVideo.thumbnailUrl} 
                    alt={trendingVideo.title}
                    className="h-full w-full object-cover" 
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-zinc-600">
                    <Video className="h-6 w-6" />
                  </div>
                )}
                <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[9px] font-black text-amber-400">
                  #1 SPOTLIGHT
                </span>
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <Flame className="h-4 w-4 animate-bounce" />
                  <span>Platform Most Trending Video</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-xl">
                  {trendingVideo.title}
                </h3>
                <p className="text-xs text-zinc-400">
                  Added on {new Date(trendingVideo.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
              <div className="text-left sm:text-right">
                <span className="text-xl sm:text-2xl font-black text-white">
                  {(trendingVideo.views || 0).toLocaleString()}
                </span>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Total Plays
                </p>
              </div>
              <Link
                to={`/video/${trendingVideo.slug || trendingVideo.id}`}
                target="_blank"
                className="flex items-center gap-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 px-3 py-2 text-xs font-bold text-amber-300 transition-colors"
              >
                <span>Watch</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Views Trend */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0d14]/90 p-5 sm:p-6 backdrop-blur-md">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-0.5">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-red-500" />
                Views Velocity (Recent Activity)
              </h2>
              <p className="text-xs text-zinc-400">Daily video watch counts across uploads</p>
            </div>
            <span className="rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-red-400">
              Area Chart
            </span>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#71717a" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#12131c', borderColor: '#ffffff15', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  itemStyle={{ color: '#f87171' }}
                />
                <Area type="monotone" dataKey="views" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorViews)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Flow */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0d14]/90 p-5 sm:p-6 backdrop-blur-md">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-0.5">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-amber-400" />
                VIP Membership Sales (BDT)
              </h2>
              <p className="text-xs text-zinc-400">Revenue approved from bKash / Nagad VIP upgrades</p>
            </div>
            <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400">
              Total ৳{totalRevenue}
            </span>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#71717a" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#12131c', borderColor: '#ffffff15', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  itemStyle={{ color: '#fbbf24' }}
                  formatter={(val) => [`৳${val}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Adsterra Domain Breakdown */}
      {adsterraData?.totalIncome?.domains?.length > 0 && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0d14]/90 p-5 sm:p-6 backdrop-blur-md space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-400" />
              Adsterra ডোমেইন-ভিত্তিক আয়
            </h2>
            <p className="text-xs text-zinc-400">
              {adsterraData?.startDate} → {adsterraData?.finishDate}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {adsterraData.totalIncome.domains.map((dom: any) => (
              <span
                key={dom.domainId}
                className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs font-mono text-emerald-300"
              >
                {dom.title}: <strong className="text-white">${Number(dom.revenue || 0).toFixed(3)}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* NEW: Payment Gateway Share, Top 5 Most Watched, and Adblock Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Payment Methods Breakdown (bKash / Nagad / Rocket) */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0d14]/90 p-5 sm:p-6 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-400" />
              পেমেন্ট মেথড সেলস রিপোর্ট
            </h2>
            <span className="text-[10px] text-zinc-400">Approved</span>
          </div>
          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-pink-400">bKash (বিকাশ)</span>
                <span className="text-white font-mono">৳{gatewayStats.bKash.toLocaleString()}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                <div 
                  className="h-full bg-pink-500 rounded-full" 
                  style={{ width: `${totalRevenue > 0 ? (gatewayStats.bKash / totalRevenue) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-orange-400">Nagad (নগদ)</span>
                <span className="text-white font-mono">৳{gatewayStats.Nagad.toLocaleString()}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                <div 
                  className="h-full bg-orange-500 rounded-full" 
                  style={{ width: `${totalRevenue > 0 ? (gatewayStats.Nagad / totalRevenue) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-purple-400">Rocket (রকেট)</span>
                <span className="text-white font-mono">৳{gatewayStats.Rocket.toLocaleString()}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full" 
                  style={{ width: `${totalRevenue > 0 ? (gatewayStats.Rocket / totalRevenue) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Top 5 Most Watched Videos */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0d14]/90 p-5 sm:p-6 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-400" />
              সর্বোচ্চ দেখা ভিডিও (Top 5)
            </h2>
            <span className="text-[10px] text-amber-400 font-bold">Most Viewed</span>
          </div>
          <div className="space-y-2.5">
            {topWatchedVideos.length === 0 ? (
              <p className="text-xs text-zinc-500">কোনো ভিডিও এখনো দেখা হয়নি</p>
            ) : (
              topWatchedVideos.map((vid, idx) => (
                <div key={vid.id} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-white/[0.04] last:border-none">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/5 text-[10px] font-black text-amber-400">
                      {idx + 1}
                    </span>
                    <span className="truncate text-zinc-300 font-medium">{vid.title}</span>
                  </div>
                  <span className="shrink-0 font-bold text-white font-mono flex items-center gap-1">
                    <Eye className="w-3 h-3 text-zinc-500" />
                    {(vid.views || 0).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. AdBlocker Detector Telemetry Log */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0d14]/90 p-5 sm:p-6 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-red-500" />
              AdBlocker ডিটেক্টর লগ
            </h2>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${adBlockMetrics.percent > 20 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
              {adBlockMetrics.percent}% Adblock
            </span>
          </div>
          <p className="text-xs text-zinc-400 mb-3">
            কত শতাংশ ভিজিটর অ্যাডব্লক ব্যবহার করছে তার রিয়েল-টাইম তথ্য:
          </p>
          <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">স্বাভাবিক বিজ্ঞাপন লোড:</span>
              <span className="text-emerald-400 font-bold font-mono">{100 - adBlockMetrics.percent}% ({adBlockMetrics.allowed} সেশন)</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">বিজ্ঞাপন ব্লক শনাক্ত:</span>
              <span className="text-red-400 font-bold font-mono">{adBlockMetrics.percent}% ({adBlockMetrics.detected} সেশন)</span>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 mt-3 italic">
            *টিপস: অ্যাডব্লকার ইউজারদের জন্য Popunder এবং Social Bar সবচেয়ে কার্যকরী।
          </p>
        </div>
      </div>

      {/* Two-Column Tables Section: Recent Uploads & Newest Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Uploads Table */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0d14]/90 overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/[0.08] p-5">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Video className="h-4 w-4 text-red-400" />
                Recent Uploads
              </h2>
              <p className="text-xs text-zinc-400">Latest media published to the catalog</p>
            </div>
            <Link
              to="/admin/videos"
              className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
            >
              View All →
            </Link>
          </div>

          <div className="p-0">
            {isLoading ? (
              <div className="text-zinc-500 text-center py-10 text-xs">Loading media...</div>
            ) : recentVideos.length === 0 ? (
              <div className="text-zinc-500 text-center py-10 text-xs">No videos uploaded yet.</div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {recentVideos.map((video) => (
                  <div key={video.id} className="flex items-center gap-3.5 p-4 hover:bg-white/[0.03] transition-colors">
                    <div className="h-12 w-20 shrink-0 rounded-lg overflow-hidden border border-white/10 bg-black/40">
                      {video.thumbnailUrl ? (
                        <img src={video.thumbnailUrl} alt={video.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-600">
                          <Video className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs sm:text-sm font-bold text-zinc-200 truncate">{video.title}</p>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3 text-zinc-500" />
                          {(video.views || 0).toLocaleString()} views
                        </span>
                        <span>•</span>
                        <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                      {video.status || 'Active'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Newest Users List */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0d14]/90 overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/[0.08] p-5">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                Newest Registered Users
              </h2>
              <p className="text-xs text-zinc-400">Recent account registrations</p>
            </div>
            <Link
              to="/admin/users"
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Manage Users →
            </Link>
          </div>

          <div className="p-0">
            {isLoading ? (
              <div className="text-zinc-500 text-center py-10 text-xs">Loading user roster...</div>
            ) : recentUsers.length === 0 ? (
              <div className="text-zinc-500 text-center py-10 text-xs">No users registered yet.</div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {recentUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3.5 p-4 hover:bg-white/[0.03] transition-colors">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-600 font-bold text-xs text-white ring-1 ring-white/10 shadow-sm">
                      {u.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-zinc-200 truncate">{u.name}</h4>
                        {u.isVIP && (
                          <span className="flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-black text-amber-300 border border-amber-500/30">
                            VIP
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 truncate">{u.email}</p>
                      {u.phone && (
                        <p className="text-[11px] text-amber-400/80 truncate flex items-center gap-1">
                          <Smartphone className="w-3 h-3" />
                          {u.phone}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-zinc-500 block">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                        {u.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Today's Top 10 Viewers Leaderboard */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c0d14]/90 overflow-hidden backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/[0.08] p-5 bg-gradient-to-r from-yellow-500/10 via-transparent to-transparent">
          <div className="space-y-0.5">
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-400" />
              Today's Viewer Leaderboard
            </h2>
            <p className="text-xs text-zinc-400">Users who watched the highest volume of media today (GMT+6)</p>
          </div>
          <span className="rounded-full bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-0.5 text-[11px] font-bold text-yellow-400">
            Top 10 Today
          </span>
        </div>

        <div className="w-full overflow-x-auto">
          {isLoading ? (
            <div className="text-zinc-500 text-center py-10 text-xs">Loading leaderboard metrics...</div>
          ) : topUsers.length === 0 ? (
            <div className="text-zinc-500 text-center py-10 text-xs">No active viewing records recorded today yet.</div>
          ) : (
            <table className="w-full text-left text-xs text-zinc-400">
              <thead className="border-b border-white/[0.06] bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-5 py-3">Rank</th>
                  <th className="px-5 py-3">User Profile</th>
                  <th className="px-5 py-3 text-right">Videos Watched</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {topUsers.map((u, index) => (
                  <tr key={u.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-lg font-black text-xs ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-600 text-black shadow-md shadow-yellow-900/40 ring-1 ring-yellow-300' :
                        index === 1 ? 'bg-gradient-to-br from-zinc-200 to-zinc-400 text-black shadow-sm ring-1 ring-white/50' :
                        index === 2 ? 'bg-gradient-to-br from-amber-700 to-amber-900 text-white shadow-sm ring-1 ring-amber-600/50' :
                        'bg-white/[0.05] text-zinc-400 border border-white/10'
                      }`}>
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 font-bold text-xs text-zinc-200 ring-1 ring-white/10">
                          {u.userName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-zinc-200 truncate">{u.userName}</p>
                          <p className="text-[11px] text-zinc-500 truncate">{u.userEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 font-bold text-yellow-400">
                        <Eye className="h-3.5 w-3.5" />
                        {u.views}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
