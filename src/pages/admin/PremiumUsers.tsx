import { formatBDTime } from '../../lib/utils';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { User } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { 
  Crown, 
  Clock, 
  Mail, 
  Calendar, 
  CheckCircle, 
  Phone, 
  PlusCircle, 
  X, 
  Sparkles, 
  AlertCircle,
  Search,
  UserCheck
} from 'lucide-react';

export function PremiumUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const currentUser = useAuthStore(state => state.user);
  
  // Custom days modal state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [customDaysInput, setCustomDaysInput] = useState<string>('30');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchPremiumUsers();
  }, []);

  const fetchPremiumUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('users').select('*').eq('is_vip', true);
      if (error) throw error;
      
      const now = Date.now();
      const fetchedUsers = (data || [])
        .map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone || u.phone_number || u.mobile || '',
          isVIP: u.is_vip,
          vipExpiresAt: u.vip_expires_at,
          vipReason: u.vip_reason
        })) as User[];
      setUsers(fetchedUsers.sort((a, b) => (b.vipExpiresAt || 0) - (a.vipExpiresAt || 0)));
    } catch (error) {
      console.error("Error fetching premium users:", error);
    }
    setIsLoading(false);
  };

  const getRemainingTime = (expiresAt: number | undefined) => {
    if (!expiresAt) return 'আজীবন সদস্য (Lifetime)';
    const now = Date.now();
    const diff = expiresAt - now;
    if (diff <= 0) return 'মেয়াদ শেষ (Expired)';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days} দিন ${hours} ঘণ্টা`;
    if (hours > 0) return `${hours} ঘণ্টা ${minutes} মিনিট`;
    return `${minutes} মিনিট`;
  };

  const handleRevoke = async (userId: string) => {
    if (window.confirm('আপনি কি নিশ্চিত যে এই ইউজারের প্রিমিয়াম এক্সেস বাতিল করতে চান?')) {
      try {
        const { error } = await supabase.from('users').update({
          is_vip: false,
          vip_expires_at: null
        }).eq('id', userId);
        if (error) throw error;

        // If revoking current logged in user
        if (currentUser && currentUser.id === userId) {
          useAuthStore.getState().setUser({
            ...currentUser,
            isVIP: false,
            vipExpiresAt: undefined
          });
        }
        
        window.dispatchEvent(new CustomEvent('user-vip-updated'));
        setActionMessage('প্রিমিয়াম এক্সেস বাতিল করা হয়েছে।');
        fetchPremiumUsers();
        setTimeout(() => setActionMessage(''), 3500);
      } catch (error) {
        console.error("Error revoking premium:", error);
      }
    }
  };

  const handleAddDays = async (targetUser: User, days: number) => {
    if (!days || days <= 0) return;
    setIsUpdating(true);
    try {
      const now = Date.now();
      // If user currently has active VIP, add on top of current expiry; else add from now
      const currentExpiry = targetUser.vipExpiresAt && targetUser.vipExpiresAt > now ? targetUser.vipExpiresAt : now;
      const addedMs = days * 24 * 60 * 60 * 1000;
      const newExpiry = currentExpiry + addedMs;
      
      // Update in Supabase by ID
      const { error } = await supabase.from('users').update({
        is_vip: true,
        vip_expires_at: newExpiry
      }).eq('id', targetUser.id);
      if (error) throw error;
      
      // Also update by email as a fallback if present
      if (targetUser.email) {
        await supabase.from('users').update({
          is_vip: true,
          vip_expires_at: newExpiry
        }).eq('email', targetUser.email);
      }

      // If updating currently logged in user (e.g. admin himself)
      if (currentUser && (currentUser.id === targetUser.id || (targetUser.email && currentUser.email === targetUser.email))) {
        useAuthStore.getState().setUser({
          ...currentUser,
          isVIP: true,
          vipExpiresAt: newExpiry
        });
      }

      // Notify the user in notifications table
      try {
        await supabase.from('notifications').insert([{
          id: crypto.randomUUID(),
          user_id: targetUser.id,
          title: '🎉 প্রিমিয়াম মেয়াদ বৃদ্ধি পেয়েছে!',
          message: `অ্যাডমিন আপনার ভিআইপি প্রিমিয়াম অ্যাকাউন্টের মেয়াদ আরো ${days} দিন বৃদ্ধি করেছেন। নতুন মেয়াদ: ${formatBDTime(newExpiry)} পর্যন্ত।`,
          read: false,
          created_at: Date.now()
        }]);
      } catch (notifErr) {
        console.warn("Could not insert notification:", notifErr);
      }

      // Notify any active UI listener
      window.dispatchEvent(new CustomEvent('user-vip-updated'));
      
      const formattedDate = formatBDTime(newExpiry);
      setActionMessage(`সফলভাবে ${targetUser.name || 'ইউজার'}-কে ${days} দিন সময় বাড়ানো হয়েছে! (নতুন মেয়াদ: ${formattedDate})`);
      
      // Close modal if open
      setSelectedUser(null);
      fetchPremiumUsers();
      setTimeout(() => setActionMessage(''), 5000);
    } catch (error: any) {
      console.error("Error adding days:", error);
      alert(`সময় বাড়াতে সমস্যা হয়েছে: ${error.message || error}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.phone && u.phone.includes(searchQuery))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Crown className="text-yellow-500 fill-yellow-500" /> Premium Users (প্রিমিয়াম ইউজার ম্যানেজমেন্ট)
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            প্রিমিয়াম ইউজারদের মেয়াদ দেখা, সময় বাড়ানো (+Days) এবং নিয়ন্ত্রণ করুন।
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="নাম, ইমেইল বা নাম্বার খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
          />
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-xl flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 animate-fadeIn">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
          <p className="font-medium text-sm">{actionMessage}</p>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">প্রিমিয়াম ইউজারদের তথ্য লোড হচ্ছে...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">কোনো প্রিমিয়াম ইউজার পাওয়া যায়নি।</div>
        ) : (
          <table className="w-full text-left text-sm text-gray-300 min-w-[750px]">
            <thead className="bg-black/60 text-xs uppercase text-gray-400 border-b border-white/10">
              <tr>
                <th className="px-5 py-4">ইউজার তথ্য (User Info)</th>
                <th className="px-5 py-4">স্ট্যাটাস (Status)</th>
                <th className="px-5 py-4">অবশিষ্ট সময় (Remaining Time)</th>
                <th className="px-5 py-4 text-right">সময় বাড়ান / একশন (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((user) => {
                const now = Date.now();
                const isExpired = user.vipExpiresAt ? user.vipExpiresAt <= now : false;

                return (
                  <tr key={user.id} className={`hover:bg-white/[0.04] transition-colors ${isExpired ? 'opacity-60 bg-red-950/10' : ''}`}>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-white flex items-center gap-2">
                          <Crown className="w-4 h-4 text-amber-400 fill-amber-400/30 shrink-0" />
                          {user.name || "Unknown"}
                          {currentUser && currentUser.id === user.id && (
                            <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.2 rounded font-normal">
                              আপনি (You)
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1.5">
                          <Mail className="h-3 w-3" /> {user.email}
                        </span>
                        {user.phone ? (
                          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md w-fit mt-0.5">
                            <Phone className="h-3 w-3" /> {user.phone}
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-500 flex items-center gap-1 italic mt-0.5">
                            <Phone className="h-3 w-3 opacity-30" /> কোনো নাম্বার নেই
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-1">
                        {isExpired ? (
                          <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">
                            মেয়াদ শেষ (Expired)
                          </span>
                        ) : (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                            <Sparkles className="w-3 h-3 text-amber-400" /> Active VIP
                          </span>
                        )}
                        {user.vipReason && (
                           <span className="text-[11px] text-gray-400 border border-white/10 px-2 py-0.5 rounded mt-1">
                             {user.vipReason}
                           </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1 text-sm font-medium">
                        <div className={`flex items-center gap-2 ${isExpired ? 'text-red-400' : 'text-emerald-400 font-bold'}`}>
                          <Clock className="w-4 h-4 shrink-0" />
                          {getRemainingTime(user.vipExpiresAt)}
                        </div>
                        <div className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-500" />
                          মেয়াদ শেষ: {user.vipExpiresAt ? formatBDTime(user.vipExpiresAt) : 'আজীবন'}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {/* Quick Add Days Buttons */}
                        <button 
                          onClick={() => handleAddDays(user, 1)}
                          disabled={isUpdating}
                          className="bg-white/10 hover:bg-emerald-600/30 hover:border-emerald-500/50 hover:text-emerald-300 border border-white/10 text-white text-xs px-2.5 py-1.5 rounded-lg transition-all font-semibold"
                          title="মেয়াদ ১ দিন বাড়ান"
                        >
                          +১ দিন
                        </button>
                        <button 
                          onClick={() => handleAddDays(user, 7)}
                          disabled={isUpdating}
                          className="bg-white/10 hover:bg-emerald-600/30 hover:border-emerald-500/50 hover:text-emerald-300 border border-white/10 text-white text-xs px-2.5 py-1.5 rounded-lg transition-all font-semibold"
                          title="মেয়াদ ৭ দিন বাড়ান"
                        >
                          +৭ দিন
                        </button>
                        <button 
                          onClick={() => handleAddDays(user, 30)}
                          disabled={isUpdating}
                          className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs px-2.5 py-1.5 rounded-lg transition-all font-bold shadow-sm"
                          title="মেয়াদ ৩০ দিন বাড়ান"
                        >
                          +৩০ দিন
                        </button>

                        {/* Custom Days Modal Trigger */}
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setCustomDaysInput('30');
                          }}
                          className="bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 text-xs px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 font-semibold"
                          title="কাস্টম দিন বা যত খুশি সময় বাড়ান"
                        >
                          <PlusCircle className="w-3.5 h-3.5" /> কাস্টম
                        </button>

                        {/* Revoke */}
                        <button 
                          onClick={() => handleRevoke(user.id)}
                          className="bg-red-950/40 hover:bg-red-600/20 text-red-400 border border-red-500/20 text-xs px-2 py-1.5 rounded-lg transition-colors ml-1"
                          title="প্রিমিয়াম বাতিল করুন"
                        >
                          বাতিল
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Custom Days Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#12141f] border border-amber-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl relative space-y-5">
            <button 
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg bg-white/5 hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Crown className="w-6 h-6 fill-current" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">সময় বাড়ান (Extend VIP Time)</h3>
                <p className="text-xs text-gray-400">{selectedUser.name} ({selectedUser.email})</p>
              </div>
            </div>

            {/* Current Expiration details */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 space-y-1.5 text-xs text-gray-300">
              <div className="flex justify-between">
                <span className="text-gray-400">বর্তমান অবশিষ্ট সময়:</span>
                <span className="font-bold text-emerald-400">{getRemainingTime(selectedUser.vipExpiresAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">বর্তমান মেয়াদ শেষ:</span>
                <span className="font-medium text-white">{selectedUser.vipExpiresAt ? formatBDTime(selectedUser.vipExpiresAt) : 'আজীবন'}</span>
              </div>
            </div>

            {/* Quick days selection pills */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-300">কুইক দিন সিলেক্ট করুন:</label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 7, 15, 30, 60, 90, 180, 365].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setCustomDaysInput(String(d))}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                      customDaysInput === String(d)
                        ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    +{d} দিন
                  </button>
                ))}
              </div>
            </div>

            {/* Custom input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                <span>যত দিন বাড়াতে চান (সংখ্যা লিখুন):</span>
                <span className="text-amber-400 font-bold">{customDaysInput} দিন</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="3650"
                  value={customDaysInput}
                  onChange={(e) => setCustomDaysInput(e.target.value)}
                  placeholder="যেমন: 30"
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-4 py-2.5 text-white font-bold text-lg focus:outline-none focus:border-amber-500"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
                  দিন
                </span>
              </div>
            </div>

            {/* New Expiry Preview */}
            {parseInt(customDaysInput) > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                <div className="text-amber-300 font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> নতুন মেয়াদ হবে:
                </div>
                <div className="text-white font-semibold">
                  {formatBDTime(
                    (selectedUser.vipExpiresAt && selectedUser.vipExpiresAt > Date.now() ? selectedUser.vipExpiresAt : Date.now()) + 
                    (parseInt(customDaysInput) * 86400000)
                  )} পর্যন্ত
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="w-1/3 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 text-sm font-semibold transition-colors"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={isUpdating || !parseInt(customDaysInput) || parseInt(customDaysInput) <= 0}
                onClick={() => handleAddDays(selectedUser, parseInt(customDaysInput))}
                className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-bold text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isUpdating ? 'আপডেট হচ্ছে...' : `+${customDaysInput} দিন বাড়িয়ে দিন`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
