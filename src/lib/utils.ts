import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getVideoDuration = (url: string): Promise<string> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (!duration || !isFinite(duration)) {
        resolve('');
        return;
      }
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      resolve(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };
    
    video.onerror = () => {
      resolve('');
    };
    
    video.src = url;
  });
};

// Get current date string in BD timezone (UTC+6) in YYYY-MM-DD format
export function getBDDateString(date: number | Date = new Date()): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const bdTime = new Date(d.getTime() + (3600000 * 6));
  const year = bdTime.getUTCFullYear();
  const month = (bdTime.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = bdTime.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format a timestamp to BD locale string
export function formatBDTime(timestamp: number | Date): string {
  return new Date(timestamp).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });
}

// Ensure full-size, uncropped thumbnail image from Blogger / Google CDN
export function getFullThumbnailUrl(url: string | undefined | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Handle Blogger / Google User Content / Blogspot image URLs
  if (trimmed.includes('googleusercontent.com') || trimmed.includes('bp.blogspot.com')) {
    // Replace crop/resize markers like /s320/, /s72-c/, /w1200-h630-p-k-no-nu/, /s1600-c/ with /s1600/ for uncropped full image
    return trimmed
      .replace(/\/w[0-9]+-h[0-9]+-[^\/]+\//, '/s1600/')
      .replace(/\/s[0-9]+-c\//, '/s1600/')
      .replace(/\/s[0-9]+\//, '/s1600/');
  }

  return trimmed;
}

// Generate deterministic display views (adds a fake boost of 1k-5k to real views)
export function getDisplayViews(realViews: number, videoId: string): number {
  if (!videoId) return realViews || 0;
  
  // Create a simple hash from the video ID
  let hash = 0;
  for (let i = 0; i < videoId.length; i++) {
    hash = ((hash << 5) - hash) + videoId.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  
  // Math.abs to ensure positive, modulo 4000 to keep it in range, + 1200 as base
  const fakeBoost = (Math.abs(hash) % 4000) + 1200; 
  
  return (realViews || 0) + fakeBoost;
}
