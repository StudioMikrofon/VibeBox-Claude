import { Song } from './song';

/**
 * PlayDirector States - Finite State Machine
 */
export type PlaybackState =
  | 'IDLE'           // No song loaded, waiting
  | 'PREPARING'      // Loading song, setting up player
  | 'PLAYING'        // Active playback in progress
  | 'XFADING'        // Crossfade transition in progress
  | 'PAUSED'         // Paused by user action
  | 'ERROR';         // Error state, requires recovery

/**
 * Intent Types - All playback actions are Intents
 * DJ/Host/Admin send Intents, PlayDirector decides execution
 */
export type PlaybackIntent =
  | { type: 'LOAD_SONG'; song: Song; startAt?: number }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'SKIP_NEXT'; useCrossfade?: boolean }
  | { type: 'SKIP_PREVIOUS'; useCrossfade?: boolean }
  | { type: 'CROSSFADE_TO_NEXT' }
  | { type: 'SEEK'; position: number }
  | { type: 'RESET_TRACK'; song: Song }  // For history replay
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'MUTE'; muted: boolean }
  | { type: 'ERROR'; error: string; code?: string | number };

/**
 * Track Runtime - Wraps Song with playback metadata
 */
export interface TrackRuntime {
  song: Song;
  runtimeId: string;           // UUID for this specific playback instance
  resumeAt: number;             // Start position in seconds (0 for fresh play)
  lastKnownPosition: number;    // Last synced position
  startedAt: number;            // Timestamp when playback started
  loadedAt: number;             // Timestamp when track was loaded
}

/**
 * PlayDirector Configuration
 */
export interface PlayDirectorConfig {
  isPlaybackDevice: boolean;    // Is this device the audio source?
  crossfadeDuration: number;    // Default crossfade duration (seconds)
  manualSkipCrossfade: number;  // Crossfade for manual skip (seconds)
  syncInterval: number;         // How often to sync (ms)
  broadcastInterval: number;    // How often to broadcast position (ms)
  driftThreshold: number;       // Max drift before correction (seconds)
}

/**
 * Playback State Update - Broadcast to other clients
 */
export interface PlaybackStateUpdate {
  state: PlaybackState;
  track: TrackRuntime | null;
  position: number;
  isPlaying: boolean;
  timestamp: number;            // Server timestamp for sync
  playbackDeviceId: string;     // Which device is playing
}

/**
 * PlayDirector Interface
 */
export interface IPlayDirector {
  // State
  getCurrentState(): PlaybackState;
  getCurrentTrack(): TrackRuntime | null;
  getCurrentPosition(): number;

  // Intent handling
  handleIntent(intent: PlaybackIntent): Promise<void>;

  // Player management
  initialize(player1: any, player2: any): void;
  destroy(): void;

  // Event callbacks
  onStateChange(callback: (state: PlaybackState) => void): void;
  onPositionUpdate(callback: (position: number) => void): void;
  onTrackEnd(callback: () => void): void;
  onError(callback: (error: string) => void): void;
}

/**
 * Helper function to create a new TrackRuntime
 */
export function createTrackRuntime(song: Song, startAt: number = 0): TrackRuntime {
  return {
    song,
    runtimeId: crypto.randomUUID(),
    resumeAt: startAt,
    lastKnownPosition: startAt,
    startedAt: Date.now(),
    loadedAt: Date.now(),
  };
}

/**
 * Helper function to reset a track (for history replay)
 */
export function resetTrackRuntime(song: Song): TrackRuntime {
  return createTrackRuntime(song, 0);
}
