import { Edit, Trash2, Play } from 'lucide-react';
import { Series } from '../types';

interface Props {
  series: Series;
  onEdit: (series: Series) => void;
  onDelete: (id: string) => void;
}

export function SeriesCard({ series, onEdit, onDelete }: Props) {
  return (
    <div className="group relative overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 transition-all hover:border-zinc-700 hover:shadow-xl hover:shadow-black/50">
      <div className="aspect-video w-full overflow-hidden bg-zinc-800 relative">
        {series.posterUrl ? (
          <img src={series.posterUrl} alt={series.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-700">
            <Play size={48} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent opacity-80" />
        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button onClick={() => onEdit(series)} className="p-2 bg-zinc-800/80 hover:bg-indigo-600 text-white rounded-full backdrop-blur-sm transition-colors">
            <Edit size={16} />
          </button>
          <button onClick={() => onDelete(series.id)} className="p-2 bg-zinc-800/80 hover:bg-red-600 text-white rounded-full backdrop-blur-sm transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold text-zinc-100 truncate pr-2">{series.title}</h3>
          <span className="text-xs font-medium px-2 py-1 rounded bg-zinc-800 text-zinc-300 shrink-0">{series.releaseYear}</span>
        </div>
        <p className="text-sm text-zinc-400 line-clamp-2 mb-3">{series.description}</p>
        <div className="flex items-center text-xs text-indigo-400 font-medium">
          {series.genre}
        </div>
      </div>
    </div>
  );
}
