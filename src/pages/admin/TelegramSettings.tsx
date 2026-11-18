import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Category } from '../../types';
import { Plus, Trash2, Send, AlertTriangle, FolderTree } from 'lucide-react';
import {
  ExtraTelegramChannel,
  fetchTelegramSecretsConfig,
  isTelegramInviteLink,
  normalizeTelegramChatId
} from '../../lib/telegramChannelService';

export function TelegramSettings() {
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChannelId, setTelegramChannelId] = useState('');
  const [telegramDefaultDescription, setTelegramDefaultDescription] = useState('');
  const [telegramCustomApiUrl, setTelegramCustomApiUrl] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryChannels, setCategoryChannels] = useState<Record<string, string>>({});
  const [extraChannels, setExtraChannels] = useState<ExtraTelegramChannel[]>([]);
  const [newExtraLabel, setNewExtraLabel] = useState('');
  const [newExtraChannelId, setNewExtraChannelId] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadSecretsAndCategories() {
      try {
        const [config, { data: catData }] = await Promise.all([
          fetchTelegramSecretsConfig(),
          supabase.from('categories').select('*').order('created_at', { ascending: true })
        ]);

        setTelegramBotToken(config.botToken || '');
        setTelegramChannelId(config.channelId || '');
        setTelegramDefaultDescription(config.defaultDescription || '');
        setTelegramCustomApiUrl(config.customApiUrl || '');
        setCategoryChannels(config.categoryChannels || {});
        setExtraChannels(config.extraChannels || []);

        if (catData) {
          setCategories(catData as Category[]);
        }
      } catch (err) {
        console.error("Failed to load secrets:", err);
      }
    }
    loadSecretsAndCategories();
  }, []);

  const getCategoryChannelValue = (catName: string): string => {
    if (categoryChannels[catName] !== undefined) return categoryChannels[catName];
    const lower = catName.trim().toLowerCase();
    for (const [k, v] of Object.entries(categoryChannels)) {
      if (k.trim().toLowerCase() === lower) return v;
    }
    return '';
  };

  const handleCategoryChannelChange = (catName: string, value: string) => {
    setCategoryChannels(prev => {
      const next = { ...prev };
      // Remove case-insensitive old key if present
      const lower = catName.trim().toLowerCase();
      for (const k of Object.keys(next)) {
        if (k !== catName && k.trim().toLowerCase() === lower) {
          delete next[k];
        }
      }
      next[catName] = value;
      return next;
    });
  };

  const handleAddExtraChannel = () => {
    const label = newExtraLabel.trim();
    const channelId = newExtraChannelId.trim();
    if (!label || !channelId) return;

    setExtraChannels(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label,
        channelId: normalizeTelegramChatId(channelId) || channelId
      }
    ]);
    setNewExtraLabel('');
    setNewExtraChannelId('');
  };

  const handleRemoveExtraChannel = (id: string) => {
    setExtraChannels(prev => prev.filter(ch => ch.id !== id));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);
    setMessage('');
    try {
      const cleanedCategoryChannels: Record<string, string> = {};
      for (const [catName, chVal] of Object.entries(categoryChannels)) {
        const trimmedName = catName.trim();
        const normalized = normalizeTelegramChatId(chVal);
        if (trimmedName && normalized) {
          cleanedCategoryChannels[trimmedName] = normalized;
        }
      }

      const cleanedExtraChannels = extraChannels
        .filter(ex => ex.label.trim() && ex.channelId.trim())
        .map(ex => ({
          id: ex.id,
          label: ex.label.trim(),
          channelId: normalizeTelegramChatId(ex.channelId) || ex.channelId.trim()
        }));

      const normalizedMainChannel = normalizeTelegramChatId(telegramChannelId) || telegramChannelId.trim();

      const { error } = await supabase.from('settings').upsert({
        id: 'telegram_secrets',
        data: {
          botToken: telegramBotToken.trim(),
          channelId: normalizedMainChannel,
          defaultDescription: telegramDefaultDescription,
          customApiUrl: telegramCustomApiUrl.trim(),
          categoryChannels: cleanedCategoryChannels,
          extraChannels: cleanedExtraChannels,
          updatedAt: Date.now()
        }
      });
      if (error) throw error;

      setCategoryChannels(cleanedCategoryChannels);
      setExtraChannels(cleanedExtraChannels);
      setTelegramChannelId(normalizedMainChannel);
      setMessage('Telegram auto-post settings & category channels saved successfully!');
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage('Error saving settings. Ensure you have admin permissions.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Telegram Auto-Post Settings</h1>
        <p className="text-sm text-gray-400">Automatically post new video uploads to your main or category-wise Telegram channels.</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <form onSubmit={handleSave} className="space-y-6">
          {message && (
            <div className={`p-4 rounded-md text-sm ${message.includes('Error') ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
              {message}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-400">
                Telegram Bot Token
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  className="block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm font-mono"
                  placeholder="e.g. 123456789:ABCdefGHIjklmnoPQRstuvWXYZ"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">Create a bot using BotFather on Telegram and add that bot as an Administrator in every channel.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-400">
                Main / Fallback Telegram Channel ID
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  value={telegramChannelId}
                  onChange={(e) => setTelegramChannelId(e.target.value)}
                  className="block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm font-mono"
                  placeholder="e.g. @yourchannel বা https://t.me/yourchannel বা -1001234567890"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">কোনো ক্যাটাগরিতে আলাদা চ্যানেল সেট করা না থাকলে ভিডিওটি এই মেইন চ্যানেলে পোস্ট হবে।</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-400">
                Telegram Auto-Post Description (শুধুমাত্র টেলিগ্রাম পোস্টের জন্য)
              </label>
              <div className="mt-2">
                <textarea
                  rows={4}
                  value={telegramDefaultDescription}
                  onChange={(e) => setTelegramDefaultDescription(e.target.value)}
                  className="block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm"
                  placeholder="টেলিগ্রাম চ্যানেলে প্রতিটি নতুন পোস্টের সাথে স্বয়ংক্রিয়ভাবে যে ক্যাপশন/ডেসক্রিপশন পাঠাতে চান তা লিখুন..."
                />
              </div>
              <p className="mt-2 text-xs text-gray-400">
                এই ডেসক্রিপশনটি শুধুমাত্র টেলিগ্রাম অটো-পোস্টে যুক্ত হবে। ওয়েবসাইটের ভিডিও ডেসক্রিপশনে এটি যোগ হবে না।
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-400">
                Custom Telegram API / Proxy URL (Optional)
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  value={telegramCustomApiUrl}
                  onChange={(e) => setTelegramCustomApiUrl(e.target.value)}
                  className="block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm font-mono"
                  placeholder="Default: https://api.telegram.org (or your Cloudflare Worker URL)"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Leave empty for normal use (<code className="text-gray-400">https://api.telegram.org</code>). If your web hosting blocks direct cURL to Telegram, you can enter a Cloudflare Worker reverse proxy URL here.
              </p>
            </div>
          </div>

          {/* Per-Category Telegram Channel Mappings */}
          <div className="pt-6 border-t border-white/10 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FolderTree className="h-4 w-4 text-sky-400" />
                <span>ক্যাটাগরি অনুযায়ী টেলিগ্রাম চ্যানেল (Category Channels)</span>
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                প্রতিটি ক্যাটাগরির জন্য আলাদা চ্যানেলের লিংক (<code className="text-gray-300">https://t.me/channel</code>), <code className="text-gray-300">@username</code>, অথবা প্রাইভেট চ্যানেলের <code className="text-gray-300">-100...</code> আইডি দিন। আপনার বটটি অবশ্যই প্রতিটি চ্যানেলের Admin হতে হবে।
              </p>
            </div>

            {categories.length === 0 ? (
              <p className="text-xs text-gray-500 italic">কোনো ক্যাটাগরি পাওয়া যায়নি।</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categories.map((cat) => {
                  const val = getCategoryChannelValue(cat.name);
                  const inviteWarning = isTelegramInviteLink(val);
                  return (
                    <div key={cat.id} className="rounded-lg border border-white/10 bg-black/40 p-3 space-y-1.5">
                      <label className="block text-xs font-bold text-gray-200 flex items-center justify-between">
                        <span>{cat.name}</span>
                        {val && !inviteWarning && (
                          <span className="text-[10px] font-mono text-sky-400">
                            {normalizeTelegramChatId(val)}
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => handleCategoryChannelChange(cat.name, e.target.value)}
                        placeholder={`ডিফল্ট (${telegramChannelId || 'Main Channel'})`}
                        className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-1.5 text-xs font-mono text-white placeholder-gray-600 focus:border-sky-500 focus:outline-none"
                      />
                      {inviteWarning && (
                        <p className="text-[11px] text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          <span>প্রাইভেট ইনভাইট লিংক (+...) কাজ করবে না; -100 চ্যাট আইডি দিন।</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Extra Quick Channels for 1-Click Blogger Selection */}
          <div className="pt-6 border-t border-white/10 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Send className="h-4 w-4 text-emerald-400" />
                <span>অতিরিক্ত কুইক চ্যানেল (Extra Quick Channels)</span>
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                ক্যাটাগরির বাইরেও বাড়তি কোনো টেলিগ্রাম চ্যানেল রাখতে চাইলে এখানে যুক্ত করুন—Blogger Import পেজ থেকে ১ ক্লিকেই সিলেক্ট করতে পারবেন।
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newExtraLabel}
                onChange={(e) => setNewExtraLabel(e.target.value)}
                placeholder="চ্যানেলের নাম (যেমন: VIP Channel)"
                className="flex-1 rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
              />
              <input
                type="text"
                value={newExtraChannelId}
                onChange={(e) => setNewExtraChannelId(e.target.value)}
                placeholder="@username বা https://t.me/... বা -100..."
                className="flex-1 rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm font-mono text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddExtraChannel}
                disabled={!newExtraLabel.trim() || !newExtraChannelId.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                <span>Add</span>
              </button>
            </div>

            {isTelegramInviteLink(newExtraChannelId) && (
              <p className="text-xs text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>প্রাইভেট ইনভাইট লিংক (+...) দিয়ে বট পোস্ট করতে পারে না; প্রাইভেট চ্যানেলের জন্য -100 চ্যাট আইডি ব্যবহার করুন।</span>
              </p>
            )}

            {extraChannels.length > 0 && (
              <div className="space-y-2">
                {extraChannels.map((ch) => (
                  <div key={ch.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/40 px-3 py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-bold text-white truncate">{ch.label}</span>
                      <span className="text-xs font-mono text-emerald-400 truncate">{ch.channelId}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveExtraChannel(ch.id)}
                      className="text-red-400 hover:text-red-300 p-1"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-6 border-t border-white/10">
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

