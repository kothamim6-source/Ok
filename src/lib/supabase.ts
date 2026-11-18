import { createClient } from '@supabase/supabase-js';

export interface BuyerSupabaseConfig {
  url: string;
  anonKey: string;
}

const STORAGE_KEY = 'buyer_supabase_config';
const PLACEHOLDER_URL = 'https://your-project.supabase.co';
const PLACEHOLDER_KEY = 'your-anon-key';

function getStoredSupabaseConfig(): Partial<BuyerSupabaseConfig> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

const stored = getStoredSupabaseConfig();
const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const resolvedUrl = (stored.url || envUrl || PLACEHOLDER_URL).trim();
const resolvedKey = (stored.anonKey || envKey || PLACEHOLDER_KEY).trim();

export function isSupabaseConfigured(): boolean {
  return (
    Boolean(resolvedUrl) &&
    resolvedUrl !== PLACEHOLDER_URL &&
    resolvedUrl.startsWith('https://') &&
    Boolean(resolvedKey) &&
    resolvedKey !== PLACEHOLDER_KEY
  );
}

export function getSupabaseConfigInfo(): { url: string; anonKey: string; source: 'local' | 'env' | 'unset' } {
  if (stored.url && stored.anonKey) {
    return { url: stored.url, anonKey: stored.anonKey, source: 'local' };
  }
  if (envUrl && envKey) {
    return { url: envUrl, anonKey: envKey, source: 'env' };
  }
  return { url: '', anonKey: '', source: 'unset' };
}

export function saveBuyerSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() }));
}

export function clearBuyerSupabaseConfig(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

const unconfiguredFetch: typeof fetch = async (input, init) => {
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const headers = new Headers(
    init?.headers || (input instanceof Request ? input.headers : undefined)
  );
  const accept = headers.get('Accept') || '';

  if (method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: { 'Content-Range': '*/0' }
    });
  }

  const wantsSingleObject = accept.includes('application/vnd.pgrst.object+json');
  return new Response(wantsSingleObject ? 'null' : '[]', {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Range': wantsSingleObject ? '0-0/0' : '*/0'
    }
  });
};

export const supabase = isSupabaseConfigured()
  ? createClient(resolvedUrl, resolvedKey)
  : createClient(resolvedUrl, resolvedKey, {
      global: { fetch: unconfiguredFetch },
      auth: { persistSession: false, autoRefreshToken: false }
    });

if (!isSupabaseConfigured()) {
  const noopChannel = {
    on: () => noopChannel,
    subscribe: () => noopChannel,
    unsubscribe: async () => 'ok'
  } as any;
  (supabase as any).channel = () => noopChannel;
  (supabase as any).removeChannel = async () => 'ok';
}
