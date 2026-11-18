import { supabase } from './supabase';

export interface ExtraTelegramChannel {
  id: string;
  label: string;
  channelId: string;
}

export interface TelegramSecretsConfig {
  botToken: string;
  channelId: string;
  defaultDescription?: string;
  customApiUrl?: string;
  categoryChannels?: Record<string, string>;
  extraChannels?: ExtraTelegramChannel[];
  updatedAt?: number;
}

/**
 * Checks whether the input looks like a private Telegram invite link (t.me/+... or joinchat/...).
 * Telegram Bot API cannot post directly to invite links; private channels require a numeric -100... chat_id.
 */
export function isTelegramInviteLink(input?: string | null): boolean {
  if (!input) return false;
  const raw = input.trim();
  return /(?:t\.me\/(?:\+|joinchat\/)|telegram\.me\/(?:\+|joinchat\/))/i.test(raw) || /^\+[a-zA-Z0-9_-]+$/.test(raw);
}

/**
 * Normalizes a Telegram channel link, @username, or numeric chat_id into a Bot-API-compatible chat_id.
 * Examples:
 *  - "https://t.me/mychannel" -> "@mychannel"
 *  - "t.me/mychannel/123" -> "@mychannel"
 *  - "mychannel" -> "@mychannel"
 *  - "@mychannel" -> "@mychannel"
 *  - "-1001234567890" -> "-1001234567890"
 */
