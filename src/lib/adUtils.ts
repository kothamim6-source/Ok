import { SiteSettings } from '../types';

/**
 * Universal ad URL extractor that parses raw URLs, HTML anchor tags (<a href="...">),
 * script tags (<script src="...">), or iframe tags to extract the pure destination URL.
 */
export function extractAdUrl(text?: string | null): string | null {
  if (!text) return null;
  const clean = text.trim();
  if (!clean) return null;

  // 1. Direct HTTP/HTTPS URL
  if (/^https?:\/\/[^\s"'<>]+$/i.test(clean)) {
    return clean;
  }

  // 2. URL inside href="..." or src="..."
  const attrMatch = clean.match(/(?:href|src)=["']([^"']+)["']/i);
  if (attrMatch && attrMatch[1]) {
    let url = attrMatch[1].trim();
    if (url.startsWith('//')) url = 'https:' + url;
    return url;
  }

  // 3. Fallback: Any http(s) URL inside HTML/JavaScript code
  const urlMatch = clean.match(/https?:\/\/[^\s"'<>]+/i);
  if (urlMatch && urlMatch[0]) {
    return urlMatch[0].trim();
  }

  return null;
}

/**
 * Retrieves the global Smartlink URL configured in the Admin Panel (Settings -> Advertisements).
 * Checks both `customAds.smartlink` and `customAds.premiumUnlockLink`.
 * Returns the sanitized, direct URL ready for navigation.
 */
export function getSmartlinkUrl(settings?: SiteSettings | null): string | null {
  if (!settings?.customAds) return null;

  // Check if smartlink toggle is explicitly disabled
  const toggles = settings.customAds.toggles;
  if (toggles && toggles.smartlink === false) {
    return null;
  }

  const raw = settings.customAds.smartlink || settings.customAds.premiumUnlockLink;
  return extractAdUrl(raw);
}

/**
 * Safely opens a smartlink in a new tab without getting blocked by mobile popup blockers.
 * If window.open is blocked, falls back to location navigation.
 */
export function openSmartlink(url?: string | null): void {
  if (!url) return;
  try {
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened || opened.closed || typeof opened.closed === 'undefined') {
      window.location.href = url;
    }
  } catch (e) {
    window.location.href = url;
  }
}
