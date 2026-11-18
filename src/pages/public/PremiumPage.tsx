import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { VideoCard } from '../../components/video/VideoCard';
import { Video, Banner } from '../../types';
import { Crown, Loader2, PlayCircle, Download } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { Link } from 'react-router-dom';
import { getSmartlinkUrl } from '../../lib/adUtils';
import { isPrivilegedUser } from '../../lib/adminConfig';

export function PremiumPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPremiumVideos();
  }, []);

  const fetchPremiumVideos = async () => {
    setIsLoading(true);
    try {
      const now = Date.now();
      
      const { data: vidsData } = await supabase
        .from('videos')
        .select('*')
        .eq('is_premium', true)
        .in('status', ['published', 'scheduled'])
        .order('created_at', { ascending: false })
        .limit(100);

      const vids: Video[] = [];
      if (vidsData) {
        vidsData.forEach((doc: any) => {
          if (doc.status === 'published' || (doc.status === 'scheduled' && (!doc.created_at || doc.created_at <= now))) {
            vids.push({
              id: doc.id,
              title: doc.title,
              slug: doc.slug,
              description: doc.description,
              thumbnailUrl: doc.thumbnail_url || doc.thumbnailUrl,
              videoUrl: doc.video_url || doc.videoUrl,
              duration: doc.duration,
              isPremium: doc.is_premium !== undefined ? doc.is_premium : doc.isPremium,
              categoryId: doc.category_id || doc.categoryId || doc.category,
              views: doc.views,
              likes: doc.likes,
              status: doc.status,
              visibility: doc.visibility,
              featured: doc.featured,
              order: doc.order,
              createdAt: doc.created_at,
              updatedAt: doc.created_at,
              tags: []
            });
          }
        });
        
        vids.sort((a, b) => {
          const orderA = a.order || 0;
          const orderB = b.order || 0;
          
          if (orderA > 0 && orderB > 0) {
            if (orderA !== orderB) return orderA - orderB;
          } else if (orderA > 0) {
            return -1;
          } else if (orderB > 0) {
            return 1;
          }
          return b.createdAt - a.createdAt;
        });
        
        setVideos(vids);
      }

      const { data: bannerData } = await supabase
        .from('banners')
        .select('*');

      if (bannerData) {
        const premiumBanners = bannerData
          .filter((doc: any) => (doc.is_active === true || doc.isActive === true) && (doc.is_premium === true || doc.isPremium === true))
          .map((doc: any) => ({
            id: doc.id,
            title: doc.title,
            imageUrl: doc.image_url || doc.imageUrl,
            linkUrl: doc.link_url || doc.linkUrl,
            isActive: true,
            isPremium: true,
            order: doc.order,
            createdAt: doc.created_at || doc.createdAt
          }));
        
        premiumBanners.sort((a, b) => {
          const orderA = a.order || 0;
          const orderB = b.order || 0;
          const timeA = new Date(a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || 0).getTime();
          if (orderA > 0 && orderB > 0) {
            if (orderA === orderB) return timeB - timeA;
            return orderA - orderB;
          }
          if (orderA > 0) return -1;
          if (orderB > 0) return 1;
          return timeB - timeA;
        });
        
        setBanners(premiumBanners);
      }
    } catch (error) {
      console.error("Error fetching premium videos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const hasAccess = isPrivilegedUser(user, settings);
  const showAds = !hasAccess && (settings?.adsEnabled !== false);
  const smartlinkUrl = getSmartlinkUrl(settings);
  // custom banners from db


  // Auto-scroll banners
  useEffect(() => {
    if (!videos.length || !sliderRef.current) return;

    const intervalId = setInterval(() => {
      if (sliderRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
        if (scrollLeft + clientWidth >= scrollWidth - 10) {
          sliderRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          sliderRef.current.scrollTo({ left: scrollLeft + clientWidth, behavior: 'smooth' });
        }
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [banners.length]);

  return (
    <div className="py-6 space-y-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-yellow-500/20 rounded-full blur-[60px] pointer-events-none"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-600 shadow-[0_0_25px_rgba(250,204,21,0.4)]">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent"></div>
            <Crown className="relative z-10 w-7 h-7 text-white drop-shadow-md" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-500 to-amber-500 drop-shadow-sm">
              Premium Content
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm mt-1 uppercase tracking-widest font-bold">Exclusive VIP Videos</p>
          </div>
        </div>
        
        {!hasAccess ? (
          <Link to="/profile?tab=vip" className="flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-500 to-yellow-600 px-6 py-2.5 text-sm font-bold text-black shadow-lg shadow-yellow-500/20 hover:scale-105 transition-all whitespace-nowrap">
            <Crown className="w-4 h-4" />
            Get Premium Access
          </Link>
        ) : (
          <Link to="/profile?tab=vip" className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 px-4 py-2 text-xs sm:text-sm font-bold text-amber-300 hover:bg-amber-500/30 transition-all whitespace-nowrap">
            <Crown className="w-4 h-4 text-amber-400" />
            <span>ভিআইপি প্যাকেজ কিনুন / রিচার্জ</span>
          </Link>
        )}
      </div>

      {!hasAccess && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-900/40 to-black border border-yellow-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-yellow-200/80 text-sm">You are currently viewing premium thumbnails. Subscribe to watch full videos.</p>
        </div>
      )}

      {/* Premium Banner Slider */}
      {!isLoading && banners.length > 0 && (
        <section className="relative overflow-hidden rounded-2xl bg-black border border-white/10 shadow-2xl group">
          <div ref={sliderRef} className="flex w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide no-scrollbar scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {banners.map((banner) => (
              <div key={banner.id} className="w-full shrink-0 snap-start snap-always relative">
                {banner.linkUrl ? (
                  <a href={banner.linkUrl} target="_blank" rel="noreferrer" className="block w-full relative">
                    <div className="absolute inset-0 bg-cover bg-center opacity-40 blur-xl scale-110 no-invert" style={{ backgroundImage: `url(${banner.imageUrl})` }} />
                    <img src={banner.imageUrl} alt={banner.title || 'Banner'} className="w-full h-[180px] sm:h-[250px] md:h-[320px] lg:h-[380px] object-contain object-center block relative z-10" />
                  </a>
                ) : (
                  <div className="relative w-full h-[180px] sm:h-[250px] md:h-[320px] lg:h-[380px]">
                    <div className="absolute inset-0 bg-cover bg-center opacity-40 blur-xl scale-110" style={{ backgroundImage: `url(${banner.imageUrl})` }} />
                    <img src={banner.imageUrl} alt={banner.title || 'Banner'} className="w-full h-[180px] sm:h-[250px] md:h-[320px] lg:h-[380px] object-contain object-center block relative z-10" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
          <Crown className="w-16 h-16 text-yellow-500/20 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Premium Videos Yet</h3>
          <p className="text-gray-400">Check back later for exclusive content.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Adsterra High-Converting CTA (Direct Link) */}
          {showAds && smartlinkUrl && (
            <div className="w-full">
              <button 
                onClick={() => {
                   window.location.href = `/redirect?url=${encodeURIComponent(smartlinkUrl)}`;
                }}
                className="flex w-full items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-green-600 via-emerald-500 to-teal-500 p-4 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-[1.02] transition-all duration-300 animate-bounce"
              >
                <div className="flex flex-col items-start text-left">
                  <span className="text-lg sm:text-xl font-black text-white uppercase tracking-wider drop-shadow-md">
                    🚀 Download Premium App
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-green-100 drop-shadow-sm mt-1">
                    Unlock All VIP Content • High Speed
                  </span>
                </div>
                <div className="flex shrink-0 items-center justify-center rounded-full bg-white p-3 text-green-600 shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                  <Download className="h-6 w-6 sm:h-8 sm:w-8 animate-pulse" />
                </div>
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
