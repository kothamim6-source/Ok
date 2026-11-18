import { Link } from 'react-router-dom';
import { Video } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect } from 'react';
import { getDisplayViews, getFullThumbnailUrl } from '../../lib/utils';
import { Eye, Crown, Play, Film } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';

interface VideoCardProps {
  video: Video;
}

export function VideoCard({ video }: VideoCardProps) {
  const { settings } = useSettingsStore();
  const rawImages = (video.thumbnailUrls && video.thumbnailUrls.length > 0) 
    ? video.thumbnailUrls 
    : [video.thumbnailUrl];
  const images = rawImages.map(img => getFullThumbnailUrl(img)).filter(Boolean);
    
  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (images.length > 1) {
      const interval = setInterval(() => {
        setCurrentImgIdx((prev) => (prev + 1) % images.length);
      }, 2800); // Change image every 2.8 seconds
      return () => clearInterval(interval);
    }
  }, [images.length]);

  const currentImage = getFullThumbnailUrl(images[currentImgIdx] || video.thumbnailUrl);

  const getTimeAgo = () => {
    try {
      if (!video.createdAt) return 'recently';
      const parsed = typeof video.createdAt === 'number' ? new Date(video.createdAt) : new Date(String(video.createdAt));
      if (isNaN(parsed.getTime())) return 'recently';
      return formatDistanceToNow(parsed, { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  return (
    <Link 
      to={`/video/${video.slug}`} 
      className="group flex flex-col gap-2 transition-all duration-300 hover:-translate-y-1"
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-xl sm:rounded-2xl border border-white/[0.08] bg-[#0c0d14] group-hover:border-red-500/60 shadow-md group-hover:shadow-[0_8px_30px_rgba(239,68,68,0.25)] transition-all duration-300">
        {/* Blurred background filling empty space */}
        {!hasError && currentImage ? (
          <>
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-30 blur-lg scale-110 transition-opacity duration-500 group-hover:opacity-55"
              style={{ backgroundImage: `url(${currentImage})`, transition: 'background-image 0.5s ease-in-out' }}
            />
            <img 
              src={currentImage} 
              alt={video.title} 
              loading="lazy"
              decoding="async"
              onError={() => setHasError(true)}
              className="relative z-10 h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-105"
            />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#131622] to-[#0a0b12] text-gray-500">
            <Film className="w-8 h-8 text-red-500/40 mb-1" />
            <span className="text-[10px] text-gray-400 font-medium">{settings?.siteName || '19-20 Streaming'}</span>
          </div>
        )}

        {/* Center Hover Play Button */}
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/25 backdrop-blur-[1px]">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-[0_0_25px_rgba(220,38,38,0.7)] transform scale-75 group-hover:scale-100 transition-transform duration-300">
            <Play className="w-5 h-5 fill-white ml-0.5" />
          </div>
        </div>
        
        {/* Duration badge */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 z-20 rounded-md bg-black/85 px-1.5 py-0.5 text-[10px] font-mono text-white font-medium backdrop-blur-md border border-white/10 shadow-sm">
            {video.duration}
          </div>
        )}

        {/* HD badge - Exact match to screenshot */}
        <div className="absolute bottom-2 left-2 z-20 rounded bg-black/90 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-500 border border-red-500/20 shadow-sm">
          HD
        </div>

        {/* VIP / Premium badge */}
        {video.isPremium && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-black shadow-[0_0_12px_rgba(251,191,36,0.7)] border border-amber-300">
            <Crown className="w-2.5 h-2.5 text-black fill-black" />
            VIP
          </div>
        )}
      </div>

      <div className="flex flex-col min-w-0 flex-1 px-0.5">
        <h3 className="line-clamp-1 text-xs sm:text-sm font-medium text-white group-hover:text-red-400 transition-colors leading-snug tracking-normal">
          {video.title}
        </h3>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-normal text-gray-400">
          <span className="flex items-center gap-1 text-gray-400">
            <Eye className="w-3 h-3 text-gray-400" />
            {getDisplayViews(video.views || 0, video.id).toLocaleString()}
          </span>
          <span className="text-gray-500">•</span>
          <span className="text-gray-400 truncate">{getTimeAgo()}</span>
        </div>
      </div>
    </Link>
  );
}

