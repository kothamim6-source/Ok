import { useState } from 'react';
import { supabase } from '../../lib/supabase';

import { Send, Bell, Loader2 } from 'lucide-react';

export function AdminNotifications() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [type, setType] = useState<'NEW_VIDEO' | 'SYSTEM' | 'PROMO'>('PROMO');
  const [target, setTarget] = useState<'all' | 'non-vip' | 'vip'>('all');
  const [sending, setSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const now = Date.now();
      
      if (target === 'all') {
        let notif: any = {
          id: crypto.randomUUID(),
          user_id: 'all',
          title,
          message,
          link: link || null,
          type,
          read: false,
          created_at: now
        };
        
        let res = await supabase.from('notifications').insert([notif]);
        
        // If fails due to missing columns, retry with basic fields
        if (res.error && (res.error.message.includes('link') || res.error.message.includes('type'))) {
          notif = {
            id: notif.id,
            user_id: 'all',
            title,
            message,
            read: false,
            created_at: now
          };
          res = await supabase.from('notifications').insert([notif]);
        }
        
        if (res.error) throw res.error;
      } else {
        const isVIP = target === 'vip';
        const { data: users, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('is_vip', isVIP);
          
        if (userError) throw userError;
        
        if (users && users.length > 0) {
          let notifications: any[] = users.map(u => ({
            id: crypto.randomUUID(),
            user_id: u.id,
            title,
            message,
            link: link || null,
            type,
            read: false,
            created_at: now
          }));
          
          let res = await supabase.from('notifications').insert(notifications);
          
          // Retry basic notification if schema cache issue
          if (res.error && (res.error.message.includes('link') || res.error.message.includes('type'))) {
             notifications = users.map(u => ({
                id: crypto.randomUUID(),
                user_id: u.id,
                title,
                message,
                read: false,
                created_at: now
             }));
             res = await supabase.from('notifications').insert(notifications);
          }
          
          if (res.error) throw res.error;
        }
      }
      
      alert('Notification sent successfully!');
      setTitle('');
      setMessage('');
      setLink('');
    } catch (error) {
      console.error("Error sending notification:", error);
      alert('Failed to send notification');
    }
    setSending(false);
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-2">
        <Bell className="h-6 w-6 text-red-500" />
        <h1 className="text-2xl font-bold text-white">Broadcast Notification</h1>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#111] p-6">
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">Target Audience</label>
            <select 
              value={target}
              onChange={(e) => setTarget(e.target.value as any)}
              className="w-full rounded-lg bg-black/50 border border-white/10 px-4 py-2 text-white focus:border-red-500 focus:outline-none"
            >
              <option value="all">All Users</option>
              <option value="vip">VIP Users Only</option>
              <option value="non-vip">Non-VIP Users Only</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">Notification Type</label>
            <select 
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full rounded-lg bg-black/50 border border-white/10 px-4 py-2 text-white focus:border-red-500 focus:outline-none"
            >
              <option value="PROMO">Promotion / Offer</option>
              <option value="NEW_VIDEO">New Video Alert</option>
              <option value="SYSTEM">System Announcement</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">Title</label>
            <input 
              type="text" 
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg bg-black/50 border border-white/10 px-4 py-2 text-white focus:border-red-500 focus:outline-none"
              placeholder="e.g. 50% Off on VIP Subscription!"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">Message</label>
            <textarea 
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full rounded-lg bg-black/50 border border-white/10 px-4 py-2 text-white focus:border-red-500 focus:outline-none resize-none"
              placeholder="Detailed message..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">Action Link (Optional)</label>
            <input 
              type="text" 
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full rounded-lg bg-black/50 border border-white/10 px-4 py-2 text-white focus:border-red-500 focus:outline-none"
              placeholder="e.g. /premium or /video/my-video-slug"
            />
          </div>

          <button 
            type="submit" 
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            {sending ? 'Sending...' : 'Broadcast Notification'}
          </button>
        </form>
      </div>
    </div>
  );
}
