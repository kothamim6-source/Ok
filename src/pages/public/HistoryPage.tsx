import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { History, X, Clock, PlayCircle, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getFullThumbnailUrl } from '../../lib/utils';

export function HistoryPage() {
  const { user } = useAuthStore();
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    async function fetchHistory() {
      if (!user) {
        setIsLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('watch_history')
          .select('id, watched_at, videos (id, title, slug, thumbnail_url)')
          .eq('user_id', user.id)
          .order('watched_at', { ascending: false })
          .limit(100);

        if (error) {
          if (error.code === 'PGRST200' || error.message.includes('watch_history')) {
            console.warn("watch_history table or relationship is missing. Please update database schema.");
            setHistory([]);
            return;
          }
          throw error;
        }
        
        if (data) {
          const mappedHistory = data.map((item: any) => ({
            id: item.id,
            videoId: item.videos?.id,
            videoTitle: item.videos?.title || 'Unknown Video',
            videoSlug: item.videos?.slug || item.videos?.id,
            videoThumbnail: item.videos?.thumbnail_url || '',
            viewedAt: item.watched_at
          }));
          setHistory(mappedHistory);
        }
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistory();
  }, [user]);

  const removeFromHistory = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    if (!user) return;
    try {
      await supabase.from('watch_history').delete().eq('id', id);
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error('Failed to remove from history', err);
    }
  };

  const clearAllHistory = async () => {
    if (!user) return;
    setIsClearing(true);
    try {
      await supabase.from('watch_history').delete().eq('user_id', user.id);
      setHistory([]);
    } catch (err) {
      console.error('Failed to clear history', err);
    } finally {
      setIsClearing(false);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center py-12">
        <div className="bg-white/5 p-8 rounded-full mb-6 border border-white/10">
          <History className="h-16 w-16 text-gray-500" />
        </div>
        <h2 className="text-2xl font-black text-white mb-3">Watch History</h2>
        <p className="text-gray-400 mb-8 max-w-sm text-center">Please log in to keep track of what you watch and easily find videos again.</p>
        <Link to="/login" className="rounded-full bg-red-600 px-8 py-3 font-bold text-white hover:bg-red-700 transition shadow-lg shadow-red-600/20">
          Log In to Continue
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <History className="h-7 w-7 text-white" />
          <h1 className="text-2xl sm:text-3xl font-black text-white">Watch History</h1>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearAllHistory}
            disabled={isClearing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-400 bg-white/5 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors border border-transparent hover:border-red-500/20 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {isClearing ? 'Clearing...' : 'Clear All'}
          </button>
        )}
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
        </div>
      ) : history.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#0a0a0a]/50 backdrop-blur-sm p-8 text-center shadow-[0_0_30px_rgba(220,38,38,0.05)] relative overflow-hidden mt-4">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-red-600/10 rounded-full blur-[60px] pointer-events-none"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 shadow-[0_0_15px_rgba(220,38,38,0.1)]">
              <History className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="mb-2 text-2xl font-black text-white">No watch history</h2>
            <p className="text-gray-400 max-w-md">You haven't watched any videos yet. When you watch videos while logged in, they will appear here.</p>
            <Link to="/" className="mt-8 rounded-full bg-gradient-to-r from-red-600 to-red-800 px-8 py-3 font-bold text-white shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:from-red-500 hover:to-red-700 transition-all">
              Explore Videos
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:gap-6 mt-4">
          {history.map((item) => (
            <Link key={item.id} to={`/video/${item.videoSlug}`} className="group flex flex-row gap-3 sm:gap-5 rounded-2xl border border-transparent p-2 sm:p-3 transition-all hover:bg-white/5">
              {/* Thumbnail */}
              <div className="relative aspect-video w-40 sm:w-56 md:w-64 shrink-0 overflow-hidden rounded-xl bg-black border border-white/5">
                {item.videoThumbnail ? (
                  <>
                    <div className="absolute inset-0 bg-cover bg-center opacity-30 blur-md scale-110" style={{ backgroundImage: `url(${getFullThumbnailUrl(item.videoThumbnail)})` }} />
                    <img src={getFullThumbnailUrl(item.videoThumbnail)} alt={item.videoTitle} className="relative z-10 h-full w-full object-contain transition-transform duration-300 group-hover:scale-105" />
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center bg-gray-900 text-gray-700">
                    <PlayCircle className="h-8 w-8" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors z-20" />
              </div>
              
              {/* Details */}
              <div className="flex flex-1 flex-col justify-start py-1 sm:py-2 min-w-0 pr-6 relative">
                <h3 className="text-sm sm:text-base md:text-lg font-bold text-white line-clamp-2 leading-snug group-hover:text-red-400 transition-colors">
                  {item.videoTitle}
                </h3>
                
                <div className="flex items-center gap-1.5 mt-2 sm:mt-3 text-xs sm:text-sm text-gray-400 font-medium">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{new Date(item.viewedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                
                {/* Remove button */}
                <button 
                  onClick={(e) => removeFromHistory(e, item.id)}
                  className="absolute right-0 top-1 sm:top-2 p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-full transition-colors opacity-0 group-hover:opacity-100 sm:opacity-100"
                  title="Remove from Watch history"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
