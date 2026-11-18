import {StrictMode} from 'react';

// Safe cache clearing for returning users
try {
  if ('caches' in window) {
    caches.keys().then((names) => {
      for (const name of names) {
        caches.delete(name);
      }
    }).catch(() => {});
  }
} catch (e) {}

// Prevent pinch-to-zoom and gesture zooming across mobile browsers / WebViews
if (typeof window !== 'undefined') {
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

  // Prevent double-tap to zoom on iOS and mobile WebViews
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      // allow buttons/links normal tap, prevent double-tap zoom
      const target = e.target as HTMLElement | null;
      if (!target?.closest('input, textarea, select')) {
        e.preventDefault();
      }
    }
    lastTouchEnd = now;
  }, { passive: false });
}

// Safe version check for local storage
try {
  const APP_VERSION = '1.0.2';
  if (typeof window !== 'undefined' && window.localStorage) {
    if (localStorage.getItem('app_version') !== APP_VERSION) {
      const keysToKeep: { key: string; value: string | null }[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('firebase') || key.startsWith('auth'))) {
          keysToKeep.push({ key, value: localStorage.getItem(key) });
        }
      }
      localStorage.clear();
      sessionStorage.clear();
      keysToKeep.forEach(({ key, value }) => {
        if (value) localStorage.setItem(key, value);
      });
      localStorage.setItem('app_version', APP_VERSION);
    }
  }
} catch (e) {}

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ui/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
