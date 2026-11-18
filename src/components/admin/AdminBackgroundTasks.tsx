import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { tryAcquireTelegramLock, isTelegramLockedLocally, markTelegramLocked } from '../../lib/telegramDeduplication';
import { getBDDateString, getFullThumbnailUrl } from '../../lib/utils';
import { drawPremiumInvoice } from '../../utils/invoiceGenerator';
import { executeDaily10GiftProcess } from '../../lib/giftService';
import { Play, Pause, Activity } from 'lucide-react';
import {
  resolveTargetChannels,
  postVideoToTelegramChannels,
  TelegramSecretsConfig
} from '../../lib/telegramChannelService';

export function AdminBackgroundTasks() {
  const [isActive, setIsActive] = useState(true);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isTaskRunningRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const runTasks = async () => {
      if (isTaskRunningRef.current) return;

      // Cross-tab mutex: ensure only one browser tab runs background processing
      const now = Date.now();
      try {
        const lastActive = Number(localStorage.getItem('admin_bg_worker_ts') || '0');
        if (now - lastActive < 20000) {
          // Another tab ran background tasks recently, skip this tick
          return;
        }
        localStorage.setItem('admin_bg_worker_ts', String(now));
      } catch (e) {}

      isTaskRunningRef.current = true;
      try {
        console.log('Running background tasks...');
        setLastRun(new Date());

        // 1. Fetch Telegram Secrets
        const { data: secretData } = await supabase.from('settings').select('*').eq('id', 'telegram_secrets').single();
        const botToken = secretData?.data?.botToken;
        const chatId = secretData?.data?.channelId;
        const defaultDescription = secretData?.data?.defaultDescription || '';
        const customApiUrl = secretData?.data?.customApiUrl || '';
        const tgApiBase = customApiUrl ? customApiUrl.replace(/\/$/, '') : 'https://api.telegram.org';

        // 2. Process Scheduled Text Posts
        if (botToken && chatId) {
          const { data: textPostsData } = await supabase.from('settings').select('*').eq('id', 'scheduled_text_posts').single();
          if (textPostsData?.data?.posts && Array.isArray(textPostsData.data.posts)) {
            let updated = false;
            const posts = textPostsData.data.posts;

            const todayBD = getBDDateString(now);
            for (let i = 0; i < posts.length; i++) {
              const post = posts[i];
              if (post.status === 'pending' && post.scheduledFor <= now) {
                if (post.lastPostedAt && getBDDateString(post.lastPostedAt) === todayBD) {
                  console.log(`[AdminBackgroundTasks] Skipping already posted text post for today: ${post.id}`);
                  continue;
                }

                const lockKey = post.isDaily 
                  ? `text_post_daily_${post.id}_${todayBD}` 
                  : `text_post_${post.id}`;

                if (isTelegramLockedLocally(lockKey)) {
                  continue;
                }

                const acquired = await tryAcquireTelegramLock(lockKey);
                if (!acquired) {
                  console.log(`[AdminBackgroundTasks] Skipping already processed text post ${post.id}`);
                  continue;
                }

                updated = true;
                if (post.isDaily) {
                  posts[i].scheduledFor += 24 * 60 * 60 * 1000;
                  posts[i].status = 'pending';
                } else {
                  posts[i].status = 'posted';
                }
                posts[i].lastPostedAt = now;

                try {
                  const res = await fetch(`${tgApiBase}/bot${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: post.textContent,
                      disable_web_page_preview: false
                    })
                  });

                  if (res.ok) {
                    markTelegramLocked(lockKey);
                  } else {
                    console.error('[AdminBackgroundTasks] Telegram send text post failed:', await res.text());
                  }
                } catch (e) {
                  console.error('[AdminBackgroundTasks] Telegram request failed:', e);
                }
              }
            }

            if (updated) {
              await supabase.from('settings').update({ data: { posts, updatedAt: now } }).eq('id', 'scheduled_text_posts');
            }
          }
        }

        // 3. Process Scheduled Videos
        const { data: videos } = await supabase
          .from('videos')
          .select('*')
          .eq('status', 'scheduled')
          .lte('created_at', now);

        if (videos && videos.length > 0) {
          for (const video of videos) {
            const lockKey = `video_${video.id}`;
            if (isTelegramLockedLocally(lockKey)) continue;

            const acquired = await tryAcquireTelegramLock(lockKey);
            if (!acquired) {
              console.log(`[AdminBackgroundTasks] Video ${video.id} already posted or locked, skipped.`);
              continue;
            }

            // Atomically claim the video from 'scheduled' -> 'published'
            const { data: claimedRows, error: updateError } = await supabase
              .from('videos')
              .update({ status: 'published' })
              .eq('id', video.id)
              .eq('status', 'scheduled')
              .select();

            if (updateError || !claimedRows || claimedRows.length === 0) {
              console.log(`[AdminBackgroundTasks] Video ${video.id} was already claimed/published by another worker.`);
              continue;
            }

            const secretsConfig: Partial<TelegramSecretsConfig> = {
              botToken,
              channelId: chatId,
              defaultDescription,
              customApiUrl,
              categoryChannels: secretData?.data?.categoryChannels || {},
              extraChannels: secretData?.data?.extraChannels || []
            };
            const videoCat = video.category_id || video.categoryId || video.category || '';
            const targetChannels = resolveTargetChannels(videoCat, secretsConfig, '__AUTO__');

            if (botToken && targetChannels.length > 0) {
              const videoLink = `${window.location.origin}/video/${video.id}`;
              const finalDesc = defaultDescription || video.description || '';
              const res = await postVideoToTelegramChannels({
                videoId: video.id,
                title: video.title || '',
                description: video.description || '',
                telegramDescription: finalDesc,
                thumbnailUrl: video.thumbnail_url ? getFullThumbnailUrl(video.thumbnail_url) : '',
                videoLink,
                botToken,
                targetChannels,
                customApiUrl
              });
              if (res.succeededChannels.length > 0) {
                markTelegramLocked(lockKey);
              }
            }
          }
        }

        // (Daily Auto-Gift has been disabled from background automation - only executed manually via Admin Gift Premium page)

      } catch (err) {
        console.error("Background tasks error:", err);
      } finally {
        isTaskRunningRef.current = false;
      }
    };

    // Run immediately, then every 30 seconds
    runTasks();
    timerRef.current = setInterval(runTasks, 30000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-white/10 bg-black/80 px-4 py-2 pr-2 text-xs backdrop-blur-xl shadow-lg">
      <div className={`flex items-center gap-2 ${isActive ? 'text-green-400' : 'text-gray-500'}`}>
        <Activity className={`h-4 w-4 ${isActive ? 'animate-pulse' : ''}`} />
        <span className="font-medium hidden sm:inline">
          {isActive ? 'Auto-Schedule Active' : 'Auto-Schedule Paused'}
        </span>
      </div>
      <button
        onClick={() => setIsActive(!isActive)}
        className="ml-2 rounded-full p-1.5 hover:bg-white/10 transition-colors text-white"
        title={isActive ? "Pause background tasks" : "Resume background tasks"}
      >
        {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
    </div>
  );
}
