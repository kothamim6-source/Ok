import { supabase } from './supabase';

// In-memory cache to prevent duplicate posts within the same client session
const localLocks = new Map<string, number>();

/**
 * Checks if a key is locked in localStorage or local memory
 */
function checkLocalLock(lockKey: string, ttlMs: number): boolean {
  const now = Date.now();
  // 1. In-memory check
  const memTime = localLocks.get(lockKey);
  if (memTime && (now - memTime < ttlMs)) {
    return true;
  }
  
  // 2. localStorage check (cross-tab & page reloads)
  try {
    const stored = localStorage.getItem(`tg_lock_${lockKey}`);
    if (stored) {
      const storedTime = Number(stored);
      if (!isNaN(storedTime) && (now - storedTime < ttlMs)) {
        localLocks.set(lockKey, storedTime);
        return true;
      }
    }
  } catch (e) {
    // localStorage might be unavailable in some private browsing modes
  }
  return false;
}

/**
 * Saves a lock locally in memory and localStorage
 */
export function markTelegramLocked(lockKey: string): void {
  const now = Date.now();
  localLocks.set(lockKey, now);
  try {
    localStorage.setItem(`tg_lock_${lockKey}`, String(now));
  } catch (e) {}
}

/**
 * Synchronously checks if a Telegram post lock is already held locally.
 */
export function isTelegramLockedLocally(lockKey: string, ttlMs: number = 24 * 60 * 60 * 1000): boolean {
  return checkLocalLock(lockKey, ttlMs);
}

/**
 * Attempts to acquire an atomic lock for a Telegram post across tabs and database.
 * If the lock is already held (posted recently within ttlMs), returns false.
 * If available, claims the lock locally and remotely and returns true.
 * 
 * @param lockKey Unique key, e.g. "video_{id}" or "autogift_{YYYY-MM-DD}" or "text_post_{id}_{scheduledFor}"
 * @param ttlMs Time-to-live in ms for the lock (default: 24 hours)
 */
export async function tryAcquireTelegramLock(lockKey: string, ttlMs: number = 24 * 60 * 60 * 1000): Promise<boolean> {
  const now = Date.now();

  // 1. Instant local & cross-tab check
  if (checkLocalLock(lockKey, ttlMs)) {
    console.log(`[TelegramDeduplication] Blocked duplicate locally/cross-tab for key: ${lockKey}`);
    return false;
  }

  // Pre-claim locally immediately to block concurrent microtasks and other tabs
  markTelegramLocked(lockKey);

  try {
    // 2. Fetch remote lock table from Supabase
    const { data: logRow, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 'telegram_posted_log')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn('[TelegramDeduplication] Error reading telegram_posted_log:', error.message);
    }

    let locks: Record<string, number> = {};
    if (logRow && logRow.data && typeof logRow.data === 'object') {
      locks = (logRow.data.locks || logRow.data.postedIds || {}) as Record<string, number>;
    }

    // 3. Check if key is already claimed in database
    const remoteTime = locks[lockKey];
    if (remoteTime && (now - remoteTime < ttlMs)) {
      console.log(`[TelegramDeduplication] Blocked duplicate from database for key: ${lockKey}`);
      return false;
    }

    // 4. Claim the lock in database
    locks[lockKey] = now;

    // Prune entries older than 7 days to prevent document bloat
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;
    const cleanedLocks: Record<string, number> = {};
    for (const [k, timestamp] of Object.entries(locks)) {
      if (typeof timestamp === 'number' && timestamp > cutoff) {
        cleanedLocks[k] = timestamp;
      }
    }

    // Upsert into Supabase settings
    const { error: upsertErr } = await supabase.from('settings').upsert({
      id: 'telegram_posted_log',
      data: {
        locks: cleanedLocks,
        updatedAt: now
      }
    });

    if (upsertErr) {
      console.warn('[TelegramDeduplication] Warning updating telegram_posted_log:', upsertErr.message);
    }

    console.log(`[TelegramDeduplication] Lock acquired successfully for key: ${lockKey}`);
    return true;
  } catch (e) {
    console.error('[TelegramDeduplication] Unexpected error in tryAcquireTelegramLock:', e);
    // On unexpected error, we already have localLocks guarding this instance
    return true;
  }
}

