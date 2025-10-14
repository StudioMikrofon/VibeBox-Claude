import { Play, Pause, SkipForward, SkipBack } from 'lucide-react';

interface PlayerControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  hasNextSong: boolean;
  hasPreviousSong: boolean;
  manualSkipCrossfade?: number;
}

export default function PlayerControls({
  isPlaying,
  onPlayPause,
  onNext,
  onPrevious,
  hasNextSong,
  hasPreviousSong,
  manualSkipCrossfade
}: PlayerControlsProps) {
  return (
    <div className="space-y-2">
      {/* LIVE Indicator */}
      {isPlaying && (
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-green-400 text-sm font-semibold animate-pulse flex items-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            LIVE
          </span>
        </div>
      )}

      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={onPrevious}
          disabled={!hasPreviousSong}
          className="p-3 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-full transition-all transform hover:scale-105 shadow-lg"
          title="Previous song"
        >
          <SkipBack className="w-6 h-6 text-white" />
        </button>

        <button
          onClick={onPlayPause}
          className="p-4 bg-purple-500 hover:bg-purple-600 rounded-full transition-all transform hover:scale-105 shadow-lg"
        >
          {isPlaying ? (
            <Pause className="w-8 h-8 text-white" fill="white" />
          ) : (
            <Play className="w-8 h-8 text-white ml-1" fill="white" />
          )}
        </button>
      
        <button
          onClick={onNext}
          disabled={!hasNextSong}
          className="p-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-full transition-all transform hover:scale-105 shadow-lg"
          title={`Skip to next (${manualSkipCrossfade !== undefined ? manualSkipCrossfade : 3}s crossfade)`}
        >
          <SkipForward className="w-6 h-6 text-white" />
        </button>
      </div>
    </div>
  );
}