import React from 'react';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

import { Category } from '../../types';
import { Trash2, Image as ImageIcon, Link as LinkIcon, Edit, Save, X, Send, AlertTriangle } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import {
  fetchTelegramSecretsConfig,
  saveCategoryChannelMapping,
  removeCategoryChannelMapping,
  normalizeTelegramChatId,
  isTelegramInviteLink
} from '../../lib/telegramChannelService';

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryChannels, setCategoryChannels] = useState<Record<string, string>>({});
  const [newCatName, setNewCatName] = useState('');
  const [newTelegramChannel, setNewTelegramChannel] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [newMetaTitle, setNewMetaTitle] = useState('');
  const [newMetaDescription, setNewMetaDescription] = useState('');
  const [newOrder, setNewOrder] = useState<number | ''>('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingOriginalName, setEditingOriginalName] = useState('');
  const [editName, setEditName] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editTelegramChannel, setEditTelegramChannel] = useState('');
  const [editOrder, setEditOrder] = useState<number | ''>('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { settings } = useSettingsStore();

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      const [{ data, error }, tgSecrets] = await Promise.all([
        supabase.from('categories').select('*').order('created_at', { ascending: true }),
        fetchTelegramSecretsConfig()
      ]);
        
      if (error) throw error;
      
      const formatted = (data || []).map(cat => ({
        ...cat,
        metaTitle: cat.metaTitle || cat.metatitle || '',
        metaDescription: cat.metaDescription || cat.metadescription || '',
        createdAt: cat.created_at
      })) as Category[];
      
      setCategories(formatted);
      setCategoryChannels(tgSecrets.categoryChannels || {});
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const getMappedChannel = (catName: string) => {
    if (categoryChannels[catName]) return categoryChannels[catName];
    const lower = catName.trim().toLowerCase();
    for (const [k, v] of Object.entries(categoryChannels)) {
      if (k.trim().toLowerCase() === lower) return v;
    }
    return '';
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setIsSubmitting(true);
    
    try {
      const slug = newCatName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const newId = crypto.randomUUID();
      const trimmedCatName = newCatName.trim();
      
      const { error } = await supabase.from('categories').insert([{
        id: newId,
        name: trimmedCatName,
        slug,
        image: imageUrlInput,
        status: 'active',
        created_at: Date.now()
      }]);
      
      if (error) throw error;

      // Save optional Telegram Channel mapping for this category
      const normalizedCh = normalizeTelegramChatId(newTelegramChannel);
      if (normalizedCh) {
        await saveCategoryChannelMapping(trimmedCatName, normalizedCh);
        setCategoryChannels(prev => ({ ...prev, [trimmedCatName]: normalizedCh }));
      }
      
      const updatedCats = [...categories, { 
        id: newId, 
        name: trimmedCatName, 
        slug, 
        image: imageUrlInput, 
        status: 'active', 
        createdAt: Date.now(), 
        metaTitle: newMetaTitle, 
        metaDescription: newMetaDescription,
        /* order: orderValue */
      } as Category];
      updatedCats.sort((a, b) => (a.order || 0) - (b.order || 0));
      setCategories(updatedCats);
      
      setNewCatName('');
      setNewTelegramChannel('');
      setImageUrlInput('');
      setNewMetaTitle('');
      setNewMetaDescription('');
      setNewOrder('');
    } catch (error) {
      console.error("Error adding category:", error);
      alert(error instanceof Error ? error.message : "Error adding category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, catName: string) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      setCategories(categories.filter(c => c.id !== id));
      await removeCategoryChannelMapping(catName);
      setCategoryChannels(prev => {
        const next = { ...prev };
        delete next[catName];
        return next;
      });
    } catch (error) {
      console.error("Error deleting category:", error);
      alert("Failed to delete category.");
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditingOriginalName(cat.name);
    setEditName(cat.name);
    setEditImage(cat.image || '');
    setEditTelegramChannel(getMappedChannel(cat.name));
    setEditOrder(cat.order !== undefined ? cat.order : '');
  };

  const saveEdit = async (id: string) => {
    try {
      const trimmedEditName = editName.trim();
      const slug = trimmedEditName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      const { error } = await supabase.from('categories').update({
        name: trimmedEditName,
        slug,
        image: editImage,
      }).eq('id', id);
      
      if (error) throw error;

      const normalizedCh = normalizeTelegramChatId(editTelegramChannel);
      await saveCategoryChannelMapping(trimmedEditName, normalizedCh, editingOriginalName);
      setCategoryChannels(prev => {
        const next = { ...prev };
        if (editingOriginalName && editingOriginalName !== trimmedEditName) {
          delete next[editingOriginalName];
        }
        if (normalizedCh) {
          next[trimmedEditName] = normalizedCh;
        } else {
          delete next[trimmedEditName];
        }
        return next;
      });
      
      const updatedCats = categories.map(c => c.id === id ? { ...c, name: trimmedEditName, slug, image: editImage } : c);
      updatedCats.sort((a, b) => (a.order || 0) - (b.order || 0));
      setCategories(updatedCats);
      setEditingId(null);
    } catch (error) {
      console.error("Error updating category:", error);
      alert("Failed to update category.");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Categories</h1>
        <p className="text-sm text-gray-400">Manage video categories, optional images, and per-category Telegram channels.</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <form onSubmit={handleAdd} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Category Name</label>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Funny, Sports, Bangladeshi Vault"
                className="w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white focus:border-red-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-sky-400 flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5" />
                <span>Telegram Channel Link / @Username / Chat ID (Optional)</span>
              </label>
              <input
                type="text"
                value={newTelegramChannel}
                onChange={(e) => setNewTelegramChannel(e.target.value)}
                placeholder="e.g. https://t.me/channelname বা @channel বা -100..."
                className="w-full rounded-md border border-sky-500/30 bg-black/50 px-4 py-2 text-sm text-white font-mono focus:border-sky-500 focus:outline-none"
              />
              {isTelegramInviteLink(newTelegramChannel) && (
                <p className="mt-1 text-xs text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>প্রাইভেট ইনভাইট লিংক (+...) দিয়ে বট পোস্ট করতে পারে না; প্রাইভেট চ্যানেলের জন্য -100 চ্যাট আইডি দিন।</span>
                </p>
              )}
            </div>
            
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Image URL (Optional)</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <LinkIcon className="h-4 w-4" />
                </div>
                <input 
                  type="url" 
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-black/50 pl-9 pr-4 py-2 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="https://example.com/cat.jpg"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-24">
                <label className="mb-2 block text-sm font-medium text-gray-300">Order</label>
                <input
                  type="number"
                  value={newOrder}
                  onChange={(e) => setNewOrder(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-white focus:border-red-500 focus:outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="mb-2 block text-sm font-medium text-gray-300">Meta Title (SEO)</label>
                <input
                  type="text"
                  value={newMetaTitle}
                  onChange={(e) => setNewMetaTitle(e.target.value)}
                  placeholder="Meta Title"
                  className="w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-sm text-white focus:border-red-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <textarea
              value={newMetaDescription}
              onChange={(e) => setNewMetaDescription(e.target.value)}
              placeholder="Meta Description (Optional)"
              rows={2}
              className="w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-sm text-white focus:border-red-500 focus:outline-none"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isSubmitting || !newCatName.trim()}
            className="rounded-md bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 w-full sm:w-auto self-start"
          >
            {isSubmitting ? 'Adding...' : 'Add Category & Save Channel'}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-black/50 text-xs uppercase text-gray-400 border-b border-white/10">
              <tr>
                <th className="px-4 py-4 w-16">Order</th>
                <th className="px-4 py-4">Image</th>
                <th className="px-4 py-4">Name</th>
                <th className="px-4 py-4">Telegram Channel</th>
                <th className="px-4 py-4">Slug / Image</th>
                <th className="px-4 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const mappedChannel = getMappedChannel(cat.name);
                return (
                  <tr key={cat.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-4">
                      {editingId === cat.id ? (
                        <input 
                          type="number" 
                          value={editOrder}
                          onChange={(e) => setEditOrder(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-16 rounded border border-white/20 bg-black px-2 py-1 text-sm text-white focus:border-red-500 focus:outline-none text-center"
                        />
                      ) : (
                        <span className="inline-flex items-center justify-center rounded-full bg-white/10 w-8 h-8 text-xs font-bold text-white">
                          {cat.order || 0}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {cat.image ? (
                        <img src={cat.image} alt={cat.name} className="h-10 w-10 rounded-md object-contain border border-white/10" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/10">
                          <ImageIcon className="h-5 w-5 text-gray-500" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 font-medium text-white">
                      {editingId === cat.id ? (
                        <input 
                          type="text" 
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded border border-white/20 bg-black px-2 py-1 text-sm text-white focus:border-red-500 focus:outline-none"
                          placeholder="Category Name"
                        />
                      ) : (
                        cat.name
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {editingId === cat.id ? (
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={editTelegramChannel}
                            onChange={(e) => setEditTelegramChannel(e.target.value)}
                            className="w-full min-w-[170px] rounded border border-sky-500/40 bg-black px-2.5 py-1 text-xs font-mono text-white focus:border-sky-400 focus:outline-none"
                            placeholder="@channel বা https://t.me/..."
                          />
                          {isTelegramInviteLink(editTelegramChannel) && (
                            <span className="block text-[10px] text-amber-400">প্রাইভেট চ্যানেলের -100 আইডি দিন</span>
                          )}
                        </div>
                      ) : mappedChannel ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 px-2.5 py-1 text-xs font-mono font-bold text-sky-300">
                          <Send className="h-3 w-3 shrink-0" />
                          <span>{mappedChannel}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500 italic">ডিফল্ট চ্যানেল</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-400">
                      {editingId === cat.id ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            value={editImage}
                            onChange={(e) => setEditImage(e.target.value)}
                            className="flex-1 rounded border border-white/20 bg-black px-2 py-1 text-sm text-white focus:border-red-500 focus:outline-none"
                            placeholder="Image URL"
                          />
                        </div>
                      ) : (
                        <div className="max-w-[120px] sm:max-w-[150px] md:max-w-xs truncate" title={cat.slug}>
                          {cat.slug}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        {editingId === cat.id ? (
                          <>
                            <button onClick={() => saveEdit(cat.id)} className="text-emerald-500 hover:text-emerald-400" title="Save">
                              <Save className="h-5 w-5" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-white" title="Cancel">
                              <X className="h-5 w-5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(cat)} className="text-blue-500 hover:text-blue-400" title="Edit">
                              <Edit className="h-5 w-5" />
                            </button>
                            <button onClick={() => handleDelete(cat.id, cat.name)} className="text-red-500 hover:text-red-400" title="Delete">
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No categories found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
