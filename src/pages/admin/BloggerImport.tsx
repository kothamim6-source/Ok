import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { tryAcquireTelegramLock, markTelegramLocked } from '../../lib/telegramDeduplication';

import { Upload, Link as LinkIcon, RefreshCw, CheckCircle, Search, AlertCircle, X, Clipboard, Trash2, ExternalLink, Send, Layers, AlertTriangle } from 'lucide-react';
import { Category } from '../../types';
import { useSettingsStore } from '../../store/settingsStore';
import { getFullThumbnailUrl } from '../../lib/utils';
import { cleanAndDecodeBloggerText } from '../../lib/textUtils';
import {
  TelegramSecretsConfig,
  fetchTelegramSecretsConfig,
  resolveTargetChannels,
  postVideoToTelegramChannels,
  getChannelForCategory,
  normalizeTelegramChatId
} from '../../lib/telegramChannelService';

export function BloggerImport() {
  const { settings } = useSettingsStore();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [scrapedData, setScrapedData] = useState<{title: string, description?: string, caption?: string, images: string[], videos: string[]} | null>(null);
  const [error, setError] = useState('');
  
  // Form State
  const [title, setTitle] = useState('');
  const [keepManualDescription, setKeepManualDescription] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('blogger_keep_manual_desc');
      return saved !== null ? saved === 'true' : true;
    } catch (e) {
      return true;
    }
  });
  const [manualTemplateDescription, setManualTemplateDescription] = useState<string>(() => {
    try {
      return localStorage.getItem('blogger_manual_desc_template') || '';
    } catch (e) {
      return '';
    }
  });
  const [description, setDescription] = useState<string>(() => {
    try {
      return localStorage.getItem('blogger_manual_desc_template') || '';
    } catch (e) {
      return '';
    }
  });
  const [defaultWebsiteDescription, setDefaultWebsiteDescription] = useState('');
  const [scrapedCaption, setScrapedCaption] = useState('');
  const [telegramDescription, setTelegramDescription] = useState('');
  const [defaultTelegramDescription, setDefaultTelegramDescription] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [addToBanner, setAddToBanner] = useState(false);
  const [order, setOrder] = useState<number | ''>('');
  const [isTrending, setIsTrending] = useState(false);
  const [skipTelegram, setSkipTelegram] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  
  const [customThumbnailUrl, setCustomThumbnailUrl] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [tgSecrets, setTgSecrets] = useState<TelegramSecretsConfig | null>(null);
  const [tgChannelOverride, setTgChannelOverride] = useState<string>(() => {
    try {
      return localStorage.getItem('blogger_tg_channel_override') || '__AUTO__';
    } catch {
      return '__AUTO__';
    }
  });
  const [postToAllCategories, setPostToAllCategories] = useState(false);
  const [tgPostReport, setTgPostReport] = useState<{ succeeded: string[]; failed: Array<{ channel: string; error: string }> } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSelectTgChannelOverride = (val: string) => {
    setTgChannelOverride(val);
    try {
      localStorage.setItem('blogger_tg_channel_override', val);
    } catch {}
  };

  useEffect(() => {
    async function fetchCategoriesAndDefaults() {
      try {
        const { data, error } = await supabase.from('categories').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        const cats = (data || []).map(c => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          image: c.image,
          status: c.status,
          order: c.order
        })) as Category[];
        setCategories(cats);
        if (cats.length > 0) setCategory(cats[0].name);
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      }

      // 1. Load Website Default Description (ONLY for website video description)
      try {
        let webDefault = settings?.defaultVideoDescription || '';
        if (!webDefault) {
          const { data: genData } = await supabase.from('settings').select('*').eq('id', 'general').single();
          if (genData?.data?.defaultVideoDescription) {
            webDefault = genData.data.defaultVideoDescription;
          }
        }
        if (webDefault) {
          setDefaultWebsiteDescription(webDefault);
          setDescription(prev => {
            const saved = typeof window !== 'undefined' ? localStorage.getItem('blogger_manual_desc_template') : null;
            return saved || prev || webDefault;
          });
        }
      } catch (defErr) {
        console.warn("Could not load website default description", defErr);
      }

      // 2. Load Telegram Auto-Post Secrets & Category Channel Mappings
      try {
        const secretsConfig = await fetchTelegramSecretsConfig();
        setTgSecrets(secretsConfig);
        if (secretsConfig.defaultDescription) {
          setDefaultTelegramDescription(secretsConfig.defaultDescription);
          setTelegramDescription(secretsConfig.defaultDescription);
        }
      } catch (tgErr) {
        console.warn("Could not load telegram secrets config", tgErr);
      }
    }
    fetchCategoriesAndDefaults();
  }, [settings?.defaultVideoDescription]);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsLoading(true);
    setError('');
    setScrapedData(null);
    setSuccess('');
    setTgPostReport(null);

    try {
      let targetUrl = url.trim();
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      const extractTitleFromUrl = (rawUrl: string): string => {
        try {
          const parsed = new URL(rawUrl);
          const parts = parsed.pathname.split('/').filter(Boolean);
          const lastPart = parts[parts.length - 1] || '';
          const rawSlug = lastPart.replace(/\.html?$/i, '').replace(/[-_+]+/g, ' ').trim();
          const cleanSlug = decodeURIComponent(rawSlug);
          if (cleanSlug && cleanSlug.length > 2) {
            return cleanSlug.replace(/\b\w/g, c => c.toUpperCase());
          }
        } catch (e) {}
        return '';
      };

      const fetchWithTimeout = async (url: string, timeout = 10000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(id);
          return res;
        } catch (error) {
          clearTimeout(id);
          throw error;
        }
      };

      // 1. Try local backend first (Fastest & avoids CORS/CAPTCHA blocks by using Node.js fetch or PHP)
      let backendSuccess = false;
      try {
        let backendRes = await fetch('/api/scrape-blogger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetUrl })
        });
        
        // Fallback for Apache/InfinityFree if /api/ wasn't rewritten
        if (!backendRes.ok && (backendRes.status === 404 || backendRes.status === 405)) {
          try {
            const phpRes = await fetch('/scrape-blogger.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: targetUrl })
            });
            if (phpRes.ok) {
              backendRes = phpRes;
            }
          } catch (e) {}
        }
        
        if (backendRes.ok) {
          const data = await backendRes.json();
          const hasVideos = data.videos && data.videos.length > 0;
          
          if (data.title || hasVideos || data.caption || data.description) {
            setScrapedData(data);
            
            // Extract title robustly
            let extractedTitle = cleanAndDecodeBloggerText(data.title || '');
            const isInvalidTitle = !extractedTitle || 
              extractedTitle.toLowerCase().includes('sensitive content') || 
              extractedTitle.toLowerCase() === 'blogger' || 
              extractedTitle.toLowerCase() === 'untitled' ||
              extractedTitle.toLowerCase() === 'new viral video' ||
              extractedTitle.trim().length < 3;
            if (isInvalidTitle) {
              const fromUrl = extractTitleFromUrl(targetUrl);
              if (fromUrl) extractedTitle = cleanAndDecodeBloggerText(fromUrl);
            }
            // If no valid title extracted, set category as title!
            const finalScrapedTitle = (extractedTitle && !isInvalidTitle) ? extractedTitle : (category || 'New Video');
            setTitle(cleanAndDecodeBloggerText(finalScrapedTitle));

            // Website Description / Caption handling:
            const rawCaption = data.caption || data.description || '';
            const postCaption = cleanAndDecodeBloggerText(rawCaption);
            if (postCaption) {
              setScrapedCaption(postCaption);
              if (keepManualDescription) {
                const template = manualTemplateDescription || description || defaultWebsiteDescription;
                if (template && template.trim()) {
                  if (!template.includes(postCaption)) {
                    setDescription(`${postCaption}\n\n${template.trim()}`);
                  }
                } else {
                  setDescription(postCaption);
                }
              } else {
                setDescription(postCaption);
              }
            } else if (keepManualDescription) {
              if (!description || !description.trim()) {
                setDescription(manualTemplateDescription || cleanAndDecodeBloggerText(defaultWebsiteDescription));
              }
            } else if (defaultWebsiteDescription && !description) {
              setDescription(cleanAndDecodeBloggerText(defaultWebsiteDescription));
            }

            if (data.images && data.images.length > 0) setSelectedImages([data.images[0]]);
            if (hasVideos) setSelectedVideos(data.videos);
            backendSuccess = true;
          }
        }
      } catch (backendError) {
        console.warn("Backend scraping failed, falling back to client-side", backendError);
      }

      if (!backendSuccess) {
          // Client-Side Proxies (Parallel Fetch for Speed)
          let html = '';

          const fetchHtml = async (proxyUrl: string): Promise<string> => {
            const res = await fetchWithTimeout(proxyUrl, 10000);
            if (!res.ok) throw new Error('Not OK');
            
            const checkHtmlForErrors = (htmlText: string) => {
                if (htmlText.includes('id="captcha-form"') || 
                    htmlText.includes('<title>Sorry...</title>') || 
                    htmlText.includes('Checking your browser before accessing') || 
                    htmlText.includes('Attention Required! | Cloudflare') ||
                    htmlText.includes('I UNDERSTAND AND I WISH TO CONTINUE') ||
                    htmlText.includes('Sensitive Content Warning')) {
                  throw new Error('CAPTCHA, Block page, or Sensitive Warning detected');
                }
            };
            
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const data = await res.json();
              if (data.contents && data.contents.includes('<html')) {
                const htmlText = data.contents;
                checkHtmlForErrors(htmlText);
                return htmlText;
              }
            } else {
              const text = await res.text();
              if (text.includes('<html')) {
                checkHtmlForErrors(text);
                return text;
              }
            }
            throw new Error('No HTML found');
          };

          const encodedUrl = encodeURIComponent(targetUrl);
          let feedHtml = null;

          // 1. If it's a Blogger URL, try fetching its JSONP feed first to bypass all warnings, CORS, and proxies
          if (targetUrl.includes('blogspot.com') || targetUrl.includes('blogger.com')) {
              try {
                  const urlObj = new URL(targetUrl);
                  
                  feedHtml = await new Promise((resolve, reject) => {
                      const callbackName = 'bloggerCallback_' + Math.round(1000000 * Math.random());
                      
                      const timeoutId = setTimeout(() => {
                          delete (window as any)[callbackName];
                          reject(new Error('JSONP Timeout'));
                      }, 10000);

                      (window as any)[callbackName] = (data: any) => {
                          clearTimeout(timeoutId);
                          delete (window as any)[callbackName];
                          if (data && data.feed && data.feed.entry && data.feed.entry.length > 0) {
                              const entry = data.feed.entry[0];
                              const htmlContent = entry.content ? entry.content.$t : (entry.summary ? entry.summary.$t : '');
                              const entryTitle = cleanAndDecodeBloggerText(entry.title ? entry.title.$t : '');
                              const entrySummary = cleanAndDecodeBloggerText(entry.summary ? entry.summary.$t : '');
                              resolve(`<html><head><title>${entryTitle}</title><meta property="og:title" content="${entryTitle}" /><meta name="description" content="${entrySummary}" /></head><body><h1 class="post-title">${entryTitle}</h1>${htmlContent}</body></html>`);
                          } else {
                              reject(new Error('No entries found'));
                          }
                      };

                      const script = document.createElement('script');
                      script.src = `https://${urlObj.hostname}/feeds/posts/default?alt=json-in-script&callback=${callbackName}&path=${urlObj.pathname}`;
                      script.onerror = () => {
                          clearTimeout(timeoutId);
                          delete (window as any)[callbackName];
                          reject(new Error('JSONP script load failed'));
                      };
                      document.body.appendChild(script);
                      script.onload = () => {
                          try { document.body.removeChild(script); } catch (e) {}
                      };
                  });
              } catch (e) {
                  console.warn("Failed to fetch Blogger JSONP feed, falling back to HTML fetch...", e);
              }
          }

          if (feedHtml) {
              html = feedHtml;
          } else {
              // 2. Standard HTML fetch fallback
              try {
                 html = await fetchHtml(`/proxy.php?url=${encodedUrl}`);
              } catch (internalErr) {
                 console.warn("Internal proxy failed, trying public proxies...");
                 const promises = [
                   fetchHtml(`https://api.allorigins.win/get?url=${encodedUrl}`),
                   fetchHtml(`https://api.allorigins.win/raw?url=${encodedUrl}`),
                   fetchHtml(`https://api.codetabs.com/v1/proxy/?quest=${encodedUrl}`),
                   fetchHtml(`https://corsproxy.io/?${encodedUrl}`),
                   fetchHtml(`https://thingproxy.freeboard.io/fetch/${targetUrl}`)
                 ];
                 try {
                   html = await Promise.any(promises);
                 } catch (e) {
                   throw new Error('Could not fetch the URL. Blogger might be blocking our proxies (Sensitive Content/CAPTCHA).');
                 }
              }
          }

          // Parse HTML in the browser
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          
          let parsedTitle = doc.querySelector('.post-title, .entry-title, h1.post-title, h2.post-title, h3.post-title, article h1, .post h1, h1.entry-title, h2.entry-title, h3.entry-title, header.entry-header h1, header.entry-header h2, .blog-post-title, h1.title, h2.title, h3.title, .post_title, .post-header h1, [itemprop="headline"], [itemprop="name"], .post-heading, .entry-header h1, .post-body h1, .post-body h2, .post-body h3')?.textContent?.trim() ||
            doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ||
            doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content')?.trim() ||
            doc.querySelector('meta[name="title"]')?.getAttribute('content')?.trim() ||
            doc.querySelector('meta[name="sailthru.title"]')?.getAttribute('content')?.trim() ||
            (doc.title ? doc.title.replace(/\s*-\s*Blogger\s*$/i, '').replace(/\s*\|\s*Blogger\s*$/i, '').replace(/^(Blogger:\s*)/i, '').trim() : '');

          const isInvalidParsedTitle = !parsedTitle || 
            parsedTitle.toLowerCase().includes('sensitive content') || 
            parsedTitle.toLowerCase() === 'blogger' || 
            parsedTitle.toLowerCase() === 'unknown title' || 
            parsedTitle.toLowerCase() === 'untitled' ||
            parsedTitle.toLowerCase() === 'new viral video' ||
            parsedTitle.trim().length < 3;

          if (isInvalidParsedTitle) {
            const fromUrl = extractTitleFromUrl(targetUrl);
            if (fromUrl) parsedTitle = fromUrl;
          }

          if (!parsedTitle || isInvalidParsedTitle) {
            parsedTitle = category || 'New Video';
          }

          // Extract caption / description
          let parsedDescription = '';
          const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() || '';
          const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
          const twitterDesc = doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content')?.trim() || '';

          const images: string[] = [];
          const videos: string[] = [];

          // 1. Determine strictly isolated main post body FIRST before removing any global containers
          let content = doc.querySelector('.post-body, .entry-content, [itemprop="articleBody"]') as HTMLElement;
          if (!content) {
            content = doc.querySelector('.post, article.post, article') as HTMLElement;
          }
          if (!content) {
            content = doc.querySelector('#main-content, #content, main') as HTMLElement;
          }
          if (!content) {
            content = doc.body;
          }
          
          // Remove residual inner elements strictly inside content
          content.querySelectorAll('.related-posts, #related-posts, .popular-posts, .sidebar, .comments, #comments, .post-footer, .share-buttons, .item-control, .post-share').forEach(el => el.remove());

          // 1b. Check dedicated Blogger captions (.tr-caption, td.tr-caption, figcaption, .caption)
          const dedicatedCaptions: string[] = [];
          content.querySelectorAll('.tr-caption, figcaption, .caption, [itemprop="caption"], .tr-caption-container td, .image-caption').forEach(el => {
            const cText = cleanAndDecodeBloggerText(el.textContent || '');
            if (cText && cText.length > 2 && !dedicatedCaptions.includes(cText)) {
              dedicatedCaptions.push(cText);
            }
          });

          // Extract text paragraphs from content (ignoring scripts, controls, buttons)
          if (content) {
            const contentClone = content.cloneNode(true) as HTMLElement;
            contentClone.querySelectorAll('script, style, iframe, video, audio, embed, object, noscript, .related-posts, #related-posts, .sidebar, .comments, #comments, .post-footer, .share-buttons, .widget, .item-control, .post-share, button, .play-button, .video-lock').forEach(el => el.remove());
            
            const paragraphs: string[] = [];
            contentClone.querySelectorAll('p, div, blockquote, span, h2, h3, h4, td').forEach(el => {
              const cloneEl = el.cloneNode(true) as HTMLElement;
              cloneEl.querySelectorAll('div, p, ul, ol').forEach(nested => nested.remove());
              const line = cleanAndDecodeBloggerText(cloneEl.textContent || '');
              if (
                line &&
                line.length > 2 &&
                !line.startsWith('http://') &&
                !line.startsWith('https://') &&
                !line.toLowerCase().includes('click here') &&
                !line.toLowerCase().includes('watch online') &&
                !paragraphs.includes(line)
              ) {
                paragraphs.push(line);
              }
            });

            let bodyText = paragraphs.join('\n\n').trim();
            if (!bodyText || bodyText.length < 5) {
              const fallbackText = cleanAndDecodeBloggerText(
                (contentClone.textContent || '')
                  .split('\n')
                  .map(l => l.trim())
                  .filter(l => l.length > 3 && !l.startsWith('http'))
                  .join('\n')
                  .replace(/\n{3,}/g, '\n\n')
                  .trim()
              );
              if (fallbackText && fallbackText.length > 5) {
                bodyText = fallbackText;
              }
            }

            const captionHeader = dedicatedCaptions.join('\n\n').trim();
            if (captionHeader) {
              parsedDescription = captionHeader + (bodyText && !bodyText.includes(captionHeader) ? '\n\n' + bodyText : '');
            } else if (bodyText) {
              parsedDescription = bodyText;
            }
          }

          if (!parsedDescription || parsedDescription.length < 5) {
            if (ogDesc && !ogDesc.toLowerCase().includes('blogger')) {
              parsedDescription = cleanAndDecodeBloggerText(ogDesc);
            } else if (metaDesc && !metaDesc.toLowerCase().includes('blogger')) {
              parsedDescription = cleanAndDecodeBloggerText(metaDesc);
            } else if (twitterDesc) {
              parsedDescription = cleanAndDecodeBloggerText(twitterDesc);
            }
          }

          parsedDescription = cleanAndDecodeBloggerText(parsedDescription);
          parsedTitle = cleanAndDecodeBloggerText(parsedTitle);

          // Extract images (restricted to content to avoid remaining sidebar noise)
          // First check for og:image or twitter:image for best quality thumbnails
          const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
          if (ogImage && ogImage.startsWith('http')) {
            images.push(ogImage);
          }
          const twitterImage = doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
          if (twitterImage && twitterImage.startsWith('http') && twitterImage !== ogImage) {
            images.push(twitterImage);
          }

          content.querySelectorAll('img').forEach((el) => {
            const src = el.getAttribute('data-src') || el.getAttribute('data-original-url') || el.getAttribute('src');
            if (src && src.startsWith('http') && !src.includes('data:image')) {
              images.push(src);
            }
          });
          
          // Look for poster attributes in the whole document since video might be outside content
          doc.querySelectorAll('video').forEach((el) => {
            const poster = el.getAttribute('poster');
            if (poster && poster.startsWith('http')) {
              images.push(poster);
            }
          });
          
          doc.querySelectorAll('[data-poster]').forEach((el) => {
            const poster = el.getAttribute('data-poster');
            if (poster && poster.startsWith('http')) {
              images.push(poster);
            }
          });
          
          // Extract videos using aggressive Regex on the content HTML to catch hidden ones
          const contentHtml = content.innerHTML || '';
          
          const videoRegex = /https?:\/\/(?:www\.|draft\.)?(?:blogger\.com\/video\.g\?[^"'\s<>&]+|mega\.nz\/[^\s"'<>&]+|mega\.co\.nz\/[^\s"'<>&]+|terabox\.com\/[^\s"'<>&]+|teraboxapp\.com\/[^\s"'<>&]+|1024tera\.com\/[^\s"'<>&]+|1024terabox\.com\/[^\s"'<>&]+|terabox\.app\/[^\s"'<>&]+|terasharelink\.com\/[^\s"'<>&]+|drive\.google\.com\/file\/d\/[^\s"'<>&]+)[^\s"'<>&]*/gi;
          const regexMatches = contentHtml.match(videoRegex) || [];
          videos.push(...regexMatches);
          
          const mp4Regex = /https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/gi;
          const mp4Matches = contentHtml.match(mp4Regex) || [];
          videos.push(...mp4Matches);

          // Extract videos
          content.querySelectorAll('iframe, video, source, embed, object').forEach(el => {
            let src = el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data');
            if (src) {
              if (src.startsWith('//')) src = 'https:' + src;
              if (src.startsWith('http')) {
                const lower = src.toLowerCase();
                if (
                  lower.includes('blogger.com/video') || 
                  lower.endsWith('.mp4') ||
                  lower.includes('mega.nz') ||
                  lower.includes('mega.co.nz') ||
                  lower.includes('terabox') ||
                  lower.includes('1024tera') ||
                  lower.includes('terasharelink') ||
                  lower.includes('drive.google.com')
                ) {
                   videos.push(src);
                }
              }
            }
          });
          
          content.querySelectorAll('a').forEach(el => {
            let href = el.getAttribute('href');
            if (href) {
              if (href.startsWith('//')) href = 'https:' + href;
              if (href.startsWith('http')) {
                const lower = href.toLowerCase();
                
                // EXTRACT DIRECTLY FROM TEXT (if blogger hid a mega link inside a tinyurl button text)
                const linkText = el.textContent || '';
                const extractedMatches = linkText.match(/https?:\/\/(mega\.nz|mega\.co\.nz|terabox\.com|teraboxapp\.com|1024tera\.com|drive\.google\.com)[^\s"']+/gi);
                
                if (extractedMatches && extractedMatches.length > 0) {
                    videos.push(extractedMatches[0]);
                    return; // Stop checking this element, we got the real link
                }
                
                // STRICT FILTERING: Only accept actual video hosting providers
                if (
                  lower.includes('blogger.com/video') || 
                  lower.endsWith('.mp4') ||
                  lower.includes('mega.nz') ||
                  lower.includes('mega.co.nz') ||
                  lower.includes('terabox') ||
                  lower.includes('1024tera') ||
                  lower.includes('terasharelink') ||
                  lower.includes('drive.google.com')
                ) {
                  videos.push(href);
                }
              }
            }
          });
          
          // Clean and deduplicate arrays
          const uniqueImages = Array.from(new Set(images.map(img => getFullThumbnailUrl(img)))).filter(img => {
             const lower = img.toLowerCase();
             return !lower.includes('gravatar.com') && 
                    !lower.match(/(icon|avatar|logo|spinner|loader|blank\.gif|px\.gif)/) && 
                    img.length > 20;
          });
          // Resolve any URL shorteners (like tinyurl, freemasala, redirectors)
          // Since we can't easily do deep HTTP redirects client-side due to CORS, 
          // we should at least clean up the videos array by keeping the most likely mega/terabox links
          let finalVideos = videos.map(v => v.replace(/["'>\)]+$/, ''));
          
          let uniqueVideos = Array.from(new Set(finalVideos)).filter(v => {
             const lower = v.toLowerCase();
             
             // ONLY KEEP DIRECT VIDEO PROVIDERS
             if (lower.includes('mega.nz') || lower.includes('mega.co.nz')) return true;
             if (lower.includes('terabox') || lower.includes('1024tera') || lower.includes('terasharelink')) return true;
             if (lower.includes('drive.google.com')) return true;
             if (lower.endsWith('.mp4') || lower.includes('.mp4?')) return true;
             if (lower.includes('blogger.com/video')) return true;
             
             // Reject everything else (shortlinks, youtube, social media, junk)
             return false;
          });
          
          // FALLBACK: If NO video was found on this page, maybe it's a redirect "Play Button" page.
          if (uniqueVideos.length === 0) {
            let redirectUrl = '';
            content.querySelectorAll('.video-lock a.play-button, .msg-box a, a.play-button').forEach(el => {
              let href = el.getAttribute('href');
              if (href && href.includes('blogspot.com/') && href.includes('blog-post_') && !href.includes(targetUrl)) {
                redirectUrl = href;
              }
            });
            
            if (!redirectUrl) {
              content.querySelectorAll('a').forEach(el => {
                let href = el.getAttribute('href');
                if (href && href.includes('blogspot.com/') && href.includes('blog-post_') && !href.includes(targetUrl)) {
                  redirectUrl = href;
                }
              });
            }
            
            if (redirectUrl) {
              console.log("Scraping nested redirect link:", redirectUrl);
              try {
                const fetchRes = await fetchHtml(`/proxy.php?url=${encodeURIComponent(redirectUrl)}`).catch(() => 
                    fetchHtml(`https://api.allorigins.win/get?url=${encodeURIComponent(redirectUrl)}`)
                );
                
                const nestedDoc = parser.parseFromString(fetchRes, 'text/html');
                const nestedHtml = nestedDoc.body.innerHTML || '';
                const videoRegex = /https?:\/\/(?:www\.)?(?:blogger\.com\/video\.g\?[^"'\s<>&]+|mega\.nz\/[^\s"'<>&]+|mega\.co\.nz\/[^\s"'<>&]+|terabox\.com\/[^\s"'<>&]+|teraboxapp\.com\/[^\s"'<>&]+|1024tera\.com\/[^\s"'<>&]+|drive\.google\.com\/file\/d\/[^\s"'<>&]+)[^\s"'<>&]*/gi;
                const mp4Regex = /https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/gi;
                
                let nestedVideos: string[] = [];
                nestedVideos.push(...(nestedHtml.match(videoRegex) || []));
                nestedVideos.push(...(nestedHtml.match(mp4Regex) || []));
                
                const cleanNestedVideos = Array.from(new Set(nestedVideos.map(v => v.replace(/["'>\)]+$/, ''))));
                uniqueVideos = cleanNestedVideos;
              } catch(e) {
                console.warn("Failed fetching nested link", e);
              }
            }
          }

          // Strict sorting and final validation
          uniqueVideos.sort((a, b) => {
             const getScore = (url) => {
                 const l = url.toLowerCase();
                 if (l.includes('mega.nz') || l.includes('mega.co.nz')) return 100;
                 if (l.includes('terabox') || l.includes('1024tera.com')) return 90;
                 if (l.includes('drive.google.com')) return 80;
                 if (l.endsWith('.mp4') || l.includes('.mp4?')) return 100;
                 if (l.includes('blogger.com/video')) return 60;
                 return 0; 
             };
             return getScore(b) - getScore(a);
          });


          setScrapedData({
            title: parsedTitle,
            description: parsedDescription,
            caption: parsedDescription,
            images: uniqueImages,
            videos: uniqueVideos
          });
          
          // Auto-fill forms
          setTitle(cleanAndDecodeBloggerText(parsedTitle || category || 'New Video'));
          if (parsedDescription) {
            setScrapedCaption(parsedDescription);
            if (keepManualDescription) {
              const template = manualTemplateDescription || description || defaultWebsiteDescription;
              if (template && template.trim()) {
                if (!template.includes(parsedDescription)) {
                  setDescription(`${parsedDescription}\n\n${template.trim()}`);
                }
              } else {
                setDescription(parsedDescription);
              }
            } else {
              setDescription(parsedDescription);
            }
          } else if (keepManualDescription) {
            if (!description || !description.trim()) {
              setDescription(manualTemplateDescription || cleanAndDecodeBloggerText(defaultWebsiteDescription));
            }
          } else if (defaultWebsiteDescription && !description) {
            setDescription(cleanAndDecodeBloggerText(defaultWebsiteDescription));
          }
          if (uniqueImages.length > 0) setSelectedImages([uniqueImages[0]]);
          if (uniqueVideos.length > 0) setSelectedVideos(uniqueVideos);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during scraping. The URL might be blocking access.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleImageSelection = (imgUrl: string) => {
    if (selectedImages.includes(imgUrl)) {
      setSelectedImages(selectedImages.filter(img => img !== imgUrl));
    } else {
      setSelectedImages([...selectedImages, imgUrl]);
    }
  };

  const toggleVideoSelection = (videoUrl: string) => {
    if (selectedVideos.includes(videoUrl)) {
      setSelectedVideos(selectedVideos.filter(v => v !== videoUrl));
    } else {
      setSelectedVideos([...selectedVideos, videoUrl]);
    }
  };

  const handleCategoryChange = (newCat: string) => {
    const oldCat = category;
    setCategory(newCat);
    // If title was empty or matched the old category or default placeholder, update to new category
    if (!title.trim() || title === oldCat || title === 'New Viral Video' || title === 'New Video') {
      setTitle(newCat);
    }
  };

  const handleUpload = async () => {
    const effectiveCategoryValue = (postToAllCategories && categories.length > 0)
      ? categories.map(c => c.name).join(', ')
      : category;

    // If no title is given, use the selected category as title
    const effectiveTitle = (title && title.trim())
      ? title.trim()
      : (category ? category.trim() : (categories[0]?.name || 'New Video'));

    const finalThumb = getFullThumbnailUrl(customThumbnailUrl || (selectedImages.length > 0 ? selectedImages[0] : settings?.defaultThumbnailUrl));

    if ((!customThumbnailUrl && selectedImages.length === 0 && !settings?.defaultThumbnailUrl) || selectedVideos.length === 0) {
      setError('Please select a thumbnail (or set a default in Settings), and select at least one video.');
      return;
    }

    if (!finalThumb) {
      setError('Please select a thumbnail (or set a default in Settings).');
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccess('');
    setTgPostReport(null);

    try {
      const cleanSlugBase = effectiveTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'video';
      const slug = `${cleanSlugBase}-${Math.floor(Math.random() * 1000)}`;

      // Create video parts from selected videos
      const parts = selectedVideos.map((vidUrl, index) => ({
        id: Date.now().toString() + index,
        title: `Part ${index + 1}`,
        videoUrl: vidUrl,
        duration: ''
      }));

      const newVideoRef = { id: slug };
      
      const effectiveDescription = (description && description.trim()) 
        ? cleanAndDecodeBloggerText(description.trim()) 
        : (defaultWebsiteDescription ? cleanAndDecodeBloggerText(defaultWebsiteDescription.trim()) : '');

      const videoInsertData: any = {
        id: slug,
        title: effectiveTitle,
        slug,
        description: effectiveDescription,
        thumbnail_url: finalThumb,
        video_url: parts.length > 1 ? JSON.stringify(parts) : selectedVideos[0],
        duration: '',
        is_premium: isPremium,
        category_id: effectiveCategoryValue,
        views: 0,
        likes: 0,
        visibility: 'public',
        is_trending: isTrending,
        created_at: scheduledTime ? new Date(`${scheduledTime}:00+06:00`).getTime() : Date.now(),
        status: scheduledTime ? 'scheduled' : 'published',
      };

      let res = await supabase.from('videos').insert([videoInsertData]);
      
      if (res.error && (res.error.message.includes('thumbnail_url') || res.error.message.includes('category_id'))) {
        res = await supabase.from('videos').insert([{
          id: slug,
          title: effectiveTitle,
          slug,
          description: effectiveDescription,
          thumbnailUrl: finalThumb,
          videoUrl: parts.length > 1 ? JSON.stringify(parts) : selectedVideos[0],
          duration: '',
          isPremium: isPremium,
          category: effectiveCategoryValue,
          views: 0,
          likes: 0,
          visibility: 'public',
          is_trending: isTrending,
          createdAt: scheduledTime ? new Date(`${scheduledTime}:00+06:00`).getTime() : Date.now(),
          status: scheduledTime ? 'scheduled' : 'published'
        }]);
      }

      const videoError = res.error;
      if (videoError) {
        console.error("Insert Video Error:", videoError);
        throw videoError;
      }

      if (addToBanner) {
        const id = crypto.randomUUID();
        let res = await supabase.from('banners').insert([{
          id,
          title: effectiveTitle,
          imageUrl: finalThumb,
          linkUrl: `/video/${slug}`,
          isActive: true,
          isPremium: isPremium,
          order: order === '' ? 0 : Number(order),
          createdAt: Date.now()
        }]);
        
        if (res.error && (res.error.message.includes('imageUrl') || res.error.message.includes('isActive') || res.error.code === 'PGRST204')) {
           res = await supabase.from('banners').insert([{
            id,
            title: effectiveTitle,
            image_url: finalThumb,
            link_url: `/video/${slug}`,
            is_active: true,
            is_premium: isPremium,
            order: order === '' ? 0 : Number(order),
            created_at: Date.now()
          }]);
        }
      }

      // Automatically post to Telegram (only if not scheduled)
      if (!skipTelegram && !scheduledTime) {
        const lockKey = `video_${newVideoRef.id}`;
        try {
          const acquired = await tryAcquireTelegramLock(lockKey);
          if (!acquired) {
            console.log(`[BloggerImport] Telegram post already sent or locked for video ${newVideoRef.id}`);
          } else {
            const videoLink = `${window.location.origin}/video/${newVideoRef.id}`;
            const latestSecrets = await fetchTelegramSecretsConfig();
            setTgSecrets(latestSecrets);

            const targetChannels = resolveTargetChannels(effectiveCategoryValue, latestSecrets, tgChannelOverride);
            const finalTelegramDesc = (telegramDescription && telegramDescription.trim())
              ? telegramDescription.trim()
              : (latestSecrets.defaultDescription || defaultTelegramDescription || '');

            if (latestSecrets.botToken && targetChannels.length > 0) {
              const tgResult = await postVideoToTelegramChannels({
                videoId: newVideoRef.id,
                title: effectiveTitle,
                description,
                telegramDescription: finalTelegramDesc,
                thumbnailUrl: finalThumb,
                videoLink,
                botToken: latestSecrets.botToken,
                targetChannels,
                customApiUrl: latestSecrets.customApiUrl
              });

              if (tgResult.succeededChannels.length > 0) {
                markTelegramLocked(lockKey);
              }
              setTgPostReport({
                succeeded: tgResult.succeededChannels,
                failed: tgResult.failedChannels
              });
            }
          }
        } catch (tgError) {
          console.error("Failed to post to Telegram:", tgError);
        }
      }

      setSuccess(
        postToAllCategories
          ? `Video imported successfully to all ${categories.length} categories!`
          : 'Video imported successfully!'
      );
      setShareUrl(`${window.location.origin}/video/${newVideoRef.id}`);

      // Reset form (keep tgChannelOverride sticky so subsequent uploads use the chosen 1-click channel!)
      setScrapedData(null);
      setUrl('');
      setTitle('');
      if (keepManualDescription) {
        const templateToKeep = manualTemplateDescription || description || defaultWebsiteDescription;
        setDescription(templateToKeep);
      } else {
        setDescription(defaultWebsiteDescription);
      }
      setTelegramDescription(defaultTelegramDescription);
      setSelectedImages([]);
      setSelectedVideos([]);
      setIsPremium(false);
      setAddToBanner(false);
      setSkipTelegram(false);
      setPostToAllCategories(false);
    } catch (err: any) {
      setError(err.message || 'Failed to import video');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 relative">
      
      {/* Full-Screen Loading Overlay */}
      {(isLoading || isUploading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505]/80 backdrop-blur-sm">
          <div className="flex flex-col items-center bg-[#0f0f0f] border border-white/10 p-8 rounded-2xl shadow-2xl">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-lg font-bold text-white">
              {isLoading ? 'Scanning Blogger Post...' : 'Importing to Website...'}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              {isLoading ? 'Extracting videos, images, and content.' : 'Saving data to database and Telegram.'} Please wait...
            </p>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-white">Auto-Import from Blogger</h1>
        <p className="text-sm text-gray-400 mt-1">Paste a Blogger post URL to automatically extract and upload videos and thumbnails.</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-6 shadow-xl">
        <form onSubmit={handleScrape} className="flex gap-4">
          <div className="flex-1 relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <LinkIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="block w-full rounded-lg border border-white/10 bg-black/50 py-3 pl-10 pr-20 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="https://example.blogspot.com/2026/08/post.html"
              required
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
              {url && (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  className="p-1 text-gray-400 hover:text-white transition-colors rounded-md hover:bg-white/10"
                  title="Clear"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    setUrl(text);
                  } catch (err) {
                    setError('Cannot access clipboard. Please paste the URL manually (Ctrl+V / Cmd+V).');
                  }
                }}
                className="p-1 text-gray-400 hover:text-white transition-colors rounded-md hover:bg-white/10"
                title="Paste from clipboard"
              >
                <Clipboard className="h-5 w-5" />
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading || !url}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            {isLoading ? 'Scanning...' : 'Scan URL'}
          </button>
        </form>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 p-4 text-red-500 border border-red-500/20">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg bg-green-500/10 p-4 border border-green-500/20">
            <div className="flex items-center gap-2 text-green-500">
              <CheckCircle className="h-5 w-5" />
              <p className="text-sm font-bold">{success}</p>
            </div>
            {tgPostReport && (
              <div className="space-y-1.5 text-xs">
                {tgPostReport.succeeded.length > 0 && (
                  <p className="text-sky-300 font-mono">
                    ✅ টেলিগ্রামে পোস্ট হয়েছে ({tgPostReport.succeeded.length}): {tgPostReport.succeeded.join(', ')}
                  </p>
                )}
                {tgPostReport.failed.length > 0 && (
                  <div className="rounded bg-amber-500/10 border border-amber-500/30 p-2 text-amber-300 space-y-1">
                    {tgPostReport.failed.map((f, idx) => (
                      <p key={idx} className="font-mono">
                        ⚠️ {f.channel} এ পোস্ট ব্যর্থ: {f.error}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
            {shareUrl && (
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={shareUrl} 
                  readOnly 
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" 
                />
                <button 
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                    } catch (err) {
                      console.warn('Clipboard access blocked');
                    }
                  }}
                  className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg text-sm font-bold text-white transition-colors"
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        )}

        {/* 1-Click Sticky Telegram Channel Selector Bar */}
        <div className="mt-5 pt-4 border-t border-white/10 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" />
              <span>১-ক্লিক টেলিগ্রাম চ্যানেল সিলেক্ট (সব ব্লগার আপলোডের জন্য):</span>
            </span>
            <span className="text-[11px] font-mono text-gray-300 bg-black/50 border border-white/10 px-2.5 py-0.5 rounded">
              {tgChannelOverride === '__AUTO__'
                ? `অটো (${getChannelForCategory(category, tgSecrets?.categoryChannels, tgSecrets?.channelId) || 'Main'})`
                : tgChannelOverride === '__MAIN__'
                ? `মেইন (${normalizeTelegramChatId(tgSecrets?.channelId) || 'Unset'})`
                : tgChannelOverride === '__ALL_CHANNELS__'
                ? 'সব চ্যানেলে একসাথে'
                : tgChannelOverride}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleSelectTgChannelOverride('__AUTO__')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                tgChannelOverride === '__AUTO__'
                  ? 'bg-sky-600 text-white border-sky-400 shadow-sm shadow-sky-500/30'
                  : 'bg-black/40 text-gray-300 border-white/10 hover:border-white/30'
              }`}
            >
              🔄 অটো (ক্যাটাগরি অনুযায়ী)
            </button>

            {tgSecrets?.channelId && (
              <button
                type="button"
                onClick={() => handleSelectTgChannelOverride('__MAIN__')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  tgChannelOverride === '__MAIN__'
                    ? 'bg-emerald-600 text-white border-emerald-400'
                    : 'bg-black/40 text-gray-300 border-white/10 hover:border-white/30'
                }`}
              >
                🏠 মেইন ({normalizeTelegramChatId(tgSecrets.channelId)})
              </button>
            )}

            {categories.map((cat) => {
              const ch = tgSecrets?.categoryChannels ? getChannelForCategory(cat.name, tgSecrets.categoryChannels, '') : '';
              if (!ch) return null;
              const isSelected = tgChannelOverride === ch;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectTgChannelOverride(ch)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    isSelected
                      ? 'bg-red-600 text-white border-red-400 shadow-sm shadow-red-500/30'
                      : 'bg-black/40 text-gray-300 border-white/10 hover:border-sky-500/40'
                  }`}
                >
                  📁 {cat.name} ({ch})
                </button>
              );
            })}

            {(tgSecrets?.extraChannels || []).map((ex) => {
              const norm = normalizeTelegramChatId(ex.channelId);
              if (!norm) return null;
              const isSelected = tgChannelOverride === norm;
              return (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => handleSelectTgChannelOverride(norm)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    isSelected
                      ? 'bg-amber-600 text-white border-amber-400'
                      : 'bg-black/40 text-gray-300 border-white/10 hover:border-amber-500/40'
                  }`}
                >
                  📌 {ex.label} ({norm})
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => handleSelectTgChannelOverride('__ALL_CHANNELS__')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                tgChannelOverride === '__ALL_CHANNELS__'
                  ? 'bg-purple-600 text-white border-purple-400'
                  : 'bg-black/40 text-gray-300 border-white/10 hover:border-purple-500/40'
              }`}
            >
              📢 সব চ্যানেলে একসাথে
            </button>
          </div>
        </div>
      </div>

      {scrapedData && (
        <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-6 shadow-xl space-y-8 animate-in fade-in slide-in-from-bottom-4">
          
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">1. Video Details</h2>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-300">Video Title</label>
                  {category && (
                    <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded font-medium">
                      {!title.trim() ? `খালি রাখলে ক্যাটাগরি '${category}' টাইটেল হবে` : `ক্যাটাগরি: ${category}`}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={category ? `টাইটেল লিখুন (খালি রাখলে '${category}' সেভ হবে)` : "ভিডিওর টাইটেল লিখুন"}
                  className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2.5 text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 placeholder-gray-500"
                />
              </div>

              {/* Caption / Description Box */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="text-sm font-bold text-gray-300">
                    Video Caption / Description (ক্যাপশন ও বিবরণ)
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {scrapedCaption && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (description.includes(scrapedCaption)) return;
                            setDescription(prev => prev ? `${prev.trim()}\n\n${scrapedCaption}`.trim() : scrapedCaption);
                          }}
                          className="text-xs bg-white/10 hover:bg-white/20 text-gray-200 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium transition cursor-pointer"
                          title="ম্যানুয়াল ডেসক্রিপশনের নিচে পোস্টের ক্যাপশন যুক্ত করুন"
                        >
                          <span>+ ক্যাপশন নিচে যোগ করুন</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDescription(scrapedCaption)}
                          className="text-xs text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 font-medium transition cursor-pointer"
                          title="ব্লগার থেকে প্রাপ্ত ক্যাপশন সেট করুন"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>শুধু পোস্ট ক্যাপশন</span>
                        </button>
                      </>
                    )}
                    {manualTemplateDescription && description !== manualTemplateDescription && (
                      <button
                        type="button"
                        onClick={() => setDescription(manualTemplateDescription)}
                        className="text-xs text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 font-medium transition cursor-pointer"
                        title="আপনার স্থায়ী ম্যানুয়াল ডেসক্রিপশন ফিরিয়ে আনুন"
                      >
                        <CheckCircle className="w-3 h-3" />
                        <span>ম্যানুয়াল রিস্টোর</span>
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDescription(val);
                    if (keepManualDescription) {
                      setManualTemplateDescription(val);
                      try {
                        localStorage.setItem('blogger_manual_desc_template', val);
                      } catch (err) {}
                    }
                  }}
                  rows={4}
                  placeholder="ব্লগার পোস্টের বাংলা ও ইংরেজি ক্যাপশন অথবা আপনার ম্যানুয়াল ডেসক্রিপশন এখানে থাকবে..."
                  className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2.5 text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 placeholder-gray-500 text-sm leading-relaxed"
                />
                <span className="text-xs text-gray-400 mt-1 block">
                  বাংলা ও ইংরেজি লেখা নির্ভুলভাবে ডিকোড করা হয়েছে। এই বক্সে যা রাখবেন তা-ই ভিডিওতে সেভ হবে।
                </span>

                <div className="mt-2.5 flex items-center justify-between bg-white/[0.03] p-2.5 rounded-lg border border-white/5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-emerald-400 font-bold hover:text-emerald-300">
                    <input 
                      type="checkbox" 
                      checked={keepManualDescription}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setKeepManualDescription(checked);
                        try {
                          localStorage.setItem('blogger_keep_manual_desc', checked.toString());
                          if (checked && description.trim()) {
                            localStorage.setItem('blogger_manual_desc_template', description.trim());
                            setManualTemplateDescription(description.trim());
                          }
                        } catch (err) {}
                      }}
                      className="h-4 w-4 rounded border-gray-400 text-emerald-600 focus:ring-emerald-500 bg-black cursor-pointer"
                    />
                    <span>সব ভিডিওতে এই ডেসক্রিপশন রাখুন (Always keep manual description for all videos)</span>
                  </label>
                  <span className="text-[11px] text-gray-500 font-mono">
                    {description.length} chars
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-bold text-gray-300 mb-2 block">Category</label>
                    <select
                      value={category}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      disabled={postToAllCategories}
                      className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2.5 text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50"
                      required={!postToAllCategories}
                    >
                      <option value="">Select a category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 1-Click Post Same Post to ALL Categories */}
                  {categories.length > 0 && (
                    <div className={`rounded-lg border p-3 transition-all ${postToAllCategories ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-white/10 bg-black/40'}`}>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={postToAllCategories}
                          onChange={(e) => setPostToAllCategories(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-400 text-emerald-500 focus:ring-emerald-500 bg-black cursor-pointer"
                        />
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                          <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>১ ক্লিকে সব ক্যাটাগরিতে পোস্ট করুন ({categories.length}টি ক্যাটাগরি)</span>
                        </div>
                      </label>
                      {postToAllCategories && (
                        <p className="mt-2 text-[11px] text-emerald-200/80 leading-relaxed">
                          এই একই পোস্ট ওয়েবসাইটের সবগুলো ক্যাটাগরিতে দেখা যাবে
                          {tgChannelOverride === '__AUTO__'
                            ? ' এবং প্রতি ক্যাটাগরির আলাদা টেলিগ্রাম চ্যানেলেও পোস্ট হবে।'
                            : ` এবং টেলিগ্রাম পোস্ট যাবে সিলেক্ট করা চ্যানেলে।`}
                        </p>
                      )}
                    </div>
                  )}

                  {!skipTelegram && !scheduledTime && tgSecrets?.botToken && (
                    <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-2.5 text-[11px] text-sky-300 flex items-start gap-2">
                      <Send className="w-3.5 h-3.5 mt-0.5 shrink-0 text-sky-400" />
                      <div>
                        <span className="font-bold">টেলিগ্রাম টার্গেট: </span>
                        <span className="font-mono">
                          {resolveTargetChannels(
                            postToAllCategories ? categories.map(c => c.name).join(', ') : category,
                            tgSecrets,
                            tgChannelOverride
                          ).join(', ') || 'কোনো চ্যানেল সেট করা নেই'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 justify-center pt-6">
                  <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/50 p-3 cursor-pointer hover:bg-white/5 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={isPremium}
                      onChange={(e) => setIsPremium(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-600 bg-black"
                    />
                    <span className="text-sm font-bold text-yellow-500">Premium / VIP Only</span>
                  </label>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-white">Order (Serial)</label>
                    <input 
                      type="number" 
                      value={order}
                      onChange={(e) => setOrder(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="1, 2, 3..."
                      className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2 text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                  <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/50 p-3 cursor-pointer hover:bg-white/5 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={isTrending}
                      onChange={(e) => setIsTrending(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-600 bg-black"
                    />
                    <span className="text-sm font-bold text-orange-400">Mark as Trending</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/50 p-3 cursor-pointer hover:bg-white/5 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={addToBanner}
                      onChange={(e) => setAddToBanner(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-600 bg-black"
                    />
                    <span className="text-sm font-bold text-blue-400">Set as Home Banner</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/50 p-3 cursor-pointer hover:bg-white/5 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={skipTelegram}
                      onChange={(e) => setSkipTelegram(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-gray-500 focus:ring-gray-600 bg-black"
                    />
                    <span className="text-sm font-bold text-gray-400">Do Not Post to Telegram</span>
                  </label>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-white">Schedule Upload (Optional)</label>
                    <input 
                      type="datetime-local" 
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2 text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                    {scheduledTime && <span className="text-xs text-orange-400">Video will be hidden and auto-posted to Telegram at this time.</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">2. Select Thumbnails ({selectedImages.length} selected)</h2>
              <span className="text-sm text-gray-400">{scrapedData.images.length} images found</span>
            </div>
            
            {scrapedData.images.length === 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-400 italic">No images found in the URL. You can provide a custom thumbnail URL{settings?.defaultThumbnailUrl ? ', or leave empty to use the default.' : '.'}</p>
                <input
                  type="url"
                  value={customThumbnailUrl}
                  onChange={(e) => {
                    setCustomThumbnailUrl(e.target.value);
                    setSelectedImages([e.target.value]);
                  }}
                  placeholder="https://example.com/thumbnail.jpg"
                  className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2.5 text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {scrapedData.images.map((imgUrl, i) => (
                  <div 
                    key={i} 
                    onClick={() => toggleImageSelection(imgUrl)}
                    className={`relative cursor-pointer overflow-hidden rounded-lg border-2 transition-all aspect-video bg-black/50 ${selectedImages.includes(imgUrl) ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] scale-[1.02]' : 'border-transparent hover:border-white/20'}`}
                  >
                    <img src={imgUrl} alt={`Thumbnail ${i}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    {selectedImages.includes(imgUrl) && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <CheckCircle className="text-red-500 h-8 w-8 bg-black rounded-full" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">3. Select Videos ({selectedVideos.length} selected)</h2>
              <span className="text-sm text-gray-400">{scrapedData.videos.length} videos found</span>
            </div>
            
            {scrapedData.videos.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No videos or iframes found in the URL. You may need to manually copy the video link.</p>
            ) : (
              <div className="space-y-3">
                {scrapedData.videos.map((vidUrl, i) => {
                  let hostLabel = 'Video';
                  const lower = vidUrl.toLowerCase();
                  if (lower.includes('blogger.com/video')) hostLabel = 'Blogger Player';
                  else if (lower.includes('mega.nz') || lower.includes('mega.co.nz')) hostLabel = 'Mega';
                  else if (lower.includes('terabox') || lower.includes('1024tera')) hostLabel = 'TeraBox';
                  else if (lower.includes('drive.google.com')) hostLabel = 'Google Drive';
                  else if (lower.endsWith('.mp4') || lower.includes('.mp4?')) hostLabel = 'Direct MP4';

                  return (
                    <div 
                      key={i} 
                      onClick={() => toggleVideoSelection(vidUrl)}
                      className={`flex items-center justify-between gap-4 rounded-xl border p-3.5 sm:p-4 cursor-pointer transition-all ${
                        selectedVideos.includes(vidUrl) 
                          ? 'border-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.15)]' 
                          : 'border-white/10 bg-black/40 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <input 
                          type="checkbox"
                          checked={selectedVideos.includes(vidUrl)}
                          onChange={() => toggleVideoSelection(vidUrl)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-5 w-5 rounded border-gray-400 text-red-600 focus:ring-red-600 bg-black cursor-pointer"
                        />
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">Video Part {i + 1}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-red-600/20 text-red-400 border border-red-500/30">
                              {hostLabel}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 truncate max-w-[280px] sm:max-w-md mt-0.5" title={vidUrl}>
                            {vidUrl}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={vidUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white transition"
                          title="Open Video Link"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedVideos(selectedVideos.filter(v => v !== vidUrl));
                            setScrapedData({
                              ...scrapedData,
                              videos: scrapedData.videos.filter(v => v !== vidUrl)
                            });
                          }}
                          className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 transition"
                          title="Remove this video part"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-white/10 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={isUploading || (!selectedImages.length && !customThumbnailUrl && !settings?.defaultThumbnailUrl) || selectedVideos.length === 0}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-8 py-3 font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {isUploading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              {isUploading ? 'Importing...' : 'Import to Website'}
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
