import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

import { Report } from '../../types';
import { Trash2, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    try {
      const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      
      const fetched = (data || []).map(r => ({
        id: r.id,
        type: r.type,
        targetId: r.item_id,
        userId: r.user_id,
        reportedBy: r.user_id,
        reason: r.reason,
        status: r.status,
        createdAt: r.created_at
      })) as Report[];
      setReports(fetched);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleResolve = async (id: string) => {
    try {
      const { error } = await supabase.from('reports').update({ status: 'resolved' }).eq('id', id);
      if (error) throw error;
      setReports(reports.map(r => r.id === id ? { ...r, status: 'resolved' } : r));
    } catch (error) {
      console.error("Error resolving report:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this report?')) return;
    try {
      const { error } = await supabase.from('reports').delete().eq('id', id);
      if (error) throw error;
      setReports(reports.filter(r => r.id !== id));
    } catch (error) {
      console.error("Error deleting report:", error);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Reports</h1>
        <p className="text-sm text-gray-400">Manage user reports for videos or comments.</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-black/50 text-xs uppercase text-gray-400 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Reason</th>
                  <th className="px-6 py-4">Target Link</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-6 py-4 capitalize">{report.type}</td>
                    <td className="px-6 py-4 text-gray-300 max-w-xs truncate" title={report.reason}>{report.reason}</td>
                    <td className="px-6 py-4">
                      {report.type === 'video' ? (
                        <Link to={`/video/${report.targetId}`} target="_blank" className="text-red-500 hover:underline">
                          View Video
                        </Link>
                      ) : (
                        <span className="text-gray-500">ID: {report.targetId.substring(0,8)}...</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${report.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        {report.status !== 'resolved' && (
                          <button onClick={() => handleResolve(report.id)} className="text-emerald-500 hover:text-emerald-400" title="Mark as resolved">
                            <CheckCircle className="h-5 w-5" />
                          </button>
                        )}
                        <button onClick={() => handleDelete(report.id)} className="text-red-500 hover:text-red-400" title="Delete report">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No reports found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
