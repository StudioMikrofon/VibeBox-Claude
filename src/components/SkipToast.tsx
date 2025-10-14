import { useEffect, useState } from 'react';
import { Song } from '../types/song';

interface SkipToastProps {
  song: Song | null;
  show: boolean;
  onHide: () => void;
}

export default function SkipToast({ song, show, onHide }: SkipToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show && song) {
      // Force reset animation by first hiding
      setIsVisible(false);
      
      // Small delay to ensure DOM updates, then show
      const resetTimer = setTimeout(() => {
        setIsVisible(true);
        
        const fadeTimer = setTimeout(() => {
          setIsVisible(false);
        }, 2700); // Start fade-out 300ms before hiding

        const hideTimer = setTimeout(() => {
          onHide();
        }, 3000); // Hide completely after 3 seconds

        return () => {
          clearTimeout(fadeTimer);
          clearTimeout(hideTimer);
        };
      }, 50);

      return () => clearTimeout(resetTimer);
    } else {
      setIsVisible(false);
    }
  }, [show, song?.id, onHide]); // Watch song.id instead of whole song object

  if (!show || !song) return null;

  return (
    <div
      className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl shadow-2xl p-4 flex items-center gap-3 min-w-[320px] max-w-[400px] border border-white/20">
        <img
          src={song.thumbnailUrl || `https://i.ytimg.com/vi/${song.id.replace('youtube-', '')}/mqdefault.jpg`}
          alt={song.title}
          className="w-16 h-16 rounded-lg object-cover shadow-lg"
          onError={(e) => {
            e.currentTarget.src = 'https://via.placeholder.com/64?text=♪';
          }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-purple-100 font-semibold mb-1 flex items-center gap-1">
            <span>⏭️</span>
            <span>Skipping to...</span>
          </p>
          <p className="text-white font-bold text-sm truncate">{song.title}</p>
          <p className="text-purple-100 text-xs truncate">{song.artist}</p>
        </div>
      </div>
    </div>
  );
}
