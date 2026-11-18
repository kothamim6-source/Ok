import React from 'react';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Video } from '../../types';
import { VideoCard } from '../../components/video/VideoCard';
import { AdBanner } from '../../components/ui/AdBanner';
import { SlidersHorizontal, FolderTree } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';

export function CategoryView() {
  const { settings } = useSettingsStore();
  const { categoryName } = useParams();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Initialize displayedCount from sessionStorage to preserve "Load More" state when going back
  const [displayedCount, setDisplayedCount] = useState(() => {
    const saved = sessionStorage.getItem(`category_count_${categoryName}`);
    return saved ? parseInt(saved, 10) : 20;
  });
  
  const [sortBy, setSortBy] = useState<'newest' | 'likes' | 'views'>('newest');

  useEffect(() => {
    sessionStorage.setItem(`category_count_${categoryName}`, displayedCount.toString());
  }, [displayedCount, categoryName]);

  useEffect(() => {
    // Only reset if we don't have a saved count for this category
    if (!sessionStorage.getItem(`category_count_${categoryName}`)) {
      setDisplayedCount(20);
    }
  }, [categoryName]);

  const [categoryMeta, setCategoryMeta] = useState<any>(null);

  useEffect(() => {
    async function fetchVideosByCategory() {
      if (!categoryName) return;
      setIsLoading(true);
      try {
        const decodedName = decodeURIComponent(categoryName);
        
        // Fetch Category Meta from Supabase
        const { data: catSnap } = await supabase.from('categories').select('*').eq('name', decodedName).limit(1);
        
        if (catSnap && catSnap.length > 0) {
          const catData = catSnap[0];
          setCategoryMeta(catData);
          document.title = `${catData.name} | ${settings?.siteName || '19-20 Streaming'}`;
        } else {
          document.title = `${decodedName} | ${settings?.siteName || '19-20 Streaming'}`;
        }

        // Admin saves category name into category_id column
        const searchCategory = decodedName;
        
        if (searchCategory) {
          const { data: snap } = await supabase
            .from('videos')
            .select('*')
            .ilike('category_id', `%${searchCategory}%`)
            .in('status', ['published', 'scheduled'])
            .eq('is_premium', false);
          
          const now = Date.now();
          const searchLower = searchCategory.trim().toLowerCase();
          const fetched: Video[] = (snap || [])
            .filter(doc => doc.status === 'published' || (doc.status === 'scheduled' && doc.created_at <= now))
            .filter(doc => {
              const rawCat = (doc.category_id || doc.categoryId || doc.category || '') as string;
              const tokens = rawCat.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
              return tokens.includes(searchLower);
            })
            .map(doc => ({
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
            status: doc.status as any,
            visibility: doc.visibility as any,
            featured: doc.featured,
            createdAt: doc.created_at,
            updatedAt: doc.created_at,
            tags: []
          }));
          
          fetched.sort((a, b) => {
            if (sortBy === 'likes') return (b.likes || 0) - (a.likes || 0);
            if (sortBy === 'views') return (b.views || 0) - (a.views || 0);
            return b.createdAt - a.createdAt;
          });
          
          setVideos(fetched);
        } else {
          setVideos([]);
        }
      } catch (error) {
        console.error("Error fetching category videos:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchVideosByCategory();
  }, [categoryName, sortBy]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white md:text-3xl capitalize">
            {decodeURIComponent(categoryName || 'Category')}
          </h1>
          <p className="text-gray-400 mt-2">Explore videos in this category.</p>
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-gray-400" />
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white/10 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:border-red-500"
          >
            <option value="newest" className="bg-black">Newest First</option>
            <option value="views" className="bg-black">Most Viewed</option>
            <option value="likes" className="bg-black">Most Liked</option>
          </select>
        </div>
      </div>

      <div className="w-full flex justify-center mb-4">
        <div className="hidden md:block">
          <AdBanner placement="banner728x90" />
        </div>
        <div className="block md:hidden">
          <AdBanner placement="banner300x250" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <span className="text-gray-400">Loading videos...</span>
        </div>
      ) : videos.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#0a0a0a]/50 backdrop-blur-sm p-8 text-center shadow-[0_0_30px_rgba(220,38,38,0.05)] relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-red-600/10 rounded-full blur-[60px] pointer-events-none"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 shadow-[0_0_15px_rgba(220,38,38,0.1)]">
              <FolderTree className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="mb-2 text-2xl font-black text-white">No videos found</h2>
            <p className="text-gray-400 max-w-md">There are currently no videos in this category. Check back later for new content.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {videos.slice(0, displayedCount).map((video, index) => (
            <React.Fragment key={video.id}>
              <VideoCard video={video} />
              {index > 0 && (index + 1) % 6 === 0 && (
                <div className="col-span-2 md:col-span-3 lg:col-span-4 my-2">
                  <AdBanner placement="nativeBanner" className="w-full min-h-[280px]" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
      
      {videos.length > displayedCount && (
        <div className="flex justify-center mt-8">
          <button
            onClick={() => setDisplayedCount(prev => prev + 20)}
            className="rounded-full border border-white/20 bg-white/5 px-8 py-3 text-sm font-bold text-white transition hover:bg-white/10"
          >
            Load More Videos
          </button>
        </div>
      )}
    </div>
  );
}
