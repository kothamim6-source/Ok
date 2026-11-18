import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Video } from '../../types';
import { VideoCard } from '../../components/video/VideoCard';
import { AdBanner } from '../../components/ui/AdBanner';
import { Flame, Loader2 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export function TrendingPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {

    async function fetchTrendingVideos() {
      setIsLoading(true);
      try {
        // Fetch videos that are explicitly marked as trending, ordered by views descending
        const { data, error } = await supabase
          .from('videos')
          .select('*')
          .in('status', ['published', 'scheduled'])
          .order('views', { ascending: false, nullsFirst: false })
          .limit(100); // Limit to top 100 trending videos

        if (error) {
          throw error;
        }

        const now = Date.now();
        const parsedData = (data || [])
          .filter(v => v.status === 'published' || (v.status === 'scheduled' && v.created_at <= now))
          .map(v => {
          let parsedParts = v.parts;
          if (typeof v.parts === 'string') {
            try {
              parsedParts = JSON.parse(v.parts);
            } catch (e) {
              parsedParts = [];
            }
          }
          return {
            ...v,
            thumbnailUrl: v.thumbnail_url || v.thumbnailUrl,
            videoUrl: v.video_url || v.videoUrl,
            isPremium: v.is_premium !== undefined ? v.is_premium : v.isPremium,
            categoryId: v.category_id || v.categoryId || v.category,
            parts: parsedParts,
            createdAt: v.created_at || v.createdAt,
            updatedAt: v.updated_at || v.updatedAt || v.created_at || v.createdAt
          };
        });
        
        setVideos(parsedData as Video[]);
      } catch (error) {
        console.error('Error fetching trending videos:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchTrendingVideos();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 bg-gradient-to-r from-orange-500/10 to-red-500/5 border border-orange-500/20 p-4 rounded-2xl">
        <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg shadow-orange-500/20">
          <Flame className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {t('trending') || 'Trending Videos'}
          </h1>
          <p className="text-sm text-gray-400">Most popular and top-viewed videos</p>
        </div>
      </div>

      <div className="w-full flex justify-center mb-6">
        <div className="hidden md:block">
          <AdBanner placement="banner728x90" />
        </div>
        <div className="block md:hidden">
          <AdBanner placement="banner300x250" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        </div>
      ) : videos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
          {videos.map((video, idx) => (
            <React.Fragment key={video.id}>
              {idx === 6 && (
                <div className="col-span-full my-2">
                  <AdBanner placement="nativeBanner" className="w-full min-h-[280px]" />
                </div>
              )}
              <VideoCard video={video} />
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
          <Flame className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No trending videos</h2>
          <p className="text-gray-400">Trending videos will appear here soon.</p>
        </div>
      )}
    </div>
  );
}
