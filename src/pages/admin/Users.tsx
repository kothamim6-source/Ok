import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { User, Role } from '../../types';
import { Trash2, Edit, Save, X, Search, Shield, ShieldOff, Mail, Calendar, User as UserIcon, Download, MonitorPlay, Phone, Check, Settings, Sparkles, CheckSquare, Square, DownloadCloud, Upload, Video, FolderTree, MessageSquare, Flag, Megaphone, Bell, Activity, Send, Crown, Gift, Key, ExternalLink, ShieldCheck, UserPlus } from 'lucide-react';
import { UserBadge } from '../../components/ui/UserBadge';
import { useAuthStore } from '../../store/authStore';
import { MODERATOR_PERMISSION_OPTIONS } from '../../data/moderatorPermissions';
export { MODERATOR_PERMISSION_OPTIONS };

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<Role>('user');
  const [editIsVIP, setEditIsVIP] = useState<boolean>(false);
  const [vipDuration, setVipDuration] = useState<number>(30);
  const [editVipReason, setEditVipReason] = useState<string>('');
  const [editPoints, setEditPoints] = useState<number>(0);
  const [editPhone, setEditPhone] = useState<string>('');
  const [editModPermissions, setEditModPermissions] = useState<string[]>([]);
  const [allModeratorAssignments, setAllModeratorAssignments] = useState<Record<string, any>>({});

  // Moderator Permissions Modal State
  const [showPermissionsModal, setShowPermissionsModal] = useState<boolean>(false);
  const [modalUser, setModalUser] = useState<User | null>(null);
  const [modalPermissions, setModalPermissions] = useState<string[]>([]);
  const [isSavingPermissions, setIsSavingPermissions] = useState<boolean>(false);

  // Filter users by phone status (default: with_phone - only show verified phone numbers)
  const [phoneFilter, setPhoneFilter] = useState<'with_phone' | 'all' | 'without_phone'>('with_phone');

  useEffect(() => {
    fetchUsers();

    // Subscribe to real-time changes in users table so new phone numbers auto-appear immediately
    const userChannel = supabase.channel('realtime_admin_users_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchUsers();
      })
      .subscribe();

    const handleCustomUpdate = () => fetchUsers();
    window.addEventListener('user-vip-updated', handleCustomUpdate);

    return () => {
      supabase.removeChannel(userChannel);
      window.removeEventListener('user-vip-updated', handleCustomUpdate);
    };
  }, []);

  async function fetchUsers() {
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;

      // Fetch moderator permissions assignments from settings
      let assignments: Record<string, any> = {};
      try {
        const { data: modSetting } = await supabase.from('settings').select('*').eq('id', 'moderator_permissions').maybeSingle();
        if (modSetting?.data?.assignments) {
          assignments = modSetting.data.assignments;
          setAllModeratorAssignments(assignments);
        }
      } catch (e) {
        console.warn('Could not load moderator permissions', e);
      }
      
      const { data: lbData } = await supabase.from('daily_leaderboard').select('user_id, views');
      const userViews: Record<string, number> = {};
      if (lbData) {
        lbData.forEach(lb => {
          userViews[lb.user_id] = (userViews[lb.user_id] || 0) + lb.views;
        });
      }
      
      const fetched: User[] = (data || []).map(u => {
        let finalName = u.name || 'Unknown';
        // Auto-fix names that are just "User" or empty
        if (finalName.toLowerCase() === 'user' || finalName === 'Unknown' || finalName.trim() === '') {
           if (u.email) {
             finalName = u.email.split('@')[0];
             // Update the database silently in the background
             supabase.from('users').update({ name: finalName }).eq('id', u.id).then();
           }
        }
        
        const isModOrAdmin = u.role === 'admin' || u.role === 'moderator';
        let isVIP = isModOrAdmin ? false : Boolean(u.is_vip);
        if (!isModOrAdmin && isVIP && u.vip_expires_at && u.vip_expires_at < Date.now()) {
          isVIP = false;
        }

        const userPerms = assignments[u.id]?.permissions || 
          (u.email ? assignments[u.email.toLowerCase()]?.permissions : []) || 
          u.permissions || 
          [];
        
        return {
          id: u.id,
          name: finalName,
          email: u.email,
          phone: u.phone || u.phone_number || u.mobile || '',
          profileImage: u.profile_image,
          role: u.role as Role,
          isVIP: isVIP,
          vipExpiresAt: isModOrAdmin ? undefined : u.vip_expires_at,
          status: u.status,
          points: u.points,
          permissions: userPerms,
          createdAt: u.created_at
        };
      });
      setUsers(fetched);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    try {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      setUsers(users.filter(u => u.id !== id));
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete. Please check permissions.");
    }
  };

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setEditRole(user.role || 'user');
    setEditIsVIP(user.role === 'admin' || user.role === 'moderator' ? true : !!user.isVIP);
    setVipDuration(30);
    setEditVipReason('');
    setEditPoints(user.points || 0);
    setEditPhone(user.phone || '');
    const userPerms = allModeratorAssignments[user.id]?.permissions || 
      (user.email ? allModeratorAssignments[user.email.toLowerCase()]?.permissions : []) || 
      user.permissions || 
      [];
    setEditModPermissions(userPerms);
  };

  const saveEdit = async (id: string) => {
    try {
      const targetUser = users.find(u => u.id === id);
      const isModOrAdmin = editRole === 'admin' || editRole === 'moderator';
      let newExpiresAt = null;
      if (editIsVIP && !isModOrAdmin) {
        const now = Date.now();
        const baseTime = (targetUser?.vipExpiresAt && targetUser.vipExpiresAt > now) ? targetUser.vipExpiresAt : now;
        newExpiresAt = baseTime + (vipDuration * 24 * 60 * 60 * 1000);
      }
      
      const { error } = await supabase.from('users').update({
        role: editRole,
        is_vip: isModOrAdmin ? true : editIsVIP,
        vip_expires_at: isModOrAdmin ? null : (editIsVIP ? newExpiresAt : null),
        points: editPoints,
        phone: editPhone.trim() || null
      }).eq('id', id);
      
      if (error) throw error;

      if (targetUser?.email) {
        await supabase.from('users').update({
          role: editRole,
          is_vip: isModOrAdmin ? true : editIsVIP,
          vip_expires_at: isModOrAdmin ? null : (editIsVIP ? newExpiresAt : null)
        }).eq('email', targetUser.email);
      }

      // Sync Moderator Permissions in settings table
      const updatedAssignments = { ...allModeratorAssignments };
      if (editRole === 'moderator') {
        const assignmentRecord = {
          userId: id,
          name: targetUser?.name || 'Moderator',
          email: targetUser?.email || '',
          phone: editPhone || targetUser?.phone || '',
          permissions: editModPermissions,
          assignedAt: Date.now()
        };
        updatedAssignments[id] = assignmentRecord;
        if (targetUser?.email) {
          updatedAssignments[targetUser.email.toLowerCase()] = assignmentRecord;
        }
      } else {
        delete updatedAssignments[id];
        if (targetUser?.email) {
          delete updatedAssignments[targetUser.email.toLowerCase()];
        }
      }

      await supabase.from('settings').upsert({
        id: 'moderator_permissions',
        data: {
          updatedAt: Date.now(),
          assignments: updatedAssignments
        }
      });
      setAllModeratorAssignments(updatedAssignments);
      
      if (editIsVIP && !isModOrAdmin && editVipReason.trim() !== '') {
        const notif: any = {
          id: crypto.randomUUID(),
          user_id: id,
          title: 'Premium Gift! 🎁',
          message: `অ্যাডমিন আপনাকে ${vipDuration} দিনের ভিআইপি প্রিমিয়াম দিয়েছেন। কারণ: ${editVipReason.trim()}`,
          read: false,
          type: 'VIP_GIFT',
          is_popup: true,
          created_at: Date.now()
        };
        let res = await supabase.from('notifications').insert([notif]);
        
        if (res.error && (res.error.message.includes('type') || res.error.message.includes('is_popup'))) {
           await supabase.from('notifications').insert([{
             id: crypto.randomUUID(),
             user_id: id,
             title: 'Premium Gift! 🎁',
             message: `অ্যাডমিন আপনাকে ${vipDuration} দিনের ভিআইপি প্রিমিয়াম দিয়েছেন। কারণ: ${editVipReason.trim()}`,
             read: false,
             created_at: Date.now()
           }]);
        }
      }

      // Sync currently logged in user if edited
      const authUser = useAuthStore.getState().user;
      if (authUser && (authUser.id === id || (targetUser?.email && authUser.email === targetUser.email))) {
        useAuthStore.getState().setUser({
          ...authUser,
          role: editRole,
          permissions: editRole === 'moderator' ? editModPermissions : [],
          isVIP: isModOrAdmin ? true : editIsVIP,
          vipExpiresAt: isModOrAdmin ? undefined : (editIsVIP ? (newExpiresAt || undefined) : undefined),
          points: editPoints,
          phone: editPhone.trim() || undefined
        });
      }

      window.dispatchEvent(new CustomEvent('user-vip-updated'));
      
      setUsers(users.map(u => u.id === id ? { 
        ...u, 
        role: editRole, 
        permissions: editRole === 'moderator' ? editModPermissions : [],
        isVIP: isModOrAdmin ? true : editIsVIP, 
        vipExpiresAt: isModOrAdmin ? undefined : (editIsVIP ? (newExpiresAt || undefined) : undefined), 
        points: editPoints,
        phone: editPhone.trim() || ''
      } : u));
      setEditingId(null);
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to update user.");
    }
  };

  const handleOpenPermissionsModal = (user: User) => {
    setModalUser(user);
    const userPerms = allModeratorAssignments[user.id]?.permissions || 
      (user.email ? allModeratorAssignments[user.email.toLowerCase()]?.permissions : []) || 
      user.permissions || 
      [];
    setModalPermissions(userPerms);
    setShowPermissionsModal(true);
  };

  const handleSaveModalPermissions = async () => {
    if (!modalUser) return;
    try {
      setIsSavingPermissions(true);
      const updatedAssignments = { ...allModeratorAssignments };
      const assignmentRecord = {
        userId: modalUser.id,
        name: modalUser.name || 'Moderator',
        email: modalUser.email || '',
        phone: modalUser.phone || '',
        permissions: modalPermissions,
        assignedAt: Date.now()
      };
      updatedAssignments[modalUser.id] = assignmentRecord;
      if (modalUser.email) {
        updatedAssignments[modalUser.email.toLowerCase()] = assignmentRecord;
      }

      const { error } = await supabase.from('settings').upsert({
        id: 'moderator_permissions',
        data: {
          updatedAt: Date.now(),
          assignments: updatedAssignments
        }
      });
      if (error) throw error;

      setAllModeratorAssignments(updatedAssignments);

      // Also ensure user role is moderator and is_vip is true in users table
      await supabase.from('users').update({
        role: 'moderator',
        is_vip: true
      }).eq('id', modalUser.id);

      if (modalUser.email) {
        await supabase.from('users').update({
          role: 'moderator',
          is_vip: true
        }).eq('email', modalUser.email);
      }

      setUsers(users.map(u => u.id === modalUser.id ? {
        ...u,
        role: 'moderator',
        isVIP: true,
        permissions: modalPermissions
      } : u));

      const authUser = useAuthStore.getState().user;
      if (authUser && (authUser.id === modalUser.id || (modalUser.email && authUser.email === modalUser.email))) {
        useAuthStore.getState().setUser({
          ...authUser,
          role: 'moderator',
          isVIP: true,
          permissions: modalPermissions
        });
      }

      window.dispatchEvent(new CustomEvent('user-vip-updated'));
      setShowPermissionsModal(false);
      setModalUser(null);
    } catch (err: any) {
      console.error('Error saving moderator permissions:', err);
      alert('Failed to save moderator permissions: ' + (err.message || ''));
    } finally {
      setIsSavingPermissions(false);
    }
  };

  // Counts for phone verification
  const verifiedWithPhoneCount = useMemo(() => {
    return users.filter(u => u.phone && u.phone.trim().length >= 6).length;
  }, [users]);

  const withoutPhoneCount = useMemo(() => {
    return users.filter(u => (!u.phone || u.phone.trim().length < 6) && u.role !== 'admin').length;
  }, [users]);

  // Filter users based on search and phone requirement
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const hasPhone = Boolean(u.phone && u.phone.trim().length >= 6);

      // Rule: users without a phone number should NOT be shown in the main user list by default
      if (phoneFilter === 'with_phone') {
        if (u.role !== 'admin' && !hasPhone) return false;
      } else if (phoneFilter === 'without_phone') {
        if (hasPhone || u.role === 'admin') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.phone && u.phone.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [users, searchQuery, phoneFilter]);

  const exportToCSV = () => {
    if (users.length === 0) return;
    
    // Create CSV header
    const headers = ['ID', 'Name', 'Email', 'Phone Number', 'Role', 'VIP Status', 'VIP Expiration', 'Points', 'Joined Date'];
    
    // Create CSV rows
    const rows = users.map(u => [
      u.id,
      `"${u.name || ''}"`,
      `"${u.email || ''}"`,
      `"${u.phone || ''}"`,
      u.role || 'user',
      u.isVIP ? 'Yes' : 'No',
      u.vipExpiresAt ? new Date(u.vipExpiresAt).toISOString() : 'N/A',
      u.points || 0,
      u.createdAt ? new Date(u.createdAt).toISOString() : 'N/A'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `users_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Users</h1>
          <p className="text-sm text-gray-400">Manage registered users, roles, and premium access.</p>
        </div>
        
        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-500" />
            </div>
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-white/10 rounded-lg bg-black/50 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 sm:text-sm"
            />
          </div>
          <button 
            onClick={exportToCSV}
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-blue-600/20 px-4 py-2 text-sm font-bold text-blue-500 border border-blue-500/20 hover:bg-blue-600/30 transition-colors"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
          <div className="bg-blue-500/10 p-3 rounded-lg">
            <UserIcon className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white flex items-center gap-2">
              {verifiedWithPhoneCount}
              {withoutPhoneCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  +{withoutPhoneCount} পেন্ডিং
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">সক্রিয় ইউজার (নম্বরযুক্ত)</div>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
          <div className="bg-yellow-500/10 p-3 rounded-lg">
            <Crown className="h-6 w-6 text-yellow-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{users.filter(u => u.isVIP && u.role !== 'admin' && u.role !== 'moderator').length}</div>
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">Premium Users</div>
          </div>
        </div>
        <Link 
          to="/admin/moderators" 
          className="bg-white/5 border border-red-500/30 hover:border-red-500/50 hover:bg-white/[0.08] transition-all rounded-xl p-4 flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="bg-red-500/10 p-3 rounded-lg group-hover:bg-red-500/20 transition-colors">
              <ShieldCheck className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white flex items-center gap-1.5">
                {users.filter(u => u.role === 'moderator').length}
                <ExternalLink className="h-3.5 w-3.5 text-zinc-500 group-hover:text-red-400" />
              </div>
              <div className="text-xs text-red-400 font-bold uppercase tracking-wider">মডারেটর টিম</div>
            </div>
          </div>
        </Link>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
          <div className="bg-red-500/10 p-3 rounded-lg">
            <Shield className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{users.filter(u => u.role === 'admin').length}</div>
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">Admins</div>
          </div>
        </div>
      </div>

      {/* Top VIP Users Section */}
      {!isLoading && users.filter(u => u.isVIP).length > 0 && (
        <div className="pt-2">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-yellow-500">🏆</span> Top Premium Users
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {users
              .filter(u => u.isVIP)
              .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
              .slice(0, 4)
              .map(user => (
                <div key={`top-${user.id}`} className="bg-gradient-to-br from-yellow-500/10 to-yellow-900/10 border border-yellow-500/20 rounded-xl p-4 flex flex-col items-center text-center transition-transform hover:scale-105">
                  <div className="w-12 h-12 bg-black rounded-full border-2 border-yellow-500 flex items-center justify-center mb-3 overflow-hidden shadow-lg shadow-yellow-500/20">
                    {user.profileImage ? (
                      <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="h-6 w-6 text-yellow-500" />
                    )}
                  </div>
                  <div className="font-bold text-white text-sm truncate w-full">{user.name || "Unknown"}</div>
                  <div className="text-xs text-yellow-500/80 truncate w-full mt-0.5">{user.email}</div>
                  {user.phone && <div className="text-xs text-yellow-500/80 truncate w-full mt-0.5 flex items-center justify-center gap-1"><Phone className="w-3 h-3" /> {user.phone}</div>}
                </div>
            ))}
          </div>
        </div>
      )}

      {/* Phone Verification Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0c0d14] border border-white/10 p-3 rounded-xl">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPhoneFilter('with_phone')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              phoneFilter === 'with_phone'
                ? 'bg-red-600 text-white shadow-md shadow-red-950/40'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Check className="h-3.5 w-3.5" />
            <span>সক্রিয় ইউজার (নম্বরসহ): {verifiedWithPhoneCount}</span>
          </button>
          
          <button
            type="button"
            onClick={() => setPhoneFilter('without_phone')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              phoneFilter === 'without_phone'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-950/40'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Phone className="h-3.5 w-3.5" />
            <span>নম্বরবিহীন পেন্ডিং: {withoutPhoneCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setPhoneFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              phoneFilter === 'all'
                ? 'bg-white/20 text-white shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            সব অ্যাকাউন্ট ({users.length})
          </button>
        </div>

        <div className="text-[11px] text-zinc-400">
          {phoneFilter === 'with_phone' && (
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              ✓ ইউজার নম্বর আপডেট করলেই স্বয়ংক্রিয়ভাবে এখানে চলে আসবে।
            </span>
          )}
          {phoneFilter === 'without_phone' && (
            <span className="text-amber-400 font-medium flex items-center gap-1">
              ⚠️ এরা নম্বর না দেওয়া পর্যন্ত সাইটে ঢুকতে পারবে না।
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading users...</div>
        ) : (
          <table className="w-full text-left text-sm text-gray-300 min-w-[700px]">
            <thead className="bg-black/50 text-xs uppercase text-gray-400 border-b border-white/10">
              <tr>
                <th className="px-6 py-4">User Info</th>
                <th className="px-6 py-4">Account Type</th>
                <th className="px-6 py-4">Points</th>
                <th className="px-6 py-4">Videos Watched</th>
                <th className="px-6 py-4">Joined Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-white">{user.name || "Unknown"}</span>
                      <span className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3" /> {user.email}
                      </span>
                      {editingId === user.id ? (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          <input
                            type="tel"
                            placeholder="মোবাইল নাম্বার..."
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="w-36 bg-black border border-emerald-500/40 text-emerald-400 text-xs rounded px-2 py-1 focus:border-emerald-500 outline-none placeholder:text-gray-600"
                          />
                        </div>
                      ) : user.phone ? (
                        <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-md w-fit mt-0.5">
                          <Phone className="h-3 w-3" /> {user.phone}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-500 flex items-center gap-1 italic mt-0.5">
                          <Phone className="h-3 w-3 opacity-30" /> কোনো নাম্বার নেই
                        </span>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    {editingId === user.id ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          {editIsVIP && (
                            <div className="flex items-center gap-1">
                              <input 
                                type="number" 
                                min="1" 
                                value={vipDuration} 
                                onChange={(e) => setVipDuration(parseInt(e.target.value) || 0)}
                                className="w-16 bg-black border border-yellow-500/50 text-yellow-500 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-yellow-500"
                                title="VIP Duration (Days)"
                              />
                              <span className="text-[10px] text-gray-500">Days</span>
                            </div>
                          )}
                          <select 
                            value={`${editRole}-${editIsVIP}`}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'admin-false') {
                                setEditRole('admin');
                                setEditIsVIP(true);
                              } else if (val === 'moderator-false') {
                                setEditRole('moderator');
                                setEditIsVIP(true);
                              } else if (val === 'user-true') {
                                setEditRole('user');
                                setEditIsVIP(true);
                              } else {
                                setEditRole('user');
                                setEditIsVIP(false);
                              }
                            }}
                            className="bg-black border border-white/20 text-white text-xs rounded px-2 py-1.5 focus:border-red-500 outline-none"
                          >
                            <option value="user-false">Normal User</option>
                            <option value="user-true">Premium User</option>
                            <option value="moderator-false">Moderator</option>
                            <option value="admin-false">Admin</option>
                          </select>
                        </div>
                        {editRole === 'moderator' && (
                          <button
                            type="button"
                            onClick={() => {
                              setModalUser(user);
                              setModalPermissions(editModPermissions);
                              setShowPermissionsModal(true);
                            }}
                            className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-red-600/30 to-purple-600/30 border border-purple-500/50 text-white text-xs font-bold hover:border-purple-400 transition-all shadow-sm"
                          >
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                              <span>মডারেটর অপশন ({editModPermissions.length})</span>
                            </div>
                            <span className="text-[10px] bg-purple-500/40 px-1.5 py-0.5 rounded text-white">সেট করুন</span>
                          </button>
                        )}
                        {editIsVIP && editRole !== 'moderator' && editRole !== 'admin' && (
                          <input 
                            type="text" 
                            placeholder="Gift Reason (Optional)..." 
                            value={editVipReason}
                            onChange={(e) => setEditVipReason(e.target.value)}
                            className="w-full bg-black border border-white/20 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-red-500"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5 items-start">
                        <UserBadge role={user.role} isVIP={user.isVIP} />
                        
                        {user.role === 'moderator' && (
                          <div className="flex flex-col gap-1 mt-0.5">
                            <button
                              type="button"
                              onClick={() => handleOpenPermissionsModal(user)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-500/20 via-pink-500/15 to-red-500/20 border border-purple-500/40 text-purple-300 text-[11px] font-bold hover:bg-purple-500/30 hover:text-white transition-all shadow-sm active:scale-95 w-fit"
                              title="মডারেটরের অপশন ও পারমিশন পরিবর্তন করুন"
                            >
                              <Shield className="w-3 h-3 text-purple-400" />
                              <span>অপশন দিন ({user.permissions?.length || 0})</span>
                            </button>

                            {user.permissions && user.permissions.length > 0 && (
                              <div className="flex flex-wrap gap-1 max-w-[220px]">
                                {user.permissions.slice(0, 3).map(p => (
                                  <span key={p} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] text-zinc-300 font-mono">
                                    {p === 'blogger_import' ? '📥 Blogger' : p === 'upload' ? '📤 Upload' : p === 'videos' ? '🎬 Videos' : p}
                                  </span>
                                ))}
                                {user.permissions.length > 3 && (
                                  <span className="px-1 py-0.5 rounded bg-white/5 text-[9px] text-zinc-400">
                                    +{user.permissions.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  
                  <td className="px-6 py-4">
                    {editingId === user.id ? (
                      <input 
                        type="number"
                        min="0"
                        value={editPoints}
                        onChange={(e) => setEditPoints(parseInt(e.target.value) || 0)}
                        className="w-20 bg-black border border-white/20 text-white text-xs rounded px-2 py-1.5 focus:border-red-500 outline-none"
                      />
                    ) : (
                      <div className="text-yellow-500 font-bold">{user.points || 0} pts</div>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-emerald-400 font-bold flex items-center gap-1">
                      <MonitorPlay className="h-4 w-4" />
                      {user.videos_watched || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar className="h-3 w-3" />
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-3">
                      {editingId === user.id ? (
                        <>
                          <button onClick={() => saveEdit(user.id)} className="text-emerald-500 hover:text-emerald-400 transition-colors" title="Save">
                            <Save className="h-5 w-5" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-white transition-colors" title="Cancel">
                            <X className="h-5 w-5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(user)} className="text-blue-500 hover:text-blue-400 transition-colors" title="Edit Role">
                            <Edit className="h-5 w-5" />
                          </button>
                          <button onClick={() => handleDelete(user.id)} className="text-red-500 hover:text-red-400 transition-colors" title="Delete User">
                            <Trash2 className="h-5 w-5 ml-auto" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No users found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Moderator Permissions & Options Management Modal */}
      {showPermissionsModal && modalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-white/10 bg-[#0d0e14] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/[0.08] bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-red-600/30 shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    মডারেটর অপশন ও পারমিশন কন্ট্রোল
                  </h3>
                  <p className="text-xs text-zinc-400">
                    ইউজার: <strong className="text-white">{modalUser.name}</strong> ({modalUser.email || modalUser.phone || modalUser.id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPermissionsModal(false)}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Presets Bar */}
            <div className="p-4 bg-black/40 border-b border-white/5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-zinc-400 font-medium">কুইক সিলেক্ট প্রিসেট:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setModalPermissions(MODERATOR_PERMISSION_OPTIONS.map(o => o.id))}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
                >
                  সব সিলেক্ট ({MODERATOR_PERMISSION_OPTIONS.length})
                </button>
                <button
                  type="button"
                  onClick={() => setModalPermissions(['blogger_import', 'upload', 'videos', 'categories'])}
                  className="px-2.5 py-1 rounded-lg bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 text-xs font-bold transition-all border border-orange-500/30"
                >
                  মিডিয়া ও ভিডিও (4)
                </button>
                <button
                  type="button"
                  onClick={() => setModalPermissions(['comments', 'reports', 'notice', 'notifications'])}
                  className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 text-xs font-bold transition-all border border-blue-500/30"
                >
                  কমিউনিটি ও নোটিশ (4)
                </button>
                <button
                  type="button"
                  onClick={() => setModalPermissions([])}
                  className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all"
                >
                  সব ক্লিয়ার
                </button>
              </div>
            </div>

            {/* Modal Body - Options Checkboxes */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3">
              <p className="text-xs text-zinc-400 mb-2 leading-relaxed">
                টিক চিহ্ন দেওয়া অপশনগুলো মডারেটরের ইউজার প্যানেল ও সাইডবারে সরাসরি দৃশ্যমান হবে। এছাড়া মডারেটরগণ বিজ্ঞাপন ছাড়া সম্পূর্ণ ফ্রিতে ভিডিও দেখার সুযোগ পাবেন:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {MODERATOR_PERMISSION_OPTIONS.map((option) => {
                  const isChecked = modalPermissions.includes(option.id);
                  return (
                    <label
                      key={option.id}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        isChecked 
                          ? 'bg-gradient-to-r from-red-600/20 via-purple-600/15 to-transparent border-red-500/50 shadow-md' 
                          : 'bg-white/[0.02] border-white/5 hover:border-white/20'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setModalPermissions([...modalPermissions, option.id]);
                          } else {
                            setModalPermissions(modalPermissions.filter(p => p !== option.id));
                          }
                        }}
                        className="mt-1 h-4 w-4 rounded border-white/20 bg-black text-red-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-xs sm:text-sm font-bold ${isChecked ? 'text-white' : 'text-zinc-300'}`}>
                            {option.labelBn}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 font-mono">
                            {option.category}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400 block font-mono mt-0.5">
                          {option.label}
                        </span>
                        <p className="text-[11px] text-zinc-400/80 mt-1 leading-snug">
                          {option.desc}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-t border-white/[0.08] bg-white/[0.02]">
              <span className="text-xs text-zinc-400 font-medium">
                সিলেক্টেড: <strong className="text-white">{modalPermissions.length} টি অপশন</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPermissionsModal(false)}
                  disabled={isSavingPermissions}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 text-xs font-bold transition-colors"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleSaveModalPermissions}
                  disabled={isSavingPermissions}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingPermissions ? 'সেভ হচ্ছে...' : 'অপশনসমূহ সংরক্ষণ করুন'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
