import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { VideoCard } from '../../components/video/VideoCard';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

export function FavoritesPage() {
  const { user } = useAuthStore();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchFavorites() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('favorites')
          .eq('id', user.id)
          .single();

        if (!userError && userData) {
          const wl = userData.favorites || [];
          if (wl.length > 0) {
            const { data: videosData, error: videosError } = await supabase
              .from('videos')
              .select('*')
              .in('id', wl);
              
            if (!videosError && videosData) {
              const mappedVideos = videosData.map(doc => ({
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
                createdAt: doc.created_at,
                updatedAt: doc.created_at,
                tags: []
              }));
              setFavorites(mappedVideos);
            } else {
              setFavorites([]);
            }
          } else {
            setFavorites([]);
          }
        }
      } catch (error) {
        console.error("Error fetching favorites:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchFavorites();
  }, [user]);

  if (!user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center">
        <Heart className="mb-4 h-16 w-16 text-gray-600" />
        <h2 className="text-xl font-bold text-white mb-2">Favorites</h2>
        <p className="text-gray-400 mb-6">Please log in to view your favorites.</p>
        <Link to="/login" className="rounded-md bg-red-600 px-6 py-2 font-bold text-white hover:bg-red-700">
          Log In
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Heart className="h-8 w-8 text-red-500 fill-red-500" />
        <h1 className="text-3xl font-black text-white">Favorites</h1>
      </div>
      
      {isLoading ? (
        <div className="text-center py-20 text-gray-400">Loading favorites list...</div>
      ) : favorites.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#0a0a0a]/50 backdrop-blur-sm p-8 text-center shadow-[0_0_30px_rgba(220,38,38,0.05)] relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-red-600/10 rounded-full blur-[60px] pointer-events-none"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 shadow-[0_0_15px_rgba(220,38,38,0.1)]">
              <Heart className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="mb-2 text-2xl font-black text-white">No favorites yet</h2>
            <p className="text-gray-400 max-w-md">You haven't liked any videos yet. Click the heart icon on a video to save it here.</p>
            <Link to="/" className="mt-8 rounded-full bg-gradient-to-r from-red-600 to-red-800 px-8 py-3 font-bold text-white shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:from-red-500 hover:to-red-700 transition-all">
              Browse Videos
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {favorites.map((video) => (
            <VideoCard key={video.id} video={video as any} />
          ))}
        </div>
      )}
    </div>
  );
}