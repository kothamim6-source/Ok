import { getBDDateString, getDisplayViews, getFullThumbnailUrl } from '../../lib/utils';
import { executeTelegramJoin } from '../../lib/telegramUtils';
import { cleanAndDecodeBloggerText } from '../../lib/textUtils';
import { getSmartlinkUrl, extractAdUrl } from '../../lib/adUtils';
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { AdBanner } from '../../components/ui/AdBanner';
import { Share2, ThumbsUp, Download, MonitorPlay, Flag, Trash2, Crown, Heart, Clock, ExternalLink, Video as VideoIcon, Loader2, PlayCircle, Play, X, CheckCircle } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Video, Comment } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAdBlockDetector } from '../../hooks/useAdBlockDetector';
import { ShieldAlert } from 'lucide-react';
import { VideoCard } from '../../components/video/VideoCard';
import { CustomVideoPlayer } from '../../components/video/CustomVideoPlayer';
import { UserBadge } from '../../components/ui/UserBadge';
import { isPrivilegedUser as checkPrivilegedUser } from '../../lib/adminConfig';

export function VideoPage() {
  const { slug } = useParams();
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();
  const [video, setVideo] = useState<Video | null>(null);
  const [activePartIndex, setActivePartIndex] = useState(0);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
  const [hasAccess, setHasAccess] = useState(true);
  const [hasClickedPlayer, setHasClickedPlayer] = useState(false);
  const [showMobileBottomAd, setShowMobileBottomAd] = useState(true);
  const [hasWatchedEnough, setHasWatchedEnough] = useState(false);
  const [adsWatched, setAdsWatched] = useState<number>(0);
  const [comments, setComments] = useState<Comment[]>([]);
  
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [hasDisliked, setHasDisliked] = useState(false);
  const [isShareCopied, setIsShareCopied] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const [isPreviewEnded, setIsPreviewEnded] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isWatchLater, setIsWatchLater] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  const [adTimer, setAdTimer] = useState(25);
  const [isAdLoaded, setIsAdLoaded] = useState(false);
  
  const isAdblockDetected = useAdBlockDetector();
  const isPrivilegedUser = checkPrivilegedUser(user, settings);

  // We still want admins, moderators, and VIPs to be able to watch without disabling adblocker
  const finalAdblockDetected = isAdblockDetected && !isPrivilegedUser;

  const playerControlRef = useRef<{ play: () => void; pause: () => void; videoElement: HTMLVideoElement | null } | null>(null);

  const handleVideoClickSmartlink = () => {
    setHasClickedPlayer(true);

    if (showAds && smartlinkUrl) {
      try {
        const opened = window.open(smartlinkUrl, '_blank');
        if (!opened || opened.closed || typeof opened.closed === 'undefined') {
          const a = document.createElement('a');
          a.href = smartlinkUrl;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } catch (e) {
        const a = document.createElement('a');
        a.href = smartlinkUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }

    // Start video playback immediately so when user comes back, the video is playing/ready at exact time
    setTimeout(() => {
      try {
        playerControlRef.current?.play();
      } catch (e) {}
    }, 100);
  };

  const isPremiumBlocked = !hasAccess;

  const isIframeUrl = (url: string) => {
    return url.includes('blogger.com/video') || 
           url.includes('youtube.com/') || 
           url.includes('youtu.be/') || 
           url.includes('vimeo.com') ||
           url.includes('streamtape.com') ||
           url.includes('dood') ||
           url.includes('streamwish') ||
           url.includes('voe.sx') ||
           url.includes('vidara.to') ||
           url.includes('vk.com/video_ext.php') ||
           url.includes('ok.ru/videoembed') ||
           url.includes('mega.nz') ||
           url.includes('tinyurl.com') ||
           url.includes('dailymotion.com') ||
           url.includes('drive.google.com');
  };

  const isImageUrl = (url: string) => {
    const lower = url.toLowerCase();
    return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif') || lower.endsWith('.webp');
  };

  const isExternalLink = (url: string) => {
    return url.includes('terabox') ||
           url.includes('1024tera') ||
           url.includes('nephobox');
  };

  const getEmbedUrl = (url: string) => {
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = new URL(url).searchParams.get('v');
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1].split('?')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('vimeo.com/') && !url.includes('player.vimeo.com')) {
      const videoId = url.split('vimeo.com/')[1].split('/')[0];
      return `https://player.vimeo.com/video/${videoId}`;
    }
    if (url.includes('dailymotion.com/video/')) {
      const videoId = url.split('/video/')[1].split('?')[0];
      return `https://www.dailymotion.com/embed/video/${videoId}`;
    }
    if (url.includes('drive.google.com/file/d/')) {
      const match = url.match(/\/file\/d\/([^\/]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/file/d/${match[1]}/preview`;
      }
    }
    return url;
  };

  useEffect(() => {
    let isMounted = true;

    async function fetchVideoAndComments() {
      if (!slug) return;
      if (isMounted) setIsLoading(true);
      try {
        let { data: docSnap, error: docError } = await supabase
          .from('videos')
          .select('*')
          .eq('slug', slug)
          .single();
          
        if (!docSnap) {
           const { data: byIdSnap, error: byIdError } = await supabase
             .from('videos')
             .select('*')
             .eq('id', slug)
             .single();
           if (byIdSnap) {
             docSnap = byIdSnap;
             docError = byIdError;
           }
        }

        if (docSnap && !docError && isMounted) {
          const rawVideoUrl = docSnap.video_url || docSnap.videoUrl;
          let parsedParts;
          let finalVideoUrl = rawVideoUrl;
          if (rawVideoUrl && rawVideoUrl.startsWith('[') && rawVideoUrl.endsWith(']')) {
            try {
              parsedParts = JSON.parse(rawVideoUrl);
              if (parsedParts.length > 0) {
                finalVideoUrl = parsedParts[0].videoUrl;
              }
            } catch(e) {}
          }

          const videoData: Video = {
            id: docSnap.id,
            title: docSnap.title,
            slug: docSnap.slug,
            description: docSnap.description,
            thumbnailUrl: getFullThumbnailUrl(docSnap.thumbnail_url || docSnap.thumbnailUrl),
            videoUrl: finalVideoUrl,
            duration: docSnap.duration,
            parts: parsedParts,
            isPremium: docSnap.is_premium !== undefined ? docSnap.is_premium : docSnap.isPremium,
            categoryId: docSnap.category_id || docSnap.categoryId || docSnap.category,
            views: docSnap.views,
            likes: docSnap.likes,
            status: docSnap.status as any,
            visibility: docSnap.visibility as any,
            featured: docSnap.featured,
            createdAt: docSnap.created_at,
            updatedAt: docSnap.created_at,
            tags: [],
            category: docSnap.category_id, // we might need to join or fetch category name
          };
          if (isMounted) setVideo(videoData);

          // Update SEO Metadata
          document.title = videoData.metaTitle || `${videoData.title} | ${settings?.siteName || '19-20 Streaming'}`;
          
          let metaTag = document.querySelector('meta[name="description"]');
          if (!metaTag) {
            metaTag = document.createElement('meta');
            metaTag.setAttribute('name', 'description');
            document.head.appendChild(metaTag);
          }
          metaTag.setAttribute('content', videoData.metaDescription || videoData.description || '');

          // Check favorites and watch later
          if (user) {
            const { data: userSnap } = await supabase.from('users').select('*').eq('id', user.id).single();
            if (userSnap && isMounted) {
              const faves = userSnap.favorites || [];
              const wl = userSnap.watch_later || [];
              setIsFavorite(faves.includes(videoData.id));
              setIsWatchLater(wl.includes(videoData.id));
            }
          }

          // Access Check (Admins and Moderators have full access like VIPs)
          if (videoData.isPremium) {
            if (!user || (user.role !== 'admin' && user.role !== 'moderator' && !user.isVIP)) {
              let watched = parseInt(localStorage.getItem(`ads_watched_${videoData.id}`) || '0');
              const watchTime = parseInt(localStorage.getItem(`ads_watched_time_${videoData.id}`) || '0');
              const EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 hours
              
              if (watched >= 3 && watchTime && (Date.now() - watchTime > EXPIRATION_TIME)) {
                // Expired after 24 hours, need to watch ads again
                watched = 0;
                localStorage.removeItem(`ads_watched_${videoData.id}`);
                localStorage.removeItem(`ads_watched_time_${videoData.id}`);
              }

              if (isMounted) {
                setAdsWatched(watched);
                if (watched < 3) {
                  setHasAccess(false);
                } else {
                  setHasAccess(true);
                }
              }
            } else {
              if (isMounted) setHasAccess(true);
            }
          } else {
            if (isMounted) setHasAccess(true);
          }

          // Fetch Related Videos
          try {
            const primaryCat = (videoData.categoryId || videoData.category || '').split(',')[0].trim();
            const relQuery = supabase
              .from('videos')
              .select('*')
              .neq('id', videoData.id)
              .in('status', ['published', 'scheduled'])
              .limit(6);

            const { data: rSnap } = primaryCat
              ? await relQuery.ilike('category_id', `%${primaryCat}%`)
              : await relQuery;
              
            const now = Date.now();
            const related: Video[] = (rSnap || [])
              .filter((d: any) => d.status === 'published' || (d.status === 'scheduled' && d.created_at <= now))
              .map((d: any) => {
              const rawUrl = d.video_url || d.videoUrl;
              let parsedParts;
              let finalUrl = rawUrl;
              if (rawUrl && rawUrl.startsWith('[') && rawUrl.endsWith(']')) {
                try {
                  parsedParts = JSON.parse(rawUrl);
                  if (parsedParts.length > 0) finalUrl = parsedParts[0].videoUrl;
                } catch(e) {}
              }
              return {
                id: d.id,
                title: d.title,
                slug: d.slug,
                description: d.description,
                thumbnailUrl: getFullThumbnailUrl(d.thumbnail_url || d.thumbnailUrl),
                videoUrl: finalUrl,
                duration: d.duration,
                parts: parsedParts,
                isPremium: d.is_premium !== undefined ? docSnap.is_premium : docSnap.isPremium,
              categoryId: d.category_id || d.categoryId || d.category,
              views: d.views,
              likes: d.likes,
              status: d.status as any,
              visibility: d.visibility as any,
              featured: d.featured,
              createdAt: d.created_at,
              updatedAt: d.created_at,
              tags: []
            };
            });
            if (isMounted) setRelatedVideos(related);
          } catch(e) {}

// View count increment moved to 10-second watcher
        }
      } catch (error) {
        console.error("Error fetching video data:", error);
      }
      
      try {
        const { data: commentsSnap } = await supabase
          .from('comments')
          .select('*')
          .eq('video_id', slug);
          
        const fetchedComments: Comment[] = (commentsSnap || []).map(d => ({
          id: d.id,
          videoId: d.video_id,
          userId: d.user_id,
          userName: d.user_name,
          text: d.text,
          createdAt: d.created_at
        }));
        fetchedComments.sort((a, b) => b.createdAt - a.createdAt);
        if (isMounted) setComments(fetchedComments);
      } catch (error) {
        console.error("Error fetching comments data:", error);
      }
      
      if (isMounted) setIsLoading(false);
    }

    
    // Reset state when slug changes
    setHasLiked(false);
    setHasDisliked(false);
    setHasAccess(true);
    setIsPreviewEnded(false);
    fetchVideoAndComments();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!hasAccess && video && !isLoading) {
      timer = setTimeout(() => {
        setIsPreviewEnded(true);
      }, 5000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [hasAccess, video, isLoading]);


  // 10-second view & history watcher
  useEffect(() => {
    if (!hasWatchedEnough || !video) return;
    
    async function recordViewAndHistory() {
      const viewedKey = `viewed_${video.id}`;
      if (!sessionStorage.getItem(viewedKey)) {
        try {
          await supabase.from('videos').update({ views: (video.views || 0) + 1 }).eq('id', video.id);
          sessionStorage.setItem(viewedKey, 'true');
          setVideo(prev => prev ? { ...prev, views: (prev.views || 0) + 1 } : prev);
        } catch (e) {
          console.warn('Could not increment view count', e);
        }
      }

      if (!user) return;
      
      const historyKey = `history_saved_${video.id}`;
      if (!sessionStorage.getItem(historyKey)) {
        try {
          // Increment user's total videos_watched stat
          const { data: userStats } = await supabase.from('users').select('videos_watched').eq('id', user.id).single();
          await supabase.from('users').update({ videos_watched: (userStats?.videos_watched || 0) + 1 }).eq('id', user.id);

          await supabase.from('watch_history').upsert({
            user_id: user.id,
            video_id: video.id,
            watched_at: Date.now()
          }, { onConflict: 'user_id,video_id' });
          
          sessionStorage.setItem(historyKey, 'true');

          const today = getBDDateString();
          const leaderKey = `leaderboard_viewed_${video.id}_${today}`;
          
          if (!sessionStorage.getItem(leaderKey)) {
            const { data: currentL } = await supabase
              .from('daily_leaderboard')
              .select('views')
              .eq('user_id', user.id)
              .eq('date', today)
              .single();

            const newViews = (currentL?.views || 0) + 1;
            await supabase.from('daily_leaderboard').upsert({
              id: `${user.id}_${today}`,
              user_id: user.id,
              user_name: user.name,
              user_email: user.email,
              date: today,
              views: newViews,
              last_viewed_at: Date.now()
            }, { onConflict: 'id' });
            sessionStorage.setItem(leaderKey, 'true');
          }
        } catch (err) {
          console.warn("Failed to save history", err);
        }
      }
    }
    recordViewAndHistory();
  }, [hasWatchedEnough, video, user]);

  // Fallback 10-second timer for external iframes
  useEffect(() => {
    if (!video || hasWatchedEnough) return;
    let timer;
    const isIframe = video.parts ? 
      video.parts.some(p => isExternalLink((p.videoUrl || '').trim()) || isIframeUrl((p.videoUrl || '').trim())) : 
      (isExternalLink((video.videoUrl || '').trim()) || isIframeUrl((video.videoUrl || '').trim()));
      
    if (isIframe) {
      timer = setTimeout(() => {
        setHasWatchedEnough(true);
      }, 10000);
    }
    return () => clearTimeout(timer);
  }, [video, hasWatchedEnough]);
 // Only trigger when user ID or video ID changes

    const handleShareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank');
  };
  const handleShareTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(video?.title || '')}`, '_blank');
  };
  const handleShareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent((video?.title || '') + ' ' + window.location.href)}`, '_blank');
  };

  const handleShareTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(video?.title || '')}`, '_blank');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: video?.title,
          url: window.location.href,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert("Link copied to clipboard!");
      } catch (err) {
        alert("Cannot copy link automatically. Please copy the URL from your browser.");
      }
    }
  };

  const toggleFavorite = async () => {
    if (!user || !video) return;
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('favorites')
        .eq('id', user.id)
        .single();
      if (!userError && userData) {
        let faves = userData.favorites || [];
        if (faves.includes(video.id)) {
          faves = faves.filter((id: string) => id !== video.id);
          setIsFavorite(false);
        } else {
          faves.push(video.id);
          setIsFavorite(true);
        }
        await supabase.from('users').update({ favorites: faves }).eq('id', user.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleWatchLater = async () => {
    if (!user || !video) return;
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('watch_later')
        .eq('id', user.id)
        .single();
      if (!userError && userData) {
        let wl = userData.watch_later || [];
        if (wl.includes(video.id)) {
          wl = wl.filter((id: string) => id !== video.id);
          setIsWatchLater(false);
        } else {
          wl.push(video.id);
          setIsWatchLater(true);
        }
        await supabase.from('users').update({ watch_later: wl }).eq('id', user.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

    const handleDislike = async () => {
    if (!video) return;
    if (hasDisliked) return;
    
    try {
      const { data: vData } = await supabase.from('videos').select('dislikes, likes').eq('id', video.id).single();
      const currentDislikes = vData?.dislikes || 0;
      const currentLikes = vData?.likes || 0;
      
      let updateData: any = { dislikes: currentDislikes + 1 };
      
      setVideo({ ...video, dislikes: ((video as any).dislikes || 0) + 1 } as any);
      setHasDisliked(true);
      
      if (hasLiked) {
        updateData.likes = Math.max(0, currentLikes - 1);
        setVideo(prev => prev ? { ...prev, likes: Math.max(0, (prev.likes || 1) - 1) } : prev);
        setHasLiked(false);
      }
      
      await supabase.from('videos').update(updateData).eq('id', video.id);
    } catch (error) {
      console.error("Error disliking video:", error);
    }
  };

  const handleLike = async () => {
    if (!video) return;
    if (hasLiked) return; // Prevent multiple likes per session for now
    try {
      const { data: vData } = await supabase.from('videos').select('likes, dislikes').eq('id', video.id).single();
      const currentLikes = vData?.likes || 0;
      const currentDislikes = vData?.dislikes || 0;
      
      let updateData: any = { likes: currentLikes + 1 };

      setVideo({ ...video, likes: (video.likes || 0) + 1 });
      setHasLiked(true);
      
      if (hasDisliked) {
        updateData.dislikes = Math.max(0, currentDislikes - 1);
        setVideo(prev => prev ? { ...prev, dislikes: Math.max(0, ((prev as any).dislikes || 1) - 1) } as any : prev);
        setHasDisliked(false);
      }
      
      await supabase.from('videos').update(updateData).eq('id', video.id);
    } catch (error) {
      console.error("Error liking video:", error);
    }
  };


  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user || !video) return;
    
    if (user.isBannedFromComments) {
      alert("You are banned from commenting.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Automatic Comment Moderation (Bad Word Filter)
      const badWords = ['fuck', 'shit', 'bitch', 'scam', 'khisti', 'magi', 'bara', 'gali', 'bokachoda', 'halarpo'];
      const lowerText = newComment.toLowerCase();
      const containsBadWord = badWords.some(word => lowerText.includes(word));

      if (containsBadWord) {
        alert("আপনার কমেন্টে খারাপ বা অশালীন ভাষা পাওয়া গেছে। দয়া করে ভালো ভাষা ব্যবহার করুন!");
        setIsSubmitting(false);
        return;
      }

      const commentData = {
        video_id: video.id,
        user_id: user.id,
        user_name: user.name,
        text: newComment.trim(),
        created_at: Date.now()
      };

      
      const { data: newDoc, error } = await supabase.from('comments').insert([commentData]).select().single();
      if (error) throw error;
      
      if (newDoc) {
        setComments([{ 
          id: newDoc.id, 
          videoId: newDoc.video_id, 
          userId: newDoc.user_id, 
          userName: newDoc.user_name, 
          text: newDoc.text, 
          createdAt: newDoc.created_at,
          userRole: user.role,
          userIsVIP: user.isVIP
        } as Comment, ...comments]);
      }
      
      setNewComment('');
      

    } catch (error) {
      console.error("Error posting comment:", error);
      alert("Failed to post comment.");
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleLikeComment = async (commentId: string, currentLikes: number = 0, likedBy: string[] = []) => {
    // Left unimplemented in Supabase schema (no likes column in comments in schema provided). 
    // We will just alert for now or ignore.
    alert("Liking comments is not supported in the new database yet.");
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Delete your comment?")) return;
    try {
      await supabase.from('comments').delete().eq('id', commentId);
      setComments(comments.filter(c => c.id !== commentId));
    } catch (error) {
      console.error("Error deleting comment:", error);
      alert("Failed to delete comment. Please check your internet or permissions.");
    }
  };


  

  const openReportModal = () => {
    if (!user) {
      setReportMessage("Please log in to report a video.");
      setTimeout(() => setReportMessage(''), 3000);
      return;
    }
    setIsReportModalOpen(true);
  };

  const submitReport = async () => {
    if (!reportReason.trim() || !video || !user) return;
    
    try {
      await supabase.from('reports').insert([{
        type: 'video',
        target_id: video.id,
        reason: reportReason.trim(),
        reported_by: user.email || user.id,
        status: 'pending',
        created_at: Date.now()
      }]);
      setIsReportModalOpen(false);
      setReportReason('');
      setReportMessage("Report submitted successfully.");
      setTimeout(() => setReportMessage(''), 3000);
    } catch (error) {
      console.error("Error reporting video:", error);
      setReportMessage("Error submitting report.");
      setTimeout(() => setReportMessage(''), 3000);
    }
  };

  // Check settings requirement
  const requireLogin = settings?.requireLoginToWatch || false;
  const isAuthLoading = useAuthStore(state => state.isLoading);
  const smartlinkUrl = getSmartlinkUrl(settings);
  const premiumUnlockLinkUrl = extractAdUrl(settings?.customAds?.premiumUnlockLink) || smartlinkUrl;
  const showAds = !isPrivilegedUser && (settings?.adsEnabled !== false);

  // Mid-video automatic redirect (triggers once in the middle of each video)
  const hasTriggeredMidVideoAdRef = useRef(false);
  const [showMidVideoNotice, setShowMidVideoNotice] = useState(false);

  const triggerMidVideoSmartlink = () => {
    if (hasTriggeredMidVideoAdRef.current || !showAds || !smartlinkUrl) return;

    // Session tracking so this specific video only triggers redirect ONCE
    const sessionKey = `mid_smartlink_${video?.id || slug}`;
    if (sessionStorage.getItem(sessionKey)) {
      hasTriggeredMidVideoAdRef.current = true;
      return;
    }
    hasTriggeredMidVideoAdRef.current = true;
    sessionStorage.setItem(sessionKey, 'true');

    setShowMidVideoNotice(true);
    setTimeout(() => setShowMidVideoNotice(false), 3500);

    try {
      const opened = window.open(smartlinkUrl, '_blank');
      if (!opened || opened.closed || typeof opened.closed === 'undefined') {
        window.location.href = smartlinkUrl;
      }
    } catch (e) {
      window.location.href = smartlinkUrl;
    }
  };

  // For iframe / external players: automatically trigger mid-video redirect ~20 seconds into viewing
  useEffect(() => {
    if (!showAds || !smartlinkUrl || !video) return;

    const sessionKey = `mid_smartlink_${video.id || slug}`;
    if (sessionStorage.getItem(sessionKey)) {
      hasTriggeredMidVideoAdRef.current = true;
      return;
    }

    const midTimer = setTimeout(() => {
      if (!hasTriggeredMidVideoAdRef.current) {
        triggerMidVideoSmartlink();
      }
    }, 20000);

    return () => clearTimeout(midTimer);
  }, [video?.id, slug, showAds, smartlinkUrl]);

  const [adStep, setAdStep] = useState(1);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && adTimer > 0) {
      interval = setInterval(() => {
        // Only decrement if the tab is visible to prevent waiting out the timer in background
        if (!document.hidden) {
          setAdTimer(prev => prev - 1);
        }
      }, 1000);
    } else if (isTimerRunning && adTimer === 0) {
      setIsTimerRunning(false);
      if (adStep < 3) {
        setAdStep(prev => prev + 1);
      } else {
        // Finished all 3
        if (video) {
          localStorage.setItem(`ads_watched_${video.id}`, '3');
          localStorage.setItem(`ads_watched_time_${video.id}`, Date.now().toString());
          setAdsWatched(3);
          setHasAccess(true);
        }
        setShowAdModal(false);
      }
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, adTimer, adStep, video]);

  const handleWatchAd = () => {
    if (!video) return;
    
    if (window.Android && typeof window.Android.showRewardedVideo === 'function') {
      window.Android.showRewardedVideo();
      const newCount = adsWatched + 1;
      setAdsWatched(newCount);
      localStorage.setItem(`ads_watched_${video.id}`, newCount.toString());
      if (newCount >= 3) {
        localStorage.setItem(`ads_watched_time_${video.id}`, Date.now().toString());
        setHasAccess(true);
      }
    } else {
      // For browser users, show multi-step modal
      setAdStep(1);
      setAdTimer(0);
      setIsTimerRunning(false);
      setShowAdModal(true);
    }
  };

  const handleStartStep = () => {
    // Show ad inside modal instead of opening in a new tab/popup
    setAdTimer(25);
    setIsTimerRunning(true);
  };

  const handleCloseAdModal = () => {
    // If they close before finishing all 3, they don't get the unlock.
    setShowAdModal(false);
  };
  
  if (isAuthLoading || !settings) {
    return <div className="text-white p-8">Loading...</div>;
  }

  if (requireLogin && !user) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">লগইন প্রয়োজন</h2>
        <p className="text-gray-400 max-w-md mb-8">
          এই ভিডিওটি দেখার জন্য আপনাকে লগইন করতে হবে। দয়া করে একটি ফ্রি অ্যাকাউন্ট তৈরি করুন অথবা আপনার অ্যাকাউন্টে লগইন করুন।
        </p>
        <div className="flex gap-4">
          <Link to="/login" className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all">
            লগইন করুন
          </Link>
          <Link to="/register" className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-600/20">
            অ্যাকাউন্ট খুলুন
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-white p-8">Loading video...</div>;
  }

  if (!video) {
    return <div className="text-white p-8">Video not found.</div>;
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="flex-1 lg:max-w-[70%] xl:max-w-[75%]">
        {/* Videos Container */}
        <div className="flex flex-col gap-8">
          <div className="w-full mb-3">
            <div className="hidden md:block">
              <AdBanner placement="banner728x90" className="w-full min-h-[90px]" />
            </div>
            <div className="block md:hidden">
              <AdBanner placement="banner320x50" className="w-full min-h-[50px]" />
            </div>
          </div>
          
          {isPremiumBlocked ? (
            <div className="min-h-[350px] md:aspect-video w-full overflow-hidden rounded-xl bg-black border border-white/10 shadow-lg relative flex items-center justify-center group">
              {/* Background Thumbnail with Blur */}
              <div 
                className="absolute inset-0 bg-cover bg-center blur-xl opacity-50 scale-110 transition-all duration-700 group-hover:scale-125 group-hover:blur-2xl" 
                style={{ backgroundImage: `url(${getFullThumbnailUrl(video.thumbnailUrl)})` }} 
              />
              
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-black/90 via-black/70 to-black/90 p-4 md:p-6 text-center z-50 overflow-y-auto">
                <div className="mb-4 rounded-full bg-gradient-to-b from-yellow-400 to-yellow-600 p-4 text-black shrink-0 shadow-lg shadow-yellow-500/30">
                  <Crown className="h-8 w-8 md:h-10 md:w-10" />
                </div>
                    <h2 className="mb-3 text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 shrink-0 tracking-tight">
                      প্রিমিয়াম ভিডিও আনলক করুন
                    </h2>
                    <p className="mb-6 max-w-md text-sm md:text-base text-gray-300 font-medium leading-relaxed">
                      এই ভিডিওটি ভিআইপি মেম্বারদের জন্য। তবে আপনি ৩টি বিজ্ঞাপন (Ads) দেখার পর ভিডিওটি ফ্রিতে দেখতে পারবেন।
                    </p>
                    
                    <div className="flex flex-col items-center gap-4 w-full">
                      <div className="flex gap-2">
                        {[1, 2, 3].map(step => (
                          <div key={step} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${adsWatched >= step ? 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)] scale-110' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}>
                             {adsWatched >= step ? '✓' : step}
                          </div>
                        ))}
                      </div>
                      
                      <button 
                        onClick={handleWatchAd}
                        className="rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-8 py-3 text-sm md:text-base font-bold text-white hover:from-blue-400 hover:to-blue-500 transition-all shrink-0 shadow-lg shadow-blue-500/25 flex items-center gap-2 mt-2"
                      >
                        <PlayCircle className="w-5 h-5" /> 
                        {adsWatched < 3 ? `অ্যাড দেখুন (${adsWatched}/3)` : 'ভিডিও আনলক হচ্ছে...'}
                      </button>

                      {!user ? (
                        <Link to="/login" className="text-gray-400 hover:text-white text-sm mt-4 underline decoration-gray-600 underline-offset-4 transition-colors">
                          অথবা লগইন করে প্রিমিয়াম কিনুন
                        </Link>
                      ) : (
                        <Link to="/premium" className="text-gray-400 hover:text-white text-sm mt-4 underline decoration-gray-600 underline-offset-4 transition-colors">
                          সরাসরি প্রিমিয়াম মেম্বারশিপ কিনুন
                        </Link>
                      )}
                    </div>
                  </div>
            </div>
          ) : finalAdblockDetected ? (
            <div className="min-h-[400px] md:aspect-video w-full overflow-hidden rounded-xl bg-black border border-white/10 shadow-lg relative flex items-center justify-center">
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-4 md:p-6 text-center z-50 overflow-y-auto">
                <div className="mb-2 md:mb-4 rounded-full bg-red-500/20 p-3 md:p-4 text-red-500 shrink-0">
                  <ShieldAlert className="h-8 w-8 md:h-12 md:w-12" />
                </div>
                <h2 className="mb-2 text-xl md:text-2xl font-bold text-white shrink-0">দয়া করে অ্যাড ব্লকার বন্ধ করুন!</h2>
                <p className="mb-4 md:mb-6 max-w-md text-sm md:text-base text-gray-400">
                  আপনার ব্রাউজারে বা ফোনে <strong>অ্যাড-ব্লকার (Adblocker)</strong> অথবা <strong>প্রাইভেট ডিএনএস (যেমন- AdGuard)</strong> চালু করা আছে। আমাদের ওয়েবসাইটটি আপনাদের জন্য সম্পূর্ণ ফ্রিতে চালানোর জন্য অ্যাডের উপর নির্ভর করতে হয়। তাই ভিডিওটি দেখতে চাইলে দয়া করে আপনার অ্যাড-ব্লকার বা প্রাইভেট ডিএনএস বন্ধ করুন।
                </p>
                <button 
                  onClick={() => window.location.reload()}
                  className="rounded-full bg-red-600 px-6 py-2 md:px-8 md:py-3 text-sm md:text-base font-bold text-white hover:bg-red-700 transition-colors shrink-0"
                >
                  আমি বন্ধ করেছি, রিফ্রেশ করুন
                </button>
              </div>
            </div>
          ) : (
            video.parts && video.parts.length > 0 ? (
              video.parts.map((part, index) => (
                <div key={part.id || index} className="flex flex-col gap-3">
                  {video.parts!.length > 1 && (
                    <h3 className="text-xl font-bold text-white px-1">
                      {part.title || `Part ${index + 1}`}
                      {part.duration && <span className="ml-3 text-sm font-normal text-gray-400">{part.duration}</span>}
                    </h3>
                  )}
                                    <div className="aspect-video w-full overflow-hidden rounded-xl bg-black border border-white/10 shadow-lg relative">
                    {showAds && smartlinkUrl && !hasClickedPlayer && (
                      <div 
                        className="absolute inset-0 z-[100] cursor-pointer flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all hover:bg-black/20"
                        title="Click to Play"
                        onClick={handleVideoClickSmartlink}
                      >
                        <div className="flex flex-col items-center gap-2 bg-black/80 border border-white/20 px-6 py-4 rounded-2xl shadow-2xl animate-pulse">
                          <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(239,68,68,0.7)]">
                            <PlayCircle className="w-9 h-9" />
                          </div>
                          <span className="text-white font-black text-sm uppercase tracking-wider">
                            Click to Play Full HD
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="w-full h-full">
                          {isImageUrl((part.videoUrl || '').trim()) ? (
                            <div className="absolute top-0 left-0 w-full h-full bg-black flex items-center justify-center">
                              <img src={(part.videoUrl || '').trim()} alt={`Part ${index + 1}`} className="w-full h-full object-contain" />
                            </div>
                          ) : isExternalLink((part.videoUrl || '').trim()) ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white z-20">
                              <ExternalLink className="w-12 h-12 mb-4 text-blue-500" />
                              <h3 className="text-xl font-bold mb-2">External Video Link</h3>
                              <p className="text-gray-400 mb-6 text-center max-w-sm px-4">This video is hosted externally and cannot be played directly inside the website.</p>
                              <a href={(part.videoUrl || '').trim()} target="_blank" rel="noopener noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors">
                                Watch Video <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          ) : isIframeUrl((part.videoUrl || '').trim()) ? (
                            <div className="absolute top-0 left-0 w-full h-full bg-black flex items-center justify-center">
                              <div className="absolute flex flex-col items-center justify-center text-gray-500 z-0">
                                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                <span className="text-sm">Loading external player...</span>
                              </div>
                              <iframe
                                src={getEmbedUrl((part.videoUrl || '').trim())}
                                className="absolute top-0 left-0 w-full h-full border-0 z-10"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          ) : (
                            <CustomVideoPlayer 
                              poster={getFullThumbnailUrl(video.thumbnailUrl)}
                              src={(part.videoUrl || '').trim()}
                              onPlayerReady={(p) => { playerControlRef.current = p; }}
                              onTimeUpdate={(e) => {
                                const cTime = e.currentTarget.currentTime;
                                const dur = e.currentTarget.duration;
                                if (cTime > 0) {
                                  localStorage.setItem(`vid_resume_${video.id}_${index}`, cTime.toString());
                                  sessionStorage.setItem(`vid_resume_${video.id}_${index}`, cTime.toString());
                                }
                                if (cTime >= 10 && !hasWatchedEnough) setHasWatchedEnough(true);
                                if (dur > 0 && cTime >= dur * 0.45 && !hasTriggeredMidVideoAdRef.current) {
                                  triggerMidVideoSmartlink();
                                }
                              }}
                              onLoadedMetadata={(e) => {
                                const saved = localStorage.getItem(`vid_resume_${video.id}_${index}`) || sessionStorage.getItem(`vid_resume_${video.id}_${index}`);
                                if (saved) {
                                  const time = parseFloat(saved);
                                  if (!isNaN(time) && time > 0) {
                                    e.currentTarget.currentTime = time;
                                  }
                                }
                              }}
                              onEnded={() => {
                                if (video.parts && index < video.parts.length - 1) {
                                  setActivePartIndex(index + 1);
                                }
                              }}
                            />
                          )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
                <div className="aspect-video w-full overflow-hidden rounded-xl bg-black border border-white/10 shadow-lg relative">
                    {showAds && smartlinkUrl && !hasClickedPlayer && (
                      <div 
                        className="absolute inset-0 z-[100] cursor-pointer flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all hover:bg-black/20"
                        title="Click to Play"
                        onClick={handleVideoClickSmartlink}
                      >
                        <div className="flex flex-col items-center gap-2 bg-black/80 border border-white/20 px-6 py-4 rounded-2xl shadow-2xl animate-pulse">
                          <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(239,68,68,0.7)]">
                            <PlayCircle className="w-9 h-9" />
                          </div>
                          <span className="text-white font-black text-sm uppercase tracking-wider">
                            Click to Play Full HD
                          </span>
                        </div>
                      </div>
                    )}
                    
                <div className="w-full h-full">
                    <>
                      {isImageUrl((video.videoUrl || '').trim()) ? (
                        <div className="absolute top-0 left-0 w-full h-full bg-black flex items-center justify-center">
                          <img src={(video.videoUrl || '').trim()} alt={video.title} className="w-full h-full object-contain" />
                        </div>
                      ) : isExternalLink((video.videoUrl || '').trim()) ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white z-20">
                          <ExternalLink className="w-12 h-12 mb-4 text-blue-500" />
                          <h3 className="text-xl font-bold mb-2">External Video Link</h3>
                          <p className="text-gray-400 mb-6 text-center max-w-sm px-4">This video is hosted externally and cannot be played directly inside the website.</p>
                          <a href={(video.videoUrl || '').trim()} target="_blank" rel="noopener noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors">
                            Watch Video <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      ) : isIframeUrl((video.videoUrl || '').trim()) ? (
                        <div className="absolute top-0 left-0 w-full h-full bg-black flex items-center justify-center">
                          <div className="absolute flex flex-col items-center justify-center text-gray-500 z-0">
                            <Loader2 className="w-8 h-8 animate-spin mb-2" />
                            <span className="text-sm">Loading external player...</span>
                          </div>
                          <iframe
                            src={getEmbedUrl((video.videoUrl || '').trim())}
                            className="absolute top-0 left-0 w-full h-full border-0 z-10"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <CustomVideoPlayer 
                          poster={getFullThumbnailUrl(video.thumbnailUrl)}
                          src={(video.videoUrl || '').trim()} 
                          onPlayerReady={(p) => { playerControlRef.current = p; }}
                          onTimeUpdate={(e) => {
                            const cTime = e.currentTarget.currentTime;
                            const dur = e.currentTarget.duration;
                            if (video?.id && cTime > 0) {
                              localStorage.setItem(`vid_resume_${video.id}`, cTime.toString());
                              sessionStorage.setItem(`vid_resume_${video.id}`, cTime.toString());
                            }
                            if (cTime >= 10 && !hasWatchedEnough) setHasWatchedEnough(true);
                            if (dur > 0 && cTime >= dur * 0.45 && !hasTriggeredMidVideoAdRef.current) {
                              triggerMidVideoSmartlink();
                            }
                          }}
                          onLoadedMetadata={(e) => {
                            const saved = localStorage.getItem(`vid_resume_${video.id}`) || sessionStorage.getItem(`vid_resume_${video.id}`);
                            if (saved) {
                              const time = parseFloat(saved);
                              if (!isNaN(time) && time > 0) {
                                e.currentTarget.currentTime = time;
                              }
                            }
                          }}
                        />
                      )}
                    </>
                </div>
              </div>
            )
          )}

          {/* Automatic Mid-Video Notification Banner */}
          {showMidVideoNotice && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[999] bg-black/95 border-2 border-amber-500/80 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce backdrop-blur-xl">
              <div className="w-3 h-3 rounded-full bg-amber-400 animate-ping shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-black text-amber-300">
                  ⚡ বিজ্ঞাপন শেষে ভিডিও চলমান রয়েছে...
                </span>
                <span className="text-[10px] text-gray-300">
                  ভিডিও দেখতে থাকুন (অটোমেটিক চালু থাকবে)
                </span>
              </div>
            </div>
          )}

          {/* Automatic Smartlink Next Part / Bonus Video Card (Auto-generated after all uploaded video parts) */}
          {showAds && smartlinkUrl && (
            <div className="flex flex-col gap-2.5 mt-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
                  <span>
                    {video.parts && video.parts.length > 1 
                      ? `Part ${video.parts.length + 1}: সম্পূর্ণ আনকাট ফুল ভিডিও (Full HD 1080p)` 
                      : 'পরবর্তী পার্ট: সম্পূর্ণ আনকাট ফুল ভিডিও (Full HD 1080p)'}
                  </span>
                </h3>
                <span className="text-[11px] bg-red-600/30 text-red-400 border border-red-500/40 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Next Part
                </span>
              </div>

              <a 
                href={smartlinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  try { 
                    const opened = window.open(smartlinkUrl, '_blank'); 
                    if (opened) e.preventDefault();
                  } catch (e) { 
                    // Let default anchor navigation proceed
                  }
                }}
                className="group/smartvid block aspect-video w-full overflow-hidden rounded-xl bg-gradient-to-br from-neutral-900 via-black to-neutral-950 border-2 border-red-500/40 hover:border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.25)] relative cursor-pointer transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
              >
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-40 blur-xs scale-105 group-hover/smartvid:scale-110 transition-transform duration-700"
                  style={{ backgroundImage: `url(${getFullThumbnailUrl(video.thumbnailUrl)})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30 z-10" />

                <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-white/20 text-white text-[11px] font-black uppercase tracking-wider shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    Full Uncut (1080p)
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-red-600 text-white text-[11px] font-black uppercase tracking-wider shadow-md">
                    HD Player
                  </span>
                </div>

                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 z-20 text-center px-4">
                  <div className="relative flex items-center justify-center">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white shadow-[0_0_25px_rgba(239,68,68,0.8)] group-hover/smartvid:scale-110 transition-transform duration-300">
                      <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current translate-x-0.5" />
                    </div>
                    <div className="absolute -inset-2 rounded-full border-2 border-red-400/50 animate-ping pointer-events-none" />
                  </div>

                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-white text-sm sm:text-base font-black tracking-wide drop-shadow-lg group-hover/smartvid:text-red-300 transition-colors">
                      পরবর্তী পার্ট / ফুল ভিডিও দেখতে এখানে চাপ দিন
                    </span>
                    <span className="text-[11px] sm:text-xs font-semibold text-gray-300 drop-shadow">
                      Tap Here to Play Next Part • High Speed 1080p Stream
                    </span>
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 h-9 bg-gradient-to-t from-black to-transparent z-20 flex items-center justify-between px-4">
                  <div className="flex items-center gap-2">
                    <Play className="w-3.5 h-3.5 text-white fill-current" />
                    <div className="w-24 sm:w-40 h-1 bg-white/20 rounded-full overflow-hidden">
                      <div className="w-1/3 h-full bg-red-500 animate-pulse" />
                    </div>
                    <span className="text-[10px] text-gray-300 font-mono">18:45 / 24:30</span>
                  </div>
                  <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider">
                    ⚡ Ultra HD
                  </span>
                </div>
              </a>
            </div>
          )}
        </div>

        {/* Adsterra High-Converting CTA (Direct Link) */}
        {showAds && smartlinkUrl && (
          <div className="mt-4 flex flex-col gap-3 px-2 sm:px-0">
            <a 
              href={smartlinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-green-600 via-emerald-500 to-teal-500 p-4 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-[1.02] active:scale-95 transition-all duration-300 animate-pulse cursor-pointer"
            >
              <div className="flex flex-col items-start text-left">
                <span className="text-lg sm:text-xl font-black text-white uppercase tracking-wider drop-shadow-md">
                  🚀 Download Full HD (1080p)
                </span>
                <span className="text-xs sm:text-sm font-bold text-green-100 drop-shadow-sm mt-0.5">
                  Direct Download • Super Fast • High Speed
                </span>
              </div>
              <div className="flex shrink-0 items-center justify-center rounded-full bg-white p-3 text-green-600 shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                <Download className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
            </a>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a 
                href={smartlinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 p-3 shadow-md hover:scale-[1.01] active:scale-95 transition-all cursor-pointer font-bold text-white text-sm"
              >
                <PlayCircle className="h-5 w-5 text-amber-200" />
                <span>⚡ Server 2 (High Speed HD)</span>
              </a>

              {settings?.telegramUrl && (
                <button 
                  onClick={() => {
                     if (showAds && smartlinkUrl) {
                       try { window.open(smartlinkUrl, '_blank'); } catch (e) {}
                     }
                     executeTelegramJoin(settings?.telegramUrl || '');
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 p-3 shadow-md hover:scale-[1.01] active:scale-95 transition-all cursor-pointer font-bold text-white text-sm"
                >
                  <span>📱 Join VIP Telegram (18+)</span>
                  <ExternalLink className="h-4 w-4 text-blue-200" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Video Info */}
        <div className="mt-6 flex flex-col gap-4">
          <h1 className="text-2xl font-black text-white md:text-3xl">
            {cleanAndDecodeBloggerText(video.title)}
          </h1>
          
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>{getDisplayViews(video.views || 0, video.id).toLocaleString()} views</span>
              <span>•</span>
              <span>Published {new Date(video.createdAt).toLocaleDateString()}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-white">
                            {showAds && smartlinkUrl && (
                <a 
                  href={smartlinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-blue-500/25 animate-pulse-slow"
                >
                  <Download className="h-4 w-4" />
                  Watch in HD / Download
                </a>
              )}
              {showAds && (
                <Link 
                  to="/premium"
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg hover:shadow-orange-500/25"
                >
                  <Crown className="h-4 w-4" />
                  বিরক্তিকর অ্যাড ছাড়া দেখুন
                </Link>
              )}
              <button 
                onClick={handleLike}
                disabled={hasLiked}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${hasLiked ? 'bg-red-600 text-white' : 'bg-white/10 hover:bg-white/20'}`}
              >
                <ThumbsUp className="h-4 w-4" />
                {video.likes || 0}
              </button>

              <button 
                onClick={toggleFavorite}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${isFavorite ? 'bg-red-600 text-white' : 'bg-white/10 hover:bg-white/20'}`}
              >
                <Heart className="h-4 w-4" />
                {isFavorite ? 'Saved' : 'Save'}
              </button>

              <button 
                onClick={toggleWatchLater}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${isWatchLater ? 'bg-blue-600 text-white' : 'bg-white/10 hover:bg-white/20'}`}
              >
                <Clock className="h-4 w-4" />
                {isWatchLater ? 'Added' : 'Watch Later'}
              </button>

              <div className="flex gap-2">
                <button 
                  onClick={handleShareWhatsApp}
                  className="flex items-center gap-2 rounded-full bg-green-500/20 text-green-500 px-4 py-2 text-sm font-bold hover:bg-green-500/30 transition-colors"
                >
                  WhatsApp
                </button>
                <button 
                  onClick={handleShareTelegram}
                  className="flex items-center gap-2 rounded-full bg-blue-500/20 text-blue-400 px-4 py-2 text-sm font-bold hover:bg-blue-500/30 transition-colors"
                >
                  Telegram
                </button>
                <button 
                  onClick={handleShare}
                  className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 transition-colors"
                >
                  <Share2 className="h-4 w-4" />
                  {isShareCopied ? "Copied!" : "Share"}
                </button>
              </div>
              <button onClick={openReportModal} className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 hover:text-red-400">
                <Flag className="h-4 w-4" />
                Report
              </button>
            </div>
          </div>

          {reportMessage && (
            <div className="rounded-md bg-white/10 p-3 text-sm text-white">
              {reportMessage}
            </div>
          )}

          {isReportModalOpen && (
            <div className="rounded-xl border border-white/20 bg-white/5 p-4">
              <h4 className="text-sm font-bold text-white mb-2">Report Video</h4>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Why are you reporting this video?"
                className="w-full resize-none rounded-md border border-white/20 bg-black p-3 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:outline-none"
                rows={3}
              />
              <div className="mt-3 flex justify-end gap-3">
                <button
                  onClick={() => setIsReportModalOpen(false)}
                  className="rounded px-4 py-2 text-sm font-medium text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={submitReport}
                  disabled={!reportReason.trim()}
                  className="rounded bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Submit Report
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl bg-white/5 p-4 border border-white/10">
            <div className="text-sm text-gray-300 whitespace-pre-wrap">
              {cleanAndDecodeBloggerText(video.description) || "No description provided."}
              
              {settings?.defaultVideoDescription && (
                <div className="mt-6 pt-4 border-t border-white/10 text-gray-400 text-xs italic whitespace-pre-wrap">
                  {settings.defaultVideoDescription}
                </div>
              )}
              
              <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-white">Category:</span>
                {(video.category || 'General').split(',').map((c) => c.trim()).filter(Boolean).map((catItem, idx, arr) => (
                  <React.Fragment key={catItem}>
                    <Link to={`/category/${encodeURIComponent(catItem)}`} className="text-red-500 hover:underline">
                      {catItem}
                    </Link>
                    {idx < arr.length - 1 && <span className="text-gray-500">,</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* High-Converting Ad Banners */}
        <div className="mt-4 mb-2">
          <div className="hidden md:block">
            <AdBanner placement="banner728x90" className="w-full min-h-[90px]" />
          </div>
          <div className="block md:hidden">
            <AdBanner placement="banner300x250" className="w-full min-h-[250px]" />
          </div>
        </div>
        <AdBanner placement="nativeBanner" className="my-3 w-full" />

        {/* Comments Section */}
        <div className="mt-8">
          <h3 className="mb-6 text-lg font-bold text-white">{comments.length} Comments</h3>
          
          {user ? (
            <form onSubmit={handlePostComment} className="mb-8 flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-600 font-bold text-white">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 space-y-3">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full resize-none rounded-md border-b border-white/20 bg-transparent py-2 text-sm text-white placeholder-gray-500 focus:border-white focus:outline-none focus:ring-0"
                  rows={2}
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || !newComment.trim()}
                    className="rounded-full bg-white px-4 py-2 text-sm font-bold text-black hover:bg-gray-200 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Posting...' : 'Comment'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="mb-8 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-400 flex items-center justify-between">
              <span>Sign in to add a comment.</span>
              <Link to="/login" className="rounded-full bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700">Log In</Link>
            </div>
          )}

          <div className="space-y-6">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-700 font-bold text-white">
                  {comment.userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-white">{comment.userName}</span>
                    <UserBadge role={comment.userRole} isVIP={comment.userIsVIP} />
                    <span className="text-xs text-gray-500 ml-2">{new Date(comment.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-300">{comment.text}</p>
                  
                  
                  <div className="mt-2 flex gap-4 items-center">
                    {user && (
                      <button 
                        onClick={() => handleLikeComment(comment.id, comment.likes, comment.likedBy)} 
                        className={`text-xs flex items-center gap-1 ${comment.likedBy?.includes(user.id) ? 'text-blue-500' : 'text-gray-400 hover:text-white'}`}
                      >
                        <ThumbsUp className="h-3 w-3" /> {comment.likes || 0}
                      </button>
                    )}
                    {user && (user.id === comment.userId || user.role === 'admin' || user.role === 'moderator') && (
                      <button onClick={() => handleDeleteComment(comment.id)} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    )}
                  </div>

                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="flex w-full flex-col gap-6 lg:w-[30%] xl:w-[25%]">
        <AdBanner placement="banner300x250" className="min-h-[250px]" />
        
        <div className="flex flex-col gap-4 mt-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-red-500">Related</span> Videos
          </h3>
          
          {relatedVideos.length > 0 ? (
            <div className="flex flex-col gap-4">
              {relatedVideos.map((relVideo, index) => (
                <React.Fragment key={relVideo.id}>
                  {index === 2 && <AdBanner placement="banner300x250" className="my-3 min-h-[250px]" />}
                  {index === 5 && (
                    <div className="my-3 w-full flex justify-center">
                      <div className="hidden lg:block w-full">
                        <AdBanner placement="banner160x600" className="min-h-[600px]" />
                      </div>
                      <div className="block lg:hidden w-full">
                        <AdBanner placement="banner160x300" className="min-h-[300px]" />
                      </div>
                    </div>
                  )}
                  {index === 8 && <AdBanner placement="nativeBanner" className="my-3 min-h-[280px]" />}
                  <Link to={`/video/${relVideo.slug}`} className="group flex gap-3">
                  <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded bg-black">
                    <div 
                      className="absolute inset-0 bg-cover bg-center opacity-40 blur-md scale-110 transition-opacity group-hover:opacity-60"
                      style={{ backgroundImage: `url(${getFullThumbnailUrl(relVideo.thumbnailUrl)})` }}
                    />
                    <img 
                      src={getFullThumbnailUrl(relVideo.thumbnailUrl)} 
                      alt={relVideo.title}
                      className="relative z-10 h-full w-full object-contain transition-transform group-hover:scale-105"
                    />
                    {relVideo.isPremium && (
                      <div className="absolute top-1 left-1 z-20 flex items-center gap-1 rounded bg-amber-500/90 px-1 py-0.5 text-[8px] font-bold text-white backdrop-blur-sm">
                        <Crown className="h-2 w-2" />
                        VIP
                      </div>
                    )}
                    <div className="absolute bottom-1 right-1 z-20 rounded bg-black/80 px-1 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                      {relVideo.duration || '0:00'}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <h4 className="line-clamp-2 text-sm font-medium text-white group-hover:text-red-500 transition-colors">
                      {relVideo.title}
                    </h4>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
                      <span>{getDisplayViews(relVideo.views || 0, relVideo.id).toLocaleString()} views</span>
                    </div>
                  </div>
                </Link>
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center bg-white/5 rounded-xl border border-white/10">
              <VideoIcon className="h-8 w-8 text-white/20 mb-2" />
              <p className="text-sm text-gray-400">No related videos found</p>
            </div>
          )}
        </div>
      </div>

      {/* 3-Step Unlock Modal */}
      {showAdModal && (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center backdrop-blur-md px-2 md:px-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0a0a0a] border border-white/10 rounded-2xl flex flex-col items-center p-4 md:p-8 shadow-[0_0_50px_rgba(34,197,94,0.1)] relative">
            
            {/* Close Button */}
            {!isTimerRunning && (
              <button 
                onClick={handleCloseAdModal}
                className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white rounded-full bg-gray-900 hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <h2 className="text-2xl font-black text-white mb-2">ভিডিও আনলক করুন</h2>
            <p className="text-gray-400 text-center mb-8">
              স্পন্সরের বিজ্ঞাপন দেখে ভিডিওটি ফ্রিতে আনলক করুন। আর মাত্র <span className="text-white font-bold">{3 - (adStep - 1)}</span> টি ধাপ বাকি।
            </p>

            <div className="flex gap-4 mb-8">
              {[1, 2, 3].map(step => (
                <div 
                  key={step} 
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-500
                    ${step < adStep ? 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 
                      step === adStep ? 'bg-blue-600 text-white ring-4 ring-blue-500/30' : 
                      'bg-gray-800 text-gray-500 border border-gray-700'}`}
                >
                  {step < adStep ? <CheckCircle className="w-6 h-6" /> : step}
                </div>
              ))}
            </div>

            {isTimerRunning ? (
              <div className="flex flex-col items-center justify-center py-6 w-full bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                <div className="w-full mb-6 relative overflow-hidden rounded-lg min-h-[400px] md:min-h-[500px] bg-black flex items-center justify-center">
                  {(() => {
                    const rawAdUrl = settings?.customAds?.premiumUnlockLink || '';
                    const isUrl = /^https?:\/\/[^\s]+$/.test(rawAdUrl.trim());
                    const isAppId = /^\d+$/.test(rawAdUrl.trim()); // Only numbers like Start.io App ID
                    
                    if (isAppId) {
                      return (
                        <div className="text-red-500 text-sm text-center p-4">
                          <p className="font-bold">⚠️ Warning for Admin:</p>
                          <p>Start.io App ID ({rawAdUrl}) does not work in browsers.</p>
                          <p>Please paste an HTML Web Script Tag here instead.</p>
                        </div>
                      );
                    }
                    
                    if (isUrl) {
                      return (
                        <>
                          <iframe src={rawAdUrl.trim()} className="w-full h-[400px] md:h-[500px] border-0 bg-white" />
                          <a 
                            href={rawAdUrl.trim()} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="absolute bottom-2 right-2 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded shadow-lg z-10 font-bold flex items-center gap-1"
                          >
                            Open Ad Link
                          </a>
                        </>
                      );
                    }
                    return <AdBanner placement="premiumUnlockLink" className="w-full h-full min-h-[400px] md:min-h-[500px]" />;
                  })()}
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="relative w-16 h-16">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-gray-800" />
                      <circle 
                        cx="32" cy="32" r="28" 
                        stroke="currentColor" 
                        strokeWidth="4" 
                        fill="transparent" 
                        strokeDasharray={2 * Math.PI * 28}
                        strokeDashoffset={(2 * Math.PI * 28) * (1 - adTimer / 25)}
                        className="text-blue-500 transition-all duration-1000 ease-linear" 
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-xl font-black text-white">
                      {adTimer}
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-blue-400 font-bold animate-pulse text-sm">
                      বিজ্ঞাপনটি দেখুন...
                    </p>
                    <p className="text-red-400 text-xs mt-1 font-bold">
                      অন্য ট্যাবে গেলে সময় থমকে যাবে!
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={handleStartStep}
                className="w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] hover:scale-[1.02] transition-all flex items-center justify-center gap-2 text-lg"
              >
                <PlayCircle className="w-6 h-6" />
                অ্যাড দেখুন (ধাপ {adStep})
              </button>
            )}
            
            <p className="text-xs text-gray-500 mt-6 text-center bg-white/5 p-3 rounded-lg border border-white/5">
              💡 <strong className="text-gray-300">নির্দেশনা:</strong> বাটনে ক্লিক করলে এই পেজেই স্পন্সরের অ্যাড ওপেন হবে। অ্যাড চলাকালীন ২৫ সেকেন্ড ট্যাব পরিবর্তন করবেন না, তাহলে কাউন্টডাউন থমকে যাবে!
            </p>
          </div>
        </div>
      )}

      {/* Sticky Mobile Bottom Ad Banner */}
      {showAds && showMobileBottomAd && (
        <div className="fixed bottom-0 left-0 right-0 z-40 block md:hidden bg-black/90 backdrop-blur-md border-t border-white/10 px-2 py-1 shadow-2xl">
          <div className="w-full flex justify-between items-center px-1 text-[10px] text-gray-400">
            <span className="font-semibold text-gray-400">স্পন্সর বিজ্ঞাপন</span>
            <button 
              type="button"
              onClick={() => setShowMobileBottomAd(false)} 
              className="text-gray-400 hover:text-white px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold"
            >
              বন্ধ করুন ✕
            </button>
          </div>
          <AdBanner placement="banner320x50" className="my-0" />
        </div>
      )}
    </div>
  );
}