export function normalizeTelegramChatId(input?: string | null): string {
  if (!input) return '';
  const raw = input.trim();
  if (!raw) return '';

  // Numeric channel/chat ID (e.g. -1001234567890 or 123456789)
  if (/^-?\d+$/.test(raw)) {
    return raw;
  }

  // Do not strip invite links into fake @handles
  if (isTelegramInviteLink(raw)) {
    return raw;
  }

  // Strip full Telegram URLs (e.g. https://t.me/username or telegram.me/username/postId)
  let clean = raw
    .replace(/^tg:\/?\/?resolve\?domain=/i, '')
    .replace(/^https?:\/\/(www\.)?(t\.me|telegram\.me|telegram\.dog)\//i, '')
    .replace(/^(t\.me|telegram\.me|telegram\.dog)\//i, '')
    .split('?')[0]
    .split('#')[0]
    .split('/')[0]
    .trim();

  if (!clean) return '';
  if (!clean.startsWith('@')) {
    clean = `@${clean}`;
  }
  return clean;
}

/**
 * Finds the mapped Telegram channel for a category name (case-insensitive),
 * falling back to the main default channel ID if none is configured.
 */
export function getChannelForCategory(
  categoryName?: string | null,
  categoryChannels?: Record<string, string>,
  fallbackChannelId?: string
): string {
  if (categoryName && categoryChannels && typeof categoryChannels === 'object') {
    const trimmed = categoryName.trim();
    if (trimmed) {
      if (categoryChannels[trimmed]) {
        const norm = normalizeTelegramChatId(categoryChannels[trimmed]);
        if (norm) return norm;
      }
      const lower = trimmed.toLowerCase();
      for (const [key, val] of Object.entries(categoryChannels)) {
        if (key.trim().toLowerCase() === lower && val && val.trim()) {
          const norm = normalizeTelegramChatId(val);
          if (norm) return norm;
        }
      }
    }
  }
  return normalizeTelegramChatId(fallbackChannelId || '');
}

/**
 * Resolves the list of target Telegram channel IDs for a post given its category value
 * (supports single category or comma-separated multiple categories) and an optional 1-click override.
 */
export function resolveTargetChannels(
  categoryValue: string,
  secrets: Partial<TelegramSecretsConfig>,
  overrideMode?: string
): string[] {
  const mainChannel = normalizeTelegramChatId(secrets.channelId || '');
  const catMap = secrets.categoryChannels || {};
  const extras = secrets.extraChannels || [];

  // 1. Explicit single override (not AUTO / not ALL_CHANNELS)
  if (overrideMode && overrideMode !== '__AUTO__' && overrideMode !== '__ALL_CHANNELS__') {
    if (overrideMode === '__MAIN__') {
      return mainChannel ? [mainChannel] : [];
    }
    const normalized = normalizeTelegramChatId(overrideMode);
    return normalized ? [normalized] : (mainChannel ? [mainChannel] : []);
  }

  // 2. Explicit ALL CHANNELS override
  if (overrideMode === '__ALL_CHANNELS__') {
    const all = new Set<string>();
    Object.values(catMap).forEach((ch) => {
      const norm = normalizeTelegramChatId(ch);
      if (norm && !isTelegramInviteLink(norm)) all.add(norm);
    });
    extras.forEach((ex) => {
      const norm = normalizeTelegramChatId(ex.channelId);
      if (norm && !isTelegramInviteLink(norm)) all.add(norm);
    });
    if (all.size === 0 && mainChannel && !isTelegramInviteLink(mainChannel)) {
      all.add(mainChannel);
    }
    return Array.from(all);
  }

  // 3. AUTO mode: resolve each category in comma-separated list
  const cats = (categoryValue || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const resolved = new Set<string>();
  if (cats.length > 0) {
    for (const catName of cats) {
      const ch = getChannelForCategory(catName, catMap, mainChannel);
      if (ch && !isTelegramInviteLink(ch)) {
        resolved.add(ch);
      }
    }
  }

  if (resolved.size === 0 && mainChannel && !isTelegramInviteLink(mainChannel)) {
    resolved.add(mainChannel);
  }

  return Array.from(resolved);
}

/**
 * Loads `telegram_secrets` config from Supabase `settings` table.
 */
export async function fetchTelegramSecretsConfig(): Promise<TelegramSecretsConfig> {
  try {
    const { data } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 'telegram_secrets')
      .single();

    if (data && data.data && typeof data.data === 'object') {
      const sd = data.data as any;
      return {
        botToken: sd.botToken || '',
        channelId: sd.channelId || '',
        defaultDescription: sd.defaultDescription || '',
        customApiUrl: sd.customApiUrl || '',
        categoryChannels: (sd.categoryChannels && typeof sd.categoryChannels === 'object') ? sd.categoryChannels : {},
        extraChannels: Array.isArray(sd.extraChannels) ? sd.extraChannels : [],
        updatedAt: sd.updatedAt
      };
    }
  } catch (e) {
    console.warn('[telegramChannelService] Could not fetch telegram_secrets:', e);
  }
  return {
    botToken: '',
    channelId: '',
    defaultDescription: '',
    customApiUrl: '',
    categoryChannels: {},
    extraChannels: []
  };
}

/**
 * Saves or updates a single category's Telegram channel inside `telegram_secrets`.
 */
export async function saveCategoryChannelMapping(
  categoryName: string,
  channelInput: string,
  oldCategoryName?: string
): Promise<boolean> {
  try {
    const current = await fetchTelegramSecretsConfig();
    const updatedMap: Record<string, string> = { ...(current.categoryChannels || {}) };

    if (oldCategoryName && oldCategoryName !== categoryName) {
      delete updatedMap[oldCategoryName];
    }

    const trimmedInput = (channelInput || '').trim();
    if (trimmedInput) {
      updatedMap[categoryName.trim()] = normalizeTelegramChatId(trimmedInput);
    } else {
      delete updatedMap[categoryName.trim()];
    }

    const { error } = await supabase.from('settings').upsert({
      id: 'telegram_secrets',
      data: {
        ...current,
        categoryChannels: updatedMap,
        updatedAt: Date.now()
      }
    });

    if (error) throw error;
    return true;
  } catch (e) {
    console.error('[telegramChannelService] Failed to save category channel mapping:', e);
    return false;
  }
}

/**
 * Removes a category's Telegram channel mapping when the category is deleted.
 */
export async function removeCategoryChannelMapping(categoryName: string): Promise<void> {
  try {
    const current = await fetchTelegramSecretsConfig();
    const updatedMap: Record<string, string> = { ...(current.categoryChannels || {}) };
    let changed = false;

    for (const key of Object.keys(updatedMap)) {
      if (key.trim().toLowerCase() === categoryName.trim().toLowerCase()) {
        delete updatedMap[key];
        changed = true;
      }
    }

    if (changed) {
      await supabase.from('settings').upsert({
        id: 'telegram_secrets',
        data: {
          ...current,
          categoryChannels: updatedMap,
          updatedAt: Date.now()
        }
      });
    }
  } catch (e) {
    console.warn('[telegramChannelService] Failed to remove category channel mapping:', e);
  }
}

export interface MultiChannelPostParams {
  videoId: string;
  title: string;
  description?: string;
  telegramDescription?: string;
  thumbnailUrl?: string;
  videoLink: string;
  botToken: string;
  targetChannels: string[];
  customApiUrl?: string;
}

export interface MultiChannelPostResult {
  succeededChannels: string[];
  failedChannels: Array<{ channel: string; error: string }>;
}

/**
 * Posts a video announcement to one or more Telegram channels,
 * using PHP backend proxy first with direct Telegram API fallback.
 */
export async function postVideoToTelegramChannels(
  params: MultiChannelPostParams
): Promise<MultiChannelPostResult> {
  const {
    videoId,
    title,
    description = '',
    telegramDescription = '',
    thumbnailUrl = '',
    videoLink,
    botToken,
    targetChannels,
    customApiUrl = ''
  } = params;

  const succeededChannels: string[] = [];
  const failedChannels: Array<{ channel: string; error: string }> = [];

  if (!botToken || !targetChannels || targetChannels.length === 0) {
    return { succeededChannels, failedChannels };
  }

  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let caption = `<b>${safeTitle}</b>\n\n`;
  caption += `🎬 <b>Watch Now / Share Link:</b>\n${videoLink}\n\n`;

  const finalTelegramDesc = telegramDescription.trim();
  if (finalTelegramDesc) {
    const safeDesc = finalTelegramDesc.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    caption += `${safeDesc}`;
  }

  const photoCaption = caption.length > 1024 ? caption.substring(0, 1020) + '...' : caption;
  const textCaption = caption.length > 4000 ? caption.substring(0, 4000) + '...' : caption;
  const apiBase = customApiUrl ? customApiUrl.replace(/\/$/, '') : 'https://api.telegram.org';

  for (let i = 0; i < targetChannels.length; i++) {
    const chatId = targetChannels[i];
    if (!chatId) continue;

    if (isTelegramInviteLink(chatId)) {
      failedChannels.push({
        channel: chatId,
        error: 'প্রাইভেট ইনভাইট লিংক (+...) দিয়ে বট পোস্ট করতে পারে না; -100 চ্যাট আইডি ব্যবহার করুন'
      });
      continue;
    }

    let posted = false;
    let lastError = '';

    // 1. Try PHP backend proxy first (for InfinityFree / Apache hosting)
    try {
      const backendRes = await fetch('/telegram-post.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          title,
          description,
          telegramDescription: finalTelegramDesc,
          thumbnailUrl,
          videoLink,
          providedBotToken: botToken,
          providedChatId: chatId,
          customApiUrl
        })
      });

      if (backendRes.ok) {
        const text = await backendRes.text();
        try {
          const data = JSON.parse(text);
          if (data && (data.success || data.ok)) {
            posted = true;
          } else if (data?.error) {
            lastError = data.error;
          }
        } catch {
          if (text.includes('"success":true') || text.includes('"ok":true')) {
            posted = true;
          }
        }
      }
    } catch {
      // Backend proxy not available (dev or CORS) - fallback to direct Telegram API
    }

    // 2. Direct Telegram API fallback
    if (!posted) {
      try {
        if (thumbnailUrl) {
          const tgRes = await fetch(`${apiBase}/bot${botToken}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              photo: thumbnailUrl,
              caption: photoCaption,
              parse_mode: 'HTML'
            })
          });

          const tgJson = await tgRes.json().catch(() => null);
          if (tgRes.ok && tgJson?.ok) {
            posted = true;
          } else {
            lastError = tgJson?.description || `HTTP ${tgRes.status}`;
            throw new Error(lastError);
          }
        } else {
          throw new Error('No thumbnail');
        }
      } catch {
        try {
          const safeImageUrl = thumbnailUrl ? thumbnailUrl.replace(/&/g, '&amp;') : '';
          const tgThumbLink = safeImageUrl ? `\n\n🖼️ <a href="${safeImageUrl}">View Thumbnail Image</a>` : '';
          const msgRes = await fetch(`${apiBase}/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `${textCaption}${tgThumbLink}`,
              parse_mode: 'HTML',
              disable_web_page_preview: false
            })
          });
          const msgJson = await msgRes.json().catch(() => null);
          if (msgRes.ok && msgJson?.ok) {
            posted = true;
          } else {
            lastError = msgJson?.description || lastError || `HTTP ${msgRes.status}`;
          }
        } catch (err: any) {
          lastError = err?.message || lastError || 'Network error';
        }
      }
    }

    if (posted) {
      succeededChannels.push(chatId);
    } else {
      failedChannels.push({ channel: chatId, error: lastError || 'Post failed' });
    }

    // Polite throttle between multi-channel requests to avoid Telegram 429 rate limits
    if (i < targetChannels.length - 1) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  return { succeededChannels, failedChannels };
}
