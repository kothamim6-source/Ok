import { useState, useEffect } from 'react';

export function useAdBlockDetector() {
  const [isAdblockDetected, setIsAdblockDetected] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const detectAdBlocker = async () => {
      let blocked = false;

      // 1. Fetch test (Network-based AdBlockers / Pi-hole / DNS blocking like AdGuard)
      try {
        await fetch('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
        });
      } catch (e) {
        blocked = true;
      }

      // 2. DOM Bait test (Extension-based AdBlockers like uBlock Origin)
      if (!blocked) {
        const bait = document.createElement('div');
        // Common ad-related classes that trigger adblockers
        bait.className = 'ad-banner adsbox doubleclick ad-placement carbon-ads ad-container sponsor-div';
        bait.style.position = 'absolute';
        bait.style.left = '-9999px';
        bait.style.height = '10px';
        bait.style.width = '10px';
        document.body.appendChild(bait);

        // Give it a tiny bit of time for extensions to act
        await new Promise((resolve) => setTimeout(resolve, 50));

        if (isMounted) {
          const styles = window.getComputedStyle(bait);
          if (
            styles.display === 'none' ||
            styles.visibility === 'hidden' ||
            bait.offsetHeight === 0 ||
            bait.clientHeight === 0
          ) {
            blocked = true;
          }
          if (document.body.contains(bait)) {
            document.body.removeChild(bait);
          }
        }
      }

      if (isMounted && blocked) {
        setIsAdblockDetected(true);
      }
    };

    // Run check initially
    detectAdBlocker();

    // Run check periodically to catch late-loading blockers
    const interval = setInterval(() => {
      if (!isAdblockDetected) {
        detectAdBlocker();
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAdblockDetected]);

  return isAdblockDetected;
}
