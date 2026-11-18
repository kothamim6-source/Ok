import { formatBDTime } from '../../lib/utils';
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Gift, CheckCircle, AlertCircle, Clock, Search, ArrowLeft, X, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { motion, AnimatePresence } from 'motion/react';

export function RedeemSection() {
  const { user, setUser } = useAuthStore();
  const [code, setCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [redeemHistory, setRedeemHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successDetails, setSuccessDetails] = useState({ days: 0 });

  useEffect(() => {
    if (user?.id) {
      fetchHistory();
    }
  }, [user?.id]);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('redeem_codes')
        .select('*')
        .eq('used_by', user?.id)
        .order('used_at', { ascending: false });
        
      if (!error && data) {
        setRedeemHistory(data);
      }
    } catch (e) {
      console.error('Error fetching redeem history:', e);
    }
    setIsLoadingHistory(false);
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !code.trim()) return;
    
    setIsRedeeming(true);
    setMessage({ type: '', text: '' });
    
    const formattedCode = code.trim().toUpperCase();
    
    try {
      // Check if user already has an active VIP
      const now = Date.now();
      if (user.isVIP && user.vipExpiresAt && user.vipExpiresAt > now) {
        throw new Error('দুঃখিত! আপনার বর্তমান VIP এর মেয়াদ শেষ হওয়ার আগে আপনি নতুন কোনো কোড রিডিম করতে পারবেন না।');
      }

      // 1. Check if code exists and is valid
      const { data: codeData, error: codeError } = await supabase
        .from('redeem_codes')
        .select('*')
        .eq('code', formattedCode)
        .single();
        
      if (codeError || !codeData) {
        throw new Error('দুঃখিত! কোডটি সঠিক নয় অথবা কোডটির অস্তিত্ব নেই।');
      }
      
      if (codeData.is_used) {
        throw new Error('দুঃখিত! এই কোডটি ইতিমধ্যে কেউ ব্যবহার করে ফেলেছে।');
      }
      
      // 2. Calculate new VIP expiry
      const currentExpiry = user.vipExpiresAt && user.vipExpiresAt > now ? user.vipExpiresAt : now;
      const newExpiry = currentExpiry + (codeData.days * 24 * 60 * 60 * 1000);
      
      // 3. Mark code as used
      const { error: updateCodeError } = await supabase
        .from('redeem_codes')
        .update({
          is_used: true,
          used_by: user.id,
          used_at: now
        })
        .eq('id', codeData.id)
        .eq('is_used', false); // Optimistic locking
        
      if (updateCodeError) throw new Error('দুঃখিত! এই কোডটি মাত্র কেউ ব্যবহার করে ফেলেছে।');
      
      // 4. Update user VIP status
      const { error: updateUserError } = await supabase
        .from('users')
        .update({
          is_vip: true,
          vip_expires_at: newExpiry,
          device_limit: Math.max(user.device_limit || 1, codeData.device_limit || 1),
        })
        .eq('id', user.id);
        
      if (updateUserError) throw updateUserError;
      
      // Update local state
      setUser({
        ...user,
        isVIP: true,
        vipExpiresAt: newExpiry,
        device_limit: Math.max(user.device_limit || 1, codeData.device_limit || 1)
      });
      
      // Show success popup instead of standard message
      setSuccessDetails({ days: codeData.days });
      setShowSuccessPopup(true);
      setMessage({ type: '', text: '' });
      setCode('');
      fetchHistory(); // Refresh history
      
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'কোডটি রিডিম করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।' });
    }
    
    setIsRedeeming(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#111] rounded-2xl border border-white/5 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center">
            <Gift className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Redeem Code</h2>
            <p className="text-gray-400 text-sm">ফ্রি VIP প্রিমিয়াম পেতে আপনার প্রোমো বা গিফট কোডটি এখানে দিন</p>
          </div>
        </div>

        {message.text && (
          <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 ${
            message.type === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-500' : 'bg-green-500/10 border border-green-500/20 text-green-500'
          }`}>
            {message.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
            <p className="font-medium">{message.text}</p>
          </div>
        )}

        <form onSubmit={handleRedeem} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-400 mb-2">
              Gift / Promo Code
            </label>
            <div className="relative">
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. VIPFREE7"
                className="w-full bg-black/50 border border-white/10 rounded-xl pl-4 pr-32 py-4 text-white font-mono uppercase tracking-wider focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
              <button
                type="submit"
                disabled={isRedeeming || !code.trim()}
                className="absolute right-2 top-2 bottom-2 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {isRedeeming ? 'যাচাই করা হচ্ছে...' : 'রিডিম করুন'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="bg-[#111] rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" /> Redemption History
          </h3>
        </div>
        
        <div className="divide-y divide-white/5">
          {isLoadingHistory ? (
            <div className="p-8 text-center text-gray-500">Loading history...</div>
          ) : redeemHistory.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              You haven't redeemed any codes yet.
            </div>
          ) : (
            redeemHistory.map((item) => (
              <div key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold tracking-wider">{item.code}</h4>
                    <p className="text-sm text-gray-400">
                      {item.used_at ? formatBDTime(item.used_at) : 'Unknown date'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-full text-sm font-bold border border-indigo-500/20 w-fit">
                  +{item.days} Day{item.days !== 1 ? 's' : ''} VIP
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {/* Success Popup */}
      <AnimatePresence>
        {showSuccessPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#111] border border-white/10 p-8 rounded-3xl w-full max-w-sm relative overflow-hidden text-center"
            >
              {/* Background Glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-indigo-500/20 blur-[50px] rounded-full pointer-events-none" />
              
              <button
                onClick={() => setShowSuccessPopup(false)}
                className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                <Sparkles className="w-10 h-10 text-indigo-400 relative z-10" />
                <div className="absolute inset-0 bg-indigo-500/30 blur-xl rounded-full" />
              </div>

              <h3 className="text-2xl font-bold text-white mb-2">অভিনন্দন!</h3>
              <p className="text-gray-400 mb-6">
                আপনার কোডটি সফলভাবে রিডিম হয়েছে। আপনি <span className="text-indigo-400 font-bold">{successDetails.days} দিনের</span> VIP প্রিমিয়াম পেয়েছেন!
              </p>

              <button
                onClick={() => setShowSuccessPopup(false)}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all active:scale-[0.98]"
              >
                ঠিক আছে
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
