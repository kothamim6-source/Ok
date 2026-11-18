import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { useLocation } from 'react-router-dom';
import { getSmartlinkUrl } from '../../lib/adUtils';
import { isPrivilegedUser } from '../../lib/adminConfig';

const extractScriptSrc = (htmlOrUrl?: string): string | null => {
  if (!htmlOrUrl) return null;
  const trimmed = htmlOrUrl.trim();
  if (/^https?:\/\/[^\s"'<>]+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/src=["'](https?:\/\/[^"']+)["']/i);
  return match ? match[1] : null;
};

const extractUrl = (raw?: string): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
  return match ? match[0] : null;
};

export function GlobalAds() {
  const { settings } = useSettingsStore();
  const { user, isLoading } = useAuthStore();
  const location = useLocation();
  const clickHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);

  useEffect(() => {
    if (isLoading) return;
    
    // Disable ads on auth pages
    if (location.pathname === '/login' || location.pathname === '/register') return;
    
    // Hide and remove ads for admins, moderators, and VIP users
    const isPrivileged = isPrivilegedUser(user, settings);
    if (isPrivileged) {
      document.getElementById('adsterra-popunder')?.remove();
      document.getElementById('adsterra-socialbar')?.remove();
      return;
    }

    if (!settings || !settings.adsEnabled || !settings.customAds) return;

    const { popunder, socialBar, smartlink, toggles } = settings.customAds;

    // Helper function to inject Adsterra script tag or inline code safely
    const injectAdsterraScript = (id: string, rawCode: string) => {
      if (document.getElementById(id)) return;
      
      const trimmed = rawCode.trim();
      const script = document.createElement('script');
      script.id = id;
      script.type = 'text/javascript';

      const src = extractScriptSrc(trimmed);
      if (src) {
        script.src = src;
        script.async = true;
        document.body.appendChild(script);
      } else {
        // If user pasted raw inline javascript code or <script>...</script> block
        const inlineCodeMatch = trimmed.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/i);
        const codeToRun = inlineCodeMatch ? inlineCodeMatch[1] : trimmed;
        if (codeToRun && !codeToRun.includes('<div') && !codeToRun.includes('<iframe')) {
          script.text = codeToRun;
          document.body.appendChild(script);
        }
      }
    };

    // 1. Inject Popunder (Adsterra's #1 CPM format)
    const isPopunderEnabled = toggles?.popunder !== false;
    if (isPopunderEnabled && popunder && popunder.trim()) {
      injectAdsterraScript('adsterra-popunder', popunder);
    } else if (!isPopunderEnabled) {
      document.getElementById('adsterra-popunder')?.remove();
    }

    // 2. Inject Social Bar (High CTR Push/Chat notification ads)
    const isSocialBarEnabled = toggles?.socialBar !== false;
    if (isSocialBarEnabled && socialBar && socialBar.trim()) {
      injectAdsterraScript('adsterra-socialbar', socialBar);
    } else if (!isSocialBarEnabled) {
      document.getElementById('adsterra-socialbar')?.remove();
    }

    // 3. High-Converting Smartlink Trigger (Direct Link)
    const smartlinkUrl = getSmartlinkUrl(settings);

    if (smartlinkUrl) {
      if (clickHandlerRef.current) {
        document.removeEventListener('click', clickHandlerRef.current, true);
      }

      const handleUserClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        // Do not trigger on admin controls, inputs, modal close buttons
        if (target?.closest('input, textarea, select, option, form, .admin-control, button[aria-label="Close"]')) {
          return;
        }

        const now = Date.now();
        const lastTrigger = parseInt(sessionStorage.getItem('ad_last_smartlink_click') || '0', 10);

        // 45 seconds frequency cap per session for balanced user retention and high revenue
        if (now - lastTrigger > 45000) {
          sessionStorage.setItem('ad_last_smartlink_click', now.toString());
          try {
            window.open(smartlinkUrl, '_blank');
          } catch (err) {
            // Popup blocker might intercept
          }
        }
      };

      document.addEventListener('click', handleUserClick, true);
      clickHandlerRef.current = handleUserClick;
    }

    // 4. Real-time AdBlocker Detection Telemetry
    try {
      const adCheckKey = 'adblock_checked_session';
      if (!sessionStorage.getItem(adCheckKey)) {
        sessionStorage.setItem(adCheckKey, 'true');
        
        // Create bait element commonly targeted by ad blockers (uBlock, AdBlock Plus)
        const bait = document.createElement('div');
        bait.className = 'adsbox ad-placement pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad text_ads text-ads text-ad-links';
        bait.style.cssText = 'height: 1px !important; width: 1px !important; position: absolute !important; left: -10000px !important; top: -1000px !important;';
        document.body.appendChild(bait);

        setTimeout(() => {
          const isBlocked = window.getComputedStyle(bait).display === 'none' || bait.offsetParent === null || bait.offsetHeight === 0;
          if (isBlocked) {
            const currBlocked = parseInt(localStorage.getItem('adblock_detected_count') || '0', 10);
            localStorage.setItem('adblock_detected_count', (currBlocked + 1).toString());
          } else {
            const currAllowed = parseInt(localStorage.getItem('adblock_allowed_count') || '0', 10);
            localStorage.setItem('adblock_allowed_count', (currAllowed + 1).toString());
          }
          bait.remove();
        }, 1500);
      }
    } catch (e) {}

    return () => {
      if (clickHandlerRef.current) {
        document.removeEventListener('click', clickHandlerRef.current, true);
        clickHandlerRef.current = null;
      }
    };
  }, [settings, user, isLoading, location.pathname]);

  return null;
}
