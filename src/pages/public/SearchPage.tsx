import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Video } from '../../types';
import { VideoCard } from '../../components/video/VideoCard';
import { AdBanner } from '../../components/ui/AdBanner';
import { Loader2, Search } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    async function fetchSearchResults() {
      if (!query.trim()) {
        setVideos([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { data: videosData, error } = await supabase
          .from('videos')
          .select('*')
          .in('status', ['published', 'scheduled'])
          .ilike('title', `%${query}%`)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const now = Date.now();
        if (videosData) {
          const fetchedVideos: Video[] = videosData
            .filter(doc => doc.status === 'published' || (doc.status === 'scheduled' && doc.created_at <= now))
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
            status: doc.status,
            visibility: doc.visibility,
            featured: doc.featured,
            createdAt: doc.created_at || doc.createdAt,
            updatedAt: doc.created_at,
            tags: []
          })) as Video[];
          setVideos(fetchedVideos);
        }
      } catch (error) {
        console.error('Error fetching search results:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSearchResults();
  }, [query]);

  return (
    <div className="mx-auto max-w-7xl px-1 sm:px-4 py-4 sm:py-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-white sm:text-3xl">
            <Search className="h-6 w-6 sm:h-8 sm:w-8 text-red-500" />
            Search Results
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {videos.length} {videos.length === 1 ? 'result' : 'results'} found for "{query}"
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-red-500" />
        </div>
      ) : videos.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      ) : (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#0a0a0a]/50 backdrop-blur-sm p-8 text-center shadow-[0_0_30px_rgba(220,38,38,0.05)] relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-red-600/10 rounded-full blur-[60px] pointer-events-none"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 shadow-[0_0_15px_rgba(220,38,38,0.1)]">
              <Search className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="mb-2 text-2xl font-black text-white">No videos found</h2>
            <p className="text-gray-400 max-w-md">Try adjusting your search keywords to find what you're looking for.</p>
          </div>
        </div>
      )}

      <div className="mt-8">
        <AdBanner placement="nativeBanner" className="w-full min-h-[280px]" />
      </div>
    </div>
  );
}
