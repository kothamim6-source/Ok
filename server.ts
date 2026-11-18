import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";
import { cleanAndDecodeBloggerText } from "./src/lib/textUtils";


function getBDDateString(date: number | Date = new Date()): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const bdTime = new Date(d.getTime() + (3600000 * 6));
  const year = bdTime.getUTCFullYear();
  const month = (bdTime.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = bdTime.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function acquireServerTelegramLock(supabaseClient: any, lockKey: string, ttlMs = 24 * 60 * 60 * 1000): Promise<boolean> {
  const now = Date.now();
  try {
    const { data: logRow } = await supabaseClient
      .from('settings')
      .select('*')
      .eq('id', 'telegram_posted_log')
      .single();

    let locks: Record<string, number> = {};
    if (logRow && logRow.data && typeof logRow.data === 'object') {
      locks = (logRow.data.locks || logRow.data.postedIds || {}) as Record<string, number>;
    }

    const remoteTime = locks[lockKey];
    if (remoteTime && (now - remoteTime < ttlMs)) {
      console.log(`[server.ts] Deduplication lock already held for: ${lockKey}`);
      return false;
    }

    locks[lockKey] = now;
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;
    const cleanedLocks: Record<string, number> = {};
    for (const [k, ts] of Object.entries(locks)) {
      if (typeof ts === 'number' && ts > cutoff) {
        cleanedLocks[k] = ts;
      }
    }

    await supabaseClient.from('settings').upsert({
      id: 'telegram_posted_log',
      data: {
        locks: cleanedLocks,
        updatedAt: now
      }
    });

    return true;
  } catch (e) {
    console.error('[server.ts] Deduplication lock error:', e);
    return true;
  }
}

process.on('uncaughtException', (err) => {
  console.error('[server.ts] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[server.ts] Unhandled Rejection at:', promise, 'reason:', reason);
});

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // API routes
  app.get("/api/env", (req, res) => res.json(Object.keys(process.env)));

  // In-memory caches to respect Adsterra Publisher API rate limits
  let adsterraMetaCache: { expiresAt: number; domains: any[]; placements: any[] } | null = null;
  let adsterraLastGoodTotal: any = null;
  let adsterraLastGoodMonth: any = null;

  app.get("/api/adsterra/overview", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

      let apiToken = (process.env.ADSTERRA_API_TOKEN || "").trim();
      if (!apiToken) {
        try {
          const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
          const supabaseAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
          if (supabaseUrl && supabaseAnonKey) {
            const sb = createClient(supabaseUrl, supabaseAnonKey);
            const { data: secretRow } = await sb.from("settings").select("*").eq("id", "adsterra_secrets").single();
            if (secretRow?.data?.apiToken) {
              apiToken = String(secretRow.data.apiToken).trim();
            }
          }
        } catch (err) {
          console.warn("[adsterra] Could not read fallback secret:", err);
        }
      }

      if (!apiToken) {
        return res.status(500).json({ ok: false, error: "Adsterra API token not configured" });
      }

      const rangeParam = String(req.query.range || "7d");
      const now = new Date();
      const formatUtc = (d: Date) => d.toISOString().slice(0, 10);
      const todayUtc = formatUtc(now);
      const yesterdayUtc = formatUtc(new Date(now.getTime() - 86400000));

      let range = "7d";
      let startDate = formatUtc(new Date(now.getTime() - 6 * 86400000));
      let finishDate = todayUtc;

      if (rangeParam === "today") {
        range = "today";
        startDate = todayUtc;
        finishDate = todayUtc;
      } else if (rangeParam === "yesterday") {
        range = "yesterday";
        startDate = yesterdayUtc;
        finishDate = yesterdayUtc;
      } else if (rangeParam === "30d") {
        range = "30d";
        startDate = formatUtc(new Date(now.getTime() - 29 * 86400000));
        finishDate = todayUtc;
      } else if (rangeParam === "total") {
        range = "total";
        startDate = formatUtc(new Date(now.getTime() - 365 * 86400000));
        finishDate = todayUtc;
      }

      const monthStartUtc = `${todayUtc.slice(0, 7)}-01`;
      const year1Start = formatUtc(new Date(now.getTime() - 365 * 86400000));
      const year2End = formatUtc(new Date(now.getTime() - 366 * 86400000));
      const year2Start = formatUtc(new Date(now.getTime() - 730 * 86400000));

      const base = "https://api3.adsterratools.com/publisher";
      const headers = {
        Accept: "application/json",
        "X-API-Key": apiToken
      };

      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      const fetchAdsterra = async (endpoint: string, maxRetries = 3): Promise<any> => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          const r = await fetch(`${base}/${endpoint}`, { headers });
          if (r.ok) {
            return r.json();
          }
          if ((r.status === 429 || r.status >= 500) && attempt < maxRetries) {
            await sleep(450 * attempt);
            continue;
          }
          const text = await r.text().catch(() => "");
          throw new Error(`Adsterra API ${r.status}: ${text || r.statusText}`);
        }
      };

      // Cache domains + placements for 10 minutes to minimize API calls
      if (!adsterraMetaCache || Date.now() > adsterraMetaCache.expiresAt) {
        const dRes = await fetchAdsterra("domains.json").catch(() => ({ items: [] }));
        await sleep(180);
        const pRes = await fetchAdsterra("placements.json").catch(() => ({ items: [] }));
        adsterraMetaCache = {
          expiresAt: Date.now() + 10 * 60 * 1000,
          domains: Array.isArray(dRes?.items) ? dRes.items : [],
          placements: Array.isArray(pRes?.items) ? pRes.items : []
        };
        await sleep(180);
      }

      const domainsItems = adsterraMetaCache.domains;
      const placementsItems = adsterraMetaCache.placements;

      // Throttled sequential fetches so Adsterra never returns 429
      const dailyRes = await fetchAdsterra(`stats.json?start_date=${startDate}&finish_date=${finishDate}&group_by=date`);
      await sleep(180);

      const placementStatsRes = await fetchAdsterra(`stats.json?start_date=${startDate}&finish_date=${finishDate}&group_by=placement`).catch(() => ({ items: [] }));
      await sleep(180);

      const countryStatsRes = await fetchAdsterra(`stats.json?start_date=${startDate}&finish_date=${finishDate}&group_by=country`).catch(() => ({ items: [] }));
      await sleep(180);

      let monthDailyRes: any = null;
      if (range === "30d" && startDate <= monthStartUtc && finishDate === todayUtc && Array.isArray(dailyRes?.items)) {
        monthDailyRes = { items: dailyRes.items.filter((row: any) => String(row.date || "") >= monthStartUtc) };
      } else {
        monthDailyRes = await fetchAdsterra(`stats.json?start_date=${monthStartUtc}&finish_date=${todayUtc}&group_by=date`).catch(() => null);
        await sleep(180);
      }

      const allTimeY1Res = await fetchAdsterra(`stats.json?start_date=${year1Start}&finish_date=${todayUtc}&group_by=domain`).catch(() => null);
      await sleep(180);
      const allTimeY2Res = await fetchAdsterra(`stats.json?start_date=${year2Start}&finish_date=${year2End}&group_by=domain`).catch(() => null);

      const domainMap = new Map<string, string>();
      for (const d of domainsItems) {
        if (d?.id !== undefined) {
          domainMap.set(String(d.id), d.title || String(d.id));
        }
      }

      const placementMap = new Map<string, { title: string; domainTitle: string }>();
      for (const p of placementsItems) {
        if (p?.id !== undefined) {
          const domId = p.domain_id !== undefined ? String(p.domain_id) : "";
          placementMap.set(String(p.id), {
            title: p.title || p.alias || `Placement #${p.id}`,
            domainTitle: domainMap.get(domId) || domId
          });
        }
      }

      const dailyItems: any[] = Array.isArray(dailyRes?.items) ? dailyRes.items : [];
      let totalRevenue = 0;
      let totalImpressions = 0;
      let totalClicks = 0;

      for (const row of dailyItems) {
        totalRevenue += Number(row.revenue || 0);
        totalImpressions += Number(row.impression || 0);
        totalClicks += Number(row.clicks || 0);
      }

      const avgCpm = totalImpressions > 0 ? Number(((totalRevenue / totalImpressions) * 1000).toFixed(4)) : 0;
      const avgCtr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(3)) : 0;

      // Aggregate All-Time / Total Income across domains (Year 1 + Year 2)
      let totalIncome: any = null;
      if (allTimeY1Res && Array.isArray(allTimeY1Res.items)) {
        let allTimeRev = 0;
        let allTimeImp = 0;
        let allTimeClicks = 0;
        const domainTotalsMap = new Map<string, { domainId: string; title: string; revenue: number; impression: number; clicks: number }>();

        for (const row of [...allTimeY1Res.items, ...(Array.isArray(allTimeY2Res?.items) ? allTimeY2Res.items : [])]) {
          const rev = Number(row.revenue || 0);
          const imp = Number(row.impression || 0);
          const clk = Number(row.clicks || 0);
          allTimeRev += rev;
          allTimeImp += imp;
          allTimeClicks += clk;

          const domId = String(row.domain ?? "");
          const prev = domainTotalsMap.get(domId) || {
            domainId: domId,
            title: domainMap.get(domId) || `Domain #${domId}`,
            revenue: 0,
            impression: 0,
            clicks: 0
          };
          prev.revenue += rev;
          prev.impression += imp;
          prev.clicks += clk;
          domainTotalsMap.set(domId, prev);
        }

        const domainTotals = Array.from(domainTotalsMap.values())
          .map((d) => ({
            ...d,
            revenue: Number(d.revenue.toFixed(4)),
            cpm: d.impression > 0 ? Number(((d.revenue / d.impression) * 1000).toFixed(4)) : 0,
            ctr: d.impression > 0 ? Number(((d.clicks / d.impression) * 100).toFixed(3)) : 0
          }))
          .sort((a, b) => b.revenue - a.revenue);

        totalIncome = {
          revenue: Number(allTimeRev.toFixed(4)),
          impression: allTimeImp,
          clicks: allTimeClicks,
          cpm: allTimeImp > 0 ? Number(((allTimeRev / allTimeImp) * 1000).toFixed(4)) : 0,
          ctr: allTimeImp > 0 ? Number(((allTimeClicks / allTimeImp) * 100).toFixed(3)) : 0,
          domains: domainTotals
        };
        adsterraLastGoodTotal = totalIncome;
      } else if (adsterraLastGoodTotal) {
        totalIncome = adsterraLastGoodTotal;
      } else {
        totalIncome = { revenue: 0, impression: 0, clicks: 0, cpm: 0, ctr: 0, domains: [] };
      }

      const placements = (Array.isArray(placementStatsRes?.items) ? placementStatsRes.items : [])
        .map((row: any) => {
          const pid = String(row.placement ?? "");
          const meta = placementMap.get(pid);
          return {
            placementId: row.placement ?? pid,
            title: meta?.title || `Placement #${pid}`,
            domainTitle: meta?.domainTitle || "",
            impression: Number(row.impression || 0),
            clicks: Number(row.clicks || 0),
            ctr: Number(row.ctr || 0),
            cpm: Number(row.cpm || 0),
            revenue: Number(row.revenue || 0)
          };
        })
        .sort((a: any, b: any) => b.revenue - a.revenue);

      const countries = (Array.isArray(countryStatsRes?.items) ? countryStatsRes.items : [])
        .map((row: any) => ({
          country: row.country || "Unknown",
          impression: Number(row.impression || 0),
          clicks: Number(row.clicks || 0),
          ctr: Number(row.ctr || 0),
          cpm: Number(row.cpm || 0),
          revenue: Number(row.revenue || 0)
        }))
        .sort((a: any, b: any) => b.revenue - a.revenue);

      let monthIncome: any = null;
      let todayIncome: any = null;

      if (monthDailyRes && Array.isArray(monthDailyRes.items)) {
        let monthRev = 0;
        let monthImp = 0;
        let monthClicks = 0;
        let todayRev = 0;
        let todayImp = 0;
        let todayClicks = 0;
        let todayCpm = 0;

        for (const row of monthDailyRes.items) {
          const rev = Number(row.revenue || 0);
          const imp = Number(row.impression || 0);
          const clk = Number(row.clicks || 0);
          monthRev += rev;
          monthImp += imp;
          monthClicks += clk;
          if (String(row.date || "") === todayUtc) {
            todayRev = rev;
            todayImp = imp;
            todayClicks = clk;
            todayCpm = Number(row.cpm || 0);
          }
        }

        todayIncome = {
          date: todayUtc,
          revenue: Number(todayRev.toFixed(4)),
          impression: todayImp,
          clicks: todayClicks,
          cpm: todayCpm || (todayImp > 0 ? Number(((todayRev / todayImp) * 1000).toFixed(4)) : 0)
        };

        monthIncome = {
          startDate: monthStartUtc,
          finishDate: todayUtc,
          revenue: Number(monthRev.toFixed(4)),
          impression: monthImp,
          clicks: monthClicks,
          cpm: monthImp > 0 ? Number(((monthRev / monthImp) * 1000).toFixed(4)) : 0
        };
        adsterraLastGoodMonth = { todayIncome, monthIncome };
      } else if (adsterraLastGoodMonth) {
        todayIncome = adsterraLastGoodMonth.todayIncome;
        monthIncome = adsterraLastGoodMonth.monthIncome;
      }

      // Extra safety: if today row exists in dailyItems and todayIncome was empty, fill from dailyItems
      const todayFromDaily = dailyItems.find((r: any) => String(r.date || "") === todayUtc);
      if (todayFromDaily && (!todayIncome || todayIncome.impression === 0)) {
        const rev = Number(todayFromDaily.revenue || 0);
        const imp = Number(todayFromDaily.impression || 0);
        const clk = Number(todayFromDaily.clicks || 0);
        todayIncome = {
          date: todayUtc,
          revenue: Number(rev.toFixed(4)),
          impression: imp,
          clicks: clk,
          cpm: Number(todayFromDaily.cpm || 0) || (imp > 0 ? Number(((rev / imp) * 1000).toFixed(4)) : 0)
        };
      }

      if (!todayIncome) {
        todayIncome = { date: todayUtc, revenue: 0, impression: 0, clicks: 0, cpm: 0 };
      }
      if (!monthIncome) {
        monthIncome = { startDate: monthStartUtc, finishDate: todayUtc, revenue: 0, impression: 0, clicks: 0, cpm: 0 };
      }

      return res.json({
        ok: true,
        range,
        startDate,
        finishDate,
        dbLastUpdateTime: dailyRes?.dbLastUpdateTime || null,
        summary: {
          revenue: Number(totalRevenue.toFixed(4)),
          impression: totalImpressions,
          clicks: totalClicks,
          cpm: avgCpm,
          ctr: avgCtr
        },
        todayIncome,
        monthIncome,
        totalIncome,
        domains: domainsItems,
        daily: dailyItems,
        placements,
        countries
      });
    } catch (error: any) {
      console.error("[adsterra] Overview API error:", error);
      return res.status(502).json({ ok: false, error: error?.message || "Failed to fetch Adsterra stats" });
    }
  });
  app.get("/api/cron-run", async (req, res) => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
      const supabaseAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
      if (!supabaseUrl || !supabaseAnonKey) return res.send("No db credentials");
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const now = Date.now();
      const todayBD = getBDDateString(now);
      
      const { data: textPostsData } = await supabase.from('settings').select('*').eq('id', 'scheduled_text_posts').single();
      let log = "Cron run:\n";
      
      if (textPostsData && textPostsData.data && Array.isArray(textPostsData.data.posts)) {
        let updated = false;
        const posts = textPostsData.data.posts;
        log += "Found " + posts.length + " posts.\n";
        
        let currentBotToken = process.env.TELEGRAM_BOT_TOKEN;
        let currentChatId = process.env.TELEGRAM_CHANNEL_ID;
        try {
          const { data: secretData } = await supabase.from('settings').select('*').eq('id', 'telegram_secrets').single();
          if (secretData && secretData.data) {
            currentBotToken = secretData.data.botToken || currentBotToken;
            currentChatId = secretData.data.channelId || currentChatId;
          }
        } catch (e) {}

        for (let i = 0; i < posts.length; i++) {
          const post = posts[i];
          log += `Post ${post.id} (${post.textContent}): status=${post.status}, sched=${new Date(post.scheduledFor).toLocaleString()}, isDaily=${post.isDaily}\n`;
          if (post.status === 'pending' && post.scheduledFor <= now) {
            if (post.lastPostedAt && getBDDateString(post.lastPostedAt) === todayBD) {
              log += ` -> Already posted today (${todayBD}), skipping\n`;
              continue;
            }

            const lockKey = post.isDaily 
              ? `text_post_daily_${post.id}_${todayBD}` 
              : `text_post_${post.id}`;
            const acquired = await acquireServerTelegramLock(supabase, lockKey);
            if (!acquired) {
              log += ` -> Lock already held (${lockKey}), skipping duplicate\n`;
              continue;
            }

            updated = true;
            if (currentBotToken && currentChatId) {
              const textUrl = `https://api.telegram.org/bot${currentBotToken}/sendMessage`;
              const tgRes = await fetch(textUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: currentChatId,
                  text: post.textContent,
                  disable_web_page_preview: false
                })
              });
              if (tgRes.ok) {
                posts[i].lastPostedAt = now;
                if (post.isDaily) {
                  const nextMs = post.scheduledFor + (24 * 60 * 60 * 1000);
                  posts[i].scheduledFor = nextMs;
                  posts[i].status = 'pending';
                  log += ` -> Posted and rescheduled\n`;
                } else {
                  posts[i].status = 'posted';
                  log += ` -> Posted once\n`;
                }
              } else {
                posts[i].status = 'failed';
                log += ` -> TG Failed: ${tgRes.statusText}\n`;
              }
            } else {
              posts[i].status = 'failed';
              log += ` -> Missing credentials\n`;
            }
          }
        }

        if (updated) {
          await supabase.from('settings').upsert({
            id: 'scheduled_text_posts',
            data: { posts, updatedAt: Date.now() }
          });
          log += "Updated DB.\n";
        }
      } else {
        log += "No posts found.\n";
      }
      res.send(log);
    } catch (e) {
      res.status(500).send(e.toString());
    }
  });

  app.post("/api/scrape-blogger", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      const response = await fetch(url, { 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8',
          'Cookie': 'adult_content_acknowledged=yes; blogspot_consent=yes; cf_clearance=yes'
        } 
      });
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Comprehensive title extraction supporting all Blogger themes and custom templates
      let title = $('.post-title, .entry-title, h1.post-title, h2.post-title, h3.post-title, article h1, .post h1, h1.entry-title, h2.entry-title, h3.entry-title, header.entry-header h1, header.entry-header h2, .blog-post-title, h1.title, h2.title, h3.title, .post_title, .post-header h1, [itemprop="headline"], [itemprop="name"], .post-heading, .entry-header h1, .post-body h1, .post-body h2, .post-body h3').first().text().trim();
      if (!title) {
        title = $('meta[property="og:title"]').attr('content') || '';
      }
      if (!title) {
        title = $('meta[name="twitter:title"]').attr('content') || '';
      }
      if (!title) {
        title = $('meta[name="title"]').attr('content') || '';
      }
      if (!title) {
        title = $('meta[name="sailthru.title"]').attr('content') || '';
      }
      if (!title) {
        title = $('title').text().trim();
      }
      
      // Clean Blogger suffixes and prefixes
      title = title
        .replace(/\s*-\s*Blogger\s*$/i, '')
        .replace(/\s*\|\s*Blogger\s*$/i, '')
        .replace(/^(Blogger:\s*)/i, '')
        .trim();

      // Robust fallback: If title is empty, is the sensitive content interstitial, or generic Blogger title, extract from the URL slug
      const isInvalidTitle = !title || 
        title.toLowerCase().includes('sensitive content') || 
        title.toLowerCase() === 'blogger' || 
        title.toLowerCase() === 'untitled' ||
        title.toLowerCase() === 'blog post' ||
        title.length < 3;

      if (isInvalidTitle) {
        try {
          const parsedUrl = new URL(url);
          const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
          const lastSegment = pathSegments[pathSegments.length - 1] || '';
          const rawSlug = lastSegment.replace(/\.html?$/i, '').replace(/[-_+]+/g, ' ').trim();
          const decodedSlug = decodeURIComponent(rawSlug);
          if (decodedSlug && decodedSlug.length > 2) {
            title = decodedSlug.replace(/\b\w/g, (c) => c.toUpperCase());
          }
        } catch (slugErr) {
          console.warn("Could not extract title from URL slug", slugErr);
        }
      }

      if (!title) {
        title = '';
      }


      
      // 1. Locate strictly the main post body FIRST before removing any global elements
      // (In Blogger, the entire post is wrapped inside a widget container, so never remove .widget globally!)
      let $content = $('.post-body, .entry-content, [itemprop="articleBody"]').first();
      if ($content.length === 0) {
        $content = $('.post, article.post, article').first();
      }
      if ($content.length === 0) {
        $content = $('#main-content, #content, main').first();
      }
      if ($content.length === 0) {
        $content = $('body');
      }

      // Clone $content so we can sanitize safely without affecting the original DOM
      const $postContent = $content.clone();

      // Only remove true noise inside the post body (comments, share buttons, footer meta)
      $postContent.find('.comments, #comments, .post-footer, .share-buttons, .item-control, .post-share, .social-share, .author-profile, .related-posts, #related-posts').remove();

      // Helper to convert Blogger / Google CDN images to original full-resolution /s1600/ format
      const toHighResBloggerImg = (imgUrl: string) => {
        if (!imgUrl) return '';
        let trimmed = imgUrl.trim();
        if (trimmed.startsWith('//')) trimmed = 'https:' + trimmed;
        if (trimmed.includes('googleusercontent.com') || trimmed.includes('bp.blogspot.com')) {
          return trimmed
            .replace(/\/w[0-9]+-h[0-9]+-[^\/]+\//, '/s1600/')
            .replace(/\/s[0-9]+(-c)?\//, '/s1600/')
            .replace(/\/s[0-9]+\//, '/s1600/');
        }
        return trimmed;
      };

      // Extract caption and description from post body & meta tags
      const ogDesc = cleanAndDecodeBloggerText($('meta[property="og:description"]').attr('content') || '');
      const metaDesc = cleanAndDecodeBloggerText($('meta[name="description"]').attr('content') || '');
      const twitterDesc = cleanAndDecodeBloggerText($('meta[name="twitter:description"]').attr('content') || '');

      // Dedicated Blogger captions (.tr-caption, td.tr-caption, figcaption, .caption)
      const dedicatedCaptions: string[] = [];
      $postContent.find('.tr-caption, figcaption, .caption, [itemprop="caption"], .tr-caption-container td, .image-caption').each((i, el) => {
        const cText = cleanAndDecodeBloggerText($(el).text().trim());
        if (cText && cText.length > 2 && !dedicatedCaptions.includes(cText)) {
          dedicatedCaptions.push(cText);
        }
      });

      const $descClone = $postContent.clone();
      $descClone.find('script, style, iframe, video, audio, embed, object, noscript, button, .play-button, .video-lock, svg').remove();

      const paragraphs: string[] = [];
      $descClone.find('p, div, blockquote, span, h2, h3, h4, td').each((i, el) => {
        const directText = cleanAndDecodeBloggerText($(el).clone().children('div, p, ul, ol').remove().end().text().trim());
        if (
          directText &&
          directText.length > 2 &&
          !directText.startsWith('http://') &&
          !directText.startsWith('https://') &&
          !directText.toLowerCase().includes('click here') &&
          !directText.toLowerCase().includes('watch online') &&
          !directText.toLowerCase().includes('join now') &&
          !directText.toLowerCase().includes('distributed by') &&
          !directText.toLowerCase().includes('designed with') &&
          !paragraphs.includes(directText)
        ) {
          paragraphs.push(directText);
        }
      });

      let extractedDescription = dedicatedCaptions.join('\n\n').trim();
      const bodyParagraphs = paragraphs.join('\n\n').trim();
      if (!extractedDescription) {
        extractedDescription = bodyParagraphs;
      } else if (bodyParagraphs && !bodyParagraphs.includes(extractedDescription)) {
        extractedDescription = extractedDescription + '\n\n' + bodyParagraphs;
      }

      if (!extractedDescription || extractedDescription.length < 5) {
        const fallbackText = cleanAndDecodeBloggerText(
          $descClone.text()
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 2 && !l.startsWith('http') && !l.toLowerCase().includes('join now') && !l.toLowerCase().includes('distributed by'))
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
        );
        if (fallbackText && fallbackText.length > 3) {
          extractedDescription = fallbackText;
        }
      }

      if (!extractedDescription || extractedDescription.length < 5) {
        if (ogDesc && !ogDesc.toLowerCase().includes('blogger') && !ogDesc.toLowerCase().includes('distributed by')) {
          extractedDescription = ogDesc;
        } else if (metaDesc && !metaDesc.toLowerCase().includes('blogger') && !metaDesc.toLowerCase().includes('distributed by')) {
          extractedDescription = metaDesc;
        } else if (twitterDesc) {
          extractedDescription = twitterDesc;
        }
      }

      extractedDescription = cleanAndDecodeBloggerText(extractedDescription);
      title = cleanAndDecodeBloggerText(title);

      // 3. Extract Images strictly from the main post body
      const images: string[] = [];

      // Check high-res anchor tags inside content first
      $postContent.find('a[href]').each((i, el) => {
        const href = $(el).attr('href');
        if (href && (href.match(/\.(jpe?g|png|webp|gif)($|\?)/i) || href.includes('googleusercontent.com') || href.includes('bp.blogspot.com'))) {
          images.push(toHighResBloggerImg(href));
        }
      });

      // Check img tags inside content
      $postContent.find('img').each((i, el) => {
        const src = $(el).attr('data-src') || $(el).attr('data-original-url') || $(el).attr('src');
        if (src && src.startsWith('http') && !src.includes('data:image')) {
          images.push(toHighResBloggerImg(src));
        }
      });

      // Fallback: og:image or twitter:image
      const ogImage = $('meta[property="og:image"]').attr('content');
      if (ogImage && ogImage.startsWith('http')) {
        images.push(toHighResBloggerImg(ogImage));
      }
      const twitterImage = $('meta[name="twitter:image"]').attr('content');
      if (twitterImage && twitterImage.startsWith('http') && twitterImage !== ogImage) {
        images.push(toHighResBloggerImg(twitterImage));
      }

      // Filter and clean images
      const cleanImgList = images.map(toHighResBloggerImg).filter(img => {
        const lower = img.toLowerCase();
        return !lower.includes('blank.gif') &&
               !lower.includes('pixel.gif') &&
               !lower.includes('px.gif') &&
               !lower.includes('spinner') &&
               !lower.includes('avatar') &&
               !lower.includes('blogger-logo') &&
               img.length > 15;
      });
      const uniqueImages = [...new Set(cleanImgList)];

      // 4. Extract and Normalize ONLY the real main videos
      const rawFoundVideos: string[] = [];

      // Priority A: iframes, video tags, sources strictly inside post body
      $postContent.find('iframe, video, source, embed, object').each((i, el) => {
        let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data');
        if (src) {
          rawFoundVideos.push(src);
        }
      });

      // Priority B: Direct video hosting links inside post body
      $postContent.find('a[href]').each((i, el) => {
        const href = $(el).attr('href');
        if (href) {
          const lower = href.toLowerCase();
          if (
            lower.includes('blogger.com/video') ||
            lower.includes('mega.nz') ||
            lower.includes('mega.co.nz') ||
            lower.includes('terabox') ||
            lower.includes('1024tera') ||
            lower.includes('terasharelink') ||
            lower.includes('drive.google.com') ||
            lower.endsWith('.mp4') ||
            lower.includes('.mp4?')
          ) {
            rawFoundVideos.push(href);
          }
        }
      });

      // Priority C: Text-based regex inside post body HTML
      const contentHtml = $postContent.html() || '';
      const videoRegex = /https?:\/\/(?:www\.|draft\.)?(?:blogger\.com\/video\.g\?[^"'\s<>&]+|mega\.nz\/[^\s"'<>&]+|mega\.co\.nz\/[^\s"'<>&]+|terabox\.com\/[^\s"'<>&]+|teraboxapp\.com\/[^\s"'<>&]+|1024tera\.com\/[^\s"'<>&]+|1024terabox\.com\/[^\s"'<>&]+|terabox\.app\/[^\s"'<>&]+|terasharelink\.com\/[^\s"'<>&]+|drive\.google\.com\/file\/d\/[^\s"'<>&]+)[^\s"'<>&]*/gi;
      const matches = contentHtml.match(videoRegex) || [];
      rawFoundVideos.push(...matches);

      const mp4Regex = /https?:\/\/[^\s"'<>]+\.mp4(?:\?[^\s"'<>]*)?/gi;
      const mp4Matches = contentHtml.match(mp4Regex) || [];
      rawFoundVideos.push(...mp4Matches);

      // Normalize & filter junk/extra videos
      const normalizeVideoUrl = (rawUrl: string): { key: string; url: string } | null => {
        if (!rawUrl) return null;
        let u = rawUrl.trim()
          .replace(/&amp;/g, '&')
          .replace(/["'>\)\\]+$/, '')
          .replace(/^["'<\(\\]+/, '');
        if (u.startsWith('//')) u = 'https:' + u;
        if (!u.startsWith('http')) return null;

        const lower = u.toLowerCase();

        // Exclude ad networks and analytics
        if (
          lower.includes('doubleclick') ||
          lower.includes('googleads') ||
          lower.includes('googlesyndication') ||
          lower.includes('adsterra') ||
          lower.includes('exoclick') ||
          lower.includes('propeller') ||
          lower.includes('popads') ||
          lower.includes('trafficjunkie') ||
          lower.includes('syndication') ||
          lower.includes('adnxs') ||
          lower.includes('histats') ||
          lower.includes('statcounter') ||
          lower.includes('analytics')
        ) {
          return null;
        }

        // Exclude social/channel pages
        if (
          lower.includes('t.me/') ||
          lower.includes('telegram.me/') ||
          lower.includes('facebook.com/') ||
          lower.includes('instagram.com/') ||
          lower.includes('twitter.com/') ||
          lower.includes('x.com/') ||
          lower.includes('youtube.com/channel') ||
          lower.includes('youtube.com/c/') ||
          lower.includes('youtube.com/user')
        ) {
          return null;
        }

        // 1. Blogger Video Player (support www.blogger.com and draft.blogger.com)
        if (lower.includes('blogger.com/video')) {
          const tokenMatch = u.match(/token=([a-zA-Z0-9_\-]+)/);
          if (tokenMatch) {
            const token = tokenMatch[1];
            return {
              key: `blogger_${token}`,
              url: `https://www.blogger.com/video.g?token=${token}`
            };
          }
          return { key: `blogger_${u}`, url: u };
        }

        // 2. Mega
        if (lower.includes('mega.nz') || lower.includes('mega.co.nz')) {
          const match = u.match(/mega\.(?:nz|co\.nz)\/(?:file\/|embed\/|\#\!|\#)([a-zA-Z0-9_\-]+)/);
          const fileId = match ? match[1] : u;
          return { key: `mega_${fileId}`, url: u };
        }

        // 3. Terabox / 1024tera / 1024terabox
        if (lower.includes('terabox') || lower.includes('1024tera') || lower.includes('terasharelink')) {
          const match = u.match(/(?:s\/|sharing\/link\?surl=)([a-zA-Z0-9_\-]+)/i);
          const surl = match ? match[1] : u;
          return { key: `terabox_${surl}`, url: u };
        }

        // 4. Google Drive
        if (lower.includes('drive.google.com')) {
          const match = u.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_\-]+)/);
          const fileId = match ? match[1] : u;
          return { key: `gdrive_${fileId}`, url: `https://drive.google.com/file/d/${fileId}/preview` };
        }

        // 5. MP4 Video file
        if (lower.endsWith('.mp4') || lower.includes('.mp4?')) {
          if (lower.includes('intro') || lower.includes('loader') || lower.includes('banner') || lower.includes('blank')) {
            return null;
          }
          const cleanMp4 = u.split('?')[0];
          return { key: `mp4_${cleanMp4}`, url: u };
        }

        return null;
      };

      const seenVideoKeys = new Set<string>();
      let uniqueVideos: string[] = [];

      for (const raw of rawFoundVideos) {
        const norm = normalizeVideoUrl(raw);
        if (norm && !seenVideoKeys.has(norm.key)) {
          seenVideoKeys.add(norm.key);
          uniqueVideos.push(norm.url);
        }
      }

      // 5. Check for Part 2 / Part 3 / Redirect button links inside post body
      const partLinks: string[] = [];
      $postContent.find('a[href]').each((i, el) => {
        const text = $(el).text().trim().toLowerCase();
        const href = $(el).attr('href');
        if (href && href.startsWith('http') && !href.includes(url)) {
          if (
            text.includes('part 2') ||
            text.includes('part-2') ||
            text.includes('part 3') ||
            text.includes('part-3') ||
            text.includes('part 4') ||
            text.includes('episode 2') ||
            text.includes('দ্বিতীয়') ||
            $(el).hasClass('play-button') ||
            $(el).parent().hasClass('video-lock') ||
            (href.includes('blogspot.com/') && href.includes('blog-post_')) ||
            href.includes('tinyurl.com')
          ) {
            partLinks.push(href);
          }
        }
      });

      // Follow part links to fetch multiple parts/videos automatically
      for (const partHref of partLinks.slice(0, 5)) {
        try {
          console.log(`[server.ts] Fetching extra video part from: ${partHref}`);
          const partRes = await fetch(partHref, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html'
            },
            redirect: 'follow'
          });
          if (partRes.ok) {
            const partHtml = await partRes.text();
            const $p = cheerio.load(partHtml);
            const $partPost = $p('.post-body, .entry-content, [itemprop="articleBody"], body').first();
            
            // Extract videos from part
            const partRaw: string[] = [];
            $partPost.find('iframe, video, source, embed, object, a[href]').each((_, el) => {
              const src = $p(el).attr('src') || $p(el).attr('href') || $p(el).attr('data-src');
              if (src) partRaw.push(src);
            });
            const partMatches = ($partPost.html() || '').match(videoRegex) || [];
            partRaw.push(...partMatches);

            for (const r of partRaw) {
              const norm = normalizeVideoUrl(r);
              if (norm && !seenVideoKeys.has(norm.key)) {
                seenVideoKeys.add(norm.key);
                uniqueVideos.push(norm.url);
              }
            }

            // Extract high-res image from part if available
            $partPost.find('a[href], img').each((_, el) => {
              const h = $p(el).attr('href') || $p(el).attr('src') || '';
              const hi = toHighResBloggerImg(h);
              if (hi && (hi.includes('googleusercontent.com') || hi.includes('bp.blogspot.com')) && !uniqueImages.includes(hi)) {
                uniqueImages.push(hi);
              }
            });
          }
        } catch (partErr) {
          console.warn("[server.ts] Failed fetching part link:", partHref, partErr);
        }
      }
      
      // Return ALL extracted images and ALL extracted videos
      const cleanTitle = cleanAndDecodeBloggerText(title);
      const cleanDesc = cleanAndDecodeBloggerText(extractedDescription);
      res.json({ 
        title: cleanTitle, 
        description: cleanDesc, 
        caption: cleanDesc, 
        images: uniqueImages, 
        videos: uniqueVideos 
      });
    } catch(err: any) {
      console.error("Error scraping blogger:", err);
      res.status(500).json({ error: err.message || "Failed to scrape" });
    }
  });

  // Telegram automatic post endpoint
  app.post("/api/telegram/post", async (req, res) => {
    try {
      const { title, description, telegramDescription, thumbnailUrl, videoLink, providedBotToken, providedChatId } = req.body;
      const botToken = providedBotToken || process.env.TELEGRAM_BOT_TOKEN;
      const chatId = providedChatId || process.env.TELEGRAM_CHANNEL_ID;

      if (!botToken || !chatId) {
        return res.status(400).json({ error: "Telegram credentials not configured" });
      }

      // Build caption
      const safeTitle = (title ? String(title).trim() : 'New Viral Video')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      let caption = `<b>${safeTitle}</b>\n\n`;
      
      // Share link comes before the description
      if (videoLink) {
        caption += `🎬 <b>Watch Now / Share Link:</b>\n${videoLink}\n\n`;
      }

      // Telegram post gets telegramDescription if provided; only falls back to description if telegramDescription is empty
      const finalDescription = (telegramDescription && String(telegramDescription).trim())
        ? String(telegramDescription).trim()
        : (description ? String(description).trim() : '');
      if (finalDescription) {
        const safeDesc = finalDescription
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        caption += `${safeDesc}`;
      }

      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(telegramUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            photo: thumbnailUrl,
            caption: caption,
            parse_mode: 'HTML'
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const result = await response.json();
        
        if (!result.ok) {
          throw new Error(result.description || "Failed to post photo to Telegram");
        }
        
        return res.json({ success: true, message: "Posted to Telegram successfully" });
      } catch (photoError) {
        console.warn("Failed to send photo to Telegram, falling back to text message...", photoError);
        
        // Fallback to sendMessage
        const textMessageUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const textContent = `${caption}\n\n🖼️ <a href="${thumbnailUrl}">View Thumbnail Image</a>`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        
        const response = await fetch(textMessageUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: textContent,
            parse_mode: 'HTML',
            disable_web_page_preview: false
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const result = await response.json();
        
        if (!result.ok) {
          throw new Error(result.description || "Fallback text message failed");
        }
        
        return res.json({ success: true, message: "Posted text fallback to Telegram" });
      }
    } catch (error: any) {
      console.error("Telegram post error:", error);
      return res.status(500).json({ error: error.message || "Failed to post" });
    }
  });

  // Proxy download to prevent taking users to Dropbox site directly
  app.get("/api/proxy-download", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).send("URL parameter is missing");
      }

      console.log(`Proxying download from: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      // Set headers for file download so browser treats it as a file directly
      const safeAppFile = String(req.query.name || 'streamhub-app').replace(/[^a-zA-Z0-9._-]/g, '_') + '.apk';
      res.setHeader('Content-Disposition', `attachment; filename="${safeAppFile}"`);
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      
      if (response.headers.get('content-length')) {
        res.setHeader('Content-Length', response.headers.get('content-length')!);
      }

      // Buffer into memory and send (simplest and most reliable for 33MB)
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
      
    } catch (error: any) {
      console.error("Proxy download error:", error);
      res.status(500).send("Failed to download file");
    }
  });

  app.get("/api/download-dist", async (req, res) => {
    try {
      const fs = await import("fs");
      const publicZipPath = path.join(process.cwd(), "public", "dist.zip");
      const distZipPath = path.join(process.cwd(), "dist", "dist.zip");

      // Force rebuild if fresh=1 or if public/dist.zip doesn't exist yet
      if (req.query.fresh === '1' || !fs.existsSync(publicZipPath)) {
        const { execSync } = await import("child_process");
        execSync("node scripts/build-dist-zip.mjs", { stdio: 'inherit' });
      }

      if (fs.existsSync(publicZipPath)) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="dist.zip"');
        return res.download(publicZipPath, "dist.zip");
      }

      res.status(404).send("dist.zip could not be found or built.");
    } catch (error) {
      console.error("Error creating zip:", error);
      res.status(500).send("Error creating zip file");
    }
  });

  // Direct download for dist.zip
  app.get("/dist.zip", (req, res) => {
    const zipPath = path.join(process.cwd(), "public", "dist.zip");
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="dist.zip"');
    res.download(zipPath, "dist.zip");
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }


  // Daily auto-gift cron removed - gifting and Telegram posting is exclusively executed manually by Admin on button click.

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    
    // Setup cron for scheduled videos
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
    const supabaseAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHANNEL_ID;

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      
      setInterval(async () => {
        try {
          const now = Date.now();

          // Process scheduled custom text posts
          try {
            const { data: textPostsData } = await supabase.from('settings').select('*').eq('id', 'scheduled_text_posts').single();
            if (textPostsData && textPostsData.data && Array.isArray(textPostsData.data.posts)) {
              let updated = false;
              const posts = textPostsData.data.posts;
              
              // Find telegram credentials
              let currentBotToken = botToken;
              let currentChatId = chatId;
              try {
                const { data: secretData } = await supabase.from('settings').select('*').eq('id', 'telegram_secrets').single();
                if (secretData && secretData.data) {
                  currentBotToken = secretData.data.botToken || currentBotToken;
                  currentChatId = secretData.data.channelId || currentChatId;
                }
              } catch (e) {}

              const todayBD = getBDDateString(now);
              for (let i = 0; i < posts.length; i++) {
                const post = posts[i];
                if (post.status === 'pending' && post.scheduledFor <= now) {
                  if (post.lastPostedAt && getBDDateString(post.lastPostedAt) === todayBD) {
                    console.log(`[server.ts] Skipping already posted text post for today: ${post.id}`);
                    continue;
                  }

                  const lockKey = post.isDaily 
                    ? `text_post_daily_${post.id}_${todayBD}` 
                    : `text_post_${post.id}`;
                  const acquired = await acquireServerTelegramLock(supabase, lockKey);
                  if (!acquired) {
                    console.log(`[server.ts] Skipping already processed text post ${post.id}`);
                    continue;
                  }

                  updated = true;
                  if (post.isDaily) {
                    const nextMs = post.scheduledFor + (24 * 60 * 60 * 1000);
                    posts[i].scheduledFor = nextMs;
                    posts[i].status = 'pending';
                    console.log(`Posted daily custom text post ${post.id}. Rescheduled for +24h.`);
                  } else {
                    posts[i].status = 'posted';
                    console.log(`Posted custom text post ${post.id} to Telegram successfully.`);
                  }
                  posts[i].lastPostedAt = now;

                  if (currentBotToken && currentChatId) {
                    try {
                      const textUrl = `https://api.telegram.org/bot${currentBotToken}/sendMessage`;
                      const res = await fetch(textUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          chat_id: currentChatId,
                          text: post.textContent,
                          disable_web_page_preview: false
                        })
                      });
                      if (!res.ok) {
                        console.error(`Failed to post custom text post ${post.id}.`);
                      }
                    } catch (e) {
                      console.error(`Exception posting custom text post ${post.id}:`, e);
                    }
                  } else {
                    console.error('No Telegram credentials available for scheduled post.');
                  }
                }
              }

              if (updated) {
                await supabase.from('settings').upsert({
                  id: 'scheduled_text_posts',
                  data: { posts, updatedAt: Date.now() }
                });
              }
            }
          } catch (e) {
            console.error("Error processing scheduled text posts:", e);
          }

          // Find scheduled videos whose time has passed
          const { data: videos, error } = await supabase
            .from('videos')
            .select('*')
            .eq('status', 'scheduled')
            .lte('created_at', now);
            
          if (error) {
            console.error('Error fetching scheduled videos:', error);
            return;
          }
          
          if (videos && videos.length > 0) {
            console.log(`Found ${videos.length} scheduled videos to publish.`);
            
            for (const video of videos) {
              const lockKey = `video_${video.id}`;
              const acquired = await acquireServerTelegramLock(supabase, lockKey);
              if (!acquired) {
                console.log(`[server.ts] Video ${video.id} already posted to Telegram or locked, skipping.`);
                continue;
              }

              // Atomically claim and mark as published
              const { data: claimedRows, error: updateError } = await supabase
                .from('videos')
                .update({ status: 'published' })
                .eq('id', video.id)
                .eq('status', 'scheduled')
                .select();
                
              if (updateError) {
                console.error(`Failed to publish video ${video.id}:`, updateError);
                continue;
              }

              if (!claimedRows || claimedRows.length === 0) {
                console.log(`[server.ts] Video ${video.id} was already claimed/published by another worker, skipping.`);
                continue;
              }
              
              console.log(`Published video: ${video.id}`);
              
              // Post to Telegram (category-wise channel resolution)
              let currentBotToken = botToken;
              let currentChatId = chatId;
              let defaultDescription = '';
              let categoryChannels: Record<string, string> = {};
              
              try {
                const { data: secretData } = await supabase.from('settings').select('*').eq('id', 'telegram_secrets').single();
                if (secretData && secretData.data) {
                  currentBotToken = secretData.data.botToken || currentBotToken;
                  currentChatId = secretData.data.channelId || currentChatId;
                  defaultDescription = secretData.data.defaultDescription || '';
                  if (secretData.data.categoryChannels && typeof secretData.data.categoryChannels === 'object') {
                    categoryChannels = secretData.data.categoryChannels;
                  }
                }
              } catch (e) {
                console.warn("Could not read telegram secrets from supabase in cron", e);
              }

              const normTgId = (raw?: string) => {
                if (!raw) return '';
                const t = raw.trim();
                if (!t) return '';
                if (/^-?\d+$/.test(t)) return t;
                if (/(?:t\.me\/(?:\+|joinchat\/)|telegram\.me\/(?:\+|joinchat\/))/i.test(t)) return '';
                let c = t
                  .replace(/^https?:\/\/(www\.)?(t\.me|telegram\.me|telegram\.dog)\//i, '')
                  .replace(/^(t\.me|telegram\.me|telegram\.dog)\//i, '')
                  .split(/[?#\/]/)[0]
                  .trim();
                if (!c) return '';
                return c.startsWith('@') ? c : `@${c}`;
              };

              const fallbackNorm = normTgId(currentChatId);
              const rawVideoCat = (video.category_id || video.categoryId || video.category || '') as string;
              const catNames = rawVideoCat.split(',').map((s: string) => s.trim()).filter(Boolean);
              const resolvedSet = new Set<string>();

              for (const cName of catNames) {
                let matched = '';
                const lower = cName.toLowerCase();
                for (const [k, v] of Object.entries(categoryChannels)) {
                  if (k.trim().toLowerCase() === lower && v) {
                    matched = normTgId(v);
                    break;
                  }
                }
                const target = matched || fallbackNorm;
                if (target) resolvedSet.add(target);
              }
              if (resolvedSet.size === 0 && fallbackNorm) {
                resolvedSet.add(fallbackNorm);
              }
              const targetChannels = Array.from(resolvedSet);
              
              if (currentBotToken && targetChannels.length > 0) {
                const baseAppUrl = (process.env.APP_URL || '').replace(/\/$/, '');
                const videoLink = baseAppUrl ? `${baseAppUrl}/video/${video.id}` : `/video/${video.id}`;
                
                const safeTitle = video.title ? video.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
                let caption = `<b>${safeTitle}</b>\n\n`;
                caption += `🎬 <b>Watch Now / Share Link:</b>\n${videoLink}\n\n`;
                const finalDesc = (defaultDescription && defaultDescription.trim()) ? defaultDescription.trim() : (video.description || '');
                if (finalDesc) {
                  const safeDesc = finalDesc.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                  caption += `${safeDesc}`;
                }
                
                const photoCaption = caption.length > 1024 ? caption.substring(0, 1020) + '...' : caption;

                for (const targetCh of targetChannels) {
                  try {
                    const tgUrl = `https://api.telegram.org/bot${currentBotToken}/sendPhoto`;
                    const photoRes = await fetch(tgUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        chat_id: targetCh,
                        photo: video.thumbnail_url || video.thumbnailUrl,
                        caption: photoCaption,
                        parse_mode: 'HTML'
                      })
                    });
                    
                    if (!photoRes.ok) {
                      throw new Error("Photo post failed");
                    }
                    console.log(`Posted video ${video.id} to Telegram channel ${targetCh} successfully.`);
                  } catch (photoErr) {
                    console.warn(`Fallback to text message for Telegram post: ${video.id} (${targetCh})`);
                    const textCaption = caption.length > 4000 ? caption.substring(0, 4000) + '...' : caption;
                    const thumb = video.thumbnail_url || video.thumbnailUrl;
                    const tgThumbLink = thumb ? `\n\n🖼️ <a href="${thumb.replace(/&/g, '&amp;')}">View Thumbnail Image</a>` : '';
                    
                    try {
                      const textUrl = `https://api.telegram.org/bot${currentBotToken}/sendMessage`;
                      await fetch(textUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          chat_id: targetCh,
                          text: `${textCaption}` + tgThumbLink,
                          parse_mode: 'HTML',
                          disable_web_page_preview: false
                        })
                      });
                    } catch (e) {
                      console.error(`Total Telegram fallback failed in cron (${targetCh}):`, e);
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error("Error in scheduled publishing interval:", e);
        }
      }, 60000); // Check every minute
    } else {
      console.warn("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set for scheduled publishing.");
    }
  });
}

startServer();
