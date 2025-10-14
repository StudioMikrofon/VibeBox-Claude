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

  const volumeHistoryRef = useRef<number[]>([]);
  const normalizationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const crossfadeStartedRef = useRef(false);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSongIdRef = useRef<string>('');
  const nextSongIdRef = useRef<string>('');
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const loadSongTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const primaryPlayerRef = activePlayer === 1 ? player1Ref : player2Ref;

  // Guest Sync Logic
  useEffect(() => {
    if (!isHost && isReady && syncTime !== undefined) {
      const player = primaryPlayerRef.current;
      if (player && typeof player.getCurrentTime === 'function') {
        const playerTime = player.getCurrentTime();
        const timeDiff = Math.abs(playerTime - syncTime);

        if (timeDiff > 2) {
          console.log(`🔄 Syncing guest player: Host is at ${syncTime.toFixed(1)}s, Guest is at ${playerTime.toFixed(1)}s. Seeking...`);
          player.seekTo(syncTime, true);
        }
      }
    }
  }, [syncTime, isHost, isReady, activePlayer]);

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
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (normalizationIntervalRef.current) clearInterval(normalizationIntervalRef.current);
      if (loadSongTimeoutRef.current) clearTimeout(loadSongTimeoutRef.current);
      if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (player1Ref.current && player2Ref.current) return;
  
    const createPlayer = (id: string, onStateChange: (e: any) => void) => {
      return new window.YT.Player(id, {
        height: '0',
        width: '0',
        playerVars: { autoplay: 0, controls: 0 },
        events: { onReady: () => onPlayerReady(id), onStateChange }
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
            console.log('🔍 Initial load - isPlaying:', isPlaying);
            
            if (isPlaying) {
                console.log('▶️ Auto-playing initial song (using loadVideoById)');
                player.loadVideoById({ videoId, startSeconds: 0 });
                player.setVolume(isMuted ? 0 : volume);
                setTimeout(() => player.playVideo(), 1000);
            } else {
                console.log('⏸️ NOT auto-playing initial song (using cueVideoById)');
                player.cueVideoById({ videoId, startSeconds: 0 });
                player.setVolume(isMuted ? 0 : volume);
            }
        }, 500);
    }

    player1Ref.current = createPlayer('youtube-player-1', e => e.data === 0 && activePlayer === 1 && onSongEnd());
    player2Ref.current = createPlayer('youtube-player-2', e => e.data === 0 && activePlayer === 2 && onSongEnd());
  }, [isReady, currentSong, activePlayer, isPlaying, volume, isMuted, onSongEnd]);

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
          
          // Broadcast currentTime to host for Firestore sync
          if (isHost && onTimeUpdate) {
            onTimeUpdate(time);
          }
        }
      }
    }, 500);
    return () => {
      if(progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isReady, activePlayer, isHost, onTimeUpdate]);

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
      const videoId = songId.replace('youtube-', '');
      setCurrentTime(0);
      setDuration(0);
      player.loadVideoById({ videoId, startSeconds: 0 });
      player.setVolume(isMuted ? 0 : volume);
      
      // FIX: Don't auto-play if paused
      if (isPlaying) {
        console.log('▶️ Auto-playing song (isPlaying: true)');
        setTimeout(() => player.playVideo(), 800);
      } else {
        console.log('⏸️ NOT auto-playing (isPlaying: false)');
      }
    }, 100);

    return () => {
      if(loadSongTimeoutRef.current) clearTimeout(loadSongTimeoutRef.current)
    };
  }, [currentSong?.id, isReady, activePlayer, isPlaying, volume, isMuted]);

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

    console.log('🔄 isPlaying changed:', isPlaying);

    setTimeout(() => {
      if (isPlaying) {
        console.log('▶️ Calling playVideo() due to isPlaying change');
        player.playVideo?.();
      } else {
        console.log('⏸️ Calling pauseVideo() due to isPlaying change');
        player.pauseVideo?.();

        // BUG FIX #1: Reset state on pause
        resetPlaybackState();
      }
    }, 300);
  }, [isPlaying, isReady, activePlayer]);

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

          {/* PROGRESS BAR - SAMO ZA DJ/HOST */}
          {(isHost || isDJ) && (
            <ProgressBar
              currentTime={currentTime}
              duration={duration}
              onSeek={handleSeek}
              onSeekStart={() => userIsSeekingRef.current = true}
              onSeekEnd={() => userIsSeekingRef.current = false}
            />
          )}

          {/* PLAYBACK CONTROLS - SAMO ZA DJ/HOST */}
          {(isHost || isDJ) ? (
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

          {/* BUG FIX #3: LISTEN ON MY DEVICE BUTTON - ALWAYS VISIBLE FOR ALL USERS */}
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
