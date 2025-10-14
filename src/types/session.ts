import { Song } from './song';

export interface SessionSettings {
  crossfadeDuration: number;
  manualSkipCrossfade?: number;
  votingEnabled: boolean;
  allowVoting: boolean;
  showCurrentPlaying: boolean;
  maxSongsPerGuest?: number;
  queuePermission?: 'all' | 'host' | 'public' | 'private';
  autoSkipNegative?: boolean;
  autoSkipThreshold?: number;
  allowDuplicates?: boolean;
  maxQueueSize?: number;
}

// NEW: Activity feed event types
export type ActivityType = 
  | 'skip' 
  | 'dj_transfer' 
  | 'speaker_change' 
  | 'song_added' 
  | 'user_joined' 
  | 'user_left'
  | 'user_kicked'
  | 'quick_message';

export interface Activity {
  id: string;
  type: ActivityType;
  userName: string;
  message: string;
  timestamp: number;
  metadata?: {
    songTitle?: string;
    targetUser?: string;
    songId?: string;
  };
}

// NEW: Quick message interface
export interface QuickMessage {
  id: string;
  from: string;
  to: string; // username or 'ALL' for broadcast
  text: string;
  timestamp: number;
  reactions?: {
    [userName: string]: string; // emoji reaction
  };
  read: boolean;
  replyTo?: string; // messageId if replying
}

// NEW: User role type
export type UserRole = 'host' | 'dj' | 'speaker' | 'guest';

// NEW: Playback Session Token - prevents sync conflicts and loops
export interface PlaybackSession {
  sessionId: string; // unique token - regenerated on every playback change
  playbackDevice: string; // 'HOST' | guestName
  djName: string;
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  lastUpdate: number;
}
