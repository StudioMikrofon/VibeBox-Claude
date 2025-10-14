import { Song } from '../types/song';

interface SongInfoProps {
  song: Song;
  activePlayer: 1 | 2;
  crossfadeDuration: number;
  normalization: boolean;
}

export default function SongInfo({
  song,
  activePlayer,
  crossfadeDuration,
  normalization
}: SongInfoProps) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <img 
        key={song.id}
        src={song.thumbnailUrl || `https://i.ytimg.com/vi/${song.id.replace('youtube-', '')}/mqdefault.jpg`}
        alt={song.title}
        className="w-20 h-20 rounded-lg object-cover shadow-lg"
        onError={(e) => {
          e.currentTarget.src = 'https://via.placeholder.com/80?text=♪';
        }}
      />
      <div className="flex-1 min-w-0">
        {/* Mobile: marquee scrolling for long titles */}
        <div className="sm:hidden mobile-marquee">
          <h3
            key={song.id}
            className="font-bold text-white text-lg mobile-marquee-text overflow"
          >
            {song.title} {/* Duplicate text for seamless loop */} {song.title}
          </h3>
        </div>
        {/* Desktop: simple truncate */}
        <h3
          key={song.id}
          className="hidden sm:block font-bold text-white text-lg truncate"
        >
          {song.title}
        </h3>
        <p className="text-gray-400 text-sm truncate">
          {song.artist}
        </p>
        {song.addedBy && (
          <p className="text-xs text-gray-500 mt-1">
            Added by <span className="text-purple-400 font-semibold">{song.addedBy}</span>
          </p>
        )}
        <p className="text-xs text-purple-400 mt-1 flex items-center gap-2">
          <span>🎵 Player {activePlayer}</span>
          {crossfadeDuration > 0 && (
            <>
              <span>•</span>
              <span>🎚️ {crossfadeDuration}s crossfade</span>
            </>
          )}
          {normalization && (
            <>
              <span>•</span>
              <span>🔊 Auto-normalize</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
