import { formatBDTime } from '../../lib/utils';
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface ScheduledPost {
  id: string;
  textContent: string;
  scheduledFor: number;
  status: 'pending' | 'posted' | 'failed';
  createdAt: number;
  isDaily?: boolean;
}

export function TelegramCustomPosts() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  const [textContent, setTextContent] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isDaily, setIsDaily] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('settings').select('*').eq('id', 'scheduled_text_posts').single();
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      if (data && data.data && Array.isArray(data.data.posts)) {
        setPosts(data.data.posts.sort((a: ScheduledPost, b: ScheduledPost) => b.scheduledFor - a.scheduledFor));
      }
    } catch (err) {
      console.error("Error fetching posts:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const savePostsToDb = async (newPosts: ScheduledPost[]) => {
    try {
      const { error } = await supabase.from('settings').upsert({
        id: 'scheduled_text_posts',
        data: { posts: newPosts, updatedAt: Date.now() }
      });
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Error saving to db:", err);
      return false;
    }
  };

  const handleAddPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textContent || !scheduledDate || !scheduledTime) {
      setMessage("Please fill all fields");
      return;
    }

    setIsSaving(true);
    setMessage('');
    
    const timeMs = new Date(`${scheduledDate}T${scheduledTime}:00+06:00`).getTime();
    
    const newPost: ScheduledPost = {
      id: crypto.randomUUID(),
      textContent,
      scheduledFor: timeMs,
      status: 'pending',
      createdAt: Date.now(),
      isDaily
    };

    const updatedPosts = [newPost, ...posts].sort((a, b) => b.scheduledFor - a.scheduledFor);
    const success = await savePostsToDb(updatedPosts);
    
    if (success) {
      setPosts(updatedPosts);
      setTextContent('');
      setScheduledDate('');
      setScheduledTime('');
      setIsDaily(false);
      setMessage("Post scheduled successfully!");
    } else {
      setMessage("Error scheduling post.");
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this scheduled post?")) return;
    const updatedPosts = posts.filter(p => p.id !== id);
    const success = await savePostsToDb(updatedPosts);
    if (success) setPosts(updatedPosts);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Scheduled Telegram Posts</h1>
        <p className="text-sm text-gray-400">Schedule custom text messages to be automatically posted to your Telegram channel.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-bold text-white mb-4">Create New Post</h2>
            <form onSubmit={handleAddPost} className="space-y-4">
              {message && (
                <div className={`p-3 rounded-md text-sm ${message.includes('Error') || message.includes('Please') ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                  {message}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Message Text (Plain Text)</label>
                <textarea
                  required
                  rows={6}
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Write your custom plain text message here..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Time</label>
                  <input
                    type="time"
                    required
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>
              <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/50 p-3 cursor-pointer hover:bg-white/5 transition-colors">
                <input 
                  type="checkbox" 
                  checked={isDaily}
                  onChange={(e) => setIsDaily(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 bg-black"
                />
                <span className="text-sm font-bold text-blue-400">Repeat Every Day at this Time</span>
              </label>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Schedule Post
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
              <h2 className="text-lg font-bold text-white">Scheduled & Past Posts</h2>
              <button onClick={fetchPosts} className="text-gray-400 hover:text-white">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
              {posts.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No scheduled posts found. Create one to get started.
                </div>
              ) : (
                posts.map(post => (
                  <div key={post.id} className="p-4 hover:bg-white/5 transition-colors">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 whitespace-pre-wrap text-sm text-gray-300 font-mono bg-black/30 p-3 rounded-lg border border-white/5">
                        {post.textContent}
                      </div>
                      <button 
                        onClick={() => handleDelete(post.id)}
                        className="text-gray-500 hover:text-red-500 p-1"
                        title="Delete Post"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1 text-gray-400">
                        <Clock className="h-3.5 w-3.5" />
                        {formatBDTime(post.scheduledFor)}
                        {post.isDaily && (
                          <span className="ml-2 flex items-center gap-1 text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-full">
                            <RefreshCw className="h-3 w-3" /> Daily
                          </span>
                        )}
                      </div>
                      <div>
                        {post.status === 'pending' && <span className="text-orange-400 flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</span>}
                        {post.status === 'posted' && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Posted</span>}
                        {post.status === 'failed' && <span className="text-red-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Failed</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
