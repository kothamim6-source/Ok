import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Activity, User as UserIcon, Clock, Phone } from 'lucide-react';
import { User } from '../../types';

export function OnlineUsers() {
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchOnlineUsers();
    const interval = setInterval(fetchOnlineUsers, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchOnlineUsers = async () => {
    try {
      // Fetch users who were active in the last 5 minutes
      const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000); // fetch recent users, filtering in memory since jsonb filtering might be tricky for operators like >

      if (error) throw error;

      if (data) {
        const active = data.filter((u: any) => {
           if (u.social_links && u.social_links.last_active_at) {
              return u.social_links.last_active_at > fiveMinsAgo;
           }
           return false;
        });
        
        // Sort by most recently active
        active.sort((a, b) => b.social_links.last_active_at - a.social_links.last_active_at);
        
        const mapped = active.map((u: any) => ({
          ...u,
          phone: u.phone || u.phone_number || u.mobile || ''
        }));
        setOnlineUsers(mapped);
      }
    } catch (error) {
      console.error("Error fetching online users:", error);
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Activity className="w-8 h-8 text-emerald-500" />
            Online Users
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Users active in the last 5 minutes.
          </p>
        </div>
        <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-bold rounded-xl flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          {onlineUsers.length} Online
        </div>
      </div>

      <div className="bg-[#111] rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/40">
          <h3 className="font-semibold text-white">Live Activity</h3>
          <button onClick={fetchOnlineUsers} className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1">
             <Clock className="w-3 h-3" /> Refresh
          </button>
        </div>
        
        <div className="p-4 min-h-[300px]">
          {isLoading && onlineUsers.length === 0 ? (
            <div className="flex justify-center items-center h-40">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : onlineUsers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {onlineUsers.map((user) => (
                <div key={user.id} className="bg-black/40 border border-white/5 p-4 rounded-xl flex items-center gap-4">
                  <div className="relative">
                    {user.profileImage ? (
                      <img src={user.profileImage} alt={user.name} className="w-12 h-12 rounded-full object-cover border border-white/10" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-white font-bold">
                        {user.name?.charAt(0) || 'U'}
                      </div>
                    )}
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#111] rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate text-sm">{user.name}</p>
                    <p className="text-gray-500 text-xs truncate">{user.email}</p>
                    {user.phone && <p className="text-yellow-500/80 text-xs truncate flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{user.phone}</p>}
                  </div>
                  {user.isVIP && (
                    <div className="relative flex items-center justify-center h-6 w-6 rounded-full bg-gradient-to-r from-yellow-400 to-amber-600 shadow-[0_0_15px_rgba(250,204,21,0.6)] shrink-0" title="VIP Member"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-40"></span><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg></div>
                  )}
                </div>
              ))}
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center h-40 text-gray-500">
               <UserIcon className="w-12 h-12 opacity-20 mb-3" />
               <p>No users currently online.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
