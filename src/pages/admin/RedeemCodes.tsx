import { formatBDTime } from '../../lib/utils';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Ticket, Plus, CheckCircle, Copy, Search, AlertCircle, X, Check, Clock, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { UserBadge } from '../../components/ui/UserBadge';

export function RedeemCodes() {
  const [codes, setCodes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  
  // Form State
  const [newCode, setNewCode] = useState('');
  const [days, setDays] = useState(1);
  const [deviceLimit, setDeviceLimit] = useState(1);
  const [amount, setAmount] = useState(1); // How many to generate
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { user } = useAuthStore();

  useEffect(() => {
    fetchCodes();
  }, []);

  const fetchCodes = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase
        .from('redeem_codes')
        .select(`
          *,
          used_by_user:users!redeem_codes_used_by_fkey(name, email, role, is_vip, vip_expires_at)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) {
        if (error.code === '42P01') {
          // Table doesn't exist error
          setShowSqlModal(true);
        } else {
          throw error;
        }
      }
      
      setCodes(data || []);
    } catch (e: any) {
      console.error(e);
      if (e.message && e.message.includes('relation "redeem_codes" does not exist')) {
        setShowSqlModal(true);
      } else {
        setErrorMsg('Error fetching codes. Please try again.');
      }
    }
    setIsLoading(false);
  };

  const generateRandomCode = (length = 8) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleGenerateCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsCreating(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const codesToInsert = [];
      for (let i = 0; i < amount; i++) {
        let codeValue = newCode.trim();
        if (amount > 1 || !codeValue) {
          codeValue = generateRandomCode(8); // Random code if none provided or generating multiple
        }
        
        codesToInsert.push({
          id: crypto.randomUUID(),
          code: codeValue.toUpperCase().startsWith('BD-VV-') ? codeValue.toUpperCase() : 'BD-VV-' + codeValue.toUpperCase(),
          days: days,
          device_limit: deviceLimit,
          is_used: false,
          created_by: user.id,
          created_at: Date.now()
        });
      }

      const { error } = await supabase.from('redeem_codes').insert(codesToInsert);
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('This specific code already exists. Try a different one.');
        }
        throw error;
      }
      
      setSuccessMsg(`Successfully generated ${amount} redeem code(s)!`);
      setNewCode('');
      setAmount(1);
      fetchCodes();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Error generating code(s).');
    }
    
    setIsCreating(false);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setSuccessMsg(`Code ${code} copied!`);
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  const copyAllUnusedCodes = () => {
    const unused = codes.filter(c => !c.is_used).map(c => c.code);
    if (unused.length === 0) {
      setErrorMsg('No unused codes to copy');
      setTimeout(() => setErrorMsg(''), 2000);
      return;
    }
    navigator.clipboard.writeText(unused.join('\n'));
    setSuccessMsg(`Copied ${unused.length} codes!`);
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  const deleteCode = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this code? If a user has already used this code, their VIP access will be removed.")) return;
    try {
      const codeToDelete = codes.find(c => c.id === id);
      
      if (codeToDelete && codeToDelete.is_used && codeToDelete.used_by) {
        // Revoke VIP from the user
        const { error: userError } = await supabase.from('users').update({
          is_vip: false,
          vip_expires_at: null,
          device_limit: 1,
          devices: []
        }).eq('id', codeToDelete.used_by);
        if (userError) throw userError;
      }

      const { error } = await supabase.from('redeem_codes').delete().eq('id', id);
      if (error) throw error;
      
      setCodes(codes.filter(c => c.id !== id));
      setSuccessMsg('Code deleted and VIP revoked (if used).');
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err: any) {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(''), 2000);
    }
  };


  const sqlQuery = `
CREATE TABLE IF NOT EXISTS public.redeem_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  days INTEGER NOT NULL DEFAULT 1,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  used_at BIGINT,
  created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at BIGINT NOT NULL
);
ALTER TABLE redeem_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all actions on redeem_codes" ON redeem_codes FOR ALL USING (true) WITH CHECK (true);
  `;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Redeem Codes</h1>
          <p className="mt-1 text-sm text-gray-400">
            Generate and manage premium VIP redeem codes for users.
          </p>
        </div>
        <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-500 flex items-center justify-center">
           <Ticket className="w-6 h-6" />
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl flex items-center gap-3 bg-green-500/10 border border-green-500/20 text-green-500">
          <CheckCircle className="w-5 h-5" />
          <p className="font-medium">{successMsg}</p>
        </div>
      )}
      
      {errorMsg && (
        <div className="p-4 rounded-xl flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-500">
          <AlertCircle className="w-5 h-5" />
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}

      {/* SQL Setup Modal for Supabase if table doesn't exist */}
      {showSqlModal && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-red-500/20 rounded-full">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Database Table Missing!</h2>
              <p className="text-gray-400 text-sm">You need to run this SQL in your Supabase Dashboard to use this feature.</p>
            </div>
          </div>
          
          <div className="bg-[#0f0f0f] rounded-xl p-4 border border-white/10 relative mt-4">
            <button 
              onClick={() => {
                navigator.clipboard.writeText(sqlQuery);
                setSuccessMsg('SQL Query Copied!');
                setTimeout(() => setSuccessMsg(''), 2000);
              }}
              className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <Copy className="w-5 h-5" />
            </button>
            <pre className="text-xs text-green-400 overflow-x-auto p-2">
              {sqlQuery}
            </pre>
          </div>
          <div className="mt-4 flex gap-4">
            <button 
              onClick={fetchCodes}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold"
            >
              I have run the SQL, Reload
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Create Code Form */}
        <div className="lg:col-span-1 bg-[#111] rounded-2xl border border-white/5 p-6 h-fit">
          <h2 className="text-lg font-bold text-white mb-4">Generate New Codes</h2>
          <form onSubmit={handleGenerateCodes} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Custom Code (Optional)</label>
              <input 
                type="text" 
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="e.g. VIPACCESS30"
                disabled={amount > 1}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
              {amount > 1 && <p className="text-xs text-gray-500 mt-1">Custom code disabled when generating multiple.</p>}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">VIP Days</label>
                <input 
                  type="number" 
                  min="1"
                  value={days}
                  onChange={(e) => setDays(parseInt(e.target.value) || 1)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Amount to Generate</label>
                <input 
                  type="number" 
                  min="1"
                  max="100"
                  value={amount}
                  onChange={(e) => setAmount(parseInt(e.target.value) || 1)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Device Limit (Max allowed devices)</label>
              <input 
                type="number" 
                min="1"
                value={deviceLimit}
                onChange={(e) => setDeviceLimit(parseInt(e.target.value) || 1)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">How many devices this account can be used on after redeeming.</p>
            </div>
            
            <button 
              type="submit"
              disabled={isCreating || showSqlModal}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
            >
              {isCreating ? 'Generating...' : <><Plus className="w-5 h-5" /> Generate Codes</>}
            </button>
          </form>
        </div>

        {/* Code List */}
        <div className="lg:col-span-2 bg-[#111] rounded-2xl border border-white/5 overflow-hidden">
                    <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">All Redeem Codes</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={copyAllUnusedCodes}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-lg text-sm font-medium transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copy All Unused
              </button>
              <div className="text-xs font-medium bg-white/5 px-3 py-1 rounded-full text-gray-400">
                {codes.length} Codes
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="bg-black/40 text-xs uppercase">
                <tr>
                  <th className="px-6 py-4 font-medium text-gray-300">Code</th>
                  <th className="px-6 py-4 font-medium text-gray-300">Duration</th>
                  <th className="px-6 py-4 font-medium text-gray-300">Device Limit</th>
                  <th className="px-6 py-4 font-medium text-gray-300">Status</th>
                  <th className="px-6 py-4 font-medium text-gray-300">Used By</th>
                  <th className="px-6 py-4 font-medium text-gray-300 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      Loading codes...
                    </td>
                  </tr>
                ) : codes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No redeem codes generated yet.
                    </td>
                  </tr>
                ) : (
                  codes.map((c) => (
                    <tr key={c.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-white bg-white/5 px-2 py-1 rounded-md tracking-wider">
                            {c.code}
                          </span>
                          <button 
                            onClick={() => copyCode(c.code)}
                            className="p-1.5 text-gray-500 hover:text-white bg-black/40 hover:bg-white/10 rounded-md transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1">
                          Created: {new Date(c.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-indigo-400">
                        {c.days} Day(s)
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {c.device_limit || 1} Device(s)
                      </td>
                      <td className="px-6 py-4">
                        {c.is_used ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                            <X className="w-3.5 h-3.5" /> Used
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                            <Check className="w-3.5 h-3.5" /> Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {c.is_used && c.used_by_user ? (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white font-medium truncate max-w-[150px]">
                                {c.used_by_user.name || 'User'}
                              </span>
                              <UserBadge role={c.used_by_user.role} isVIP={c.used_by_user.is_vip && c.used_by_user.vip_expires_at && c.used_by_user.vip_expires_at > Date.now()} />
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {c.used_at ? formatBDTime(c.used_at) : 'N/A'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-600 italic">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => deleteCode(c.id)}
                          className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete Code"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
