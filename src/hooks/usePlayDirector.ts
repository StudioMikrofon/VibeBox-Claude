import { useEffect, useRef, useState } from 'react';
import { PlayDirector } from '../services/PlayDirector';
import { PlaybackState, PlaybackIntent, PlayDirectorConfig } from '../types/playback';
import { Song } from '../types/song';

interface UsePlayDirectorProps {
  isPlaybackDevice: boolean;
  crossfadeDuration: number;
  manualSkipCrossfade: number;
  onSongEnd?: () => void;
  onTimeUpdate?: (time: number) => void;
  onError?: (error: string) => void;
  onCrossfadeNeeded?: (inactivePlayerId: 1 | 2) => void;
}

interface UsePlayDirectorReturn {
  director: PlayDirector;
  state: PlaybackState;
  currentPosition: number;
  isReady: boolean;
  dispatchIntent: (intent: PlaybackIntent) => Promise<void>;
  initializePlayers: (player1: any, player2: any) => void;
}

/**
 * React hook for PlayDirector integration
 *
 * Usage:
 * const { director, state, dispatchIntent } = usePlayDirector({
 *   isPlaybackDevice: true,
 *   crossfadeDuration: 10,
 *   manualSkipCrossfade: 3,
 *   onSongEnd: handleSongEnd,
 *   onTimeUpdate: handleTimeUpdate
 * });
 */
export function usePlayDirector(props: UsePlayDirectorProps): UsePlayDirectorReturn {
  const {
    isPlaybackDevice,
    crossfadeDuration,
    manualSkipCrossfade,
    onSongEnd,
    onTimeUpdate,
    onError,
    onCrossfadeNeeded
  } = props;

  // Director singleton ref (stays same across re-renders)
  const directorRef = useRef<PlayDirector | null>(null);

  // State from director
  const [state, setState] = useState<PlaybackState>('IDLE');
  const [currentPosition, setCurrentPosition] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // Initialize PlayDirector on mount
  useEffect(() => {
    if (!directorRef.current) {
      const config: PlayDirectorConfig = {
        isPlaybackDevice,
        crossfadeDuration,
        manualSkipCrossfade,
        syncInterval: 2000,        // 2s sync check
        broadcastInterval: 1000,   // 1s broadcast
        driftThreshold: 3.0,       // 3s max drift
      };

      directorRef.current = PlayDirector.getInstance(config);
      console.log('🎬 usePlayDirector: Initialized PlayDirector singleton');
    }

    const director = directorRef.current;

    // Subscribe to state changes
    const handleStateChange = (newState: PlaybackState) => {
      console.log(`🎬 usePlayDirector: State changed to ${newState}`);
      setState(newState);
    };

    // Subscribe to position updates
    const handlePositionUpdate = (position: number) => {
      setCurrentPosition(position);
      if (onTimeUpdate) {
        onTimeUpdate(position);
      }
    };

    // Subscribe to track end
    const handleTrackEnd = () => {
      console.log('🎬 usePlayDirector: Track ended');
      if (onSongEnd) {
        onSongEnd();
      }
    };

    // Subscribe to errors
    const handleError = (error: string) => {
      console.error('🎬 usePlayDirector: Error:', error);
      if (onError) {
        onError(error);
      }
    };

    // Subscribe to crossfade needed
    const handleCrossfadeNeeded = (inactivePlayerId: 1 | 2) => {
      console.log(`🎬 usePlayDirector: Crossfade needed, load next song into Player ${inactivePlayerId}`);
      if (onCrossfadeNeeded) {
        onCrossfadeNeeded(inactivePlayerId);
      }
    };

    // Register callbacks
    director.onStateChange(handleStateChange);
    director.onPositionUpdate(handlePositionUpdate);
    director.onTrackEnd(handleTrackEnd);
    director.onError(handleError);
    director.onCrossfadeNeeded(handleCrossfadeNeeded);

    // Cleanup on unmount
    return () => {
      console.log('🎬 usePlayDirector: Cleaning up');
      // Note: We don't destroy director here because it's a singleton
      // It will be destroyed when the session ends
    };
  }, [isPlaybackDevice, crossfadeDuration, manualSkipCrossfade, onSongEnd, onTimeUpdate, onError, onCrossfadeNeeded]);

  // Initialize YouTube players
  const initializePlayers = (player1: any, player2: any) => {
    if (directorRef.current) {
      directorRef.current.initialize(player1, player2);
      setIsReady(true);
      console.log('🎬 usePlayDirector: Players initialized');
    }
  };

  // Dispatch intents to director
  const dispatchIntent = async (intent: PlaybackIntent) => {
    if (directorRef.current) {
      await directorRef.current.handleIntent(intent);
    }
  };

  return {
    director: directorRef.current!,
    state,
    currentPosition,
    isReady,
    dispatchIntent,
    initializePlayers,
  };
}

// Helper functions for creating intents
export function createLoadSongIntent(song: Song, startAt?: number): PlaybackIntent {
  return { type: 'LOAD_SONG', song, startAt };
}

export function createPlayIntent(): PlaybackIntent {
  return { type: 'PLAY' };
}

export function createPauseIntent(): PlaybackIntent {
  return { type: 'PAUSE' };
}

export function createSkipNextIntent(useCrossfade = true): PlaybackIntent {
  return { type: 'SKIP_NEXT', useCrossfade };
}

export function createSkipPreviousIntent(useCrossfade = true): PlaybackIntent {
  return { type: 'SKIP_PREVIOUS', useCrossfade };
}

export function createSeekIntent(position: number): PlaybackIntent {
  return { type: 'SEEK', position };
}

export function createResetTrackIntent(song: Song): PlaybackIntent {
  return { type: 'RESET_TRACK', song };
}

export function createVolumeIntent(volume: number): PlaybackIntent {
  return { type: 'SET_VOLUME', volume };
}

export function createMuteIntent(muted: boolean): PlaybackIntent {
  return { type: 'MUTE', muted };
}
