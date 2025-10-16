export interface Song {
  id: string;
  title: string;
  artist?: string;
  channel?: string;
  youtubeId: string;
  type: 'youtube';
  thumbnailUrl?: string;
  addedBy?: string;
  addedById?: string;
  duration: number;
  upvotes: string[];
  downvotes: string[];
  votes: number;
  played: boolean;
  isPlaying: boolean;
  addedAt?: string;
  playedAt?: string | null;
  djBumped?: boolean;
  replayed?: boolean;
  startedAt?: number; // Timestamp when song started playing
}

export function createYouTubeSong(
  id: string,
  title: string,
  channel: string,
  thumbnailUrl: string,
  duration: number,
  addedBy: string
): Song {
  // Remove "youtube-" prefix if it exists
  const cleanId = id.replace(/^youtube-/, '');
  
  return {
    id: `youtube-${cleanId}`,
    title: title || 'Unknown Title',
    channel: channel || 'Unknown Channel',
    youtubeId: cleanId,
    type: 'youtube',
    thumbnailUrl: thumbnailUrl || '',
    duration: duration || 0,
    addedBy: addedBy || 'Guest',
    upvotes: [],
    downvotes: [],
    votes: 0,
    played: false,
    isPlaying: false,
    addedAt: new Date().toISOString(),
    playedAt: null,
  };
}
