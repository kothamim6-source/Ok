import React from 'react';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

import { Banner } from '../../types';
import { useSettingsStore } from '../../store/settingsStore';
import { Trash2, Upload, Plus, CheckCircle, XCircle, Edit, Link as LinkIcon, UploadCloud } from 'lucide-react';

export function Banners() {
  const { settings } = useSettingsStore();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [newOrder, setNewOrder] = useState<number | ''>('');
  
  const [newBanner, setNewBanner] = useState({
    title: '',
    description: '',
    linkUrl: '',
    isActive: true,
    isPremium: false
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOrder, setEditOrder] = useState<number | ''>('');

  useEffect(() => {
    fetchBanners();
  }, []);

  async function fetchBanners() {
    try {
      const { data, error } = await supabase.from('banners').select('*');
      if (error) throw error;
      
      const formatted = (data || []).map(d => ({
        id: d.id,
        imageUrl: d.image_url || d.imageUrl,
        title: d.title,
        description: d.description,
        linkUrl: d.link_url || d.linkUrl,
        isActive: d.is_active !== undefined ? d.is_active : d.isActive,
        isPremium: d.is_premium !== undefined ? d.is_premium : d.isPremium,
        order: d.order,
        createdAt: d.created_at || d.createdAt
      })) as Banner[];
      
      formatted.sort((a, b) => {
        const orderA = a.order || 0;
        const orderB = b.order || 0;
        if (orderA > 0 && orderB > 0) {
          if (orderA === orderB) return (b.createdAt || 0) - (a.createdAt || 0);
          return orderA - orderB;
        }
        if (orderA > 0) return -1;
        if (orderB > 0) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setBanners(formatted);
    } catch (error) {
      console.error("Error fetching banners:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!imageUrlInput) {
      alert("Please provide an image URL.");
      return;
    }
    
    setIsUploading(true);
    try {
      const id = crypto.randomUUID();
      const orderValue = newOrder === '' ? 0 : Number(newOrder);
      const now = Date.now();
      
      let res = await supabase.from('banners').insert([{
        id,
        image_url: imageUrlInput,
        title: newBanner.title,
        description: newBanner.description,
        link_url: newBanner.linkUrl,
        is_active: newBanner.isActive,
        is_premium: newBanner.isPremium,
        order: orderValue,
        created_at: now
      }]);
      
      if (res.error && (res.error.message.includes('image_url') || res.error.message.includes('is_active') || res.error.code === 'PGRST204')) {
        res = await supabase.from('banners').insert([{
          id,
          imageUrl: imageUrlInput,
          title: newBanner.title,
          description: newBanner.description,
          linkUrl: newBanner.linkUrl,
          isActive: newBanner.isActive,
          isPremium: newBanner.isPremium,
          order: orderValue,
          created_at: now
        }]);
      }
      
      if (res.error) throw res.error;
      
      const banner: Banner = {
        id,
        imageUrl: imageUrlInput,
        title: newBanner.title,
        description: newBanner.description,
        linkUrl: newBanner.linkUrl,
        isActive: newBanner.isActive,
        isPremium: newBanner.isPremium,
        order: orderValue,
        createdAt: now
      };
      
      const updatedBanners = [banner, ...banners];
      updatedBanners.sort((a, b) => {
        const orderA = a.order || 0;
        const orderB = b.order || 0;
        if (orderA > 0 && orderB > 0) {
          if (orderA === orderB) return (b.createdAt || 0) - (a.createdAt || 0);
          return orderA - orderB;
        }
        if (orderA > 0) return -1;
        if (orderB > 0) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setBanners(updatedBanners);
      
      setShowForm(false);
      setNewBanner({ title: '', description: '', linkUrl: '', isActive: true, isPremium: false });
      setImageUrlInput('');
      setNewOrder('');
    } catch (error: any) {
      console.error("Error creating banner:", error);
      alert(error.message || "Failed to create banner.");
    } finally {
      setIsUploading(false);
    }
  };

  
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editIsPremium, setEditIsPremium] = useState(false);

  const startEdit = (banner: Banner) => {
    setEditingId(banner.id);
    setEditTitle(banner.title || "");
    setEditDesc(banner.description || "");
    setEditIsPremium(!!banner.isPremium);
    setEditLink(banner.linkUrl || "");
    setEditImageUrl(banner.imageUrl || "");
    setEditOrder(banner.order !== undefined ? banner.order : "");
  };

  const saveEdit = async (id: string) => {
    try {
      const orderValue = editOrder === "" ? 0 : Number(editOrder);
      let res = await supabase.from('banners').update({
        title: editTitle,
        description: editDesc,
        link_url: editLink,
        image_url: editImageUrl,
        order: orderValue
      }).eq('id', id);
      
      if (res.error && (res.error.message.includes('image_url') || res.error.message.includes('link_url') || res.error.code === 'PGRST204')) {
        res = await supabase.from('banners').update({
          title: editTitle,
          description: editDesc,
          linkUrl: editLink,
          imageUrl: editImageUrl,
          order: orderValue
        }).eq('id', id);
      }
      
      if (res.error) throw res.error;
      
      const updatedBanners = banners.map(b => b.id === id ? { 
        ...b, 
        title: editTitle, 
        description: editDesc, 
        linkUrl: editLink,
        imageUrl: editImageUrl,
        order: orderValue
      } : b);
      updatedBanners.sort((a, b) => {
        const orderA = a.order || 0;
        const orderB = b.order || 0;
        if (orderA > 0 && orderB > 0) {
          if (orderA === orderB) return (b.createdAt || 0) - (a.createdAt || 0);
          return orderA - orderB;
        }
        if (orderA > 0) return -1;
        if (orderB > 0) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setBanners(updatedBanners);
      setEditingId(null);
    } catch (error) {
      console.error("Error updating banner:", error);
      alert("Failed to update banner.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this banner?")) return;
    try {
      const { error } = await supabase.from('banners').delete().eq('id', id);
      if (error) throw error;
      setBanners(banners.filter(b => b.id !== id));
    } catch (error) {
      console.error("Error deleting banner:", error);
      alert("Failed to delete banner.");
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      let res = await supabase.from('banners').update({ is_active: !currentStatus }).eq('id', id);
      if (res.error && (res.error.message.includes('is_active') || res.error.code === 'PGRST204')) {
        res = await supabase.from('banners').update({ isActive: !currentStatus }).eq('id', id);
      }
      if (res.error) throw res.error;
      setBanners(banners.map(b => b.id === id ? { ...b, isActive: !currentStatus } : b));
    } catch (error) {
      console.error("Error toggling banner:", error);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Homepage Banners</h1>
          <p className="text-sm text-gray-400">Manage custom image banners for your homepage hero section.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
        >
          {showForm ? 'Cancel' : <><Plus className="h-4 w-4" /> Add Banner</>}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 mb-8">
          <form onSubmit={handleCreate} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300">Image Direct URL *</label>
              <div className="relative mt-2">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <LinkIcon className="h-5 w-5" />
                </div>
                <input 
                  type="url" 
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-black/50 pl-10 pr-4 py-2 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="https://example.com/banner.jpg"
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-300">Title (Optional)</label>
                <input
                  type="text"
                  value={newBanner.title}
                  onChange={e => setNewBanner({...newBanner, title: e.target.value})}
                  className="mt-1 block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Target Link URL (Optional)</label>
                <input
                  type="url"
                  value={newBanner.linkUrl}
                  onChange={e => setNewBanner({...newBanner, linkUrl: e.target.value})}
                  placeholder="https://"
                  className="mt-1 block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Order</label>
                <input
                  type="number"
                  value={newOrder}
                  onChange={e => setNewOrder(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="mt-1 block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">Description (Optional)</label>
              <textarea
                value={newBanner.description}
                onChange={e => setNewBanner({...newBanner, description: e.target.value})}
                rows={2}
                className="mt-1 block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox"
                  id="isActive"
                checked={newBanner.isActive}
                onChange={e => setNewBanner({...newBanner, isActive: e.target.checked})}
                className="rounded border-gray-300 text-red-600 focus:ring-red-600"
              />
              <label htmlFor="isActive" className="text-sm text-gray-300">Banner is Active</label>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox"
                  id="isPremium"
                  checked={newBanner.isPremium}
                  onChange={e => setNewBanner({...newBanner, isPremium: e.target.checked})}
                  className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                />
                <label htmlFor="isPremium" className="text-sm text-yellow-500 font-bold">Premium Banner</label>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isUploading}
                className="flex items-center gap-2 rounded-md bg-red-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                {isUploading ? 'Saving...' : <><Upload className="h-4 w-4" /> Save Banner</>}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading banners...</div>
        ) : banners.length === 0 ? (
          <div className="p-8 text-center text-gray-400 border-t border-white/10">
            No banners found. Add one above.
          </div>
        ) : (
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-black/50 text-xs uppercase text-gray-400 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 w-20">Order</th>
                <th className="px-6 py-4">Image</th>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Link URL</th>
                <th className="px-6 py-4 text-center">Type</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((banner) => (
                <tr key={banner.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-6 py-4">
                    {editingId === banner.id ? (
                      <input 
                        type="number" 
                        value={editOrder}
                        onChange={(e) => setEditOrder(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-16 rounded border border-white/20 bg-black px-2 py-1 text-sm text-white focus:border-red-500 focus:outline-none text-center"
                      />
                    ) : (
                      <span className="inline-flex items-center justify-center rounded-full bg-white/10 w-8 h-8 text-xs font-bold text-white">
                        {banner.order || 0}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingId === banner.id ? (
                      <input 
                        type="url" 
                        value={editImageUrl}
                        onChange={(e) => setEditImageUrl(e.target.value)}
                        placeholder="Image URL"
                        className="w-full rounded border border-white/20 bg-black px-2 py-1 text-sm text-white focus:border-red-500 focus:outline-none"
                      />
                    ) : (
                      <img src={banner.imageUrl} alt={banner.title} className="h-12 w-20 object-cover rounded border border-white/10" />
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium text-white max-w-[200px] truncate">
                    {editingId === banner.id ? (
                      <input 
                        type="text" 
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Title"
                        className="w-full rounded border border-white/20 bg-black px-2 py-1 text-sm text-white focus:border-red-500 focus:outline-none"
                      />
                    ) : (
                      banner.title || <span className="text-gray-500 italic">Untitled</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-400 max-w-[200px] truncate">
                    {editingId === banner.id ? (
                      <input 
                        type="text" 
                        value={editLink}
                        onChange={(e) => setEditLink(e.target.value)}
                        placeholder="Link URL"
                        className="w-full rounded border border-white/20 bg-black px-2 py-1 text-sm text-white focus:border-red-500 focus:outline-none"
                      />
                    ) : (
                      banner.linkUrl ? (
                        <a href={banner.linkUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                          {banner.linkUrl}
                        </a>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {editingId === banner.id ? (
                      <div className="flex justify-center">
                        <input 
                          type="checkbox"
                          checked={editIsPremium}
                          onChange={(e) => setEditIsPremium(e.target.checked)}
                          className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                        />
                      </div>
                    ) : (
                      banner.isPremium ? (
                        <span className="inline-flex rounded-full bg-yellow-500/10 px-2 py-1 text-[10px] font-bold text-yellow-500">
                          Premium
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-500">
                          Standard
                        </span>
                      )
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => toggleActive(banner.id, banner.isActive)}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${
                        banner.isActive 
                          ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' 
                          : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                      }`}
                    >
                      {banner.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-3">
                      {editingId === banner.id ? (
                        <>
                          <button onClick={() => saveEdit(banner.id)} className="text-emerald-500 hover:text-emerald-400">
                            Save
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-white">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(banner)} className="text-blue-500 hover:text-blue-400">
                            <Edit className="h-5 w-5" />
                          </button>
                          <button onClick={() => handleDelete(banner.id)} className="text-red-500 hover:text-red-400">
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
        )}
      </div>
    </div>
  );
}
