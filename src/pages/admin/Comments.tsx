import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

import { Comment } from '../../types';
import { Trash2, UserX, EyeOff, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Comments() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchComments();
  }, []);

  async function fetchComments() {
    try {
      const { data, error } = await supabase.from('comments').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      
      const formatted = (data || []).map(c => ({
        id: c.id,
        videoId: c.video_id,
        userId: c.user_id,
        userName: c.user_name,
        text: c.text,
        createdAt: c.created_at,
        isHidden: c.isHidden
      })) as Comment[];
      
      setComments(formatted);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      const { error } = await supabase.from('comments').delete().eq('id', id);
      if (error) throw error;
      setComments(comments.filter(c => c.id !== id));
    } catch (error) {
      console.error("Error deleting comment:", error);
      alert("Failed to delete comment.");
    }
  };

  const handleBanUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Ban user ${userName} from commenting?`)) return;
    try {
      // In a real app we might need a specific field 'isBannedFromComments'
      // Assuming 'status' is 'banned' for simple cases, or we can add that to schema later.
      const { error } = await supabase.from('users').update({ status: 'banned' }).eq('id', userId);
      if (error) throw error;
      alert(`User ${userName} has been banned.`);
    } catch (e) {
      console.error(e);
      alert("Failed to ban user.");
    }
  };

  const handleToggleHide = async (id: string, currentStatus: boolean | undefined) => {
    try {
      const { error } = await supabase.from('comments').update({ "isHidden": !currentStatus }).eq('id', id);
      if (error) throw error;
      setComments(comments.map(c => c.id === id ? { ...c, isHidden: !currentStatus } : c));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Comments</h1>
        <p className="text-sm text-gray-400">Manage user comments on videos.</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-black/50 text-xs uppercase text-gray-400 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Comment</th>
                  <th className="px-6 py-4">Video Link</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {comments.map((comment) => (
                  <tr key={comment.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-6 py-4 font-medium text-white">{comment.userName}</td>
                    <td className="px-6 py-4 text-gray-300 max-w-xs truncate" title={comment.text}>{comment.text}</td>
                    <td className="px-6 py-4">
                      <Link to={`/video/${comment.videoId}`} target="_blank" className="text-red-500 hover:underline">
                        View Video
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      {comment.isHidden ? (
                        <span className="text-orange-500 text-xs font-bold bg-orange-500/10 px-2 py-1 rounded">Hidden</span>
                      ) : (
                        <span className="text-emerald-500 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded">Visible</span>
                      )}
                    </td>
                    <td className="px-6 py-4">{new Date(comment.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => handleToggleHide(comment.id, comment.isHidden)} className="text-gray-400 hover:text-white transition-colors" title={comment.isHidden ? 'Approve Comment' : 'Hide Comment'}>
                          {comment.isHidden ? <CheckCircle className="h-5 w-5 text-emerald-500" /> : <EyeOff className="h-5 w-5" />}
                        </button>
                        <button onClick={() => handleBanUser(comment.userId, comment.userName)} className="text-orange-500 hover:text-orange-400 transition-colors" title="Ban User from Commenting">
                          <UserX className="h-5 w-5" />
                        </button>
                        <button onClick={() => handleDelete(comment.id)} className="text-red-500 hover:text-red-400 transition-colors" title="Delete Comment">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {comments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No comments found.</td>
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
