import { Song } from '../types/song';

interface NextSongPreviewProps {
  nextSong: Song | null;
}

export default function NextSongPreview({ nextSong }: NextSongPreviewProps) {
  if (!nextSong) return null;

  return (
    <div className="pt-4 border-t border-white/10">
      <p className="text-xs text-gray-500 mb-2">Up Next:</p>
      <div className="flex items-center gap-2">
        <img 
          src={nextSong.thumbnailUrl || ''} 
          alt={nextSong.title} 
          className="w-10 h-10 rounded object-cover" 
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white truncate">{nextSong.title}</p>
          <p className="text-xs text-gray-400 truncate">{nextSong.artist}</p>
        </div>
      </div>
    </div>
  );
}
