import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Series } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (series: Omit<Series, 'id' | 'createdAt'>) => void;
  editingSeries?: Series | null;
}

export function SeriesFormModal({ isOpen, onClose, onSave, editingSeries }: Props) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    genre: '',
    releaseYear: '',
    posterUrl: '',
    videoUrl: ''
  });

  useEffect(() => {
    if (editingSeries) {
      setFormData({
        title: editingSeries.title,
        description: editingSeries.description,
        genre: editingSeries.genre,
        releaseYear: editingSeries.releaseYear,
        posterUrl: editingSeries.posterUrl,
        videoUrl: editingSeries.videoUrl || ''
      });
    } else {
      setFormData({ title: '', description: '', genre: '', releaseYear: '', posterUrl: '', videoUrl: '' });
    }
  }, [editingSeries, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-auto">
        <div className="flex justify-between items-center p-5 border-b border-zinc-800">
          <h2 className="text-xl font-semibold text-white">{editingSeries ? 'Edit Web Series' : 'Upload New Web Series'}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Title</label>
            <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" placeholder="e.g. Breaking Bad" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Description</label>
            <textarea required rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" placeholder="Brief summary of the series..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Genre</label>
              <input required type="text" value={formData.genre} onChange={e => setFormData({...formData, genre: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" placeholder="e.g. Thriller, Drama" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Release Year</label>
              <input required type="number" min="1900" max="2099" value={formData.releaseYear} onChange={e => setFormData({...formData, releaseYear: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" placeholder="2024" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Poster Image URL</label>
            <input required type="url" value={formData.posterUrl} onChange={e => setFormData({...formData, posterUrl: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" placeholder="https://..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Video URL (Optional)</label>
            <input type="url" value={formData.videoUrl} onChange={e => setFormData({...formData, videoUrl: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" placeholder="https://..." />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-lg shadow-indigo-500/25">
              {editingSeries ? 'Save Changes' : 'Upload Series'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
