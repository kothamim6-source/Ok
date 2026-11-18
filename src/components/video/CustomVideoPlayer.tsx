import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, Forward, Rewind, PictureInPicture } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { getFullThumbnailUrl } from '../../lib/utils';

interface CustomVideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  onTimeUpdate?: (e: React.SyntheticEvent<HTMLVideoElement, Event>) => void;
  onLoadedMetadata?: (e: React.SyntheticEvent<HTMLVideoElement, Event>) => void;
  onEnded?: () => void;
  onPlayerReady?: (player: { play: () => void; pause: () => void; videoElement: HTMLVideoElement | null }) => void;
}

export function CustomVideoPlayer({ src, poster, autoPlay, onTimeUpdate, onLoadedMetadata, onEnded, onPlayerReady }: CustomVideoPlayerProps) {
  const { settings } = useSettingsStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [duration, setDuration] = useState('0:00');
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isEndedEarly, setIsEndedEarly] = useState(false);
  
  let hideControlsTimeout: NodeJS.Timeout;

  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(hideControlsTimeout);
    hideControlsTimeout = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      setProgress((current / total) * 100);
      setCurrentTime(formatTime(current));

      if (src && src.includes('freemasala.com') && total > 0 && current >= total - 6) {
        if (!isEndedEarly) {
          videoRef.current.pause();
          setIsPlaying(false);
          setIsEndedEarly(true);
          if (onEnded) onEnded();
        }
      }
    }
    if (onTimeUpdate) onTimeUpdate(e);
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    if (videoRef.current) {
      setDuration(formatTime(videoRef.current.duration));
    }
    if (onLoadedMetadata) onLoadedMetadata(e);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const time = (parseFloat(e.target.value) / 100) * videoRef.current.duration;
    videoRef.current.currentTime = time;
    setProgress(parseFloat(e.target.value));
    if (src && src.includes('freemasala.com') && time < videoRef.current.duration - 6) {
      setIsEndedEarly(false);
    }
  };

  const skip = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime += seconds;
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
    if (isMuted) videoRef.current.volume = volume;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const vol = parseFloat(e.target.value);
    videoRef.current.volume = vol;
    setVolume(vol);
    if (vol === 0) setIsMuted(true);
    else setIsMuted(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.error("Fullscreen error:", err?.message || String(err)));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await videoRef.current.requestPictureInPicture();
    }
  };

  const changeSpeed = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSettings(false);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (onPlayerReady) {
      onPlayerReady({
        play: () => {
          if (videoRef.current) {
            videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
          }
        },
        pause: () => {
          if (videoRef.current) {
            videoRef.current.pause();
            setIsPlaying(false);
          }
        },
        videoElement: videoRef.current
      });
    }
  }, [onPlayerReady]);

  useEffect(() => {
    if (autoPlay && videoRef.current) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [autoPlay, src]);

  return (
    <div 
      ref={containerRef}
      className="relative h-full w-full bg-black group flex flex-col justify-center overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        poster={getFullThumbnailUrl(poster)}
        className="w-full h-full object-contain"
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={onEnded}
        onError={() => {
           const error = videoRef.current?.error;
           setHasError(true);
        }}
      />
      
      {/* Watermark */}
      <div className="absolute top-4 right-4 pointer-events-none opacity-[0.4] z-10 flex items-center gap-2 select-none">
        {settings?.logoImageUrl ? (
          <img src={settings.logoImageUrl} alt="Watermark" className="h-6 w-6 sm:h-8 sm:w-8 object-contain drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]" />
        ) : (
          <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded bg-red-600/80 font-black text-white text-[10px] sm:text-xs shadow-[0_0_8px_rgba(0,0,0,0.8)]">
            {settings?.logo || 'SH'}
          </div>
        )}
        <span className="text-white font-bold text-xs sm:text-sm tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] hidden sm:block">
          {settings?.siteName || '19-20 Streaming'}
        </span>
      </div>

      {hasError && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white z-20">
            <div className="text-red-500 mb-2">
               <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            </div>
            <p className="text-lg font-semibold">Video unavailable</p>
            <p className="text-sm text-gray-400 mt-1">The element has no supported sources.</p>
         </div>
      )}

      {isEndedEarly && (
         <div className="absolute inset-0 bg-black z-20 pointer-events-none"></div>
      )}

      {/* Center Play Button Overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-red-600/80 rounded-full p-4 text-white">
            <Play className="h-10 w-10 ml-1" />
          </div>
        </div>
      )}

      {/* Controls */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Progress Bar */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-white text-xs font-mono">{currentTime}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={progress || 0}
            onChange={handleSeek}
            className="flex-1 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
          <span className="text-white text-xs font-mono">{duration}</span>
        </div>

        {/* Bottom Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="text-white hover:text-red-500">
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button onClick={() => skip(-10)} className="text-white hover:text-red-500" title="Rewind 10s">
              <Rewind className="h-5 w-5" />
            </button>
            <button onClick={() => skip(10)} className="text-white hover:text-red-500" title="Skip 10s">
              <Forward className="h-5 w-5" />
            </button>
            
            <div className="flex items-center gap-2 group/volume">
              <button onClick={toggleMute} className="text-white hover:text-red-500">
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 opacity-0 group-hover/volume:w-20 group-hover/volume:opacity-100 transition-all duration-300 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-red-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 relative">
            <button onClick={togglePiP} className="text-white hover:text-red-500" title="Picture in Picture">
              <PictureInPicture className="h-5 w-5" />
            </button>
            <div className="relative">
              <button onClick={() => setShowSettings(!showSettings)} className="text-white hover:text-red-500">
                <Settings className="h-5 w-5" />
              </button>
              
              {showSettings && (
                <div className="absolute bottom-full right-0 mb-2 w-48 bg-black/90 border border-white/10 rounded-lg py-2 z-50">
                  <div className="px-4 py-1 text-xs text-gray-400 font-bold uppercase">Playback Speed</div>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                    <button
                      key={speed}
                      onClick={() => changeSpeed(speed)}
                      className={`block w-full text-left px-4 py-1.5 text-sm hover:bg-white/10 ${playbackSpeed === speed ? 'text-red-500 font-bold' : 'text-white'}`}
                    >
                      {speed === 1 ? 'Normal' : `${speed}x`}
                    </button>
                  ))}
                  
                  <div className="px-4 py-1 mt-2 text-xs text-gray-400 font-bold uppercase border-t border-white/10 pt-2">Quality</div>
                  {['1080p', '720p', '480p'].map(q => (
                    <button
                      key={q}
                      onClick={() => setShowSettings(false)}
                      className={`block w-full text-left px-4 py-1.5 text-sm hover:bg-white/10 ${q === '1080p' ? 'text-red-500 font-bold' : 'text-white'}`}
                    >
                      {q} {q === '1080p' && '(HD)'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={toggleFullscreen} className="text-white hover:text-red-500">
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
