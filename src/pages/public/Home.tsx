import React from 'react';
import { useEffect, useState, useRef, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { AdBanner } from '../../components/ui/AdBanner';
import { VideoCard } from '../../components/video/VideoCard';
import { Video, Banner, Category } from '../../types';
import { useSettingsStore } from '../../store/settingsStore';
import { useCacheStore } from '../../store/cacheStore';
import { Link } from 'react-router-dom';
import { 
  FolderTree, 
  Crown, 
  X, 
  Loader2, 
  Gift, 
  Gem, 
  Flame, 
  Sparkles, 
  Play, 
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  Clock,
  Zap,
  ShieldCheck,
  Eye,
  Film,
  Layers,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { MarqueeNotice } from '../../components/ui/MarqueeNotice';
import { QuickButtonsBar } from '../../components/ui/QuickButtonsBar';
import { getFullThumbnailUrl } from '../../lib/utils';
import { getSafeTelegramWebUrl, isLikelyTelegramOrExternalUrl, executeTelegramJoin } from '../../lib/telegramUtils';
import { getSmartlinkUrl } from '../../lib/adUtils';
import { isPrivilegedUser as checkPrivilegedUser } from '../../lib/adminConfig';

export function Home() {
  const homeVideos = useCacheStore(state => state.homeVideos);
  const homeBanners = useCacheStore(state => state.homeBanners);
  const homeCategories = useCacheStore(state => state.homeCategories);
  const hasLoaded = useCacheStore(state => state.hasLoaded);
  const setHomeData = useCacheStore(state => state.setHomeData);
  const updateVideos = useCacheStore(state => state.updateVideos);
  const shouldFetch = useCacheStore(state => state.shouldFetch);

  const videos = homeVideos;
  const banners = homeBanners;
  const categories = homeCategories;

  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(!hasLoaded && homeVideos.length === 0);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [giftNotice, setGiftNotice] = useState<any>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'vip' | 'trending' | 'latest'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  const { settings } = useSettingsStore();
  const smartlinkUrl = getSmartlinkUrl(settings);
  const { user } = useAuthStore();
  const isPrivilegedUser = checkPrivilegedUser(user, settings);
  const sliderRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      if (!isSupabaseConfigured()) {
        if (isMounted) setIsLoading(false);
        return;
      }

      if (!shouldFetch()) {
        if (isMounted) setIsLoading(false);
        return;
      }
      
      try {
        const { data: videosData, error: videosError } = await supabase
          .from('videos')
          .select('*')
          .in('status', ['published', 'scheduled'])
          .order('created_at', { ascending: false })
          .limit(24);

        if (videosError) throw videosError;

        const now = Date.now();
        const fetchedVideos: Video[] = (videosData || [])
          .filter(doc => doc.status === 'published' || (doc.status === 'scheduled' && doc.created_at <= now))
          .map(doc => ({
            id: doc.id,
            title: doc.title,
            slug: doc.slug,
            description: doc.description,
            thumbnailUrl: getFullThumbnailUrl(doc.thumbnail_url || doc.thumbnailUrl),
            videoUrl: doc.video_url || doc.videoUrl,
            duration: doc.duration,
            isPremium: doc.is_premium !== undefined ? doc.is_premium : doc.isPremium,
            categoryId: doc.category_id || doc.categoryId || doc.category,
            views: doc.views,
            likes: doc.likes,
            status: doc.status,
            visibility: doc.visibility,
            featured: doc.featured,
            createdAt: doc.created_at || doc.createdAt,
            updatedAt: doc.created_at,
            tags: []
          })) as Video[];
        
        if (isMounted && fetchedVideos.length < 24) {
          setHasMore(false);
        }

        // Fetch banners
        let publicBanners: Banner[] = [];
        try {
          const { data: bannerData, error: bannerError } = await supabase
            .from('banners')
            .select('*');

          if (!bannerError && bannerData) {
            publicBanners = bannerData
              .filter(b => (b.is_active === true || b.isActive === true) && (!b.is_premium && !b.isPremium))
              .map(b => ({
                id: b.id,
                imageUrl: getFullThumbnailUrl(b.image_url || b.imageUrl),
                title: b.title,
                description: b.description,
                linkUrl: b.link_url || b.linkUrl,
                isActive: true,
                isPremium: false,
                order: b.order,
                createdAt: b.created_at || b.createdAt
              })) as Banner[];
              
            publicBanners.sort((a, b) => {
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
          }
        } catch (e) {
          console.error("Error fetching banners:", e);
        }

        // Fetch categories
        let publicCategories: Category[] = [];
        try {
          const { data: catData, error: catError } = await supabase
            .from('categories')
            .select('*')
            .eq('status', 'active');

          if (!catError && catData) {
            publicCategories = catData.map(doc => ({
              id: doc.id,
              name: doc.name,
              slug: doc.slug,
              image: doc.image,
              status: doc.status,
              createdAt: doc.created_at
            })) as Category[];
          }
        } catch (e) {
          console.error("Error fetching categories:", e);
        }
        
        if (isMounted) {
          setHomeData(fetchedVideos, publicBanners, publicCategories);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Error fetching data:", error);
          const errMsg = error instanceof Error ? error.message : ((error as any)?.message || String(error));
          setDebugError(errMsg);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    fetchData();

    return () => {
      isMounted = false;
    };
  }, [setHomeData, shouldFetch]);

  // Auto-scroll banner slider
  useEffect(() => {
    if (!banners.length) return;

    const intervalId = setInterval(() => {
      const slider = sliderRef.current;
      if (slider && slider.clientWidth > 0) {
        const { scrollLeft, scrollWidth, clientWidth } = slider;
        if (scrollLeft + clientWidth >= scrollWidth - 15) {
          slider.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          slider.scrollTo({ left: scrollLeft + clientWidth, behavior: 'smooth' });
        }
      }
    }, 4800);

    return () => clearInterval(intervalId);
  }, [banners.length]);

  // Track active banner slide
  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider || !banners.length) return;

    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!slider || slider.clientWidth <= 0) return;
        const index = Math.round(slider.scrollLeft / slider.clientWidth);
        if (index >= 0 && index < banners.length) {
          setActiveBannerIndex((prev) => (prev === index ? prev : index));
        }
      }, 60);
    };

    slider.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      slider.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, [banners.length]);

  const scrollToBanner = (index: number) => {
    const slider = sliderRef.current;
    if (slider && slider.clientWidth > 0) {
      slider.scrollTo({ left: index * slider.clientWidth, behavior: 'smooth' });
      setActiveBannerIndex(index);
    }
  };

  const scrollPrevBanner = () => {
    if (!banners.length) return;
    const nextIdx = (activeBannerIndex - 1 + banners.length) % banners.length;
    scrollToBanner(nextIdx);
  };

  const scrollNextBanner = () => {
    if (!banners.length) return;
    const nextIdx = (activeBannerIndex + 1) % banners.length;
    scrollToBanner(nextIdx);
  };

  const scrollCategories = (direction: 'left' | 'right') => {
    const el = categoriesRef.current;
    if (!el) return;
    const amount = direction === 'left' ? -280 : 280;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  useEffect(() => {
    let isMounted = true;

    async function fetchNotices() {
      if (!user || !isSupabaseConfigured()) return;
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_popup', true)
          .eq('read', false)
          .limit(1);

        if (error) throw error;
        
        if (isMounted && data && data.length > 0) {
          const doc = data[0];
          setGiftNotice({ 
            id: doc.id,
            userId: doc.user_id,
            title: doc.title,
            message: doc.message,
            read: doc.read,
            type: doc.type,
            isPopup: doc.is_popup,
            createdAt: doc.created_at,
            link: (doc as any).link
          });
        }
      } catch(e) {
        console.error("Error fetching gift notice:", e);
      }
    }
    fetchNotices();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const dismissNotice = async () => {
    if (!giftNotice) return;
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', giftNotice.id);
    } catch(e) {
      console.error(e);
    }
    setGiftNotice(null);
  };

  const loadMoreVideos = async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .in('status', ['published', 'scheduled'])
        .order('created_at', { ascending: false })
        .range(videos.length, videos.length + 19);

      if (error) throw error;

      if (data && data.length > 0) {
        const now = Date.now();
        const newVideos: Video[] = data
          .filter(doc => doc.status === 'published' || (doc.status === 'scheduled' && doc.created_at <= now))
          .map(doc => ({
            id: doc.id,
            title: doc.title,
            slug: doc.slug,
            description: doc.description,
            thumbnailUrl: getFullThumbnailUrl(doc.thumbnail_url || doc.thumbnailUrl),
            videoUrl: doc.video_url || doc.videoUrl,
            duration: doc.duration,
            isPremium: doc.is_premium !== undefined ? doc.is_premium : doc.isPremium,
            categoryId: doc.category_id || doc.categoryId || doc.category,
            views: doc.views,
            likes: doc.likes,
            status: doc.status,
            visibility: doc.visibility,
            featured: doc.featured,
            createdAt: doc.created_at || doc.createdAt,
            updatedAt: doc.created_at,
            tags: []
          })) as Video[];
        
        const existingIds = new Set(videos.map(v => v.id));
        const uniqueNewVideos = newVideos.filter(v => !existingIds.has(v.id));
        const combined = [...videos, ...uniqueNewVideos];
        
        updateVideos(combined);
        
        if (data.length < 20) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading more videos:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const defaultVaultCategories = useMemo<Array<{ id: string; name: string; shortLabel: string; image?: string }>>(() => [
    { id: 'secrat-vault-tiktok', name: 'SECRAT VAULT TIKTOK', shortLabel: 'SECRAT V...', image: undefined },
    { id: 'celebrity-vault', name: 'CELEBRITY VAULT', shortLabel: 'CELEBRIT...', image: undefined },
    { id: 'pakistani-vault', name: 'PAKISTANI VAULT', shortLabel: 'PAKISTANI...', image: undefined },
    { id: 'hidden-vault', name: 'HIDDEN VAULT', shortLabel: 'HIDDEN V...', image: undefined },
    { id: 'korean-vault', name: 'KOREAN VAULT', shortLabel: 'KOREAN V...', image: undefined },
    { id: 'bangladeshi-vault', name: 'BANGLADESHI VAULT', shortLabel: 'BANGLA V...', image: undefined },
    { id: 'indian-vault', name: 'INDIAN VAULT', shortLabel: 'INDIAN V...', image: undefined },
  ], []);

  const displayCategories = useMemo(() => {
    if (categories && categories.length > 0) {
      return categories.map(c => ({
        id: c.id,
        name: c.name,
        shortLabel: c.name.length > 9 ? c.name.substring(0, 8) + '...' : c.name,
        image: c.image
      }));
    }
    return defaultVaultCategories;
  }, [categories, defaultVaultCategories]);

  // Filter videos by tab and selected category
  const filteredVideos = useMemo(() => {
    let result = [...videos];

    // Filter tab
    if (filterTab === 'vip') {
      result = result.filter(v => v.isPremium);
    } else if (filterTab === 'trending') {
      result = result.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (filterTab === 'latest') {
      result = result.sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
    }

    // Category filter
    if (selectedCategory) {
      const activeCat = displayCategories.find(c => c.id === selectedCategory);
      const catName = (activeCat?.name || '').toLowerCase();
      const selLower = selectedCategory.toLowerCase();

      result = result.filter(v => {
        const vCat = (v.category || '').toLowerCase();
        const vCatId = (v.categoryId || '').toLowerCase();
        const vTitle = (v.title || '').toLowerCase();

        const catTokens = [
          ...vCatId.split(',').map(s => s.trim()).filter(Boolean),
          ...vCat.split(',').map(s => s.trim()).filter(Boolean)
        ];

        if (catTokens.includes(selLower) || (catName && catTokens.includes(catName))) return true;
        if (vCatId === selLower || vCat === selLower) return true;
        if (catName && vCat && (vCat.includes(catName) || catName.includes(vCat))) return true;
        if (catName && vCatId && (vCatId.includes(catName) || catName.includes(vCatId))) return true;

        if (selLower.includes('tiktok') && (vCat.includes('tiktok') || vCatId.includes('tiktok') || vTitle.includes('tiktok'))) return true;
        if (selLower.includes('celebrity') && (vCat.includes('celebrity') || vCatId.includes('celebrity') || vTitle.includes('celebrity'))) return true;
        if (selLower.includes('pakistan') && (vCat.includes('pakistan') || vCatId.includes('pakistan') || vTitle.includes('pakistan'))) return true;
        if (selLower.includes('korean') && (vCat.includes('korean') || vCatId.includes('korean') || vTitle.includes('korean'))) return true;
        if (selLower.includes('bangla') && (vCat.includes('bangla') || vCatId.includes('bangla') || vTitle.includes('bangla'))) return true;
        if (selLower.includes('indian') && (vCat.includes('indian') || vCatId.includes('indian') || vTitle.includes('indian'))) return true;
        if (selLower.includes('hidden') && (vCat.includes('hidden') || vCat.includes('secret') || vCatId.includes('hidden') || vCatId.includes('secret') || vTitle.includes('vault'))) return true;

        return false;
      });
    }

    return result;
  }, [videos, filterTab, selectedCategory, displayCategories]);

  const trendingVideos = useMemo(() => {
    return [...videos].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 4);
  }, [videos]);

  // Unified hero carousel slides: only real user banners from DB
  const heroSlides = useMemo(() => {
    if (banners && banners.length > 0) {
      return banners.map(b => ({
        id: b.id,
        title: b.title || '',
        imageUrl: getFullThumbnailUrl(b.imageUrl),
        linkUrl: b.linkUrl || '#'
      }));
    }
    return [];
  }, [banners]);

  // Auto-slide carousel every 4.5s
  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const interval = setInterval(() => {
      setActiveBannerIndex(prev => {
        const next = (prev + 1) % heroSlides.length;
        if (sliderRef.current) {
          const slideWidth = sliderRef.current.clientWidth;
          sliderRef.current.scrollTo({
            left: slideWidth * next,
            behavior: 'smooth'
          });
        }
        return next;
      });
    }, 4500);
    return () => clearInterval(interval);
  }, [heroSlides.length]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6 pb-20 sm:pb-16 pt-1 sm:pt-2 px-2.5 sm:px-4">
      
      {/* Gift Notification Popup */}
      {giftNotice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-[#0d0f14] border border-amber-500/30 shadow-[0_0_60px_rgba(245,158,11,0.25)] animate-in zoom-in-95 duration-500">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/20 rounded-full blur-[60px]"></div>
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-red-500/20 rounded-full blur-[60px]"></div>
            
            <div className="h-24 bg-gradient-to-r from-amber-600/20 via-yellow-500/20 to-amber-600/20 w-full flex items-end justify-center pb-6">
              <div className="absolute -top-6 bg-gradient-to-b from-amber-400 to-yellow-500 p-4 rounded-full shadow-[0_0_35px_rgba(245,158,11,0.6)] border-4 border-[#0d0f14]">
                <Gift className="w-9 h-9 text-black" />
              </div>
            </div>

            <div className="p-7 pt-9 text-center relative z-10">
              <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 mb-3">
                {giftNotice.title}
              </h3>
              
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-5">
                <p className="text-sm text-gray-200 leading-relaxed font-medium">
                  {giftNotice.message}
                </p>
              </div>

              {giftNotice.link && (
                <a 
                  href={giftNotice.link} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-block w-full text-center px-5 py-2.5 mb-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold border border-white/10 transition-colors text-xs"
                >
                  View Details &rarr;
                </a>
              )}

              <button 
                onClick={dismissNotice} 
                className="w-full rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-6 py-3.5 font-black text-black text-sm uppercase tracking-wider hover:brightness-110 shadow-[0_0_25px_rgba(245,158,11,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{giftNotice.type === 'VIP_APPROVED' ? 'ভিআইপি উপভোগ শুরু করুন' : 'ঠিক আছে, ধন্যবাদ'}</span>
                <Crown className="w-4 h-4" />
              </button>
            </div>
            
            <button 
              onClick={dismissNotice} 
              className="absolute top-4 right-4 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition z-20"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Quick Link Buttons (Directly below Top Bar) */}
      <div className="-mt-1">
        <QuickButtonsBar />
      </div>

      {/* 1. Hero Carousel: Shows directly user's custom banners */}
      {heroSlides.length > 0 ? (
        <div className="relative group rounded-2xl overflow-hidden shadow-[0_12px_45px_rgba(0,0,0,0.85)] border border-white/[0.08] bg-black">
          <div 
            ref={sliderRef}
            className="flex snap-x snap-mandatory overflow-x-auto hide-scrollbar scroll-smooth"
          >
            {heroSlides.map((slide, sIdx) => (
              <div 
                key={slide.id} 
                className="w-full shrink-0 snap-start relative aspect-[16/10] sm:aspect-[21/9] md:aspect-[2.6/1] bg-black overflow-hidden flex items-center justify-center"
              >
                {/* Blurred lateral reflections */}
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-40 blur-xl scale-110 pointer-events-none" 
                  style={{ backgroundImage: `url(${slide.imageUrl})` }} 
                />
                
                {/* Centered portrait image */}
                {isLikelyTelegramOrExternalUrl(slide.linkUrl) ? (
                  <a 
                    href={getSafeTelegramWebUrl(slide.linkUrl)} 
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      executeTelegramJoin(slide.linkUrl);
                    }}
                    className="relative z-10 h-full w-full flex items-center justify-center cursor-pointer"
                  >
                    <img 
                      src={slide.imageUrl} 
                      alt={slide.title || 'Featured'} 
                      className="h-full w-auto max-w-full object-contain drop-shadow-2xl"
                    />
                  </a>
                ) : (
                  <Link 
                    to={slide.linkUrl || '#'} 
                    className="relative z-10 h-full w-full flex items-center justify-center cursor-pointer"
                  >
                    <img 
                      src={slide.imageUrl} 
                      alt={slide.title || 'Featured'} 
                      className="h-full w-auto max-w-full object-contain drop-shadow-2xl"
                    />
                  </Link>
                )}

                {/* Gradient overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent pointer-events-none z-15" />

                {/* Bottom Left Title */}
                {slide.title && (
                  <div className="absolute bottom-5 left-3 sm:bottom-6 sm:left-5 z-20 pointer-events-none max-w-[88%]">
                    <h3 className="text-sm sm:text-base md:text-lg font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] line-clamp-1 leading-snug">
                      {slide.title}
                    </h3>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Carousel indicators */}
          {heroSlides.length > 1 && (
            <div className="absolute bottom-2 left-0 right-0 z-30 flex justify-center items-center gap-1.5 pointer-events-auto">
              {heroSlides.map((_, idx) => (
                <button 
                  key={idx}
                  type="button"
                  onClick={() => scrollToBanner(idx)}
                  aria-label={`Slide ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    idx === activeBannerIndex 
                      ? 'w-6 bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]' 
                      : 'w-1.5 bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      ) : isLoading ? (
        <div className="w-full aspect-[16/10] sm:aspect-[21/9] md:aspect-[2.6/1] rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse flex items-center justify-center">
          <div className="w-7 h-7 rounded-full border-2 border-red-600 border-t-transparent animate-spin opacity-50" />
        </div>
      ) : null}

      {/* Top Ad Banner */}
      <div className="w-full my-2">
        <div className="hidden md:block">
          <AdBanner placement="banner728x90" className="w-full min-h-[90px]" />
        </div>
        <div className="block md:hidden">
          <AdBanner placement="banner320x50" className="w-full min-h-[50px]" />
        </div>
      </div>

      {/* 2. Marquee Notice Bar (Screenshot 1) */}
      <MarqueeNotice />

      {/* 3. Popular Categories (Screenshot 1) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">
            <span className="text-red-500 font-extrabold">Popular</span>{' '}
            <span className="text-white font-extrabold">Categories</span>
          </h2>
          <Link 
            to="/categories" 
            className="text-red-500 hover:text-red-400 font-bold text-xs flex items-center gap-1 transition-colors"
          >
            <span>View All</span>
            <span className="text-sm leading-none">&rarr;</span>
          </Link>
        </div>

        {/* Horizontal scroll of circular categories */}
        <div 
          ref={categoriesRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto pb-1 hide-scrollbar scroll-smooth"
        >
          {displayCategories.map((category) => {
            const isSelected = selectedCategory === category.id;
            const shortName = category.shortLabel || (category.name.length > 9 ? category.name.substring(0, 8) + '...' : category.name);

            return (
              <div
                key={category.id}
                onClick={() => {
                  setSelectedCategory(prev => prev === category.id ? null : category.id);
                }}
                role="button"
                tabIndex={0}
                className="group flex flex-col items-center gap-1.5 shrink-0 cursor-pointer transition-transform duration-200 active:scale-95 select-none"
              >
                {/* Outer Glowing Circular Ring */}
                <div className={`relative flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-full border-2 p-[2px] transition-all duration-300 shadow-md ${
                  isSelected 
                    ? 'border-red-500 shadow-[0_0_18px_rgba(239,68,68,0.7)] scale-105' 
                    : 'border-red-500/80 group-hover:border-red-400 group-hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                }`}>
                  {/* Inner Creamy Beige Round Surface */}
                  <div className="relative h-full w-full rounded-full bg-[#fef8eb] flex flex-col items-center justify-center p-1 overflow-hidden border border-amber-300/40 text-center select-none">
                    {category.image ? (
                      <img 
                        src={category.image} 
                        alt={category.name} 
                        className="h-full w-full object-cover rounded-full" 
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full h-full">
                        {/* Golden Safe Vault Graphic (Exact Match to Screenshot 1) */}
                        <div className="w-7 h-7 sm:w-8 sm:h-8 relative flex items-center justify-center">
                          <svg viewBox="0 0 36 36" className="w-full h-full drop-shadow-sm" fill="none">
                            {/* Vault Frame */}
                            <rect x="3" y="3" width="30" height="30" rx="4" fill="#d97706" stroke="#92400e" strokeWidth="1.5" />
                            <rect x="6" y="6" width="24" height="24" rx="2" fill="#fef3c7" stroke="#b45309" strokeWidth="1" />
                            {/* Safe Dial */}
                            <circle cx="18" cy="18" r="6" fill="#f59e0b" stroke="#78350f" strokeWidth="1.5" />
                            <circle cx="18" cy="18" r="2.5" fill="#78350f" />
                            {/* Dial Marks */}
                            <line x1="18" y1="12.5" x2="18" y2="14" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" />
                            <line x1="18" y1="22" x2="18" y2="23.5" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" />
                            <line x1="12.5" y1="18" x2="14" y2="18" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" />
                            <line x1="22" y1="18" x2="23.5" y2="18" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" />
                            {/* Handle */}
                            <rect x="23" y="16.5" width="4" height="3" rx="1" fill="#78350f" />
                          </svg>
                        </div>
                        {/* Text inside badge */}
                        <span className="text-[6px] sm:text-[7px] font-black text-amber-950 uppercase leading-none tracking-tighter truncate max-w-full px-0.5 mt-0.5">
                          {category.name.includes('TIKTOK') ? 'TIKTOK' : category.name.split(' ')[0]}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Truncated White Label Below Circle */}
                <span className={`text-[10px] sm:text-[11px] font-bold uppercase transition-colors text-center w-16 sm:w-20 truncate tracking-tight ${
                  isSelected ? 'text-red-400 font-extrabold' : 'text-white group-hover:text-red-400'
                }`}>
                  {shortName}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Mid Ad Banner between Categories and Trending */}
      <div className="w-full my-3">
        <div className="hidden md:block">
          <AdBanner placement="banner728x90" className="w-full min-h-[90px]" />
        </div>
        <div className="block md:hidden">
          <AdBanner placement="banner300x250" className="w-full min-h-[250px]" />
        </div>
      </div>

      {/* 4. Trending Now (Screenshot 1) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-1.5">
            <span className="text-red-500 font-extrabold">Trending</span>{' '}
            <span className="text-white font-extrabold">Now</span>
            <span className="w-3.5 h-3.5 rounded-full bg-red-900/80 inline-block align-middle ml-1" />
          </h2>
          <Link 
            to="/trending" 
            className="text-red-500 hover:text-red-400 font-bold text-xs flex items-center gap-1 transition-colors"
          >
            <span>View All</span>
            <span className="text-sm leading-none">&rarr;</span>
          </Link>
        </div>

        {/* 2-Column Grid of Trending Videos */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {(trendingVideos.length > 0 ? trendingVideos : videos.slice(0, 4)).map((video) => (
            <VideoCard key={`trending-${video.id}`} video={video} />
          ))}
        </div>
      </section>

      {/* High-Converting Native Ad Banner */}
      <div className="w-full my-3">
        <AdBanner placement="nativeBanner" className="w-full min-h-[120px]" />
      </div>

      {/* 5. Latest Videos (Screenshot 2) */}
      <section className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">
            <span className="text-white font-extrabold">Latest</span>{' '}
            <span className="text-red-500 font-extrabold">Videos</span>
          </h2>
        </div>

        {/* 2-Column Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2 animate-pulse">
                <div className="aspect-[16/10] w-full rounded-2xl bg-white/[0.05]" />
                <div className="h-3.5 w-3/4 rounded bg-white/[0.06]" />
                <div className="h-3 w-1/2 rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="flex min-h-[25vh] flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-[#090b12]/60 p-8 text-center">
            {!isSupabaseConfigured() ? (
              <div className="max-w-md space-y-3">
                <p className="text-base font-extrabold text-white">Platform Setup Required</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Connect your own Supabase and Firebase credentials in the Platform Setup wizard to start loading videos and user accounts.
                </p>
                <Link
                  to="/setup"
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2 text-xs font-bold text-white transition-colors"
                >
                  <span>Open Platform Setup</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <>
                <p className="text-sm font-bold text-gray-300">কোনো ভিডিও পাওয়া যায়নি।</p>
                {selectedCategory && (
                  <button 
                    onClick={() => setSelectedCategory(null)}
                    className="mt-3 px-3 py-1.5 rounded-xl bg-red-600 text-xs font-bold text-white"
                  >
                    ফিল্টার রিসেট করুন
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filteredVideos.map((video, idx) => (
              <React.Fragment key={video.id}>
                {idx === 4 && (
                  <div className="col-span-full my-2 sm:my-3">
                    <div className="hidden md:block">
                      <AdBanner placement="banner728x90" className="w-full min-h-[90px]" />
                    </div>
                    <div className="block md:hidden">
                      <AdBanner placement="banner300x250" className="w-full min-h-[250px]" />
                    </div>
                  </div>
                )}
                {idx === 8 && (
                  <div className="col-span-full my-2 sm:my-3">
                    <AdBanner placement="nativeBanner" className="w-full min-h-[280px]" />
                  </div>
                )}
                {idx === 14 && (
                  <div className="col-span-full my-2 sm:my-3">
                    <div className="hidden md:flex justify-center gap-4">
                      <AdBanner placement="banner468x60" className="min-h-[60px]" />
                      <AdBanner placement="banner160x300" className="min-h-[300px]" />
                    </div>
                    <div className="block md:hidden">
                      <AdBanner placement="banner300x250" className="w-full min-h-[250px]" />
                    </div>
                  </div>
                )}
                <VideoCard video={video} />
              </React.Fragment>
            ))}

            {/* Auto Smartlink Sponsored Video Card */}
            {smartlinkUrl && !isPrivilegedUser && (
              <a
                href={smartlinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  try { window.open(smartlinkUrl, '_blank'); } catch (err) {}
                }}
                className="group flex flex-col gap-2 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
              >
                <div className="relative aspect-video w-full overflow-hidden rounded-xl sm:rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-950/40 via-red-950/30 to-[#0c0d14] group-hover:border-amber-400 shadow-lg group-hover:shadow-[0_8px_30px_rgba(245,158,11,0.3)] transition-all duration-300 flex items-center justify-center">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent opacity-70 group-hover:opacity-100 transition-opacity" />
                  
                  {/* Glowing Play Icon */}
                  <div className="relative z-10 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-red-500 shadow-[0_0_25px_rgba(245,158,11,0.6)] group-hover:scale-110 transition-transform">
                    <Play className="h-6 w-6 text-white fill-current translate-x-0.5" />
                  </div>

                  {/* Badge */}
                  <div className="absolute top-2 left-2 z-20 flex items-center gap-1 rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-black tracking-wider text-black uppercase shadow">
                    <Flame className="w-3 h-3 fill-current" />
                    <span>স্পেশাল ভাইরাল</span>
                  </div>

                  <div className="absolute bottom-2 right-2 z-20 rounded-md bg-black/80 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-300 border border-amber-500/30">
                    HD FULL
                  </div>
                </div>

                <div className="flex flex-col gap-1 px-1">
                  <h3 className="line-clamp-2 text-xs sm:text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                    🔥 আজকের স্পেশাল ভাইরাল ভিডিও (HD Full Watch / Download)
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                    <span className="text-amber-400 font-semibold">125K+ views</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-bold">সরাসরি দেখুন</span>
                  </div>
                </div>
              </a>
            )}
          </div>
        )}

        {/* Load More Button */}
        {hasMore && !isLoading && !selectedCategory && videos.length > 0 && (
          <div className="mt-6 sm:mt-8 flex justify-center">
            <button
              onClick={loadMoreVideos}
              disabled={isLoadingMore}
              className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-[#11131c] hover:bg-[#1a1c2b] px-6 py-2.5 text-xs font-bold text-gray-200 transition-all shadow-md disabled:opacity-50 active:scale-95"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <span>Load More Videos</span>
                  <ChevronRight className="w-4 h-4 text-red-500" />
                </>
              )}
            </button>
          </div>
        )}
      </section>

    </div>
  );
}

