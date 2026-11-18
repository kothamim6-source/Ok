import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Notification } from '../types';
import { Bell, Check, Info, AlertCircle, PlayCircle, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotificationBell() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .in('user_id', [user.id, 'all'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error fetching notifications:", error);
      } else if (data) {
        const notifs = data.map(doc => ({
          id: doc.id,
          userId: doc.user_id,
          title: doc.title,
          message: doc.message,
          read: doc.read,
          type: doc.type,
          isPopup: doc.is_popup,
          createdAt: doc.created_at,
          link: (doc as any).link // if link exists in db
        })) as unknown as Notification[];
        
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.read).length);
      }
    };

    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel('custom-all-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          fetchNotifications(); // simple refetch on change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.read);
      for (const n of unreadNotifs) {
        await supabase.from('notifications').update({ read: true }).eq('id', n.id);
      }
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read", error);
    }
  };


  const getIcon = (type: string) => {
    switch (type) {
      case 'NEW_VIDEO': return <PlayCircle className="h-4 w-4 text-blue-400" />;
      case 'VIP_UPDATE': return <Star className="h-4 w-4 text-yellow-400" />;
      case 'PROMO': return <Info className="h-4 w-4 text-green-400" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-600 ring-2 ring-black"></span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-lg border border-white/10 bg-black/90 backdrop-blur-xl shadow-xl z-[2147483647]">
          <div className="sticky top-0 bg-black/95 p-3 border-b border-white/10 flex items-center justify-between z-10">
            <h3 className="text-sm font-bold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>
          
          <div className="p-2">
            {notifications.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No notifications yet.</p>
            ) : (
              notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className={`mb-1 flex items-start gap-3 rounded-lg p-2 transition-colors ${notif.read ? 'bg-transparent' : 'bg-white/5'}`}
                >
                  <div className="mt-1 flex-shrink-0">{getIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${notif.read ? 'text-gray-300' : 'text-white font-medium'}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 break-words">
                      {notif.message}
                    </p>
                    {notif.link && (
                      <Link 
                        to={notif.link} 
                        className="text-xs text-blue-400 hover:underline mt-1 inline-block"
                        onClick={() => { markAsRead(notif.id); setShowDropdown(false); }}
                      >
                        View Details
                      </Link>
                    )}
                  </div>
                  {!notif.read && (
                    <button 
                      onClick={() => markAsRead(notif.id)}
                      className="text-gray-500 hover:text-white"
                      title="Mark as read"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
