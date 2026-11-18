/**
 * Telegram link utilities tailored for Bangladesh networks, Android WebViews,
 * iOS Safari, desktop browsers, and in-app browsers.
 *
 * Prevents ISP blocking of t.me by offering unblocked telegram.me mirrors,
 * avoids net::ERR_UNKNOWN_URL_SCHEME errors in Android WebViews/Chromium by
 * using universal HTTPS links instead of unsupported custom tg: protocols,
 * and handles relative URL routing errors in banners and modals.
 */

export interface TelegramLinkInfo {
  isInvite: boolean;
  rawInput: string;
  handleOrHash: string;
  displayHandle: string;
  appUrl: string;           // tg:// protocol
  androidIntentUrl: string; // intent:// protocol with fallback to web client
  primaryWebUrl: string;    // https://t.me/...
  mirrorWebUrl: string;     // https://telegram.me/... (universal HTTPS)
  webClientUrl: string;     // https://web.telegram.org/... (immune to WebView scheme errors)
}

/**
 * Checks whether an environment is an Android WebView, WebApp wrapper, or standalone PWA.
 */
export function isAndroidWebView(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isStandalone = 
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
    Boolean((window.navigator as any).standalone) ||
    Boolean(document.referrer && document.referrer.includes('android-app://'));
  const isWebView = 
    /\bwv\b/i.test(ua) || 
    /Version\/[0-9\.]+\s+Chrome/i.test(ua) || 
    /Web2App|Website2APK|gonative|bubblewrap|hermit/i.test(ua) ||
    (isAndroid && !(window as any).chrome?.webstore);

  // If running in any WebApp, WebView, or Android mobile device
  return Boolean(isStandalone || isWebView || isAndroid);
}

/**
 * Checks whether an input string is an external URL, Telegram link, or handle.
 */
export function isLikelyTelegramOrExternalUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return false;
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('tg:') ||
    trimmed.startsWith('tg://') ||
    trimmed.startsWith('@') ||
    trimmed.startsWith('+') ||
    trimmed.includes('t.me') ||
    trimmed.includes('telegram.me') ||
    /^[a-zA-Z0-9_]{3,32}$/.test(trimmed)
  );
}

/**
 * Parses user or admin input into structured Telegram links.
 */
export function parseTelegramInput(input?: string | null): TelegramLinkInfo | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  // 1. Check for invite links: e.g. https://t.me/+xyz, t.me/joinchat/xyz, +xyz, tg://join?invite=xyz, tg:join?invite=xyz
  const inviteMatch = 
    raw.match(/(?:t\.me\/(?:\+|joinchat\/)|telegram\.me\/(?:\+|joinchat\/)|tg:\/?\/?join\?invite=)([a-zA-Z0-9_-]+)/i) ||
    raw.match(/^\+([a-zA-Z0-9_-]+)$/);

  if (inviteMatch && inviteMatch[1]) {
    const hash = inviteMatch[1];
    const webClientFallback = `https://web.telegram.org/a/#?q=https://t.me/+${hash}`;
    return {
      isInvite: true,
      rawInput: raw,
      handleOrHash: hash,
      displayHandle: `+${hash}`,
      appUrl: `tg://join?invite=${hash}`,
      androidIntentUrl: `intent://join?invite=${hash}#Intent;scheme=tg;package=org.telegram.messenger;S.browser_fallback_url=${encodeURIComponent(webClientFallback)};end`,
      primaryWebUrl: `https://t.me/+${hash}`,
      mirrorWebUrl: `https://telegram.me/+${hash}`,
      webClientUrl: webClientFallback
    };
  }

  // 2. Check for public usernames: e.g. @yourchannel, yourchannel, tg://resolve?domain=yourchannel, tg:resolve?domain=yourchannel
  let cleanHandle = raw
    .replace(/^tg:\/?\/?resolve\?domain=/i, '')
    .replace(/^https?:\/\/(www\.)?(t\.me|telegram\.me|telegram\.dog)\//i, '')
    .replace(/^(t\.me|telegram\.me|telegram\.dog)\//i, '')
    .replace(/^@/, '')
    .replace(/\/$/, '')
    .split('?')[0]
    .split('#')[0]
    .trim();

  // If handle contains non-handle characters like slashes, colons (or other protocols), it's not a handle
  if (!cleanHandle || cleanHandle.includes('/') || cleanHandle.includes(':') || cleanHandle.length > 64) {
    return null;
  }

  const webClientFallback = `https://web.telegram.org/k/#@${cleanHandle}`;
  return {
    isInvite: false,
    rawInput: raw,
    handleOrHash: cleanHandle,
    displayHandle: `@${cleanHandle}`,
    appUrl: `tg://resolve?domain=${cleanHandle}`,
    androidIntentUrl: `intent://resolve?domain=${cleanHandle}#Intent;scheme=tg;package=org.telegram.messenger;S.browser_fallback_url=${encodeURIComponent(webClientFallback)};end`,
    primaryWebUrl: `https://t.me/${cleanHandle}`,
    mirrorWebUrl: `https://telegram.me/${cleanHandle}`,
    webClientUrl: webClientFallback
  };
}

/**
 * Ensures any Telegram link has a safe, absolute HTTPS web URL (defaulting to telegram.me
 * which bypasses Bangladesh ISP blocks and handles Android Intent filters seamlessly).
 */
export function getSafeTelegramWebUrl(input?: string | null, fallback = ''): string {
  if (!input || !input.trim()) return fallback;
  const raw = input.trim();

  const parsed = parseTelegramInput(raw);
  if (parsed) {
    return parsed.mirrorWebUrl;
  }

  // If it's already an external HTTP/HTTPS URL, return it safely
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return fallback;
}

/**
 * Safely executes joining Telegram without website errors, iframe crashes, or WebView navigation aborts.
 * If running inside an Android WebView/Webapp, it triggers the safe in-app launcher modal
 * which completely avoids net::ERR_UNKNOWN_URL_SCHEME errors.
 */
export function executeTelegramJoin(input?: string | null, fallbackUrl = ''): void {
  const targetInput = (input || fallbackUrl || '').trim();
  if (!targetInput) return;

  // In Android WebViews, always open safe launcher modal to prevent WebView ERR_UNKNOWN_URL_SCHEME
  if (isAndroidWebView()) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open_telegram_launcher', { detail: { input: targetInput } }));
    }
    return;
  }

  const targetUrl = getSafeTelegramWebUrl(targetInput, fallbackUrl);
  if (!targetUrl) return;

  try {
    const newWindow = window.open(targetUrl, '_blank', 'noopener,noreferrer');
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      // If popup blocker intercepted or window.open failed, open safe launcher modal
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('open_telegram_launcher', { detail: { input: targetInput } }));
      }
    }
  } catch (e) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open_telegram_launcher', { detail: { input: targetInput } }));
    }
  }
}
