import { X, Plus, Clock } from 'lucide-react';
import { formatDuration } from '../utils/formatters';

interface PreviewPlayerProps {
  youtubeId: string;
  title: string;
  channel: string;
  thumbnailUrl: string;
  duration: number;
  onClose: () => void;
  onAdd: () => void;
}

export default function PreviewPlayer({
  youtubeId,
  title,
  channel,
  thumbnailUrl,
  onClose,
  onAdd,
  duration,
}: PreviewPlayerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-gray-900/95 backdrop-blur-xl border border-white/20 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden">
        <div 
          className="aspect-video bg-cover bg-center"
          style={{ backgroundImage: `url(${thumbnailUrl})` }}
        >
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="relative z-10"
          />
        </div>

        <div className="p-6">
          <h3 className="text-xl font-bold text-white mb-1">{title}</h3>
          <p className="text-gray-400 mb-4">{channel}</p>
          
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-2 text-gray-400">
                <Clock className="w-5 h-5" />
                <span>{formatDuration(duration)}</span>
             </div>
            <div className="flex gap-2">
                <button
                onClick={onClose}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                >
                Close
                </button>
                <button
                onClick={onAdd}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white transition-colors"
                >
                <Plus className="w-5 h-5" />
                <span>Add to Queue</span>
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
