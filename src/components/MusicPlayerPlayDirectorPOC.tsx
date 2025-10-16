import { useEffect, useRef, useState } from 'react';
import { Song } from '../types/song';
import {
  usePlayDirector,
  createLoadSongIntent,
  createPlayIntent,
  createPauseIntent,
  createSkipNextIntent,
  createSkipPreviousIntent,
} from '../hooks/usePlayDirector';

interface MusicPlayerPlayDirectorPOCProps {
  currentSong: Song | null;
  nextSong: Song | null;
  previousSong: Song | null;
  isPlaying: boolean;
  onSongEnd: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  crossfadeDuration: number;
  manualSkipCrossfade?: number;
  isPlaybackDevice?: boolean;
  onTimeUpdate?: (time: number) => void;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

/**
 * PROOF OF CONCEPT: MusicPlayer using PlayDirector
 *
 * This is a simplified version to test PlayDirector integration.
 * NOT intended for production - just testing the architecture.
 */
export default function MusicPlayerPlayDirectorPOC({
  currentSong,
  nextSong,
  previousSong,
  isPlaying,
  onSongEnd,
  onPlayPause,
  onNext,
  onPrevious,
  crossfadeDuration,
  manualSkipCrossfade = 3,
  isPlaybackDevice = false,
  onTimeUpdate,
}: MusicPlayerPlayDirectorPOCProps) {
  const player1Ref = useRef<any>(null);
  const player2Ref = useRef<any>(null);
  const [isYTReady, setIsYTReady] = useState(false);

  // Initialize PlayDirector hook
  const { state, dispatchIntent, initializePlayers } = usePlayDirector({
    isPlaybackDevice,
    crossfadeDuration,
    manualSkipCrossfade,
    onSongEnd,
    onTimeUpdate,
    onError: (error) => console.error('PlayDirector error:', error),
  });

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsYTReady(true);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      setIsYTReady(true);
      console.log('✅ YouTube IFrame API ready');
    };

    return () => {
      console.log('🧹 Cleaning up YouTube API');
    };
  }, []);

  // Initialize YouTube players
  useEffect(() => {
    if (!isYTReady) return;
    if (player1Ref.current && player2Ref.current) return;

    console.log('🎬 Creating YouTube players...');

    const createPlayer = (id: string) => {
      return new window.YT.Player(id, {
        height: '0',
        width: '0',
        playerVars: { autoplay: 0, controls: 0 },
        events: {
          onReady: () => console.log(`✅ Player ${id} ready`),
          onStateChange: (e: any) => {
            // Handle track end (state 0 = ended)
            if (e.data === 0) {
              console.log('🎵 Track ended, dispatching track end...');
              onSongEnd();
            }
          },
          onError: (e: any) => console.error(`❌ Player ${id} error:`, e.data),
        },
      });
    };

    player1Ref.current = createPlayer('youtube-player-poc-1');
    player2Ref.current = createPlayer('youtube-player-poc-2');

    // Give players time to initialize, then register with PlayDirector
    setTimeout(() => {
      initializePlayers(player1Ref.current, player2Ref.current);
    }, 500);
  }, [isYTReady, initializePlayers, onSongEnd]);

  // Load song when currentSong changes
  useEffect(() => {
    if (!currentSong || state === 'PREPARING') return;

    console.log('🎬 Loading song:', currentSong.title);
    dispatchIntent(createLoadSongIntent(currentSong, 0));
  }, [currentSong?.id, state, dispatchIntent]);

  // Handle play/pause
  useEffect(() => {
    if (state === 'IDLE' || state === 'PREPARING') return;

    if (isPlaying && state !== 'PLAYING') {
      console.log('▶️ Play intent');
      dispatchIntent(createPlayIntent());
    } else if (!isPlaying && state !== 'PAUSED') {
      console.log('⏸️ Pause intent');
      dispatchIntent(createPauseIntent());
    }
  }, [isPlaying, state, dispatchIntent]);

  // Manual skip handlers
  const handleNext = () => {
    if (!nextSong) return;
    console.log('⏭️ Skip next intent');
    dispatchIntent(createSkipNextIntent(manualSkipCrossfade > 0));
    onNext();
  };

  const handlePrevious = () => {
    if (!previousSong) return;
    console.log('⏮️ Skip previous intent');
    dispatchIntent(createSkipPreviousIntent(manualSkipCrossfade > 0));
    onPrevious();
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-black border border-yellow-500/50 rounded-2xl p-6 shadow-2xl">
      <div id="youtube-player-poc-1" style={{ display: 'none' }} />
      <div id="youtube-player-poc-2" style={{ display: 'none' }} />

      <div className="text-center mb-4">
        <div className="text-yellow-400 font-bold text-lg mb-2">
          🧪 PlayDirector POC Mode
        </div>
        <div className="text-gray-400 text-sm">
          Testing PlayDirector integration (not production-ready)
        </div>
      </div>

      {currentSong ? (
        <>
          <div className="text-white text-xl font-bold mb-2">{currentSong.title}</div>
          <div className="text-gray-400 text-sm mb-4">{currentSong.artist}</div>

          <div className="text-purple-400 text-sm mb-4">
            PlayDirector State: <span className="font-mono">{state}</span>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={handlePrevious}
              disabled={!previousSong}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white"
            >
              ⏮️ Previous
            </button>

            <button
              onClick={onPlayPause}
              className="px-6 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-white font-bold"
            >
              {isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>

            <button
              onClick={handleNext}
              disabled={!nextSong}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white"
            >
              ⏭️ Next
            </button>
          </div>

          {isPlaybackDevice && (
            <div className="mt-4 p-3 bg-blue-500/20 border border-blue-500/50 rounded-lg text-blue-400 text-sm text-center">
              📡 Playback Device Mode
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-gray-500 py-8">No song loaded</div>
      )}
    </div>
  );
}
