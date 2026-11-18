import { supabase } from './supabase';
import { tryAcquireTelegramLock, markTelegramLocked } from './telegramDeduplication';
import { getBDDateString } from './utils';
import { drawPremiumInvoice } from '../utils/invoiceGenerator';

export interface EligibleGiftUser {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  is_vip?: boolean;
  vip_expires_at?: number;
  created_at?: number;
}

/**
 * Retrieves the list of all user IDs who have EVER received a VIP gift before.
 * Stored in `gifted_users_registry` and backed up by `notifications` with type 'VIP_GIFT'.
 * This guarantees a user is NEVER gifted more than once in their lifetime.
 */
export async function getPermanentGiftedUserIds(): Promise<Set<string>> {
  const giftedSet = new Set<string>();

  try {
    // 1. Check persistent registry in settings
    const { data: registryDoc } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 'gifted_users_registry')
      .single();

    if (registryDoc?.data?.giftedUserIds && Array.isArray(registryDoc.data.giftedUserIds)) {
      registryDoc.data.giftedUserIds.forEach((uid: string) => {
        if (uid) giftedSet.add(uid);
      });
    }
  } catch (err) {
    console.warn('[giftService] Could not read gifted_users_registry:', err);
  }

  try {
    // 2. Cross-check notifications table for any VIP_GIFT ever issued
    const { data: notifData } = await supabase
      .from('notifications')
      .select('user_id')
      .eq('type', 'VIP_GIFT')
      .limit(5000);

    if (notifData && Array.isArray(notifData)) {
      notifData.forEach(n => {
        if (n.user_id) giftedSet.add(n.user_id);
      });
    }
  } catch (err) {
    console.warn('[giftService] Could not check notifications for VIP_GIFT:', err);
  }

  return giftedSet;
}

/**
 * Permanently adds user IDs to the gifted users registry in Supabase settings
 */
export async function recordPermanentlyGiftedUsers(userIds: string[]): Promise<void> {
  if (!userIds || userIds.length === 0) return;

  try {
    const existingSet = await getPermanentGiftedUserIds();
    userIds.forEach(id => existingSet.add(id));

    await supabase.from('settings').upsert({
      id: 'gifted_users_registry',
      data: {
        giftedUserIds: Array.from(existingSet),
        updatedAt: Date.now()
      }
    });
  } catch (err) {
    console.error('[giftService] Failed to update gifted_users_registry:', err);
  }
}

/**
 * Selects 10 eligible users from the TOTAL registered user base.
 * Criteria:
 * - Never received a gift before (checked against permanent registry & VIP_GIFT history).
 * - Not currently an active VIP user.
 * - Not an admin.
 * - Shuffled randomly to give all registered users fair opportunity.
 */
export async function fetchEligibleUsersForDailyGift(limit = 10): Promise<EligibleGiftUser[]> {
  // 1. Get all permanently gifted user IDs
  const alreadyGiftedIds = await getPermanentGiftedUserIds();

  // 2. Fetch all users from the total user base (up to 10,000 users)
  const { data: allUsers, error } = await supabase
    .from('users')
    .select('id, name, email, role, is_vip, vip_expires_at, created_at')
    .limit(10000);

  if (error || !allUsers) {
    console.error('[giftService] Error fetching users from total user pool:', error);
    return [];
  }

  const now = Date.now();

  // 3. Filter total users: strictly exclude anyone already gifted, active VIPs, or admins
  const eligible = allUsers.filter(u => {
    if (!u.id) return false;
    // Strictly never gift admins
    if (u.role === 'admin') return false;
    // Strictly never gift anyone who ever received a gift before
    if (alreadyGiftedIds.has(u.id)) return false;
    // Exclude if currently active VIP
    if (u.is_vip === true) return false;
    if (u.vip_expires_at && u.vip_expires_at > now) return false;

    return true;
  });

  // 4. Shuffle eligible users array using Fisher-Yates shuffle
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }

  // 5. Pick up to `limit` (default: 10)
  return eligible.slice(0, limit);
}

/**
 * Posts to Telegram with multiple fallback mechanisms:
 * Tier 1: Direct Telegram sendPhoto
 * Tier 2: PHP proxy on InfinityFree (`/telegram-post.php`)
 * Tier 3: Express proxy (`/api/post-to-telegram`)
 * Tier 4: Fallback to sendMessage (text only) if photo upload fails
 */
