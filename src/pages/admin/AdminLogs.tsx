import { formatBDTime } from '../../lib/utils';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

import { AuditLog } from '../../types';
import { FileText, Clock } from 'lucide-react';

export function AdminLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const { data, error } = await supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        
        const fetched: AuditLog[] = (data || []).map(d => ({
          id: d.id,
          adminId: d.admin_id,
          action: d.action,
          details: d.details,
          createdAt: d.created_at
        }));
        setLogs(fetched);
      } catch (err: any) {
        if (err?.code === 'PGRST205' || err?.message?.includes('admin_logs')) {
           setLogs([]); // table doesn't exist yet, just show empty
        } else {
           console.error("Error fetching audit logs:", err);
        }
      } finally {
        setIsLoading(false);
      }
    }
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-red-500" />
            Activity Logs
          </h1>
          <p className="text-sm text-gray-400 mt-1">Review recent administrative actions.</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center">
            <Clock className="w-12 h-12 mb-4 opacity-50" />
            <p>No activity logs found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm text-gray-400 min-w-[600px]">
              <thead className="border-b border-white/10 text-xs uppercase text-gray-500 bg-black/20">
                <tr>
                  <th className="px-6 py-4 font-medium">Time</th>
                  <th className="px-6 py-4 font-medium">Admin ID</th>
                  <th className="px-6 py-4 font-medium">Action</th>
                  <th className="px-6 py-4 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatBDTime(log.createdAt)}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{log.adminId}</td>
                    <td className="px-6 py-4">
                      <span className="bg-red-500/10 text-red-500 font-bold px-2 py-1 rounded text-xs">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 truncate max-w-[300px]" title={log.details}>
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
