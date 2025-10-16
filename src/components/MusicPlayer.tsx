import { useEffect, useRef, useState, memo } from 'react';
import { Song } from '../types/song';
import CSSVisualizer from './CSSVisualizer';
import SongInfo from './SongInfo';
import ProgressBar from './ProgressBar';
import PlayerControls from './PlayerControls';
import VolumeControl from './VolumeControl';
import NextSongPreview from './NextSongPreview';
import SkipToast from './SkipToast';
import PlayOnYouTubeButton from './PlayOnYouTubeButton';
import { Headphones, VolumeX } from 'lucide-react';

interface MusicPlayerProps {
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
  isHost?: boolean;
  isDJ?: boolean;
  isPlaybackDevice?: boolean;
  roomCode?: string;
  triggerCrossfade: boolean;
  syncTime?: number;
  onTimeUpdate?: (time: number) => void;
  onToggleAudio?: (enabled: boolean) => void;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
    MediaMetadata: any;
  }
}

const MusicPlayer = memo(function MusicPlayer({
  currentSong,
  nextSong,
  previousSong,
  isPlaying,
  onSongEnd,
  onPlayPause,
  onNext,
  onPrevious,
  crossfadeDuration,
  manualSkipCrossfade,
  isHost = true,
  isDJ = false,
  isPlaybackDevice = false,
  roomCode,
  triggerCrossfade,
  syncTime,
  onTimeUpdate,
  onToggleAudio
}: MusicPlayerProps) {
  const player1Ref = useRef<any>(null);
  const player2Ref = useRef<any>(null);
  const [activePlayer, setActivePlayer] = useState<1 | 2>(1);
  const [volume, setVolume] = useState(100);
  const [displayVolume, setDisplayVolume] = useState(100);
  const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [normalization, setNormalization] = useState(true);
  const [showSkipToast, setShowSkipToast] = useState(false);
  const [skipToastSong, setSkipToastSong] = useState<Song | null>(null);
  const userIsSeekingRef = useRef(false);
  const [audioEnabled, setAudioEnabled] = useState(() => {
    const saved = localStorage.getItem('guestAudioEnabled');
    return saved === 'true';
  });
  const [wakeLock, setWakeLock] = useState<any>(null); // 🔴 BUG FIX #3: Wake lock state

  const volumeHistoryRef = useRef<number[]>([]);
  const normalizationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const crossfadeStartedRef = useRef(false);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSongIdRef = useRef<string>('');
  const nextSongIdRef = useRef<string>('');
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const loadSongTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 5000;

  // 🔴 NEW: Separate broadcast and sync intervals
  const broadcastIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 🔥 CRITICAL FIX: Store onTimeUpdate in ref to prevent interval restart
  const onTimeUpdateRef = useRef(onTimeUpdate);

  // Keep ref up to date
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  const primaryPlayerRef = activePlayer === 1 ? player1Ref : player2Ref;

  // Constants for playback sync
  const lastSyncTimestampRef = useRef(0);
  const SYNC_COOLDOWN = 2000; // 2s cooldown between sync corrections
  const BROADCAST_INTERVAL = 1000; // Broadcast position every 1s
  const SYNC_CHECK_INTERVAL = 2000; // Check sync every 2s
  const DRIFT_THRESHOLD = 3.0; // Max 3s drift before correction

  // 🔴 BUG FIX #3: Wake Lock functions to keep screen on
  const requestWakeLock = async () => {
    try {
      if (wakeLock !== null) return; // Already have wake lock
      if ('wakeLock' in navigator) {
        const lock = await (navigator as any).wakeLock.request('screen');
        setWakeLock(lock);
        console.log('🔒 Wake Lock acquired (playback device)');

        // Re-acquire wake lock if released (e.g., screen briefly locked)
        lock.addEventListener('release', async () => {
          console.log('🔓 Wake Lock released, attempting to re-acquire...');
          setWakeLock(null);
          setTimeout(async () => {
            if (isPlaying && isPlaybackDevice) {
              await requestWakeLock();
            }
          }, 1000);
        });
      }
    } catch (err) {
      console.error('❌ Wake Lock error:', err);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLock !== null) {
      try {
        await wakeLock.release();
        setWakeLock(null);
        console.log('🔓 Wake Lock released');
      } catch (err) {
        console.error('❌ Wake Lock release error:', err);
      }
    }
  };

  // 🔴 BUG FIX #3: Acquire wake lock when playback device is playing
  useEffect(() => {
    if (isPlaybackDevice && isPlaying) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    // Cleanup on unmount
    return () => {
      releaseWakeLock();
    };
  }, [isPlaybackDevice, isPlaying]);

  // 🔴 NEW: Clear ALL playback timers (complete isolation)
  const clearAllPlaybackTimers = () => {
    console.log('🧹 Clearing all playback timers');

    if (broadcastIntervalRef.current) {
      clearInterval(broadcastIntervalRef.current);
      broadcastIntervalRef.current = null;
    }

    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }

    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }

    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }

    console.log('✅ All playback timers cleared');
  };

  // 🔴 EFFECT 1: Broadcast interval - ONLY re-runs when playback device ROLE changes
  // This is the CORE FIX: NO dependencies on functions that change every render!
  useEffect(() => {
    console.log(`🎛️ Playback device role: ${isPlaybackDevice ? 'BROADCAST MODE' : 'SYNC/IDLE MODE'}`);

    // Clear any existing interval
    if (broadcastIntervalRef.current) {
      console.log('🧹 Clearing broadcast interval (role changed)');
      clearInterval(broadcastIntervalRef.current);
      broadcastIntervalRef.current = null;
    }

    // Only start broadcast if we're the playback device AND player is ready
    if (!isReady || !isPlaybackDevice) {
      return;
    }

    console.log('📡 Starting broadcast mode (1s interval) - WILL NOT RESTART ON STATE CHANGES!');

    broadcastIntervalRef.current = setInterval(() => {
      // 🔥 FIX: Use dynamic player reference (not from deps!)
      const player = activePlayer === 1 ? player1Ref.current : player2Ref.current;
      if (!player || typeof player.getCurrentTime !== 'function') return;

      // 🔥 SAFE: Use fallback to prevent TypeError
      const currentTime = player.getCurrentTime() || 0;

      // 🔥 OPTIMIZATION: Skip broadcast if paused (player state !== 1)
      const playerState = player.getPlayerState?.();
      if (playerState !== 1) {
        // console.log('⏸️ Player paused, skipping broadcast');
        return; // Skip this broadcast but keep interval running
      }

      // 🔴 CRITICAL: Broadcast syncTime as Date.now() - (currentTime * 1000)
      const syncTime = Date.now() - (currentTime * 1000);

      // 🔥 FIX: Use ref instead of direct function call to prevent dependency
      if (onTimeUpdateRef.current) {
        onTimeUpdateRef.current(syncTime);
      }

      console.log(`📡 Broadcasting: currentTime=${currentTime.toFixed(1)}s, playerState=${playerState}`);
    }, BROADCAST_INTERVAL);

    return () => {
      if (broadcastIntervalRef.current) {
        console.log('🧹 Cleanup: clearing broadcast interval on unmount');
        clearInterval(broadcastIntervalRef.current);
        broadcastIntervalRef.current = null;
      }
    };
  }, [isReady, isPlaybackDevice]); // 🔥 ONLY isReady and isPlaybackDevice - NO OTHER DEPS!

  // 🔴 NEW: Sync interval (ONLY for non-playback devices)
  useEffect(() => {
    // 🔥 CRITICAL FIX: Clear old interval FIRST before starting new one!
    if (syncIntervalRef.current) {
      console.log('🧹 Clearing old sync interval before starting new one');
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }

    if (!isReady || isPlaybackDevice || isHost || syncTime === undefined) {
      return;
    }

    console.log('🔄 Starting sync mode (2s interval)');

    syncIntervalRef.current = setInterval(() => {
      const now = Date.now();

      // Cooldown check to prevent aggressive syncing
      if (now - lastSyncTimestampRef.current < SYNC_COOLDOWN) {
        return;
      }

      // 🔥 FIX: Use dynamically calculated player ref instead of activePlayer dependency
      const player = activePlayer === 1 ? player1Ref.current : player2Ref.current;
      if (!player || typeof player.getCurrentTime !== 'function') return;

      const playerTime = player.getCurrentTime() || 0;

      // 🔴 CRITICAL: Calculate expected time from syncTime
      const expectedTime = (now - syncTime) / 1000;
      const drift = Math.abs(playerTime - expectedTime);

      if (drift > DRIFT_THRESHOLD) {
        console.log(`🔄 Drift detected: ${drift.toFixed(1)}s. Correcting...`);
        console.log(`   Player: ${playerTime.toFixed(1)}s, Expected: ${expectedTime.toFixed(1)}s`);

        player.seekTo(expectedTime, true);
        lastSyncTimestampRef.current = now;
      }
    }, SYNC_CHECK_INTERVAL);

    return () => {
      if (syncIntervalRef.current) {
        console.log('🧹 Cleanup: clearing sync interval');
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [isReady, isPlaybackDevice, isHost, syncTime]);

  // Save playback progress every 5 seconds
  useEffect(() => {
    if (!currentSong || !isPlaying) return;
    
    const saveInterval = setInterval(() => {
      const currentTime = primaryPlayerRef.current?.getCurrentTime?.();
      if (currentTime && roomCode) {
        localStorage.setItem(
          `vibebox_progress_${roomCode}_${currentSong.id}`,
          currentTime.toString()
        );
      }
    }, 5000);
    
    return () => clearInterval(saveInterval);
  }, [currentSong, isPlaying, roomCode]);

  // On song load, restore progress
  useEffect(() => {
    if (!currentSong || !roomCode) return;

    // ONLY restore for host, guests sync via Firestore startedAt timestamp
    if (!isHost) return;

    const savedProgress = localStorage.getItem(
      `vibebox_progress_${roomCode}_${currentSong.id}`
    );
    
    if (savedProgress && primaryPlayerRef.current) {
      const time = parseFloat(savedProgress);
      setTimeout(() => {
        primaryPlayerRef.current?.seekTo(time, true);
        console.log('✅ Restored playback from:', time);
      }, 500);
    }
  }, [currentSong, roomCode, isHost]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    setDisplayVolume(newVolume);
    
    if (volumeTimeoutRef.current) {
      clearTimeout(volumeTimeoutRef.current);
    }
    
    volumeTimeoutRef.current = setTimeout(() => {
      console.log('🔊 Setting volume to', newVolume);
      setVolume(newVolume);
    }, 300);
  };

  const handleManualNext = () => {
    if (!nextSong) {
      console.log('⏭️ No next song');
      return;
    }

    // Clear saved progress for next song so it starts from 0:00
    if (roomCode) {
      localStorage.removeItem(`vibebox_progress_${roomCode}_${nextSong.id}`);
    }

    if (crossfadeStartedRef.current) {
      console.warn('⚠️ Crossfade already in progress, ignoring manual next');
      return;
    }

    const manualCrossfade = manualSkipCrossfade !== undefined ? manualSkipCrossfade : 3;
    
    if (manualCrossfade === 0) {
      console.log('⏭️ Instant skip (no crossfade)');
      onNext();
      return;
    }

    console.log(`⏭️ Manual crossfade triggered (${manualCrossfade}s)`);
    
    setSkipToastSong(nextSong);
    setShowSkipToast(true);

    const currentPlayer = activePlayer === 1 ? player1Ref.current : player2Ref.current;
    const nextPlayer = activePlayer === 1 ? player2Ref.current : player1Ref.current;

    if (!currentPlayer || !nextPlayer) {
      console.warn('⚠️ Players not ready');
      onNext();
      return;
    }

    crossfadeStartedRef.current = true;

    const nextVideoId = nextSong.id.replace('youtube-', '');
    
    nextPlayer.loadVideoById({ videoId: nextVideoId, startSeconds: 0 });
    nextPlayer.setVolume(0);

    setTimeout(() => {
      nextPlayer.playVideo();

      let step = 0;
      const steps = 20;
      const targetVolume = isMuted ? 0 : volume;

      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);

      fadeIntervalRef.current = setInterval(() => {
        step++;
        const progress = step / steps;

        currentPlayer.setVolume(Math.max(0, targetVolume * (1 - progress)));
        nextPlayer.setVolume(Math.min(targetVolume, targetVolume * progress));

        if (step >= steps) {
          if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
          console.log('✅ Manual crossfade complete');
          
          currentSongIdRef.current = nextSong.id;
          currentPlayer.setVolume(0);
          currentPlayer.pauseVideo();
          nextPlayer.setVolume(isMuted ? 0 : volume);
          setActivePlayer(prev => prev === 1 ? 2 : 1);
          onNext();
          
          setTimeout(() => {
            crossfadeStartedRef.current = false;
            console.log('✅ Manual crossfade flag reset');
          }, 500);
        }
      }, (manualCrossfade * 1000) / steps);
    }, 300);
  };
  
  useEffect(() => {
    if (triggerCrossfade && nextSong) {
      console.log('🎵 External trigger: calling handleManualNext');
      setSkipToastSong(nextSong);
      setShowSkipToast(true);
      handleManualNext();
    }
  }, [triggerCrossfade]);

  const handleManualPrevious = () => {
    if (!previousSong) {
      console.log('⏮️ No previous song');
      return;
    }

    // Clear saved progress for previous song so it starts from 0:00
    if (roomCode) {
      localStorage.removeItem(`vibebox_progress_${roomCode}_${previousSong.id}`);
    }

    const manualCrossfade = manualSkipCrossfade !== undefined ? manualSkipCrossfade : 3;
    
    if (manualCrossfade === 0) {
      console.log('⏮️ Instant skip (no crossfade)');
      onPrevious();
      return;
    }

    console.log(`⏮️ Manual crossfade to previous (${manualCrossfade}s)`);
    
    setSkipToastSong(previousSong);
    setShowSkipToast(true);

    const currentPlayer = activePlayer === 1 ? player1Ref.current : player2Ref.current;
    const nextPlayer = activePlayer === 1 ? player2Ref.current : player1Ref.current;

    if (!currentPlayer || !nextPlayer) {
      console.warn('⚠️ Players not ready');
      onPrevious();
      return;
    }

    crossfadeStartedRef.current = true;

    const prevVideoId = previousSong.id.replace('youtube-', '');
    
    nextPlayer.loadVideoById({ videoId: prevVideoId, startSeconds: 0 });
    nextPlayer.setVolume(0);

    setTimeout(() => {
      nextPlayer.playVideo();

      let step = 0;
      const steps = 20;
      const targetVolume = isMuted ? 0 : volume;

      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);

      fadeIntervalRef.current = setInterval(() => {
        step++;
        const progress = step / steps;

        currentPlayer.setVolume(Math.max(0, targetVolume * (1 - progress)));
        nextPlayer.setVolume(Math.min(targetVolume, targetVolume * progress));

        if (step >= steps) {
          if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
          console.log('✅ Manual previous crossfade complete');
          
          currentSongIdRef.current = previousSong.id;
          currentPlayer.setVolume(0);
          currentPlayer.pauseVideo();
          nextPlayer.setVolume(isMuted ? 0 : volume);
          setActivePlayer(prev => prev === 1 ? 2 : 1);
          onPrevious();
          
          setTimeout(() => {
            crossfadeStartedRef.current = false;
            console.log('✅ Previous crossfade flag reset');
          }, 500);
        }
      }, (manualCrossfade * 1000) / steps);
    }, 300);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    const player = activePlayer === 1 ? player1Ref.current : player2Ref.current;
    player?.seekTo?.(newTime, true);
    setCurrentTime(newTime);
  };

  const toggleAudioEnabled = () => {
    const newValue = !audioEnabled;
    setAudioEnabled(newValue);
    if (onToggleAudio) onToggleAudio(newValue);
  };

  // 🔴 NEW: YouTube error handler with retry logic
  const onPlayerError = (event: any, playerId: number) => {
    const errorCode = event.data;
    console.error(`❌ YouTube Error ${errorCode} on Player ${playerId}`);

    switch (errorCode) {
      case 2: // Invalid video ID
        console.log('⏭️ Invalid video ID, skipping...');
        if (isHost || isDJ) {
          setTimeout(() => onNext(), 1000);
        }
        break;

      case 5: // HTML5 player error (often temporary)
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          console.log(`⏳ HTML5 error, retrying... (${retryCountRef.current}/${MAX_RETRIES})`);

          setTimeout(() => {
            const player = playerId === 1 ? player1Ref.current : player2Ref.current;
            player?.playVideo();
          }, RETRY_DELAY);
        } else {
          console.log('❌ Max retries reached, skipping song');
          retryCountRef.current = 0;
          if (isHost || isDJ) {
            setTimeout(() => onNext(), 1000);
          }
        }
        break;

      case 100: // Video not found
      case 101: // Embedding disabled
      case 150: // Same as 101
        console.log(`⏭️ Video unavailable (error ${errorCode}), skipping...`);
        if (isHost || isDJ) {
          setTimeout(() => onNext(), 1000);
        }
        break;

      default:
        console.error(`❓ Unknown error: ${errorCode}`);
        // Don't skip on unknown errors, might be temporary
        break;
    }
  };

  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsReady(true);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      setIsReady(true);
    };

    return () => {
      console.log('🧹 Component unmounting, cleaning up all timers');
      clearAllPlaybackTimers();
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (normalizationIntervalRef.current) clearInterval(normalizationIntervalRef.current);
      if (loadSongTimeoutRef.current) clearTimeout(loadSongTimeoutRef.current);
      if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (player1Ref.current && player2Ref.current) return;
  
    const createPlayer = (id: string, onStateChange: (e: any) => void, playerId: number) => {
      return new window.YT.Player(id, {
        height: '0',
        width: '0',
        playerVars: { autoplay: 0, controls: 0 },
        events: {
          onReady: () => onPlayerReady(id),
          onStateChange,
          onError: (e: any) => onPlayerError(e, playerId)
        }
      });
    };

    let p1Ready = false, p2Ready = false;
    const onPlayerReady = (id: string) => {
      console.log(`✅ Player ${id} ready`);
      if (id === 'youtube-player-1') p1Ready = true;
      if (id === 'youtube-player-2') p2Ready = true;
      if (p1Ready && p2Ready) {
          console.log('✅ Both players ready');
          if (currentSong && !currentSongIdRef.current) {
            loadInitialSong();
          }
      }
    };
    
    const loadInitialSong = () => {
        console.log('🎬 Loading initial song:', currentSong?.title);
        const player = activePlayer === 1 ? player1Ref.current : player2Ref.current;
        const videoId = currentSong!.id.replace('youtube-', '');
        currentSongIdRef.current = currentSong!.id;
        setTimeout(() => {
            console.log('🔍 Initial load - isPlaying:', isPlaying, 'isPlaybackDevice:', isPlaybackDevice);

            // ✅ BUG FIX #2: Only playback device can auto-play
            if (isPlaying && isPlaybackDevice) {
                console.log('▶️ Auto-playing initial song IMMEDIATELY (playback device)');
                player.loadVideoById({ videoId, startSeconds: 0 });
                player.setVolume(isMuted ? 0 : volume);
                // 🔴 IMMEDIATE PLAY - reduced from 1000ms to 400ms
                setTimeout(() => player.playVideo(), 400);
            } else {
                console.log('⏸️ NOT auto-playing initial song (not playback device or paused)');
                player.cueVideoById({ videoId, startSeconds: 0 });
                player.setVolume(isMuted ? 0 : volume);
            }
        }, 200);
    }

    player1Ref.current = createPlayer('youtube-player-1', e => e.data === 0 && activePlayer === 1 && onSongEnd(), 1);
    player2Ref.current = createPlayer('youtube-player-2', e => e.data === 0 && activePlayer === 2 && onSongEnd(), 2);
  }, [isReady, currentSong, activePlayer, isPlaying, isPlaybackDevice, volume, isMuted, onSongEnd]);

  useEffect(() => {
    if (currentSong && 'mediaSession' in navigator) {
        (navigator as any).mediaSession.metadata = new window.MediaMetadata({
            title: currentSong.title,
            artist: currentSong.artist,
            album: 'VibeBox Session',
            artwork: [{ src: currentSong.thumbnailUrl || '', sizes: '512x512', type: 'image/jpeg' }]
        });

        (navigator as any).mediaSession.setActionHandler('play', onPlayPause);
        (navigator as any).mediaSession.setActionHandler('pause', onPlayPause);
        (navigator as any).mediaSession.setActionHandler('nexttrack', handleManualNext);
        (navigator as any).mediaSession.setActionHandler('previoustrack', handleManualPrevious);
    }

    const handleVisibilityChange = () => {
        if (!document.hidden && isPlaying) {
            const currentPlayer = activePlayer === 1 ? player1Ref.current : player2Ref.current;
            setTimeout(() => currentPlayer?.playVideo?.(), 300);
        }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if ('mediaSession' in navigator) {
            (navigator as any).mediaSession.setActionHandler('play', null);
            (navigator as any).mediaSession.setActionHandler('pause', null);
            (navigator as any).mediaSession.setActionHandler('nexttrack', null);
            (navigator as any).mediaSession.setActionHandler('previoustrack', null);
        }
    };
  }, [currentSong, isPlaying, activePlayer, onPlayPause, handleManualNext, handleManualPrevious]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      (navigator as any).mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  // 🔴 UPDATED: Progress interval ONLY updates UI (no broadcasting)
  // Broadcasting is now handled by dedicated broadcast interval above
  useEffect(() => {
    if (!isReady) return;
    progressIntervalRef.current = setInterval(() => {
      const player = activePlayer === 1 ? player1Ref.current : player2Ref.current;
      if (player?.getCurrentTime && player?.getDuration) {
        const time = player.getCurrentTime();
        const dur = player.getDuration();
        if (time > 0 && dur > 0) {
          setCurrentTime(time);
          setDuration(dur);
        }
      }
    }, 500);
    return () => {
      if(progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isReady, activePlayer]);

  useEffect(() => {
    if (loadSongTimeoutRef.current) {
      clearTimeout(loadSongTimeoutRef.current);
    }

    if (!currentSong || !isReady || !player1Ref.current || !player2Ref.current) return;

    const songId = currentSong.id;
    if (songId === currentSongIdRef.current && player1Ref.current.getPlayerState() !== -1 && player2Ref.current.getPlayerState() !== -1) {
      return;
    }

    const player = activePlayer === 1 ? player1Ref.current : player2Ref.current;
    if (typeof player.loadVideoById !== 'function') return;

    loadSongTimeoutRef.current = setTimeout(() => {
      console.log(`🎬 Loading ${currentSong.title} on Player ${activePlayer}`);
      currentSongIdRef.current = songId;
      crossfadeStartedRef.current = false;
      volumeHistoryRef.current = [];
      retryCountRef.current = 0; // Reset retry counter on new song load
      const videoId = songId.replace('youtube-', '');
      setCurrentTime(0);
      setDuration(0);
      player.loadVideoById({ videoId, startSeconds: 0 });
      player.setVolume(isMuted ? 0 : volume);

      // ✅ BUG FIX #2: Only playback device can auto-play
      if (isPlaying && isPlaybackDevice) {
        console.log('▶️ Auto-playing song IMMEDIATELY (isPlaying: true, isPlaybackDevice: true)');
        // 🔴 IMMEDIATE PLAY - reduced from 800ms to 300ms
        setTimeout(() => player.playVideo(), 300);
      } else if (!isPlaybackDevice) {
        console.log('⏸️ NOT auto-playing (not playback device)');
      } else {
        console.log('⏸️ NOT auto-playing (isPlaying: false)');
      }
    }, 100);

    return () => {
      if(loadSongTimeoutRef.current) clearTimeout(loadSongTimeoutRef.current)
    };
  }, [currentSong?.id, isReady, activePlayer, isPlaying, isPlaybackDevice, volume, isMuted]);

  // BUG FIX #1: Reset playback state on pause to prevent chaos
  const resetPlaybackState = () => {
    console.log('🔄 Resetting playback state (clearing timers)');

    // Clear all crossfade timers
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }

    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }

    // Reset crossfade flag
    crossfadeStartedRef.current = false;

    console.log('✅ Playback state reset complete');
  };

  useEffect(() => {
    if (!isReady || !player1Ref.current || !player2Ref.current) return;
    const player = activePlayer === 1 ? player1Ref.current : player2Ref.current;

    console.log('🔄 isPlaying changed:', isPlaying, 'isPlaybackDevice:', isPlaybackDevice);

    // 🔴 IMMEDIATE PLAYBACK - NO DELAY!
    if (isPlaying && isPlaybackDevice) {
      console.log('▶️ IMMEDIATE playVideo() call (playback device)');
      player.playVideo?.();
    } else if (!isPlaying && isPlaybackDevice) {
      console.log('⏸️ IMMEDIATE pauseVideo() call (playback device)');
      player.pauseVideo?.();

      // Reset state on pause
      resetPlaybackState();
    } else if (!isPlaybackDevice) {
      console.log('⏸️ Not playback device, pausing local player');
      player.pauseVideo?.();
    }
  }, [isPlaying, isReady, activePlayer, isPlaybackDevice]);

  useEffect(() => {
    if (!isReady) return;
    const currentPlayer = activePlayer === 1 ? player1Ref.current : player2Ref.current;
    currentPlayer?.setVolume?.(isMuted ? 0 : volume);
    console.log(`🔊 Volume set to ${isMuted ? 0 : volume} on Player ${activePlayer}`);
  }, [volume, isMuted, isReady, activePlayer]);

  useEffect(() => {
    if (!nextSong || !isReady || crossfadeDuration === 0) {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      return;
    }

    if (nextSong.id !== nextSongIdRef.current) {
        nextSongIdRef.current = nextSong.id;
        crossfadeStartedRef.current = false;
    }

    checkIntervalRef.current = setInterval(() => {
      const currentPlayer = activePlayer === 1 ? player1Ref.current : player2Ref.current;
      if (currentPlayer.getDuration && currentPlayer.getCurrentTime) {
        const timeLeft = currentPlayer.getDuration() - currentPlayer.getCurrentTime();

        if (timeLeft <= crossfadeDuration && timeLeft > 0 && !crossfadeStartedRef.current) {
          crossfadeStartedRef.current = true;
          console.log(`🎚️ Starting ${crossfadeDuration}s crossfade`);

          const nextPlayer = activePlayer === 1 ? player2Ref.current : player1Ref.current;
          const nextVideoId = nextSong.id.replace('youtube-', '');
          
          nextPlayer.loadVideoById({ videoId: nextVideoId, startSeconds: 0 });
          nextPlayer.setVolume(0);

          setTimeout(() => {
            nextPlayer.playVideo();

            let step = 0;
            const steps = 20;
            const targetVolume = isMuted ? 0 : volume;

            if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);

            fadeIntervalRef.current = setInterval(() => {
                if (userIsSeekingRef.current) {
                    console.log('🚫 Crossfade interrupted by seek');
                    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
                    crossfadeStartedRef.current = false;
                    return;
                }

              step++;
              const progress = step / steps;
              currentPlayer.setVolume(Math.max(0, targetVolume * (1 - progress)));
              nextPlayer.setVolume(Math.min(targetVolume, targetVolume * progress));

              if (step >= steps) {
                if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
                console.log('✅ Crossfade complete');

                currentSongIdRef.current = nextSong.id;
                currentPlayer.setVolume(0);
                currentPlayer.pauseVideo();
                nextPlayer.setVolume(isMuted ? 0 : volume);
                setActivePlayer(prev => prev === 1 ? 2 : 1);
                onSongEnd();

                setTimeout(() => {
                    crossfadeStartedRef.current = false;
                    console.log('✅ Crossfade flag reset');
                }, 500);
              }
            }, (crossfadeDuration * 1000) / steps);
          }, 500);
        }
      }
    }, 500);

    return () => {
      if(checkIntervalRef.current) clearInterval(checkIntervalRef.current)
    };
  }, [nextSong?.id, isReady, crossfadeDuration, activePlayer, volume, isMuted, onSongEnd]);

  useEffect(() => {
    if (!normalization || !isReady || !isPlaying) {
      if (normalizationIntervalRef.current) clearInterval(normalizationIntervalRef.current);
      return;
    }

    if (crossfadeStartedRef.current) {
      if (normalizationIntervalRef.current) clearInterval(normalizationIntervalRef.current);
      return;
    }

    if (volumeTimeoutRef.current) {
      if (normalizationIntervalRef.current) clearInterval(normalizationIntervalRef.current);
      return;
    }

    if (normalizationIntervalRef.current) clearInterval(normalizationIntervalRef.current);

    normalizationIntervalRef.current = setInterval(() => {
      if (crossfadeStartedRef.current) return;
      if (volumeTimeoutRef.current) return;

      const currentPlayer = activePlayer === 1 ? player1Ref.current : player2Ref.current;
      
      if (!currentPlayer?.getVolume) return;

      try {
        const currentVolume = currentPlayer.getVolume();
        
        volumeHistoryRef.current.push(currentVolume);
        if (volumeHistoryRef.current.length > 10) volumeHistoryRef.current.shift();

        const avgVolume = volumeHistoryRef.current.reduce((a, b) => a + b, 0) / volumeHistoryRef.current.length;
        const targetVolume = isMuted ? 0 : volume;

        if (avgVolume < targetVolume * 0.7) {
          const newVolume = Math.min(targetVolume * 1.2, 100);
          console.log(`🔊 Boosting: ${avgVolume.toFixed(1)} → ${newVolume.toFixed(0)}`);
          currentPlayer.setVolume(newVolume);
        } else if (avgVolume > targetVolume * 1.1) {
          const newVolume = Math.max(targetVolume * 0.9, 0);
          console.log(`🔉 Reducing: ${avgVolume.toFixed(1)} → ${newVolume.toFixed(0)}`);
          currentPlayer.setVolume(newVolume);
        }
      } catch (error) {
        console.error('❌ Normalization error:', error);
      }
    }, 500);

    return () => {
      if (normalizationIntervalRef.current) clearInterval(normalizationIntervalRef.current);
    };
  }, [normalization, isReady, isPlaying, activePlayer, volume, isMuted]);

  return (
    <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl p-6 shadow-2xl">
      <div id="youtube-player-1" style={{ display: 'none' }} />
      <div id="youtube-player-2" style={{ display: 'none' }} />

      {currentSong ? (
        <>
          <CSSVisualizer 
            isPlaying={isPlaying} 
            currentTime={currentTime}
            barCount={48} 
          />
          
          <SongInfo
            song={currentSong}
            activePlayer={activePlayer}
            crossfadeDuration={crossfadeDuration}
            normalization={normalization}
          />

          {/* 🔴 BUG FIX #13: PROGRESS BAR - ONLY FOR DJ (NOT HOST UNLESS THEY ARE DJ) */}
          {isDJ && (
            <ProgressBar
              currentTime={currentTime}
              duration={duration}
              onSeek={handleSeek}
              onSeekStart={() => userIsSeekingRef.current = true}
              onSeekEnd={() => userIsSeekingRef.current = false}
            />
          )}

          {/* 🔴 BUG FIX #13: PLAYBACK CONTROLS - ONLY FOR DJ (NOT HOST UNLESS THEY ARE DJ) */}
          {isDJ ? (
            <PlayerControls
              isPlaying={isPlaying}
              onPlayPause={onPlayPause}
              onNext={handleManualNext}
              onPrevious={handleManualPrevious}
              hasNextSong={!!nextSong}
              hasPreviousSong={!!previousSong}
              manualSkipCrossfade={manualSkipCrossfade}
            />
          ) : (
            <div className="flex justify-center mb-4">
              <PlayOnYouTubeButton 
                videoId={currentSong.id} 
                title={currentSong.title} 
              />
            </div>
          )}

          {/* VOLUME CONTROL - ZA SVE KORISNIKE */}
          <VolumeControl
            volume={displayVolume}
            isMuted={isMuted}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={() => setIsMuted(!isMuted)}
            normalization={normalization}
            onNormalizationToggle={() => setNormalization(!normalization)}
          />

          {/* 🔴 BUG FIX #4 & #5: LISTEN ON MY DEVICE - FOR ALL USERS (HOST + GUESTS) */}
          {onToggleAudio && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2">
                {audioEnabled ? (
                  <Headphones className="w-5 h-5 text-purple-400" />
                ) : (
                  <VolumeX className="w-5 h-5 text-gray-400" />
                )}
                <span className="text-white text-sm">Listen on My Device</span>
                {isPlaybackDevice && (
                  <span className="text-gray-400 text-xs">(You are the playback device)</span>
                )}
              </div>
              <button
                onClick={toggleAudioEnabled}
                disabled={isPlaybackDevice}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  isPlaybackDevice
                    ? 'bg-gray-700 cursor-not-allowed opacity-50'
                    : audioEnabled
                      ? 'bg-purple-500'
                      : 'bg-gray-600'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    audioEnabled || isPlaybackDevice ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>
          )}

          {/* PLAYBACK DEVICE NOTICE */}
          {isPlaybackDevice && (
            <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg mt-4">
              <Headphones className="w-6 h-6 text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-blue-400 font-semibold text-sm">You are the Playback Device</p>
                <p className="text-gray-400 text-xs">Audio is playing from YOUR device. Keep this tab open!</p>
              </div>
            </div>
          )}

          <NextSongPreview nextSong={nextSong} />
        </>
      ) : (
        <div className="text-center text-gray-500 py-8">Add songs to start! 🎉</div>
      )}
      
      <SkipToast
        song={skipToastSong}
        show={showSkipToast}
        onHide={() => setShowSkipToast(false)}
      />
    </div>
  );
});

export default MusicPlayer;
