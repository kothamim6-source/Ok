import { useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

export function OnlineTracker() {
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return;

    const pingOnlineStatus = async () => {
      try {
        const socialLinks = user.socialLinks || {};
        await supabase
          .from('users')
          .update({ 
            social_links: { 
              ...socialLinks, 
              last_active_at: Date.now() 
            } 
          })
          .eq('id', user.id);
      } catch (error) {
        console.error("Error updating online status", error);
      }
    };

    // Ping immediately on mount
    pingOnlineStatus();

    // Ping every 3 minutes
    const interval = setInterval(pingOnlineStatus, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  return null;
}
