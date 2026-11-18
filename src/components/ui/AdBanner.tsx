import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { SiteSettings } from '../../types';
import { useEffect, useState, useMemo } from 'react';
import { isPrivilegedUser } from '../../lib/adminConfig';

interface AdBannerProps {
  placement: keyof NonNullable<SiteSettings['customAds']>;
  className?: string;
}

export function AdBanner({ placement, className = '' }: AdBannerProps) {
  const { settings } = useSettingsStore();
  const { user, isLoading } = useAuthStore();
  const [dynamicHeight, setDynamicHeight] = useState<number | null>(null);
  
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'ad-resize' && event.data.placement === placement) {
        const reportedHeight = parseInt(event.data.height, 10);
        if (!isNaN(reportedHeight) && reportedHeight > 0) {
          // Cap the maximum height to prevent layout blowout from overlays
          const cappedHeight = Math.min(reportedHeight, 800);
          setDynamicHeight(cappedHeight);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [placement]);

  if (isLoading) return null;
  if (!settings || !settings.adsEnabled || !settings.customAds) return null;
  
  // Hide ads for admins, moderators, and VIP users
  const isPrivileged = isPrivilegedUser(user, settings);
  if (isPrivileged) return null;
  
  // Check if placement is toggled off in admin settings
  if (settings.customAds.toggles && settings.customAds.toggles[placement] === false) {
    return null;
  }
  
  const rawAdHtml = settings.customAds[placement];
  if (typeof rawAdHtml !== 'string' || !rawAdHtml.trim()) return null;

  let initialHeight = 100;
  let defaultWidth = '100%';
  if (placement.includes('320x50')) { initialHeight = 50; defaultWidth = '320px'; }
  else if (placement.includes('468x60')) { initialHeight = 60; defaultWidth = '468px'; }
  else if (placement.includes('728x90')) { initialHeight = 90; defaultWidth = '728px'; }
  else if (placement.includes('300x250')) { initialHeight = 250; defaultWidth = '300px'; }
  else if (placement.includes('160x300')) { initialHeight = 300; defaultWidth = '160px'; }
  else if (placement.includes('160x600')) { initialHeight = 600; defaultWidth = '160px'; }
  else if (placement === 'nativeBanner') { initialHeight = 280; defaultWidth = '100%'; }

  const heightToUse = dynamicHeight !== null ? dynamicHeight : initialHeight;

  // Process ad HTML: for native banners, ensure container div exists before or with script
  let processedAdHtml = rawAdHtml;
  if (placement === 'nativeBanner') {
    const divMatch = rawAdHtml.match(/<div id="[^"]+"><\/div>/i);
    const scriptMatch = rawAdHtml.match(/<script[\s\S]*?<\/script>/i);
    if (divMatch && scriptMatch && rawAdHtml.indexOf('<script') < rawAdHtml.indexOf('<div')) {
      processedAdHtml = `${divMatch[0]}\n${scriptMatch[0]}`;
    }
  }

  // Build clean HTML document for srcdoc so Adsterra scripts execute in exact order
  const srcDocContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer-when-downgrade">
  <base target="_blank">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      min-height: 100%;
      background: transparent;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow-x: hidden;
    }
    #ad-wrapper {
      width: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <div id="ad-wrapper">
    ${processedAdHtml}
  </div>
  <script>
    function reportSize() {
      try {
        var wrapper = document.getElementById('ad-wrapper');
        var h = wrapper ? wrapper.scrollHeight : (document.body.scrollHeight || document.documentElement.scrollHeight);
        if (h && h > 20) {
          window.parent.postMessage({ type: 'ad-resize', height: h, placement: '${placement}' }, '*');
        }
      } catch(e) {}
    }
    window.addEventListener('load', reportSize);
    [200, 600, 1200, 2500, 5000].forEach(function(ms) { setTimeout(reportSize, ms); });
  </script>
</body>
</html>`;

  // Create hash to re-render if ad code changes
  let hash = 0;
  for (let i = 0; i < rawAdHtml.length; i++) {
    hash = ((hash << 5) - hash) + rawAdHtml.charCodeAt(i);
    hash |= 0;
  }

  return (
    <div 
      className={`w-full flex justify-center items-center overflow-hidden my-2 sm:my-3 ${className}`}
      style={{ minHeight: `${heightToUse}px`, transition: 'height 0.3s ease' }}
    >
      <iframe 
        key={`${placement}-${hash}`}
        srcDoc={srcDocContent}
        width={defaultWidth}
        height={heightToUse}
        frameBorder="0" 
        scrolling="no"
        loading="eager"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-top-navigation-by-user-activation"
        style={{ border: 'none', overflow: 'hidden', maxWidth: '100%' }}
        title={`Ad ${placement}`}
      />
    </div>
  );
}
