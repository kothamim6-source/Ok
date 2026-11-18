import { getBDDateString, formatBDTime, getFullThumbnailUrl } from '../../lib/utils';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Video, Category, VideoPart } from '../../types';
import { Trash2, Edit, Eye, Save, X, Copy, Check, UploadCloud } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getVideoDuration } from '../../lib/utils';

export function AdminVideos() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'premium'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkCategorizing, setIsBulkCategorizing] = useState(false);
  
  const [isBulkTrending, setIsBulkTrending] = useState(false);
  const [isBulkBannering, setIsBulkBannering] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editThumbnailUrl, setEditThumbnailUrl] = useState('');
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editIsPremium, setEditIsPremium] = useState(false);
  const [editOrder, setEditOrder] = useState<number | ''>('');
  const [editParts, setEditParts] = useState<VideoPart[]>([]);
  const [editStatus, setEditStatus] = useState('published');
  const [editScheduledDate, setEditScheduledDate] = useState('');
  const [editScheduledTime, setEditScheduledTime] = useState('');
  
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyUrl = async (id: string, slug: string) => {
    const url = `${window.location.origin}/video/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch (err) {
      console.warn("Clipboard access blocked.");
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    fetchVideosAndCategories();
  }, []);

  async function fetchVideosAndCategories() {
    try {
      const { data, error } = await supabase.from('videos').select('*').order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      const fetchedVideos = (data || []).map(v => {
        let parsedParts;
        const rawUrl = v.video_url || v.videoUrl;
        let finalUrl = rawUrl;
        if (rawUrl && rawUrl.startsWith('[') && rawUrl.endsWith(']')) {
          try {
            parsedParts = JSON.parse(rawUrl);
            if (parsedParts.length > 0) finalUrl = parsedParts[0].videoUrl;
          } catch(e) {}
        }
        return {
          id: v.id, title: v.title, slug: v.slug, description: v.description, thumbnailUrl: v.thumbnail_url || v.thumbnailUrl, videoUrl: finalUrl, duration: v.duration, parts: parsedParts, isPremium: v.is_premium !== undefined ? v.is_premium : v.isPremium, is_trending: v.is_trending, categoryId: v.category_id || v.categoryId || v.category, views: v.views, likes: v.likes, status: v.status, visibility: v.visibility, featured: v.featured, createdAt: v.created_at || v.createdAt, tags: [], updatedAt: v.updated_at || v.updatedAt || v.created_at || v.createdAt
        } as Video;
      });
      setVideos(fetchedVideos);

      const { data: catData } = await supabase.from('categories').select('*');
      if (catData) {
        setCategories(catData.map(c => ({ id: c.id, name: c.name, slug: c.slug, image: c.image, status: c.status, createdAt: c.created_at } as Category)));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this video?')) {
      try {
        await supabase.from('videos').delete().eq('id', id);
        setVideos(videos.filter(v => v.id !== id));
        setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
      } catch (error) {
        console.error("Error deleting video:", error);
        alert('Failed to delete video.');
      }
    }
  };

  const startEdit = (video: Video) => {
    setEditingId(video.id);
    setEditTitle(video.title);
    setEditCategory(video.category || 'Entertainment');
    setEditThumbnailUrl(video.thumbnailUrl || '');
    if (video.parts && video.parts.length > 0) {
      setEditParts(JSON.parse(JSON.stringify(video.parts))); // deep copy
      setEditVideoUrl('');
      setEditDuration('');
    } else {
      setEditVideoUrl(video.videoUrl || '');
      setEditDuration(video.duration || '0:00');
      setEditParts([]);
    }
    setEditIsPremium(video.isPremium || false);
    setEditOrder(video.order !== undefined ? video.order : '');
    setEditStatus(video.status || 'published');
    if (video.scheduledFor) {
      const d = new Date(video.scheduledFor);
      setEditScheduledDate(getBDDateString(d));
      setEditScheduledTime(d.toTimeString().split(' ')[0].slice(0, 5));
    } else {
      setEditScheduledDate('');
      setEditScheduledTime('');
    }
  };

  const updateEditPart = async (index: number, field: keyof VideoPart, value: string) => {
    const newParts = [...editParts];
    newParts[index] = { ...newParts[index], [field]: value };
    
    // Auto-fetch duration if url changes
    if (field === 'videoUrl' && value) {
      const dur = await getVideoDuration(value);
      if (dur) {
        newParts[index].duration = dur;
      }
    }
    
    setEditParts(newParts);
  };

  const handleSingleVideoUrlChange = async (url: string) => {
    setEditVideoUrl(url);
    if (url) {
      const dur = await getVideoDuration(url);
      if (dur) {
        setEditDuration(dur);
      }
    }
  };

  const saveEdit = async (id: string) => {
    try {
      const orderValue = editOrder === '' ? 0 : Number(editOrder);
      let scheduledForTime = null;
      if (editStatus === 'scheduled' && editScheduledDate && editScheduledTime) {
        scheduledForTime = new Date(`${editScheduledDate}T${editScheduledTime}:00+06:00`).getTime();
      }

      const updateData: any = {
        title: editTitle,
        category_id: editCategory,
        thumbnail_url: editThumbnailUrl,
        is_premium: editIsPremium,
        status: editStatus,
        ...(scheduledForTime ? { created_at: scheduledForTime } : {})
        /* order: orderValue */
      };
      
      if (editParts.length > 0) {
        updateData.video_url = editParts.length > 1 ? JSON.stringify(editParts) : editParts[0].videoUrl;
        updateData.duration = editParts[0].duration;
      } else {
        updateData.video_url = editVideoUrl;
        updateData.duration = editDuration;
      }

      await supabase.from('videos').update(updateData).eq('id', id);
      
      const updatedVideos = videos.map(v => v.id === id ? { 
        ...v, 
        ...updateData
      } : v);
      updatedVideos.sort((a, b) => {
        const orderA = a.order || 0;
        const orderB = b.order || 0;
        
        if (orderA > 0 && orderB > 0) {
          if (orderA !== orderB) return orderA - orderB;
        } else if (orderA > 0) {
          return -1;
        } else if (orderB > 0) {
          return 1;
        }
        return b.createdAt - a.createdAt;
      });
      setVideos(updatedVideos);
      setEditingId(null);
    } catch (error) {
      console.error("Error updating video:", error);
      alert("Failed to update video.");
    }
  };

  const filteredVideos = videos.filter(v => activeTab === 'all' ? !v.isPremium : v.isPremium);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredVideos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredVideos.map(v => v.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selId => selId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} videos?`)) {
      setIsBulkDeleting(true);
      try {
        for (const id of selectedIds) {
          await supabase.from('videos').delete().eq('id', id);
        }
        setVideos(videos.filter(v => !selectedIds.includes(v.id)));
        setSelectedIds([]);
        alert('Selected videos deleted successfully.');
      } catch (error) {
        console.error("Bulk delete error:", error);
        alert("Failed to delete some videos.");
      }
      setIsBulkDeleting(false);
    }
  };

  const handleBulkChangeCategory = async () => {
    if (selectedIds.length === 0 || !bulkCategory) return;
    setIsBulkCategorizing(true);
    try {
      for (const id of selectedIds) {
        await supabase.from('videos').update({ category_id: bulkCategory }).eq('id', id);
      }
      setVideos(videos.map(v => selectedIds.includes(v.id) ? { ...v, category: bulkCategory } : v));
      setSelectedIds([]);
      setBulkCategory('');
    } catch (error) {
      console.error("Error bulk updating categories:", error);
    } finally {
      setIsBulkCategorizing(false);
    }
  };

  const handleBulkTrending = async (status: boolean) => {
    if (selectedIds.length === 0) return;
    setIsBulkTrending(true);
    try {
      for (const id of selectedIds) {
        await supabase.from('videos').update({ is_trending: status }).eq('id', id);
      }
      setVideos(videos.map(v => selectedIds.includes(v.id) ? { ...v, is_trending: status } : v));
      setSelectedIds([]);
    } catch (error) {
      console.error("Error bulk trending:", error);
      alert("Failed to update trending status. (Ensure 'is_trending' column exists in Supabase)");
    } finally {
      setIsBulkTrending(false);
    }
  };

  const handleBulkAddToBanner = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkBannering(true);
    try {
      for (const id of selectedIds) {
        const video = videos.find(v => v.id === id);
        if (!video) continue;
        const bannerId = crypto.randomUUID();
        
        let res = await supabase.from('banners').insert([{
          id: bannerId,
          title: video.title,
          image_url: video.thumbnailUrl,
          link_url: `/video/${video.slug}`,
          is_active: true,
          is_premium: video.isPremium,
          "order": 0,
          created_at: Date.now()
        }]);

        if (res.error && (res.error.message.includes('image_url') || res.error.message.includes('is_active') || res.error.code === 'PGRST204')) {
           res = await supabase.from('banners').insert([{
            id: bannerId,
            title: video.title,
            imageUrl: video.thumbnailUrl,
            linkUrl: `/video/${video.slug}`,
            isActive: true,
            isPremium: video.isPremium,
            "order": 0,
            created_at: Date.now()
          }]);
        }
      }
      setSelectedIds([]);
      alert("Selected videos added to banners!");
    } catch (error) {
      console.error("Error bulk adding to banner:", error);
      alert("Failed to add some videos to banner.");
    } finally {
      setIsBulkBannering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Videos</h1>
          <p className="text-sm text-gray-400">Manage your uploaded videos.</p>
        </div>
        <Link 
          to="/admin/videos/upload" 
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
        >
          Upload New
        </Link>
      </div>

      <div className="flex gap-4 border-b border-white/10 pb-2 justify-between items-center">
        <div className="flex gap-4">
          <button
            onClick={() => { setActiveTab('all'); setSelectedIds([]); }}
            className={`px-4 py-2 font-bold ${activeTab === 'all' ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-400 hover:text-white'}`}
          >
            All Videos (Free)
          </button>
          <button
            onClick={() => { setActiveTab('premium'); setSelectedIds([]); }}
            className={`px-4 py-2 font-bold ${activeTab === 'premium' ? 'text-yellow-500 border-b-2 border-yellow-500' : 'text-gray-400 hover:text-white'}`}
          >
            Premium Videos
          </button>
        </div>
        
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">{selectedIds.length} selected</span>
            <select
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              className="rounded border border-white/20 bg-black px-2 py-1 text-sm text-white"
            >
              <option value="">Select Category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={handleBulkChangeCategory}
              disabled={isBulkCategorizing || !bulkCategory}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Move
            </button>
            <button
              onClick={() => handleBulkTrending(true)}
              disabled={isBulkTrending}
              className="rounded bg-orange-500 px-3 py-1 text-sm text-white hover:bg-orange-600 disabled:opacity-50"
            >
              Set Trending
            </button>
            <button
              onClick={() => handleBulkTrending(false)}
              disabled={isBulkTrending}
              className="rounded bg-gray-600 px-3 py-1 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
            >
              Unset Trending
            </button>
            <button
              onClick={handleBulkAddToBanner}
              disabled={isBulkBannering}
              className="rounded bg-purple-600 px-3 py-1 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
            >
              Add to Banner
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading videos...</div>
        ) : filteredVideos.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No videos found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-black/50 text-xs uppercase text-gray-400 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 w-10">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.length === filteredVideos.length && filteredVideos.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-600 bg-black"
                    />
                  </th>
                  <th className="px-6 py-4">Thumbnail</th>
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4 w-20">Order</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Views</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVideos.map((video) => (
                  <tr key={video.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(video.id)}
                        onChange={() => toggleSelect(video.id)}
                        className="rounded border-gray-600 bg-black"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <img src={getFullThumbnailUrl(video.thumbnailUrl)} alt={video.title} className="h-12 w-20 object-contain rounded" />
                    </td>
                    <td className="px-6 py-4 font-medium text-white min-w-[200px]">
                      {editingId === video.id ? (
                        <div className="space-y-2">
                          <input 
                            type="text" 
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Video Title"
                            className="w-full rounded border border-white/20 bg-black px-2 py-1 text-sm text-white focus:border-red-500 focus:outline-none"
                          />
                          <div className="flex items-center gap-2">
                            <input 
                              type="text" 
                              value={editThumbnailUrl}
                              onChange={(e) => setEditThumbnailUrl(e.target.value)}
                              placeholder="Thumbnail URL"
                              className="flex-1 rounded border border-white/20 bg-black px-2 py-1 text-sm text-white focus:border-red-500 focus:outline-none"
                            />
                          </div>
                          
                          {editParts.length > 0 ? (
                            <div className="space-y-2 mt-2 p-2 border border-white/10 rounded bg-black/40">
                              <div className="text-xs font-bold text-gray-400 mb-1">Video Parts:</div>
                              {editParts.map((part, index) => (
                                <div key={part.id || index} className="space-y-1.5 pb-2 border-b border-white/5 last:border-0 last:pb-0">
                                  <input 
                                    type="text"
                                    value={part.title}
                                    onChange={(e) => updateEditPart(index, 'title', e.target.value)}
                                    placeholder={`Part ${index + 1} Title`}
                                    className="w-full rounded border border-white/20 bg-black px-2 py-1 text-sm text-white focus:border-red-500 focus:outline-none"
                                  />
                                  <div className="flex gap-2">
                                    <input 
                                      type="text"
                                      value={part.videoUrl}
                                      onChange={(e) => updateEditPart(index, 'videoUrl', e.target.value)}
                                      placeholder="Video URL"
                                      className="flex-1 rounded border border-white/20 bg-black px-2 py-1 text-sm text-white focus:border-red-500 focus:outline-none"
                                    />
                                    <input 
                                      type="text"
                                      value={part.duration || ''}
                                      onChange={(e) => updateEditPart(index, 'duration', e.target.value)}
                                      placeholder="0:00"
                                      className="w-20 rounded border border-white/20 bg-black px-2 py-1 text-sm text-white focus:border-red-500 focus:outline-none"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="text" 
                                  value={editVideoUrl}
                                  onChange={(e) => handleSingleVideoUrlChange(e.target.value)}
                                  placeholder="Video URL"
                                  className="flex-1 rounded border border-white/20 bg-black px-2 py-1 text-sm text-white focus:border-red-500 focus:outline-none"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="text" 
                                  value={editDuration}
                                  onChange={(e) => setEditDuration(e.target.value)}
                                  placeholder="Duration (e.g. 12:34)"
                                  className="flex-1 rounded border border-white/20 bg-black px-2 py-1 text-sm text-white focus:border-red-500 focus:outline-none"
                                />
                              </div>
                            </>
                          )}
                          
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox"
                                checked={editIsPremium}
                                onChange={(e) => setEditIsPremium(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-600 bg-black/50"
                              />
                              <span className="text-sm font-medium text-yellow-500">Premium Video (VIP Only)</span>
                            </label>
                          </div>
                          
                          <div className="flex flex-col gap-2 mt-2">
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value)}
                              className="rounded border border-white/20 bg-black px-2 py-1 text-sm text-white focus:border-red-500 focus:outline-none"
                            >
                              <option value="published">Published</option>
                              <option value="draft">Draft</option>
                              <option value="scheduled">Scheduled</option>
                            </select>
                            
                            {editStatus === 'scheduled' && (
                              <div className="flex gap-2">
                                <input
                                  type="date"
                                  value={editScheduledDate}
                                  onChange={(e) => setEditScheduledDate(e.target.value)}
                                  className="w-full rounded border border-white/20 bg-black px-2 py-1 text-sm text-white focus:border-red-500 focus:outline-none"
                                />
                                <input
                                  type="time"
                                  value={editScheduledTime}
                                  onChange={(e) => setEditScheduledTime(e.target.value)}
                                  className="w-full rounded border border-white/20 bg-black px-2 py-1 text-sm text-white focus:border-red-500 focus:outline-none"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="truncate max-w-[150px] sm:max-w-[200px] md:max-w-xs" title={video.title}>
                            {video.title} 
                            {video.isPremium && <span className="ml-2 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-500 font-bold">VIP</span>}
                            {video.is_trending && <span className="ml-2 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-500 font-bold">Trending</span>}
                            {video.status === 'draft' && <span className="ml-2 rounded-full bg-gray-500/20 px-2 py-0.5 text-xs text-gray-400 font-bold">Draft</span>}
                            {video.status === 'scheduled' && <span className="ml-2 rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400 font-bold" title={video.scheduledFor ? formatBDTime(video.scheduledFor) : ''}>Scheduled</span>}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <Link to={`/video/${video.slug}`} target="_blank" className="text-xs text-blue-400 hover:text-blue-300 font-normal truncate max-w-[200px]">
                              {window.location.origin}/video/{video.slug}
                            </Link>
                            <button
                              onClick={() => handleCopyUrl(video.id, video.slug)}
                              className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
                              title="Copy URL"
                            >
                              {copiedId === video.id ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {editingId === video.id ? (
                        <input 
                          type="number" 
                          value={editOrder}
                          onChange={(e) => setEditOrder(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-16 rounded border border-white/20 bg-black px-2 py-1 text-sm text-white focus:border-red-500 focus:outline-none text-center"
                        />
                      ) : (
                        <span className="inline-flex items-center justify-center rounded-full bg-white/10 w-8 h-8 text-xs font-bold text-white">
                          {video.order || 0}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingId === video.id ? (
                         <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="w-full rounded border border-white/20 bg-black px-2 py-1 text-sm text-white focus:border-red-500 focus:outline-none"><option value="">Select Category</option>{categories.map(cat => (<option key={cat.id} value={cat.name}>{cat.name}</option>))}</select>
                      ) : (
                        categories.find(c => c.name === video.categoryId || c.id === video.categoryId)?.name || video.categoryId || video.category
                      )}
                    </td>
                    <td className="px-6 py-4">{video.views || 0}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-3">
                        {editingId === video.id ? (
                          <>
                            <button onClick={() => saveEdit(video.id)} className="text-emerald-500 hover:text-emerald-400">
                              <Save className="h-5 w-5" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-white">
                              <X className="h-5 w-5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <Link to={`/video/${video.slug}`} target="_blank" className="text-gray-400 hover:text-white" title="View Video">
                              <Eye className="h-5 w-5" />
                            </Link>
                            <button 
                              onClick={() => handleCopyUrl(video.id, video.slug)} 
                              className="text-blue-500 hover:text-blue-400"
                              title="Copy Share Link"
                            >
                              {copiedId === video.id ? (
                                <Check className="h-5 w-5 text-green-500" />
                              ) : (
                                <Copy className="h-5 w-5" />
                              )}
                            </button>
                            <button onClick={() => startEdit(video)} className="text-blue-500 hover:text-blue-400" title="Edit Video">
                              <Edit className="h-5 w-5" />
                            </button>
                            <button onClick={() => handleDelete(video.id)} className="text-red-500 hover:text-red-400" title="Delete Video">
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
