import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { User } from '../../types';
import { 
  ShieldCheck, 
  UserPlus, 
  Search, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Sparkles, 
  AlertCircle, 
  Mail, 
  Phone, 
  CheckSquare, 
  Square, 
  ExternalLink, 
  ShieldAlert,
  Eye,
  LayoutDashboard,
  Video,
  Upload,
  Globe,
  FolderTree,
  Image as ImageIcon,
  MessageSquare,
  Flag,
  Megaphone,
  Bell,
  Activity,
  Send,
  CreditCard,
  Gift,
  Users as UsersIcon
} from 'lucide-react';
import { MODERATOR_PERMISSION_OPTIONS, ModeratorPermissionOption } from '../../data/moderatorPermissions';
import { useAuthStore } from '../../store/authStore';

export function Moderators() {
  const { user: currentAdmin } = useAuthStore();
  const [moderators, setModerators] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [allModeratorAssignments, setAllModeratorAssignments] = useState<Record<string, any>>({});

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditPermsModal, setShowEditPermsModal] = useState(false);
  const [selectedMod, setSelectedMod] = useState<User | null>(null);
  const [tempPermissions, setTempPermissions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add Moderator search & select
  const [userSearchText, setUserSearchText] = useState('');
  const [selectedUserToPromote, setSelectedUserToPromote] = useState<User | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      // 1. Fetch settings for moderator_permissions
      let assignments: Record<string, any> = {};
      try {
        const { data: modSetting } = await supabase.from('settings').select('*').eq('id', 'moderator_permissions').maybeSingle();
        if (modSetting?.data?.assignments) {
          assignments = modSetting.data.assignments;
          setAllModeratorAssignments(assignments);
        }
      } catch (e) {
        console.warn('Could not load moderator settings', e);
      }

      // 2. Fetch users
      const { data: usersData, error } = await supabase.from('users').select('*');
      if (error) throw error;

      const formattedUsers: User[] = (usersData || []).map((u: any) => {
        let finalName = u.name || 'User';
        if (finalName.toLowerCase() === 'user' && u.email) {
          finalName = u.email.split('@')[0];
        }
        const userPerms = assignments[u.id]?.permissions || 
          (u.email ? assignments[u.email.toLowerCase()]?.permissions : []) || 
          u.permissions || 
          [];

        return {
          id: u.id,
          name: finalName,
          email: u.email || '',
          phone: u.phone || u.phone_number || u.mobile || '',
          role: u.role || 'user',
          isVIP: false,
          vipExpiresAt: u.vip_expires_at,
          createdAt: u.created_at ? new Date(u.created_at).getTime() : Date.now(),
          points: u.points || 0,
          permissions: userPerms
        } as User;
      });

      setAllUsers(formattedUsers);
      const modList = formattedUsers.filter(u => u.role === 'moderator');
      setModerators(modList);
    } catch (err: any) {
      console.error('Error fetching moderator data:', err);
      setStatusMessage({ type: 'error', text: 'মডারেটর ডাটা লোড করতে ব্যর্থ হয়েছে।' });
    } finally {
      setIsLoading(false);
    }
  };

  const notify = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4500);
  };

  // Filtered moderators based on search
  const filteredModerators = useMemo(() => {
    return moderators.filter(m => 
      (m.name && m.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.email && m.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.phone && m.phone.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [moderators, searchQuery]);

  // Candidate users to promote
  const candidateUsers = useMemo(() => {
    if (!userSearchText.trim()) return [];
    return allUsers
      .filter(u => u.role !== 'moderator' && u.role !== 'admin')
      .filter(u => 
        (u.name && u.name.toLowerCase().includes(userSearchText.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(userSearchText.toLowerCase())) ||
        (u.phone && u.phone.toLowerCase().includes(userSearchText.toLowerCase()))
      )
      .slice(0, 10);
  }, [allUsers, userSearchText]);

  // Open edit modal
  const openEditModal = (mod: User) => {
    setSelectedMod(mod);
    const existing = mod.permissions || allModeratorAssignments[mod.id]?.permissions || [];
    setTempPermissions([...existing]);
    setShowEditPermsModal(true);
  };

  // Toggle single permission
  const togglePermission = (permId: string) => {
    setTempPermissions(prev => 
      prev.includes(permId) 
        ? prev.filter(p => p !== permId) 
        : [...prev, permId]
    );
  };

  // Quick permission helpers
  const handleSelectAll = () => {
    setTempPermissions(MODERATOR_PERMISSION_OPTIONS.map(opt => opt.id));
  };

  const handleSelectMediaOnly = () => {
    setTempPermissions(['upload', 'videos', 'blogger_import', 'categories', 'banners']);
  };

  const handleClearAll = () => {
    setTempPermissions([]);
  };

  // Save permissions (for existing or newly promoted)
  const savePermissions = async (userId: string, targetUser: User, permissionsToSave: string[]) => {
    setIsSaving(true);
    try {
      const updatedAssignments = { ...allModeratorAssignments };
      const record = {
        userId,
        name: targetUser.name || 'Moderator',
        email: targetUser.email || '',
        phone: targetUser.phone || '',
        permissions: permissionsToSave,
        assignedAt: Date.now()
      };

      updatedAssignments[userId] = record;
      if (targetUser.email) {
        updatedAssignments[targetUser.email.toLowerCase()] = record;
      }

      // Upsert in settings table
      const { error: setErr } = await supabase.from('settings').upsert({
        id: 'moderator_permissions',
        data: {
          updatedAt: Date.now(),
          assignments: updatedAssignments
        }
      });
      if (setErr) throw setErr;

      // Update user role to moderator in users table
      await supabase.from('users').update({
        role: 'moderator',
        is_vip: true
      }).eq('id', userId);

      if (targetUser.email) {
        await supabase.from('users').update({
          role: 'moderator',
          is_vip: true
        }).eq('email', targetUser.email);
      }

      setAllModeratorAssignments(updatedAssignments);

      // Update local state
      setModerators(prev => {
        const exists = prev.some(m => m.id === userId);
        if (exists) {
          return prev.map(m => m.id === userId ? { ...m, role: 'moderator', permissions: permissionsToSave } : m);
        } else {
          return [...prev, { ...targetUser, role: 'moderator', permissions: permissionsToSave }];
        }
      });

      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, role: 'moderator', permissions: permissionsToSave } : u));

      // Trigger custom update
      window.dispatchEvent(new CustomEvent('user-vip-updated'));

      notify('success', `${targetUser.name || 'মডারেটর'} এর পারমিশন সফলভাবে আপডেট হয়েছে!`);
      setShowEditPermsModal(false);
      setShowAddModal(false);
      setSelectedMod(null);
      setSelectedUserToPromote(null);
    } catch (err: any) {
      console.error('Save failed:', err);
      notify('error', 'পারমিশন সেভ করতে ত্রুটি হয়েছে: ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // Revoke moderator role
  const revokeModerator = async (mod: User) => {
    if (!confirm(`আপনি কি নিশ্চিত যে "${mod.name}" কে মডারেটর থেকে সাধারণ ইউজারে পরিবর্তন করবেন?`)) {
      return;
    }

    try {
      setIsSaving(true);
      const updatedAssignments = { ...allModeratorAssignments };
      delete updatedAssignments[mod.id];
      if (mod.email) {
        delete updatedAssignments[mod.email.toLowerCase()];
      }

      await supabase.from('settings').upsert({
        id: 'moderator_permissions',
        data: {
          updatedAt: Date.now(),
          assignments: updatedAssignments
        }
      });

      await supabase.from('users').update({
        role: 'user'
      }).eq('id', mod.id);

      if (mod.email) {
        await supabase.from('users').update({
          role: 'user'
        }).eq('email', mod.email);
      }

      setAllModeratorAssignments(updatedAssignments);
      setModerators(prev => prev.filter(m => m.id !== mod.id));
      setAllUsers(prev => prev.map(u => u.id === mod.id ? { ...u, role: 'user', permissions: [] } : u));

      window.dispatchEvent(new CustomEvent('user-vip-updated'));
      notify('success', `"${mod.name}" কে সাধারণ ইউজারে ফিরিয়ে আনা হয়েছে।`);
    } catch (err: any) {
      console.error('Revoke failed:', err);
      notify('error', 'মডারেটর রিমুভ করতে সমস্যা হয়েছে: ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // Group permission options by category
  const categories = useMemo(() => {
    const map: Record<string, ModeratorPermissionOption[]> = {};
    MODERATOR_PERMISSION_OPTIONS.forEach(opt => {
      if (!map[opt.category]) map[opt.category] = [];
      map[opt.category].push(opt);
    });
    return map;
  }, []);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center border border-red-500/30">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Moderator Team & Roles
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            মডারেটর টিম পরিচালনা করুন এবং কার কোন সেকশন (ড্যাশবোর্ড, ভিডিও, আপলোড, কমেন্ট ইত্যাদি) দেখার পারমিশন থাকবে তা নিয়ন্ত্রণ করুন।
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => {
              setSelectedUserToPromote(null);
              setUserSearchText('');
              setTempPermissions(['upload', 'videos', 'categories']);
              setShowAddModal(true);
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-red-950/40 hover:brightness-110 active:scale-95 transition-all w-full sm:w-auto border border-red-500/30"
          >
            <UserPlus className="h-4 w-4" />
            <span>নতুন মডারেটর যুক্ত করুন</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {statusMessage && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border transition-all animate-in fade-in slide-in-from-top-2 ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
            : 'bg-red-950/40 border-red-500/30 text-red-300'
        }`}>
          {statusMessage.type === 'success' ? <Check className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <span className="text-sm font-semibold">{statusMessage.text}</span>
        </div>
      )}

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0c0d14] border border-white/[0.08] rounded-xl p-4 flex items-center gap-4">
          <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/20 text-red-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{moderators.length}</div>
            <div className="text-xs text-zinc-400 font-medium uppercase tracking-wider">মোট মডারেটর</div>
          </div>
        </div>

        <div className="bg-[#0c0d14] border border-white/[0.08] rounded-xl p-4 flex items-center gap-4">
          <div className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20 text-emerald-400">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              {moderators.filter(m => (m.permissions || []).includes('dashboard')).length}
            </div>
            <div className="text-xs text-zinc-400 font-medium uppercase tracking-wider">ড্যাশবোর্ড অ্যাক্সেসপ্রাপ্ত</div>
          </div>
        </div>

        <div className="bg-[#0c0d14] border border-white/[0.08] rounded-xl p-4 flex items-center gap-4">
          <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/20 text-blue-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              {moderators.filter(m => !(m.permissions || []).includes('dashboard')).length}
            </div>
            <div className="text-xs text-zinc-400 font-medium uppercase tracking-wider">ড্যাশবোর্ড গোপন (নো এক্সেস)</div>
          </div>
        </div>
      </div>

      {/* Notice Card on Permissions */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs sm:text-sm text-amber-200/90 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-amber-300">
            ড্যাশবোর্ড সিকিউরিটি ও গোপনীয়তা রুলস:
          </p>
          <p className="text-zinc-300 leading-relaxed">
            কোনো মডারেটরকে ড্যাশবোর্ড পারমিশন না দিলে সে অ্যাডমিন ড্যাশবোর্ড বা সাইটের কোনো পরিসংখ্যান/আর্থিক তথ্য দেখতে পারবে না। সে শুধুমাত্র আপনার অনুমোদিত অপশনগুলো (যেমন ভিডিও আপলোড, ক্যাটাগরি, কমেন্ট ইত্যাদি) দেখতে পাবে।
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <input
          type="text"
          placeholder="মডারেটর খুঁজুন (নাম, ইমেইল অথবা মোবাইল নম্বর দিয়ে)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-white/[0.08] bg-[#0c0d14] pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-red-500/50 focus:outline-none transition-all"
        />
      </div>

      {/* Moderators List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 text-zinc-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-500 border-t-transparent mb-3" />
          <span className="text-xs font-semibold">মডারেটর তালিকা লোড হচ্ছে...</span>
        </div>
      ) : filteredModerators.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#0c0d14] p-10 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-zinc-600 mb-3" />
          <h3 className="text-base font-bold text-white">কোনো মডারেটর পাওয়া যায়নি</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
            {searchQuery 
              ? 'আপনার সার্চ অনুযায়ী কোনো মডারেটরের রেকর্ড মেলেনি।'
              : 'এখনো কোনো ইউজারকে মডারেটর করা হয়নি। উপরে "নতুন মডারেটর যুক্ত করুন" বাটনে ক্লিক করে যেকোনো ইউজারকে পারমিশনসহ মডারেটর বানাতে পারেন।'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredModerators.map((mod) => {
            const perms = mod.permissions || [];
            const hasDashboard = perms.includes('dashboard');

            return (
              <div 
                key={mod.id}
                className="rounded-2xl border border-white/[0.08] bg-[#0c0d14] p-5 space-y-4 hover:border-white/20 transition-all shadow-md relative overflow-hidden"
              >
                {/* Top User Info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-white font-black text-sm border border-red-400/30 shrink-0">
                      {(mod.name || 'M').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white tracking-tight">
                          {mod.name || 'Unnamed Moderator'}
                        </h4>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-red-600/20 text-red-400 border border-red-500/30 rounded-md">
                          মডারেটর
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                        {mod.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-zinc-500" />
                            <span className="truncate max-w-[150px]">{mod.email}</span>
                          </span>
                        )}
                        {mod.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-zinc-500" />
                            <span>{mod.phone}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dashboard Access Badge */}
                  <div>
                    {hasDashboard ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <Check className="h-3 w-3" /> ড্যাশবোর্ড অনুমোদিত
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                        <X className="h-3 w-3" /> ড্যাশবোর্ড গোপন
                      </span>
                    )}
                  </div>
                </div>

                {/* Permissions Chips */}
                <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                  <div className="text-[11px] font-bold text-zinc-400 flex items-center justify-between">
                    <span>অনুমোদিত ফিচারসমূহ ({perms.length}):</span>
                    <span className="text-[10px] text-zinc-500">
                      {perms.length === MODERATOR_PERMISSION_OPTIONS.length ? 'সব অ্যাক্সেস' : 'কাস্টম অ্যাক্সেস'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto scrollbar-thin">
                    {perms.length === 0 ? (
                      <span className="text-xs text-zinc-500 italic">কোনো পারমিশন সেট করা হয়নি</span>
                    ) : (
                      perms.map((pId) => {
                        const opt = MODERATOR_PERMISSION_OPTIONS.find(o => o.id === pId);
                        const isDash = pId === 'dashboard';
                        return (
                          <span
                            key={pId}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isDash 
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                                : 'bg-white/[0.05] text-zinc-300 border border-white/10'
                            }`}
                          >
                            {opt?.labelBn || opt?.label || pId}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
                  <button
                    onClick={() => openEditModal(mod)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/10 text-xs font-bold text-zinc-200 border border-white/10 transition-colors"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-blue-400" />
                    <span>পারমিশন পরিবর্তন</span>
                  </button>
                  <button
                    onClick={() => revokeModerator(mod)}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-bold text-red-400 border border-red-500/20 transition-colors"
                    title="মডারেটর থেকে সাধারণ ইউজারে রূপান্তর"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>রিমুভ</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: EDIT PERMISSIONS MODAL */}
      {showEditPermsModal && selectedMod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-[#0d0e17] border border-white/15 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center border border-red-500/30">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    পারমিশন সেটিংস: {selectedMod.name}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    নির্দিষ্ট ফিচার টিক দিয়ে পারমিশন দিন বা টিক তুলে দিয়ে বন্ধ করুন।
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditPermsModal(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Select Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 py-3 border-b border-white/10 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-300 font-medium border border-white/10"
                >
                  সবগুলো নির্বাচন করুন
                </button>
                <button
                  type="button"
                  onClick={handleSelectMediaOnly}
                  className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-300 font-medium border border-white/10"
                >
                  শুধুমাত্র মিডিয়া/ভিডিও
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 border border-white/10"
                >
                  সব আনচেক
                </button>
              </div>

              <div className="text-zinc-400 text-xs font-semibold">
                সিলেক্টেড: <span className="text-red-400 font-bold">{tempPermissions.length}</span> টি অপশন
              </div>
            </div>

            {/* Permissions Checkbox Grid (Categorized) */}
            <div className="flex-1 overflow-y-auto py-4 space-y-5 scrollbar-thin scrollbar-thumb-zinc-800">
              {/* Highlight Dashboard Option at top */}
              <div className="p-3.5 rounded-xl border border-red-500/40 bg-gradient-to-r from-red-950/30 to-black/30">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={tempPermissions.includes('dashboard')}
                    onChange={() => togglePermission('dashboard')}
                    className="mt-1 h-4 w-4 rounded border-red-500 bg-black text-red-600 focus:ring-red-500"
                  />
                  <div>
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4 text-red-400" />
                      ড্যাশবোর্ড ওভারভিউ (Dashboard Overview)
                    </span>
                    <p className="text-xs text-zinc-300 mt-0.5">
                      টিক দিলে মডারেটর ড্যাশবোর্ডের গ্রাফ, ইউজার কাউন্ট ও পরিসংখ্যান দেখতে পাবে। আনচেক রাখলে ড্যাশবোর্ড সম্পূর্ণ লুকানো থাকবে।
                    </p>
                  </div>
                </label>
              </div>

              {Object.entries(categories).map(([categoryName, options]) => {
                // Filter out dashboard since shown in highlight box
                const catOpts = options.filter(o => o.id !== 'dashboard');
                if (catOpts.length === 0) return null;

                return (
                  <div key={categoryName} className="space-y-2">
                    <h5 className="text-[11px] font-black uppercase tracking-wider text-zinc-400 px-1">
                      {categoryName}
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {catOpts.map((opt) => {
                        const isChecked = tempPermissions.includes(opt.id);
                        return (
                          <div
                            key={opt.id}
                            onClick={() => togglePermission(opt.id)}
                            className={`p-3 rounded-xl border cursor-pointer select-none transition-all flex items-start gap-2.5 ${
                              isChecked
                                ? 'bg-red-950/20 border-red-500/40 text-white'
                                : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // handled by parent div
                              className="mt-0.5 h-3.5 w-3.5 rounded border-white/20 bg-black text-red-600 focus:ring-red-500"
                            />
                            <div className="space-y-0.5">
                              <div className="text-xs font-bold text-zinc-100">
                                {opt.labelBn} ({opt.label})
                              </div>
                              <p className="text-[11px] text-zinc-400 line-clamp-2">
                                {opt.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setShowEditPermsModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-zinc-300 transition-colors"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => savePermissions(selectedMod.id, selectedMod, tempPermissions)}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:brightness-110 text-xs font-bold text-white shadow-lg shadow-red-950/40 transition-all border border-red-500/30 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>সেভ হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>পারমিশন সেভ করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / PROMOTE NEW MODERATOR */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-[#0d0e17] border border-white/15 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center border border-red-500/30">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    নতুন মডারেটর নির্বাচন ও পারমিশন প্রদান
                  </h3>
                  <p className="text-xs text-zinc-400">
                    রেজিস্টার্ড ইউজারদের মধ্য থেকে কাউকে নির্বাচন করে মডারেটর বানান।
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800">
              {/* Step 1: Select User */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  ১. ইউজার খুঁজুন (নাম, ইমেইল বা ফোন)
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="ইউজারের নাম অথবা ইমেইল লিখুন..."
                    value={userSearchText}
                    onChange={(e) => setUserSearchText(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/60 pl-9 pr-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-red-500/50 focus:outline-none"
                  />
                </div>

                {/* Candidate list */}
                {userSearchText.trim() && (
                  <div className="rounded-xl border border-white/10 bg-black/80 max-h-48 overflow-y-auto divide-y divide-white/5">
                    {candidateUsers.length === 0 ? (
                      <div className="p-3 text-xs text-zinc-500 text-center">
                        কোনো ইউজার মেলেনি
                      </div>
                    ) : (
                      candidateUsers.map((candidate) => (
                        <div
                          key={candidate.id}
                          onClick={() => {
                            setSelectedUserToPromote(candidate);
                            setUserSearchText('');
                          }}
                          className="p-2.5 flex items-center justify-between hover:bg-white/5 cursor-pointer transition-colors"
                        >
                          <div>
                            <div className="text-xs font-bold text-white">{candidate.name}</div>
                            <div className="text-[11px] text-zinc-400">{candidate.email || candidate.phone || 'No contact'}</div>
                          </div>
                          <span className="text-[10px] font-bold text-red-400 px-2 py-0.5 bg-red-500/10 rounded border border-red-500/20">
                            সিলেক্ট করুন
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Selected user badge */}
                {selectedUserToPromote && (
                  <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/20 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider">নির্বাচিত ইউজার:</div>
                      <div className="text-sm font-bold text-white">{selectedUserToPromote.name}</div>
                      <div className="text-xs text-zinc-400">{selectedUserToPromote.email || selectedUserToPromote.phone}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedUserToPromote(null)}
                      className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded bg-white/10"
                    >
                      পরিবর্তন
                    </button>
                  </div>
                )}
              </div>

              {/* Step 2: Choose Permissions */}
              <div className="space-y-3 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    ২. মডারেটরের পারমিশন নির্বাচন করুন ({tempPermissions.length} টি সিলেক্টেড)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-[11px] text-zinc-400 hover:text-white underline"
                    >
                      সব সিলেক্ট
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-[11px] text-zinc-400 hover:text-white underline"
                    >
                      ক্লিয়ার
                    </button>
                  </div>
                </div>

                {/* Highlight Dashboard Checkbox */}
                <div className="p-3 rounded-xl border border-red-500/30 bg-red-950/20">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tempPermissions.includes('dashboard')}
                      onChange={() => togglePermission('dashboard')}
                      className="mt-0.5 h-4 w-4 rounded border-red-500 bg-black text-red-600 focus:ring-red-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-white">
                        ড্যাশবোর্ড দেখার অনুমতি (Dashboard Overview)
                      </span>
                      <p className="text-[11px] text-zinc-400">
                        টিক না দিলে এই মডারেটর কোনো ড্যাশবোর্ড বা আয়/পরিসংখ্যান দেখতে পারবে না।
                      </p>
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {MODERATOR_PERMISSION_OPTIONS.filter(o => o.id !== 'dashboard').map((opt) => {
                    const isChecked = tempPermissions.includes(opt.id);
                    return (
                      <div
                        key={opt.id}
                        onClick={() => togglePermission(opt.id)}
                        className={`p-2.5 rounded-xl border cursor-pointer select-none transition-all flex items-start gap-2 ${
                          isChecked
                            ? 'bg-red-950/20 border-red-500/40 text-white'
                            : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:border-white/20'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-white/20 bg-black text-red-600 focus:ring-red-500"
                        />
                        <div className="text-xs font-medium">
                          {opt.labelBn}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-zinc-300 transition-colors"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={!selectedUserToPromote || isSaving}
                onClick={() => {
                  if (selectedUserToPromote) {
                    savePermissions(selectedUserToPromote.id, selectedUserToPromote, tempPermissions);
                  }
                }}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:brightness-110 text-xs font-bold text-white shadow-lg shadow-red-950/40 transition-all border border-red-500/30 disabled:opacity-40"
              >
                {isSaving ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>যোগ হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>মডারেটর হিসেবে সেভ করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
