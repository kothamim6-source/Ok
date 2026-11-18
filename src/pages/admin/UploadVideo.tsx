import React, { useState, useEffect, useRef } from 'react';
import { Upload, Image as ImageIcon, CheckCircle, XCircle, Link as LinkIcon, FileVideo, Plus, Trash2, Layers, CheckSquare, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { Category, VideoPart } from '../../types';
import { tryAcquireTelegramLock, markTelegramLocked } from '../../lib/telegramDeduplication';
import {
  fetchTelegramSecretsConfig,
  resolveTargetChannels,
  postVideoToTelegramChannels
} from '../../lib/telegramChannelService';

import { getVideoDuration, getFullThumbnailUrl } from '../../lib/utils';

type VideoPartInput = {
  id: string;
  title: string;
  url: string;
  duration: string;
};

export function UploadVideo() {
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('single');
  const [isUploading, setIsUploading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Bulk Upload State
  const [bulkRawText, setBulkRawText] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkIsPremium, setBulkIsPremium] = useState(false);
  const [bulkThumbnails, setBulkThumbnails] = useState('');
  const [bulkStatusLog, setBulkStatusLog] = useState<string[]>([]);
  const [bulkSuccessCount, setBulkSuccessCount] = useState(0);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [order, setOrder] = useState<number | ''>('');
  const [addToBanner, setAddToBanner] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [thumbnailUrlInput, setThumbnailUrlInput] = useState('');

  // SEO Meta
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');

  const [publishStatus, setPublishStatus] = useState<'published' | 'draft' | 'scheduled'>('published');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const [videoParts, setVideoParts] = useState<VideoPartInput[]>([
    { id: '1', title: 'Part 1', url: '', duration: '' }
  ]);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const { data, error } = await supabase.from('categories').select('*');
        if (data) {
          const fetched = data.map(doc => ({ id: doc.id, ...doc }));
          fetched.sort((a, b) => (a.order || 0) - (b.order || 0));
          setCategories(fetched);
          if (fetched.length > 0) {
            setCategory(fetched[0].name);
            setBulkCategory(fetched[0].name);
          }
        }
      } catch (err) {
        console.error("Error fetching categories:", err);
      }
    }
    fetchCategories();
  }, []);

  // Handle Bulk Upload of multiple video links / Google Drive / Telegram links
  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkRawText.trim()) {
      setStatus('error');
      setMessage('অনুগ্রহ করে অন্তত ১টি ভিডিও লিংক দিন!');
      return;
    }

    setIsUploading(true);
    setStatus('uploading');
    setProgress(0);
    setBulkStatusLog([]);
    setBulkSuccessCount(0);

    const lines = bulkRawText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'));

    if (lines.length === 0) {
      setIsUploading(false);
      setStatus('error');
      setMessage('কোনো বৈধ ভিডিও লিংক পাওয়া যায়নি!');
      return;
    }

    const thumbList = bulkThumbnails
      .split('\n')
      .map(t => t.trim())
      .filter(Boolean);

    let successCount = 0;
    const logs: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Format supported: "Title | VideoUrl" OR just "VideoUrl"
      let itemTitle = '';
      let itemUrl = line;

      if (line.includes('|')) {
        const parts = line.split('|');
        itemTitle = parts[0].trim();
        itemUrl = parts.slice(1).join('|').trim();
      } else {
        // Auto title from filename or category
        const urlName = itemUrl.split('/').pop()?.split('?')[0]?.replace(/[-_]/g, ' ') || '';
        itemTitle = urlName && urlName.length > 3 ? decodeURIComponent(urlName) : `${bulkCategory || 'Viral Video'} #${i + 1}`;
      }

      const assignedThumb = thumbList[i] || thumbList[0] || settings?.defaultThumbnailUrl || '';
      const slug = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      try {
        const videoData: any = {
          id: slug,
          title: itemTitle,
          slug,
          description: settings?.defaultVideoDescription || '',
          thumbnail_url: assignedThumb,
          video_url: itemUrl,
          duration: '00:00',
          is_premium: bulkIsPremium,
          category_id: bulkCategory || category,
          views: 0,
          likes: 0,
          status: 'published',
          visibility: 'public',
          created_at: Date.now() - (lines.length - i) * 1000 // stagger timestamps
        };

        let res = await supabase.from('videos').insert([videoData]);
        if (res.error) {
          // fallback schema check
          await supabase.from('videos').insert([{
            id: slug,
            title: itemTitle,
            slug,
            description: settings?.defaultVideoDescription || '',
            thumbnailUrl: assignedThumb,
            videoUrl: itemUrl,
            duration: '00:00',
            isPremium: bulkIsPremium,
            category: bulkCategory || category,
            views: 0,
            likes: 0,
            status: 'published',
            visibility: 'public',
            createdAt: Date.now()
          }]);
        }

        successCount++;
        logs.push(`✅ [${i + 1}/${lines.length}] আপলোড সফল: ${itemTitle}`);
      } catch (err: any) {
        logs.push(`❌ [${i + 1}/${lines.length}] ব্যর্থ: ${itemTitle} (${err?.message || 'Error'})`);
      }

      setBulkStatusLog([...logs]);
      setProgress(Math.round(((i + 1) / lines.length) * 100));
    }

    setBulkSuccessCount(successCount);
    setIsUploading(false);
    setStatus('success');
    setMessage(`মোট ${successCount} টি ভিডিও সফলভাবে বাল্ক আপলোড সম্পন্ন হয়েছে!`);
    setBulkRawText('');
  };

  const handleAddPart = () => {
    const newId = Date.now().toString();
    setVideoParts([...videoParts, { id: newId, title: `Part ${videoParts.length + 1}`, url: '', duration: '' }]);
  };

  const handleRemovePart = (id: string) => {
    if (videoParts.length === 1) return;
    setVideoParts(videoParts.filter(p => p.id !== id));
  };

  const updatePart = async (id: string, field: keyof VideoPartInput, value: any) => {
    const newParts = videoParts.map(p => p.id === id ? { ...p, [field]: value } : p);
    
    // Auto-fetch duration if url changes
    if (field === 'url' && value) {
      const dur = await getVideoDuration(value);
      if (dur) {
        const index = newParts.findIndex(p => p.id === id);
        if (index !== -1) {
          newParts[index].duration = dur;
        }
      }
    }
    
    setVideoParts(newParts);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmittingRef.current || isUploading) {
      console.warn("Upload already in progress, ignoring duplicate submission.");
      return;
    }
    
    // Validation
    for (let i = 0; i < videoParts.length; i++) {
      const part = videoParts[i];
      if (!part.url) {
        setStatus('error');
        setMessage(`Please enter a video URL for ${part.title}.`);
        return;
      }
    }

    const finalThumbnailUrlInput = getFullThumbnailUrl(thumbnailUrlInput || settings?.defaultThumbnailUrl || '');

    if (!finalThumbnailUrlInput) {
      setStatus('error');
      setMessage('Please enter a thumbnail URL or set a default in Settings.');
      return;
    }

    if (!user) {
      setStatus('error');
      setMessage('Database is not initialized or user not logged in.');
      return;
    }

    isSubmittingRef.current = true;
    setIsUploading(true);
    setStatus('uploading');
    setProgress(0);
    setMessage('');

    let scheduledFor = null;
    if (publishStatus === 'scheduled') {
      if (!scheduledDate || !scheduledTime) {
        setStatus('error');
        setMessage("Please select date and time for scheduled publish");
        setIsUploading(false);
        return;
      }
      scheduledFor = new Date(`${scheduledDate}T${scheduledTime}:00+06:00`).getTime();
    }

    try {
      const finalThumbUrls = finalThumbnailUrlInput.split(/[\n,]+/).map(u => u.trim()).filter(Boolean);
      const finalThumbUrl = finalThumbUrls[0] || '';

      const uploadedParts: VideoPart[] = [];

      for (let i = 0; i < videoParts.length; i++) {
        const part = videoParts[i];
        let finalVideoUrl = '';
        let finalDuration = part.duration;

        if (!finalDuration || finalDuration === '0:00') {
          finalDuration = await getVideoDuration(part.url);
        }
        if (!finalDuration) finalDuration = '0:00';
        
        finalVideoUrl = part.url;
        
        setProgress(Math.round(((i + 1) / videoParts.length) * 100));

        uploadedParts.push({
          id: part.id,
          title: part.title,
          videoUrl: finalVideoUrl,
          duration: finalDuration
        });
      }
      
      const effectiveTitle = (title && title.trim()) ? title.trim() : (category ? category.trim() : 'New Video');
      const cleanSlugBase = effectiveTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'video';
      const slug = `${cleanSlugBase}-${Math.floor(Math.random() * 1000)}`;

      // Save to Supabase
      const videoData = {
        id: slug,
        title: effectiveTitle,
        slug: slug,
        description: description,
        thumbnail_url: finalThumbUrl,
        video_url: uploadedParts.length > 1 ? JSON.stringify(uploadedParts) : (uploadedParts.length > 0 ? uploadedParts[0].videoUrl : ''),
        duration: uploadedParts.length > 0 ? uploadedParts[0].duration : '',
        is_premium: isPremium,
        category_id: category,
        views: 0,
        likes: 0,
        status: publishStatus,
        visibility: 'public',
        created_at: scheduledFor ? scheduledFor : Date.now()
      };
      
      let resInsert = await supabase.from('videos').insert([videoData]).select().single();
      
      if (resInsert.error && (resInsert.error.message.includes('thumbnail_url') || resInsert.error.message.includes('category_id'))) {
        resInsert = await supabase.from('videos').insert([{
          id: slug,
          title: effectiveTitle,
          slug: slug,
          description: description,
          thumbnailUrl: finalThumbUrl,
          videoUrl: uploadedParts.length > 1 ? JSON.stringify(uploadedParts) : (uploadedParts.length > 0 ? uploadedParts[0].videoUrl : ''),
          duration: uploadedParts.length > 0 ? uploadedParts[0].duration : '',
          isPremium: isPremium,
          category: category,
          views: 0,
          likes: 0,
          status: publishStatus,
          visibility: 'public',
          createdAt: scheduledFor ? scheduledFor : Date.now()
        }]).select().single();
      }

      const { data: newVideo, error: insertError } = resInsert;

      if (insertError) throw insertError;
      const newVideoRef = { id: newVideo.id };

      if (addToBanner) {
        const id = crypto.randomUUID();
        let res = await supabase.from('banners').insert([{
          id,
          title: title,
          image_url: finalThumbUrl,
          link_url: `/video/${slug}`,
          is_active: true,
          is_premium: isPremium,
          "order": order === '' ? 0 : Number(order),
          created_at: Date.now()
        }]);
        
        if (res.error && (res.error.message.includes('image_url') || res.error.message.includes('is_active') || res.error.code === 'PGRST204')) {
           res = await supabase.from('banners').insert([{
            id,
            title: title,
            imageUrl: finalThumbUrl,
            linkUrl: `/video/${slug}`,
            isActive: true,
            isPremium: isPremium,
            "order": order === '' ? 0 : Number(order),
            created_at: Date.now()
          }]);
        }
      }

      try {
        await supabase.from('admin_logs').insert([{
          admin_id: user.id,
          action: 'UPLOAD_VIDEO',
          details: `Uploaded video: ${title} (${newVideoRef.id})`,
          created_at: Date.now()
        }]);
      } catch (err) {
        console.warn("Failed to write to admin_logs (table may not exist)", err);
      }

      // Automatically post to Telegram only if published immediately
      if (publishStatus === 'published') {
        const lockKey = `video_${newVideoRef.id}`;
        try {
          const acquired = await tryAcquireTelegramLock(lockKey);
          if (!acquired) {
            console.log(`[UploadVideo] Telegram post already sent or locked for video ${newVideoRef.id}`);
          } else {
            const videoLink = `${window.location.origin}/video/${newVideoRef.id}`;
            const secrets = await fetchTelegramSecretsConfig();
            const targetChannels = resolveTargetChannels(category, secrets, '__AUTO__');

            if (secrets.botToken && targetChannels.length > 0) {
              const finalTelegramDesc = (secrets.defaultDescription && secrets.defaultDescription.trim())
                ? secrets.defaultDescription.trim()
                : (description ? description.trim() : '');

              const tgResult = await postVideoToTelegramChannels({
                videoId: newVideoRef.id,
                title: effectiveTitle,
                description,
                telegramDescription: finalTelegramDesc,
                thumbnailUrl: finalThumbUrl,
                videoLink,
                botToken: secrets.botToken,
                targetChannels,
                customApiUrl: secrets.customApiUrl
              });

              if (tgResult.succeededChannels.length > 0) {
                markTelegramLocked(lockKey);
              }
            }
          }
        } catch (tgError) {
          console.error("Failed to post to Telegram:", tgError);
        }
      }

      setStatus('success');
      setMessage('Video uploaded successfully!');
      setIsUploading(false);
      isSubmittingRef.current = false;
      
      setTitle('');
      setDescription('');
      setThumbnailUrlInput('');
      setOrder('');
      setVideoParts([{ id: Date.now().toString(), title: 'Part 1', url: '', duration: '' }]);
      setAddToBanner(false);
      setPublishStatus('published');
      setScheduledDate('');
      setScheduledTime('');
      setProgress(0);
    } catch (error: any) {
      console.error("Upload error:", error);
      setStatus('error');
      setMessage(error.message || 'An error occurred during upload');
      setIsUploading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="mx-auto max-w-3xl pb-12">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Upload Video</h1>
          <p className="text-sm text-gray-400 mt-1">Publish a single video with parts or bulk upload multiple video links at once.</p>
        </div>

        {/* Upload Mode Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-white/5 border border-white/10 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => setUploadMode('single')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              uploadMode === 'single'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Single Video</span>
          </button>
          <button
            type="button"
            onClick={() => setUploadMode('bulk')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              uploadMode === 'bulk'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Bulk Upload (মাল্টি-ভিডিও)</span>
          </button>
        </div>
      </div>

      {status === 'success' && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/15 p-4 text-emerald-300 font-bold text-sm shadow-lg shadow-emerald-500/10">
          <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
          <p>{message}</p>
        </div>
      )}

      {status === 'error' && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/15 p-4 text-red-400 font-bold text-sm shadow-lg shadow-red-500/10">
          <XCircle className="h-5 w-5 shrink-0 text-red-500" />
          <p>{message}</p>
        </div>
      )}

      {/* --- BULK UPLOAD VIEW --- */}
      {uploadMode === 'bulk' ? (
        <form onSubmit={handleBulkUpload} className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-white/5 p-6 lg:p-8 shadow-2xl">
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
            <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>বাল্ক ভিডিও আপলোড নিয়মাবলী (Bulk Import Format):</span>
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              প্রতি লাইনে ১টি করে ভিডিও লিংক দিন (Direct MP4, Google Drive, StreamTape, Doodstream, Telegram direct link ইত্যাদি)।<br />
              <b>ফরম্যাট ১:</b> <code className="bg-black/50 px-1 py-0.5 rounded text-amber-300">ভিডিওর টাইটেল | https://link-to-video.mp4</code><br />
              <b>ফরম্যাট ২:</b> শুধুমাত্র লিংক পেস্ট করলেও স্বয়ংক্রিয়ভাবে নাম তৈরি হয়ে যাবে।
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-white flex items-center justify-between">
              <span>ভিডিও লিংকসমূহ (প্রতি লাইনে ১টি) *</span>
              <span className="text-xs text-gray-400 font-normal">
                {bulkRawText.split('\n').filter(l => l.trim()).length} টি লিংক যুক্ত হয়েছে
              </span>
            </label>
            <textarea
              required
              rows={8}
              value={bulkRawText}
              onChange={(e) => setBulkRawText(e.target.value)}
              placeholder="Movie Part 1 | https://example.com/video1.mp4&#10;Viral Video 2 | https://drive.google.com/file/d/xxx/preview&#10;https://example.com/direct-video3.mp4"
              className="rounded-xl border border-white/10 bg-black/50 p-4 font-mono text-xs sm:text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-white">Category (ক্যাটাগরি)</label>
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                className="rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-red-500 outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name} className="bg-black text-white">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-white">Access Level</label>
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/50 p-2.5 cursor-pointer hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={bulkIsPremium}
                  onChange={(e) => setBulkIsPremium(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-600 bg-black"
                />
                <span className="text-sm font-bold text-yellow-500">Premium / VIP Only</span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-white">
              Default Thumbnails URL (ঐচ্ছিক - প্রতি লাইনে ১টি)
            </label>
            <textarea
              rows={3}
              value={bulkThumbnails}
              onChange={(e) => setBulkThumbnails(e.target.value)}
              placeholder="https://example.com/thumb1.jpg&#10;https://example.com/thumb2.jpg"
              className="rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-xs text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-white">
                <span>আপলোড প্রোগ্রেস...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {bulkStatusLog.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-black/70 p-3 space-y-1 text-xs font-mono">
                  {bulkStatusLog.map((log, idx) => (
                    <div key={idx} className="text-zinc-300">{log}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-white/10">
            <button
              type="submit"
              disabled={isUploading}
              className="rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 px-8 py-3 text-sm font-black text-white shadow-xl shadow-red-950/50 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isUploading ? `বাল্ক আপলোড হচ্ছে (${progress}%)...` : 'সব ভিডিও একসাথে আপলোড করুন (Bulk Publish)'}
            </button>
          </div>
        </form>
      ) : (
        /* --- SINGLE VIDEO UPLOAD VIEW --- */
        <form onSubmit={handleUpload} className="flex flex-col gap-8 rounded-xl border border-white/10 bg-white/5 p-6 lg:p-8">

        {/* Thumbnail Section */}
        <div className="rounded-xl border border-white/5 bg-black/20 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-red-500" />
              Thumbnail Image (URL)
            </h2>
          </div>

          <div className="pt-2">
            <label className="text-sm font-bold text-gray-300 mb-2 block">Direct Image URLs (Comma or line-break separated) {settings?.defaultThumbnailUrl && <span className="text-xs text-gray-500 font-normal ml-2">(Optional - using default)</span>}</label>
            <div className="relative">
              <textarea 
                value={thumbnailUrlInput}
                onChange={(e) => setThumbnailUrlInput(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/50 p-4 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Video Parts Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileVideo className="h-5 w-5 text-red-500" />
              Video Parts (Episodes/Clips)
            </h2>
          </div>
          
          <div className="space-y-6">
            {videoParts.map((part, index) => (
              <div key={part.id} className="rounded-xl border border-white/5 bg-black/20 p-5 relative group">
                {videoParts.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => handleRemovePart(part.id)}
                    className="absolute -right-2 -top-2 bg-red-600 rounded-full p-1.5 text-white hover:bg-red-700 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}

                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-4 mb-4 gap-4">
                  <input
                    type="text"
                    value={part.title}
                    onChange={(e) => updatePart(part.id, 'title', e.target.value)}
                    className="bg-transparent border-none text-white font-bold px-0 focus:ring-0 text-lg flex-1"
                    placeholder="Part Title (e.g. Part 1, Episode 1)"
                    required
                  />
                </div>

                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-sm font-bold text-gray-300 mb-2 block">Direct Video/Embed URL</label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                        <LinkIcon className="h-5 w-5" />
                      </div>
                      <input 
                        type="url" 
                        value={part.url}
                        onChange={(e) => updatePart(part.id, 'url', e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black/50 pl-10 pr-4 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                        placeholder="https://example.com/video.mp4 or YouTube Link"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-300 mb-2 block">Duration (Optional)</label>
                    <input 
                      type="text" 
                      value={part.duration}
                      onChange={(e) => updatePart(part.id, 'duration', e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                      placeholder="e.g. 12:34"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddPart}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-transparent py-4 text-sm font-bold text-white hover:border-red-500 hover:text-red-500 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Another Part
          </button>
        </div>

        {/* Metadata Section */}
        <div className="space-y-6 pt-2">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-white">Title</label>
                {category && (
                  <span className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                    {!title.trim() ? `খালি থাকলে '${category}' টাইটেল হবে` : `ক্যাটাগরি: ${category}`}
                  </span>
                )}
              </div>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-lg border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 placeholder-gray-500"
                placeholder={category ? `টাইটেল লিখুন (খালি রাখলে '${category}' সেভ হবে)` : "ভিডিওর টাইটেল লিখুন"}
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-white">Video Access</label>
              <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/50 p-3 cursor-pointer hover:bg-white/5 transition-colors">
                <input 
                  type="checkbox" 
                  checked={isPremium}
                  onChange={(e) => setIsPremium(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-600 bg-black"
                />
                <span className="text-sm font-bold text-yellow-500">Premium / VIP Only</span>
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-white">Add to Banner</label>
              <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/50 p-3 cursor-pointer hover:bg-white/5 transition-colors">
                <input 
                  type="checkbox" 
                  checked={addToBanner}
                  onChange={(e) => setAddToBanner(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-600 bg-black"
                />
                <span className="text-sm font-bold text-blue-400">Set as Banner</span>
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-white">Category</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                {categories.length === 0 ? (
                  <option value="Entertainment">Entertainment</option>
                ) : (
                  categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))
                )}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-white">Order (Serial)</label>
              <input 
                type="number" 
                value={order}
                onChange={(e) => setOrder(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="1, 2, 3..."
                className="rounded-lg border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3 pt-6 border-t border-white/10 mt-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-white">Publish Status</label>
              <select
                value={publishStatus}
                onChange={(e) => setPublishStatus(e.target.value as any)}
                className="rounded-lg border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="published">Publish Now</option>
                <option value="draft">Save as Draft</option>
                <option value="scheduled">Schedule Publish</option>
              </select>
            </div>
            
            {publishStatus === 'scheduled' && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-white">Schedule Date</label>
                  <input
                    type="date"
                    required={publishStatus === 'scheduled'}
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="rounded-lg border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-white">Schedule Time</label>
                  <input
                    type="time"
                    required={publishStatus === 'scheduled'}
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="rounded-lg border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-6">
            <label className="text-sm font-bold text-white">Description</label>
            <textarea 
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="Write a description for this video..."
            />
          </div>

          {/* SEO Metadata */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            <h3 className="text-lg font-bold text-white">SEO Optimization</h3>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-white">Meta Title (Optional)</label>
              <input 
                type="text" 
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                className="rounded-lg border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder="Leave blank to use video title"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-white">Meta Description (Optional)</label>
              <textarea 
                rows={2}
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                className="rounded-lg border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder="Leave blank to use video description"
              />
            </div>
          </div>
        </div>

        {status === 'uploading' && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-bold text-white">
              <span>Uploading...</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div 
                className="h-full bg-red-600 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-2 flex items-center justify-end gap-4 border-t border-white/10 pt-6">
          <button 
            type="submit" 
            disabled={isUploading}
            className="rounded-lg bg-red-600 px-8 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black transition-all"
          >
            {isUploading ? 'Uploading Video...' : 'Publish Video'}
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
