import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { VIPRequest } from '../../types';
import { useSettingsStore } from '../../store/settingsStore';
import { Loader2, Check, X, Search, Trash2, Crown, Sparkles, Clock, Calendar, ChevronDown } from 'lucide-react';

export function resolveDurationDays(amount: number, packages?: Array<{ price: number; durationDays: number }>) {
  if (packages && packages.length > 0) {
    const matched = packages.find(p => p.price === amount);
    if (matched && matched.durationDays) return matched.durationDays;
  }
  // Standard VIP Pricing Tiers
  if (amount <= 15) return 1;    // ৳10 -> 1 day trial
  if (amount <= 25) return 1;    // ৳20 -> 1 day trial
  if (amount <= 35) return 7;    // ৳30 -> 7 days weekly
  if (amount <= 75) return 7;    // ৳50-70 -> 7 days weekly
  if (amount <= 200) return 30;  // ৳100-150 -> 30 days monthly
  if (amount >= 300) return 365; // ৳500 -> 365 days lifetime
  return 30;
}

export function VIPRequests() {
  const { settings } = useSettingsStore();
  const [requests, setRequests] = useState<VIPRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [errorMsg, setErrorMsg] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [selectedDaysMap, setSelectedDaysMap] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchRequests() {
      try {
        const { data, error } = await supabase
          .from('vip_requests')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        const reqs = (data || []).map(r => ({
          id: r.id,
          userId: r.user_id,
          userName: r.user_name || 'Unknown User',
          userEmail: r.user_email,
          transactionId: r.transaction_id,
          paymentMethod: r.payment_method,
          amount: r.amount,
          durationDays: r.duration_days || undefined,
          packageId: r.package_id || undefined,
          status: r.status,
          createdAt: r.created_at
        }));
        setRequests(reqs as VIPRequest[]);
        setLoading(false);
      } catch(e) {
        setLoading(false);
        console.error(e);
      }
    }
    fetchRequests();
  }, []);

  // Transaction ID duplicate frequency detector map
  const trxCounts = requests.reduce((acc, curr) => {
    const clean = curr.transactionId?.trim().toUpperCase();
    if (clean) {
      acc[clean] = (acc[clean] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const handleApprove = async (request: VIPRequest, customDays?: number) => {
    const cleanTrx = request.transactionId?.trim().toUpperCase();
    const isDup = cleanTrx && (trxCounts[cleanTrx] || 0) > 1;

    if (isDup) {
      const confirmDup = window.confirm(
        `⚠️ সতর্কতা: এই ট্রানজ্যাকশন আইডি (${request.transactionId}) ইতোমধ্যে ${trxCounts[cleanTrx]} বার জমা দেওয়া হয়েছে!\n\nআপনি কি নিশ্চিত যে এটি সঠিক এবং অনুমোদন করতে চান?`
      );
      if (!confirmDup) return;
    }

    try {
      setErrorMsg('');
      setActionSuccessMsg('');

      // Determine duration: customDays > selectedDaysMap > request.durationDays > resolveDurationDays
      const selectedOverride = selectedDaysMap[request.id];
      const grantDays = customDays || selectedOverride || request.durationDays || resolveDurationDays(request.amount, settings?.vipSettings?.packages);

      const { data: userDoc } = await supabase
        .from('users')
        .select('vip_expires_at')
        .eq('id', request.userId)
        .single();

      const now = Date.now();
      const currentExpiry = userDoc?.vip_expires_at && userDoc.vip_expires_at > now ? userDoc.vip_expires_at : now;
      const addedMs = grantDays * 24 * 60 * 60 * 1000;
      const newExpiry = currentExpiry + addedMs;

      // 1. Update user to active VIP without invalid columns (no vip_reason)
      const { error: userUpdateError } = await supabase.from('users').update({
        is_vip: true,
        vip_expires_at: newExpiry
      }).eq('id', request.userId);

      if (userUpdateError) {
        console.error("Failed to update user VIP:", userUpdateError);
        throw new Error(`ব্যবহারকারীর ভিআইপি স্ট্যাটাস আপডেট ব্যর্থ: ${userUpdateError.message}`);
      }

      // 2. Update vip_requests table
      const { error: reqUpdateError } = await supabase.from('vip_requests').update({ 
        status: 'approved'
      }).eq('id', request.id);

      if (reqUpdateError) {
        console.warn("Notice: vip_requests update issue:", reqUpdateError);
      }

      // 3. Formatted expiry date in Bengali
      const formattedDate = new Date(newExpiry).toLocaleDateString('bn-BD', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // 4. Send celebratory Bengali popup notification to user
      try {
        await supabase.from('notifications').insert([{
          id: crypto.randomUUID(),
          user_id: request.userId,
          title: '🎉 আপনার VIP রিকোয়েস্ট অনুমোদিত হয়েছে!',
          message: `আপনার ৳${request.amount} টাকার (${request.paymentMethod}) পেমেন্ট সফলভাবে ভেরিফাই করা হয়েছে। আপনার একাউন্টে ${grantDays} দিনের ভিআইপি প্রিমিয়াম মেম্বারশিপ সক্রিয় করা হয়েছে। মেয়াদ শেষ: ${formattedDate}। সম্পূর্ণ বিজ্ঞাপনমুক্ত অভিজ্ঞতা উপভোগ করুন!`,
          read: false,
          type: 'VIP_APPROVED',
          is_popup: true,
          created_at: Date.now()
        }]);
      } catch (notifErr) {
        console.warn("Notification insert warning:", notifErr);
      }
      
      setRequests(prev => prev.map(r => r.id === request.id ? { ...r, status: 'approved', durationDays: grantDays } : r));
      setActionSuccessMsg(`✅ ইউজার "${request.userName}" এর জন্য ${grantDays} দিনের VIP এক্সেস সফলভাবে অনুমোদিত হয়েছে! (মেয়াদ: ${formattedDate})`);
      setTimeout(() => setActionSuccessMsg(''), 6000);
    } catch (error: any) {
      console.error("Error approving request:", error);
      setErrorMsg(error?.message || 'Failed to approve request. Please check permissions.');
    }
  };

  const handleReject = async (request: VIPRequest) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই রিকোয়েস্টটি বাতিল (Reject) করতে চান?')) return;
    try {
      setErrorMsg('');
      await supabase.from('vip_requests').update({ status: 'rejected' }).eq('id', request.id);
      
      try {
        await supabase.from('notifications').insert([{
          id: crypto.randomUUID(),
          user_id: request.userId,
          title: '❌ ভিআইপি রিকোয়েস্ট বাতিল করা হয়েছে',
          message: `দুঃখিত, আপনার প্রেরিত TrxID (${request.transactionId}) যাচাই করা সম্ভব হয়নি। অনুগ্রহ করে সঠিক TrxID দিয়ে আবার চেষ্টা করুন অথবা এডমিন সাপোর্টে যোগাযোগ করুন।`,
          read: false,
          type: 'VIP_REJECTED',
          is_popup: true,
          created_at: Date.now()
        }]);
      } catch (e) {}
      
      setRequests(prev => prev.map(r => r.id === request.id ? { ...r, status: 'rejected' } : r));
      setActionSuccessMsg(`রিকোয়েস্টটি বাতিল করা হয়েছে এবং ইউজারকে নোটিশ পাঠানো হয়েছে।`);
      setTimeout(() => setActionSuccessMsg(''), 4000);
    } catch (error) {
      console.error("Error rejecting request:", error);
      setErrorMsg('Failed to reject request.');
    }
  };

  const handleDelete = async (requestId: string) => {
    if (!window.confirm('Are you sure you want to delete this VIP request?')) return;
    try {
      await supabase.from('vip_requests').delete().eq('id', requestId);
      setRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (error) {
      console.error("Error deleting request:", error);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = req.transactionId.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          req.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          req.userName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Crown className="text-amber-400 w-7 h-7" /> VIP Requests (পেমেন্ট ভেরিফিকেশন)
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            বিকাশ/নগদ/রকেট থেকে ব্যবহারকারীদের পাঠানো TrxID যাচাই করে ১-ক্লিকে সঠিক মেয়াদের VIP এক্সেস অনুমোদন দিন।
          </p>
        </div>

        {/* Quick Pending Counter Badge */}
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.5 rounded-full text-amber-300 text-xs font-bold">
          <Clock className="w-3.5 h-3.5 animate-pulse" />
          <span>পেন্ডিং রিকোয়েস্ট: {requests.filter(r => r.status === 'pending').length} টি</span>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="bg-emerald-500/15 text-emerald-300 p-4 rounded-2xl flex items-center gap-3 border border-emerald-500/30 font-bold text-sm animate-in fade-in shadow-lg shadow-emerald-500/10">
          <Sparkles className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-500/15 text-red-400 p-4 rounded-2xl flex items-start gap-3 border border-red-500/30 font-bold text-sm shadow-lg shadow-red-500/10">
          <X className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by User, Email or TrxID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-white/10 bg-black/60 text-white text-sm rounded-xl focus:ring-1 focus:ring-red-500 outline-none"
          />
        </div>
        
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === status 
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30' 
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {status === 'all' ? 'All' : status === 'pending' ? 'Pending (পেন্ডিং)' : status === 'approved' ? 'Approved (অনুমোদিত)' : 'Rejected (বাতিল)'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-red-600" />
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-[#0e0e11] overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-black/80 text-[11px] uppercase tracking-wider text-gray-400 border-b border-white/10">
                <tr>
                  <th className="px-5 py-4">User Details</th>
                  <th className="px-5 py-4">Method</th>
                  <th className="px-5 py-4">TrxID</th>
                  <th className="px-5 py-4">Amount</th>
                  <th className="px-5 py-4">Package / Duration</th>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Approve / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredRequests.map((req) => {
                  const calculatedDefaultDays = req.durationDays || resolveDurationDays(req.amount, settings?.vipSettings?.packages);
                  const activeSelectedDays = selectedDaysMap[req.id] || calculatedDefaultDays;

                  return (
                    <tr key={req.id} className="hover:bg-white/[0.03] transition-colors">
                      {/* User */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-white text-sm">{req.userName}</div>
                        <div className="text-xs text-gray-400">{req.userEmail}</div>
                      </td>

                      {/* Method */}
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg border ${
                          req.paymentMethod === 'bKash' ? 'bg-pink-500/10 text-pink-400 border-pink-500/30' :
                          req.paymentMethod === 'Nagad' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
                          'bg-purple-500/10 text-purple-400 border-purple-500/30'
                        }`}>
                          {req.paymentMethod}
                        </span>
                      </td>

                      {/* TrxID with Duplicate Warning Flag */}
                      <td className="px-5 py-4 font-mono font-bold text-xs select-all">
                        {(() => {
                          const clean = req.transactionId?.trim().toUpperCase();
                          const count = clean ? (trxCounts[clean] || 0) : 0;
                          const isDuplicate = count > 1;

                          return (
                            <div className="flex flex-col gap-1 items-start">
                              <span className={isDuplicate ? 'text-red-400 font-black bg-red-500/10 px-2 py-0.5 rounded border border-red-500/30' : 'text-amber-300'}>
                                {req.transactionId}
                              </span>
                              {isDuplicate && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-red-600 text-white animate-pulse">
                                  ⚠️ ডুপ্লিকেট ({count} বার সাবমিট)
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-4 font-black text-white text-sm">
                        ৳{req.amount}
                      </td>

                      {/* Duration & Package */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs w-fit">
                            <Calendar className="w-3.5 h-3.5 text-amber-400" />
                            {activeSelectedDays} দিন {activeSelectedDays === 1 ? '(দৈনিক)' : activeSelectedDays === 7 ? '(সাপ্তাহিক)' : activeSelectedDays === 30 ? '(মাসিক)' : activeSelectedDays >= 365 ? '(লাইফটাইম)' : ''}
                          </span>

                          {/* Quick Duration Modifier dropdown for Admin */}
                          {req.status === 'pending' && (
                            <select
                              value={activeSelectedDays}
                              onChange={(e) => setSelectedDaysMap(prev => ({ ...prev, [req.id]: Number(e.target.value) }))}
                              className="text-[11px] bg-black/80 border border-white/10 rounded-md px-2 py-1 text-gray-300 hover:border-amber-500/50 outline-none w-fit cursor-pointer"
                            >
                              <option value={1}>১ দিন (৳১০ - ৳২০)</option>
                              <option value={7}>৭ দিন (৳৩০ - ৳৭০)</option>
                              <option value={15}>১৫ দিন</option>
                              <option value={30}>৩০ দিন (৳১০০ - ৳১৫০)</option>
                              <option value={60}>৬০ দিন (২ মাস)</option>
                              <option value={90}>৯০ দিন (৩ মাস)</option>
                              <option value={365}>৩৬৫ দিন (১ বছর)</option>
                            </select>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(req.createdAt).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border ${
                          req.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                          req.status === 'rejected' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                          'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse'
                        }`}>
                          {req.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {req.status === 'pending' && (
                            <>
                              {/* 1-Click Approve Button with selected days */}
                              <button
                                onClick={() => handleApprove(req, activeSelectedDays)}
                                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer active:scale-95"
                                title={`Approve (${activeSelectedDays} Days)`}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>অনুমোদন ({activeSelectedDays} দিন)</span>
                              </button>

                              {/* Reject Button */}
                              <button
                                onClick={() => handleReject(req)}
                                className="p-1.5 text-red-400 hover:text-white hover:bg-red-600/20 rounded-xl transition-colors border border-red-500/20 cursor-pointer"
                                title="Reject Request"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDelete(req.id)}
                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                            title="Delete Request"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredRequests.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      কোনো ভিআইপি রিকোয়েস্ট পাওয়া যায়নি।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
