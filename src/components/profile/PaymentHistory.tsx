import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { VIPRequest } from '../../types';
import { Receipt, Loader2 } from 'lucide-react';

interface PaymentHistoryProps {
  userId: string;
}

export function PaymentHistory({ userId }: PaymentHistoryProps) {
  const [requests, setRequests] = useState<VIPRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      if (!userId) return;
      try {
        const { data: vData } = await supabase
          .from('vip_requests')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (vData) {
          const data: VIPRequest[] = vData.map(doc => ({
            id: doc.id,
            userId: doc.user_id,
            userName: 'Unknown', userEmail: doc.user_email,
            transactionId: doc.transaction_id,
            paymentMethod: doc.payment_method,
            amount: doc.amount,
            status: doc.status as any,
            createdAt: doc.created_at
          }));
          setRequests(data);
        }
      } catch (error) {
        console.error('Error fetching payment history:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-red-500" />
      </div>
    );
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-white">
        <Receipt className="h-5 w-5 text-red-500" />
        Payment History
      </h2>
      <div className="space-y-3">
        {requests.map((req) => (
          <div key={req.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 p-3.5">
            <div>
              <div className="font-bold text-white text-sm">৳{req.amount} — {req.paymentMethod}</div>
              <div className="text-xs font-mono text-amber-300 mt-0.5">TrxID: {req.transactionId}</div>
              <div className="text-[11px] text-gray-400 mt-1">
                {new Date(req.createdAt).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
            <div>
              <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider border ${
                req.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                req.status === 'rejected' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse'
              }`}>
                {req.status === 'approved' ? 'অনুমোদিত' : req.status === 'rejected' ? 'বাতিল' : 'পেন্ডিং'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