export async function sendTelegramWithFallbacks({
  botToken,
  chatId,
  caption,
  imageBlob,
  customApiUrl
}: {
  botToken: string;
  chatId: string;
  caption: string;
  imageBlob?: Blob | null;
  customApiUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  const cleanBotToken = botToken.trim();
  const cleanChatId = chatId.trim();
  const baseApi = (customApiUrl && customApiUrl.trim()) 
    ? customApiUrl.trim().replace(/\/$/, '') 
    : 'https://api.telegram.org';

  if (!cleanBotToken || !cleanChatId) {
    return { success: false, error: 'Bot Token or Chat/Channel ID is missing.' };
  }

  // Strategy A: If image blob provided, try sending photo directly
  if (imageBlob) {
    try {
      const formData = new FormData();
      formData.append('chat_id', cleanChatId);
      formData.append('caption', caption.length > 1024 ? caption.substring(0, 1020) + '...' : caption);
      formData.append('photo', imageBlob, 'daily_gift_invoice.jpg');

      const res = await fetch(`${baseApi}/bot${cleanBotToken}/sendPhoto`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (data.ok) {
        return { success: true };
      }
      console.warn('[giftService] Direct sendPhoto failed with response:', data);
    } catch (directErr) {
      console.warn('[giftService] Direct Telegram sendPhoto network/CORS error:', directErr);
    }
  }

  // Strategy B: Try via local PHP proxy (for InfinityFree hosting)
  try {
    const res = await fetch('/telegram-post.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botToken: cleanBotToken,
        chatId: cleanChatId,
        caption: caption,
        customApiUrl: baseApi
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return { success: true };
      }
    }
  } catch (phpErr) {
    // Ignore and proceed to Strategy C
  }

  // Strategy C: Direct text message fallback (sendMessage)
  try {
    const textCaption = caption.length > 4000 ? caption.substring(0, 3996) + '...' : caption;
    const res = await fetch(`${baseApi}/bot${cleanBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: textCaption,
        disable_web_page_preview: false
      })
    });

    const data = await res.json();
    if (data.ok) {
      return { success: true };
    }
    return { success: false, error: data.description || 'Telegram API error' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Telegram network failure' };
  }
}

/**
 * Executes granting 1-day VIP gift to exactly 10 users from total user base,
 * records them permanently, generates the invoice, and posts to Telegram.
 */
export async function executeDaily10GiftProcess({
  usersToGift,
  botToken,
  chatId,
  customText,
  siteName = '19-20 Streaming',
  isManual = false
}: {
  usersToGift?: EligibleGiftUser[];
  botToken: string;
  chatId: string;
  customText?: string;
  siteName?: string;
  isManual?: boolean;
}): Promise<{ success: boolean; count: number; message: string; telegramSuccess: boolean }> {
  const todayBD = getBDDateString(new Date());
  const lockKey = `autogift_${todayBD}`;

  // Check deduplication lock for automatic runs (allow manual override with warning)
  if (!isManual) {
    const acquired = await tryAcquireTelegramLock(lockKey);
    if (!acquired) {
      return {
        success: false,
        count: 0,
        message: `আজকের (${todayBD}) অটো গিফট ইতিমধ্যে সম্পন্ন হয়েছে।`,
        telegramSuccess: false
      };
    }
  }

  // If users are not provided, fetch 10 eligible users from total user base
  const users = (usersToGift && usersToGift.length > 0)
    ? usersToGift
    : await fetchEligibleUsersForDailyGift(10);

  if (!users || users.length === 0) {
    return {
      success: false,
      count: 0,
      message: 'গিফট পাওয়ার মতো কোনো যোগ্য ইউজার পাওয়া যায়নি (সবাই ইতিমধ্যে গিফট পেয়েছে বা প্রিমিয়ামে আছে)।',
      telegramSuccess: false
    };
  }

  const oneDayMs = 24 * 60 * 60 * 1000;
  const newExpiresAt = Date.now() + oneDayMs;
  const giftedIds: string[] = [];

  // 1. Grant 1-day VIP in Supabase and send notification popup
  for (const u of users) {
    if (!u.id) continue;

    try {
      await supabase
        .from('users')
        .update({
          is_vip: true,
          vip_expires_at: u.vip_expires_at && u.vip_expires_at > Date.now() ? u.vip_expires_at + oneDayMs : newExpiresAt
        })
        .eq('id', u.id);

      await supabase.from('notifications').insert([{
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
        user_id: u.id,
        title: 'Daily Lucky Premium Gift! 🎁',
        message: 'অভিনন্দন! আপনি আমাদের দৈনন্দিন লাকি ড্র-তে নির্বাচিত হয়েছেন এবং ১ দিনের সম্পূর্ণ ফ্রি প্রিমিয়াম অ্যাক্সেস পেয়েছেন।',
        read: false,
        type: 'VIP_GIFT',
        is_popup: true,
        created_at: Date.now()
      }]);

      giftedIds.push(u.id);
    } catch (uErr) {
      console.error(`[giftService] Error gifting user ${u.id}:`, uErr);
    }
  }

  // 2. Permanently record these users so they are NEVER gifted again
  await recordPermanentlyGiftedUsers(giftedIds);

  // 3. Mark lastAutoGiftRun in general settings and read dynamic website/APK/support links
  let configuredAppLink = '';
  let configuredSupportLink = '';
  try {
    const { data: generalDoc } = await supabase.from('settings').select('*').eq('id', 'general').single();
    const curData = generalDoc?.data || {};
    configuredAppLink = curData.appDownloadLink || '';
    configuredSupportLink = curData.giftSupportLink || curData.supportLinks?.telegram || curData.telegramUrl || '';
    await supabase.from('settings').upsert({
      id: 'general',
      data: {
        ...curData,
        lastAutoGiftRun: todayBD
      }
    });
  } catch (settingsErr) {
    console.warn('[giftService] Could not update lastAutoGiftRun:', settingsErr);
  }

  // 4. Generate invoice photo and post to Telegram
  let telegramSuccess = false;
  if (botToken && chatId) {
    const canvas = document.createElement('canvas');
    drawPremiumInvoice(canvas, siteName, users, 'Daily Lucky 10 User Gift');

    const imageBlob = await new Promise<Blob | null>(resolve => {
      try {
        canvas.toBlob(b => resolve(b), 'image/jpeg', 0.9);
      } catch {
        resolve(null);
      }
    });

    const usersListText = users.map((u, i) => {
      let displayName = u.name;
      if (!displayName || displayName.toLowerCase() === 'user' || displayName.trim() === '') {
        displayName = u.email?.split('@')[0] || 'Lucky User';
      }
      return `${i + 1}. ${displayName} (1 Day Premium)`;
    }).join('\n');

    const descText = customText && customText.trim()
      ? customText.trim()
      : 'আমাদের সকল রেজিস্টার্ড ইউজারদের মধ্য থেকে লটারির মাধ্যমে প্রতিদিন ১০ জন লাকি ইউজারকে ১ দিনের প্রিমিয়াম উপহার দেওয়া হয়েছে।';

    const websiteHost = typeof window !== 'undefined' ? window.location.hostname : '';
    const extraLinks: string[] = [];
    if (websiteHost) extraLinks.push(`🌐 Website:\n${websiteHost}`);
    if (configuredAppLink) extraLinks.push(`📱 APK:\n${configuredAppLink}`);
    if (configuredSupportLink) extraLinks.push(`💬 কোনো সমস্যা হলে মেসেজ করুন:\n${configuredSupportLink}`);
    const linksBlock = extraLinks.length > 0 ? `\n━━━━━━━━━━━━━━━━━━\n${extraLinks.join('\n')}` : '';

    const caption = `🎉 আজকের Daily Premium Gift Update 🎉\n\n${descText}\n\n💎 আজকের নির্বাচিত ১০ জন ভাগ্যবান ইউজার:\n${usersListText}\n\n✅ সবাইকে অনুরোধ করা হচ্ছে, নিজ নিজ Account/Profile চেক করে Premium Access পেয়েছেন কি না দেখে নিন।\n🎁 প্রতিদিন আমাদের সকল ইউজারদের মধ্য থেকে নতুন ১০ জনকে এই উপহার দেওয়া হয় (একজনকে দ্বিতীয়বার দেওয়া হয় না)।${linksBlock}\n━━━━━━━━━━━━━━━━━━\n🌙 নতুন ভিডিও আপডেট:\nপ্রতিদিন রাত ১২টার পর আমাদের নতুন ভিডিও আপলোড করা হয়।\n❤️ আমাদের সাথে থাকুন এবং প্রতিদিনের নতুন আপডেট উপভোগ করুন।\n🙏 ধন্যবাদ সবাইকে।`;

    const tgRes = await sendTelegramWithFallbacks({
      botToken,
      chatId,
      caption,
      imageBlob
    });

    telegramSuccess = tgRes.success;
    if (tgRes.success) {
      markTelegramLocked(lockKey);
    } else {
      console.error('[giftService] Telegram post failed:', tgRes.error);
    }
  }

  return {
    success: true,
    count: giftedIds.length,
    message: `${giftedIds.length} জন ইউজারকে ১ দিনের প্রিমিয়াম গিফট সফলভাবে দেওয়া হয়েছে${telegramSuccess ? ' এবং টেলিগ্রামে পোস্ট করা হয়েছে!' : ' (টেলিগ্রাম পোস্ট ব্যর্থ হয়েছে, দয়া করে টোকেন চেক করুন)।'}`,
    telegramSuccess
  };
}
