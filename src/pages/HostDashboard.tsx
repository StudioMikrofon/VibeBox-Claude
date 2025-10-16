import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { db } from '../services/firebase';
import { doc, updateDoc, arrayUnion, onSnapshot, DocumentData, runTransaction, arrayRemove, collection, addDoc, query, where } from 'firebase/firestore';
import { Song } from '../types/song';
import { SessionSettings, QuickMessage, PlaybackSession } from '../types/session';
import HostHeader from '../components/host/HostHeader';
import RoomInfoCard from '../components/host/RoomInfoCard';
import StartPartyPrompt from '../components/host/StartPartyPrompt';
import MusicPlayer from '../components/MusicPlayer';
import GuestsCard from '../components/host/GuestsCard';
import QueueSection from '../components/host/QueueSection';
import AddSongModal from '../components/AddSongModal';
import SettingsModal from '../components/host/SettingsModal';
import InviteModal from '../components/host/InviteModal';
import ToastManager, { Toast } from '../components/ToastManager';
import QuickReplyModal from '../components/QuickReplyModal';

interface SessionData extends DocumentData {
  code: string;
  hostName: string;
  roomName: string;
  queue: Song[];
  guests: string[];
  history: Song[];
  settings?: SessionSettings;
  currentSong?: Song | null;
  isPlaying?: boolean;
  isPartyStarted?: boolean;
  playbackDevice?: string;
  djName?: string;
  adminUsers?: string[];
  playbackSession?: PlaybackSession; // NEW: Playback sync token
}

const defaultSettings: SessionSettings = {
  crossfadeDuration: 5,
  manualSkipCrossfade: 3,
  votingEnabled: true,
  allowVoting: true,
  showCurrentPlaying: true,
  maxSongsPerGuest: 5,
  queuePermission: 'all',
  autoSkipNegative: false,
  autoSkipThreshold: -3,
  allowDuplicates: false,
  maxQueueSize: 50
};

// Helper function to create a new playback session token
// This ensures all clients sync to the same playback state
function createPlaybackSession(
  playbackDevice: string,
  djName: string,
  currentSong: Song | null,
  isPlaying: boolean,
  currentTime: number = 0
): PlaybackSession {
  return {
    sessionId: Date.now().toString(), // Unique token
    playbackDevice,
    djName,
    currentSong,
    isPlaying,
    currentTime,
    lastUpdate: Date.now()
  };
}

export default function HostDashboard() {
  const navigate = useNavigate();
  const { code: roomCode } = useParams<{ code: string }>();
  const location = useLocation();
  const hostName = location.state?.hostName || 'Host';

  const [session, setSession] = useState<SessionData | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null | undefined>(undefined);
  const [previousSong, setPreviousSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState<Song[]>([]);
  const [triggerCrossfade, setTriggerCrossfade] = useState(false);
  const [settings, setSettings] = useState<SessionSettings>(defaultSettings);
  const [wakeLock, setWakeLock] = useState<any>(null);
  
  const [showAddSong, setShowAddSong] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  const [playbackDevice, setPlaybackDevice] = useState<string>('HOST');
  const [djName, setDjName] = useState<string>(hostName);
  const [adminUsers, setAdminUsers] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showQuickReply, setShowQuickReply] = useState(false);
  const [replyRecipient, setReplyRecipient] = useState<string>('');

  // 🔴 REMOVED: currentTimeRef (no longer needed, syncTime handled by MusicPlayer)

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const newToast: Toast = {
      ...toast,
      id: `toast-${Date.now()}-${Math.random()}`
    };
    setToasts(prev => [...prev, newToast]);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const logActivity = async (type: string, message: string, metadata?: any) => {
    if (!roomCode) return;
    try {
      await addDoc(collection(db, 'sessions', roomCode, 'activity'), {
        type,
        userName: hostName,
        message,
        timestamp: Date.now(),
        metadata: metadata || {}
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const requestWakeLock = async () => {
    try {
      if (wakeLock !== null) return;
      if ('wakeLock' in navigator) {
        const lock = await (navigator as any).wakeLock.request('screen');
        setWakeLock(lock);
        lock.addEventListener('release', async () => {
          setWakeLock(null);
          setTimeout(async () => {
            if (isPlaying) await requestWakeLock();
          }, 1000);
        });
      }
    } catch (err) {
      console.error('Wake Lock error:', err);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLock !== null) {
      try {
        await wakeLock.release();
        setWakeLock(null);
      } catch (err) {
        console.error('Wake Lock release error:', err);
      }
    }
  };

  useEffect(() => {
    if (!roomCode) return;

    // SEPARATE LISTENER #1: Playback state ONLY (currentSong, isPlaying, syncTime)
    const playbackUnsubscribe = onSnapshot(
      doc(db, 'sessions', roomCode),
      {
        includeMetadataChanges: false // 🔥 FIX: Ignore local writes to prevent broadcast loop
      },
      (docSnapshot) => {
        if (!docSnapshot.exists()) {
          navigate('/');
          return;
        }

        const data = docSnapshot.data() as SessionData;

        // ONLY update playback-related state
        setCurrentSong(data.currentSong || null);
        setIsPlaying(data.isPlaying || false);
      }
    );

    // SEPARATE LISTENER #2: Session data (queue, guests, roles, settings)
    const sessionUnsubscribe = onSnapshot(
      doc(db, 'sessions', roomCode),
      {
        includeMetadataChanges: false // 🔥 FIX: Ignore local writes
      },
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as SessionData;
          setSession(data);
          setQueue(data.queue || []);
          setSettings({ ...defaultSettings, ...data.settings });

          setPlaybackDevice(data.playbackDevice || 'HOST');
          setDjName(data.djName || hostName);
          setAdminUsers(data.adminUsers || []);
        } else {
          navigate('/');
        }
      }
    );

    const messagesUnsubscribe = onSnapshot(
      query(collection(db, 'sessions', roomCode, 'messages'), where('to', '==', hostName)),
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const msg = change.doc.data() as QuickMessage;
            if (!msg.read) {
              addToast({
                type: 'message',
                title: `Message from ${msg.from}`,
                message: msg.text,
                autoDismiss: false,
                quickMessage: { ...msg, id: change.doc.id },
                onReply: () => {
                  setReplyRecipient(msg.from);
                  setShowQuickReply(true);
                },
                onReact: async (emoji) => {
                  try {
                    // 1. Pošalji quick message sa emoji-jem jako reply
                    await addDoc(collection(db, 'sessions', roomCode, 'messages'), {
                      from: hostName,
                      to: msg.from,
                      text: emoji,
                      timestamp: Date.now(),
                      read: false
                    });

                    // 2. Markirati originalnu poruku kao pročitanu
                    await updateDoc(doc(db, 'sessions', roomCode, 'messages', change.doc.id), {
                      read: true
                    });

                    // 3. Success notification
                    addToast({
                      type: 'message',
                      title: 'Reply Sent',
                      message: `You replied with ${emoji} to ${msg.from}`,
                      autoDismiss: true,
                      dismissTime: 2000
                    });
                  } catch (error) {
                    console.error('Error sending emoji reaction:', error);

                    // 4. Error notification
                    addToast({
                      type: 'error',
                      title: 'Failed to Send Reply',
                      message: 'Please try again',
                      autoDismiss: true,
                      dismissTime: 3000
                    });
                  }
                }
              });

              updateDoc(doc(db, 'sessions', roomCode, 'messages', change.doc.id), {
                read: true
              });
            }
          }
        });
      }
    );

    // BUG FIX #4: Activity listener to show skip/next/previous toasts from guests
    const activityUnsubscribe = onSnapshot(
      collection(db, 'sessions', roomCode, 'activity'),
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const activity = change.doc.data();

            // Show toast for skip/next/previous from OTHER users (guests, DJs)
            if (activity.type === 'skip' && activity.userName !== hostName) {
              addToast({
                type: 'skip',
                title: 'Song Skipped',
                message: activity.message,
                song: activity.metadata?.songTitle ? {
                  id: activity.metadata.songId || '',
                  title: activity.metadata.songTitle,
                  artist: '',
                  channel: '',
                  youtubeId: activity.metadata.songId?.replace('youtube-', '') || '',
                  type: 'youtube' as const,
                  thumbnailUrl: '',
                  addedBy: '',
                  duration: 0,
                  upvotes: [],
                  downvotes: [],
                  votes: 0,
                  played: false,
                  isPlaying: false
                } : undefined,
                autoDismiss: true,
                dismissTime: 3000
              });
            }
          }
        });
      }
    );

    return () => {
      playbackUnsubscribe();
      sessionUnsubscribe();
      messagesUnsubscribe();
      activityUnsubscribe();
      releaseWakeLock();
    };
  }, [roomCode, navigate, hostName]);

  useEffect(() => {
    if (session?.history && session.history.length > 0) {
      const latestHistorySong = session.history[session.history.length - 1];
      if (latestHistorySong.id !== previousSong?.id) {
        setPreviousSong(latestHistorySong);
      }
    } else {
      if (previousSong !== null) setPreviousSong(null);
    }
  }, [session?.history, previousSong]);

  // 🔴 REMOVED: Old currentTime broadcast (now handled by MusicPlayer's broadcast interval)
  // MusicPlayer now broadcasts syncTime = Date.now() - (currentTime * 1000) every 1s

  const handleAddSong = async (song: Song) => {
    if (!roomCode) return;
    await updateDoc(doc(db, 'sessions', roomCode), { queue: arrayUnion(song) });
    await logActivity('song_added', `${hostName} added "${song.title}"`, { songTitle: song.title, songId: song.id });
  };
  
  const handleStartParty = async () => {
    if (!roomCode || queue.length === 0) {
      if (queue.length === 0) alert('Add songs to the queue first!');
      return;
    }

    await requestWakeLock();
    const [nextSong, ...remainingQueue] = queue;

    try {
      const finalPlaybackDevice = playbackDevice || 'HOST';
      const finalDjName = djName || hostName;

      // Create INITIAL playback session token when party starts
      const initialPlaybackSession = createPlaybackSession(
        finalPlaybackDevice,
        finalDjName,
        { ...nextSong, startedAt: Date.now() },
        true,
        0
      );

      await updateDoc(doc(db, 'sessions', roomCode), {
        currentSong: { ...nextSong, startedAt: Date.now() },
        queue: remainingQueue,
        isPlaying: true,
        isPartyStarted: true,
        playbackDevice: finalPlaybackDevice,
        djName: finalDjName,
        playbackSession: initialPlaybackSession // NEW: Initial sync token
      });

      setCurrentSong(nextSong);
      setQueue(remainingQueue);
      setIsPlaying(true);
    } catch (error) {
      console.error('Error starting party:', error);
    }
  };
  
  const handleSongEnd = useCallback(async () => {
    if (!roomCode) return;

    if (queue.length === 0) {
      // Create playback session token when stopping playback
      const newPlaybackSession = createPlaybackSession(
        playbackDevice,
        djName,
        null,
        false,
        0
      );

      await updateDoc(doc(db, 'sessions', roomCode), {
        currentSong: null,
        isPlaying: false,
        playbackSession: newPlaybackSession // NEW: Sync token
      });
      return;
    }

    const [nextSong, ...remainingQueue] = queue;

    // Create NEW playback session token for automatic song transition
    const newPlaybackSession = createPlaybackSession(
      playbackDevice,
      djName,
      { ...nextSong, startedAt: Date.now() },
      true,
      0
    );

    const payload: DocumentData = {
      currentSong: { ...nextSong, startedAt: Date.now() },
      queue: remainingQueue,
      playbackSession: newPlaybackSession // NEW: Sync token
    };

    if (currentSong) {
      payload.history = arrayUnion(currentSong);
    }

    await updateDoc(doc(db, 'sessions', roomCode), payload);
  }, [roomCode, queue, currentSong, playbackDevice, djName]);

  const handlePlayPause = useCallback(async () => {
    if (!roomCode) return;

    // VALIDATE: Only HOST can control playback initially (or DJ if transferred)
    const isHostPlaybackDevice = playbackDevice === 'HOST';
    if (!isHostPlaybackDevice) {
      console.warn('[HostDashboard] Not the playback device, ignoring play/pause');
      return;
    }

    const newIsPlaying = !isPlaying;

    // 🔴 UPDATED: Removed currentTime update (syncTime handled by MusicPlayer broadcast)

    await updateDoc(doc(db, 'sessions', roomCode), {
      isPlaying: newIsPlaying
    });

    console.log(`[HostDashboard] Play/Pause toggled: ${newIsPlaying}`);
  }, [roomCode, isPlaying, playbackDevice]);

  const handleNext = useCallback(async () => {
    if (!roomCode || queue.length === 0) return;

    const [nextSong, ...remainingQueue] = queue;

    try {
      // Create NEW playback session token
      const newPlaybackSession = createPlaybackSession(
        playbackDevice,
        djName,
        { ...nextSong, startedAt: Date.now() },
        true,
        0
      );

      await updateDoc(doc(db, 'sessions', roomCode), {
        currentSong: { ...nextSong, startedAt: Date.now() },
        queue: remainingQueue,
        history: arrayUnion(currentSong),
        playbackSession: newPlaybackSession // NEW: Sync token
      });

      await logActivity('skip', `${hostName} skipped to "${nextSong.title}"`, { songTitle: nextSong.title, songId: nextSong.id });
    } catch (error) {
      console.error('Error skipping:', error);
    }
  }, [roomCode, queue, currentSong, hostName, playbackDevice, djName]);

  const handlePrevious = useCallback(async () => {
    if (!roomCode || !session?.history || session.history.length === 0) return;

    const lastSong = session.history[session.history.length - 1];
    const updatedHistory = session.history.slice(0, -1);

    try {
      const payload: any = {
        currentSong: { ...lastSong, startedAt: Date.now() },
        queue: currentSong ? [currentSong, ...queue] : queue,
        history: updatedHistory
      };

      await updateDoc(doc(db, 'sessions', roomCode), payload);
    } catch (error) {
      console.error('Error going previous:', error);
    }
  }, [roomCode, session?.history, currentSong, queue]);

  const handleVote = useCallback(async (songId: string, type: 'up' | 'down') => {
    if (!roomCode) return;

    await runTransaction(db, async (transaction) => {
      const roomRef = doc(db, 'sessions', roomCode);
      const roomDoc = await transaction.get(roomRef);
      if (!roomDoc.exists()) throw 'Room does not exist!';

      const q = roomDoc.data().queue as Song[];
      const songIndex = q.findIndex(s => s.id === songId);
      if (songIndex === -1) throw 'Song not in queue!';

      const song = q[songIndex];
      const upvotes = song.upvotes || [];
      const downvotes = song.downvotes || [];

      const hasUpvoted = upvotes.includes(hostName);
      const hasDownvoted = downvotes.includes(hostName);

      if (type === 'up') {
        if (hasUpvoted) return;
        q[songIndex].upvotes = [...upvotes, hostName];
        if (hasDownvoted) {
          q[songIndex].downvotes = downvotes.filter(u => u !== hostName);
        }
      } else {
        if (hasDownvoted) return;
        q[songIndex].downvotes = [...downvotes, hostName];
        if (hasUpvoted) {
          q[songIndex].upvotes = upvotes.filter(u => u !== hostName);
        }
      }
      
      q[songIndex].votes = (q[songIndex].upvotes?.length || 0) - (q[songIndex].downvotes?.length || 0);
      q.sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));

      transaction.update(roomRef, { queue: q });
    });
  }, [roomCode, hostName]);

  const handleRemove = async (songId: string) => {
    if (!roomCode) return;
    const updatedQueue = queue.filter(song => song.id !== songId);
    await updateDoc(doc(db, 'sessions', roomCode), { queue: updatedQueue });
  };

  const handleClearQueue = async () => {
    if (!roomCode || !confirm('Are you sure you want to clear the entire queue?')) return;
    await updateDoc(doc(db, 'sessions', roomCode), { queue: [] });
  };

  const handlePlayNow = async (song: Song) => {
    if (!roomCode) return;

    try {
      const updatedQueue = queue.filter(s => s.id !== song.id);

      // Create NEW playback session token to invalidate old state
      const newPlaybackSession = createPlaybackSession(
        playbackDevice,
        djName,
        { ...song, startedAt: Date.now() },
        true,
        0 // Start from beginning
      );

      const payload: any = {
        currentSong: { ...song, startedAt: Date.now() },
        queue: updatedQueue,
        triggerCrossfade: true,
        playbackSession: newPlaybackSession // NEW: Sync token
      };

      if (currentSong) {
        payload.history = arrayUnion(currentSong);
        await logActivity('skip', `${hostName} skipped "${currentSong.title}" to play "${song.title}"`, {
          songTitle: currentSong.title,
          songId: currentSong.id,
          skippedBy: hostName,
          newSongTitle: song.title,
          newSongId: song.id,
        });
      }

      await updateDoc(doc(db, 'sessions', roomCode), payload);
      setTriggerCrossfade(true);
      setTimeout(() => setTriggerCrossfade(false), 100);
    } catch (error) {
      console.error('Error playing now:', error);
    }
  };

  const handleMoveToNext = async (song: Song) => {
    if (!roomCode) return;

    try {
      const updatedQueue = queue.filter(s => s.id !== song.id);
      updatedQueue.unshift(song);

      await updateDoc(doc(db, 'sessions', roomCode), {
        queue: updatedQueue
      });
    } catch (error) {
      console.error('Error moving to next:', error);
    }
  };

  const handleReplaySong = async (song: Song) => {
    if (!roomCode) return;
    const isAlreadyInQueue = queue.some(queueSong => queueSong.id === song.id);
    if (isAlreadyInQueue) return;
    await updateDoc(doc(db, 'sessions', roomCode), { queue: arrayUnion(song) });
  };

  const handleClearHistory = async () => {
    if (!roomCode || !confirm('Are you sure you want to clear the entire history?')) return;
    await updateDoc(doc(db, 'sessions', roomCode), { history: [] });
  };

  const handleSaveSettings = async (newSettings: SessionSettings) => {
    if (!roomCode) return;
    await updateDoc(doc(db, 'sessions', roomCode), { settings: newSettings });
    setShowSettings(false);
  };

  const handleReorderQueue = async (reorderedQueue: Song[]) => {
    if (!roomCode) return;
    await updateDoc(doc(db, 'sessions', roomCode), { queue: reorderedQueue });
  };

  const handleGiveDJ = async (guestName: string) => {
    if (!roomCode) return;

    // Create NEW playback session token when DJ changes
    const newPlaybackSession = createPlaybackSession(
      playbackDevice,
      guestName, // New DJ
      currentSong || null,
      isPlaying,
      0 // syncTime now broadcast by MusicPlayer
    );

    await updateDoc(doc(db, 'sessions', roomCode), {
      djName: guestName,
      playbackSession: newPlaybackSession // NEW: Sync token
    });

    await logActivity('dj_transfer', `${hostName} gave DJ controls to ${guestName}`, { targetUser: guestName });
    addToast({
      type: 'dj_transfer',
      title: 'DJ Controls Transferred',
      message: `${guestName} is now the DJ`,
      autoDismiss: true,
      dismissTime: 3000
    });
  };

  const handleToggleAdmin = async (userName: string) => {
    if (!roomCode) return;
    
    const isCurrentlyAdmin = adminUsers.includes(userName);
    const newAdminUsers = isCurrentlyAdmin
      ? adminUsers.filter(u => u !== userName)
      : [...adminUsers, userName];
    
    await updateDoc(doc(db, 'sessions', roomCode), {
      adminUsers: newAdminUsers
    });

    // Log activity for admin grant (not for removal)
    if (!isCurrentlyAdmin) {
      await logActivity('admin_grant', `${hostName} gave admin privileges to ${userName}`, { targetUser: userName });
    }
  };

  const handleSetSpeaker = async (guestName: string) => {
    if (!roomCode) return;

    // Create NEW playback session token when speaker changes
    const newPlaybackSession = createPlaybackSession(
      guestName, // New playback device
      djName,
      currentSong || null,
      isPlaying,
      0 // syncTime now broadcast by MusicPlayer
    );

    await updateDoc(doc(db, 'sessions', roomCode), {
      playbackDevice: guestName,
      playbackSession: newPlaybackSession // NEW: Sync token
    });

    await logActivity('speaker_change', `${hostName} set ${guestName} as playback device`, { targetUser: guestName });
    addToast({
      type: 'speaker',
      title: 'Speaker Changed',
      message: `Audio now playing on ${guestName}'s device`,
      autoDismiss: true,
      dismissTime: 3000
    });
  };

  const handleSendMessage = (guestName: string) => {
    setReplyRecipient(guestName);
    setShowQuickReply(true);
  };

  const handleSendQuickMessage = async (message: string) => {
    if (!roomCode || !replyRecipient) return;

    try {
      const messageData: Omit<QuickMessage, 'id'> = {
        from: hostName,
        to: replyRecipient,
        text: message,
        timestamp: Date.now(),
        read: false
      };

      await addDoc(collection(db, 'sessions', roomCode, 'messages'), messageData);
      await logActivity('quick_message', `${hostName} sent message to ${replyRecipient}`, { targetUser: replyRecipient });

      addToast({
        type: 'message',
        title: 'Message Sent',
        message: `Sent to ${replyRecipient}: "${message}"`,
        autoDismiss: true,
        dismissTime: 3000
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKickUser = async (guestName: string) => {
    if (!roomCode) return;

    try {
      await updateDoc(doc(db, 'sessions', roomCode), {
        guests: arrayRemove(guestName)
      });

      if (djName === guestName) {
        await updateDoc(doc(db, 'sessions', roomCode), { djName: hostName });
      }
      if (playbackDevice === guestName) {
        await updateDoc(doc(db, 'sessions', roomCode), { playbackDevice: 'HOST' });
      }

      await logActivity('user_kicked', `${hostName} kicked ${guestName}`, { targetUser: guestName });

      addToast({
        type: 'kicked',
        title: 'User Kicked',
        message: `${guestName} has been removed from the session`,
        autoDismiss: true,
        dismissTime: 3000
      });
    } catch (error) {
      console.error('Error kicking user:', error);
    }
  };

  if (!session) {
    return <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center"><div className="text-white text-xl">Loading room...</div></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-black text-white pb-32">

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <HostHeader onLeave={() => navigate('/')} onInviteClick={() => setShowInvite(true)} onSettingsClick={() => setShowSettings(true)} />
        <RoomInfoCard roomName={session.roomName} hostName={session.hostName} guestCount={session.guests.length} code={roomCode!} onCopyCode={() => { navigator.clipboard.writeText(roomCode!); setCopied(true); setTimeout(() => setCopied(false), 2000); }} copied={copied} />

        <div className="mt-8">
          {!session.isPartyStarted ? (
            <StartPartyPrompt 
            queueLength={queue.length} 
            onStartParty={handleStartParty}
            onAddSong={() => setShowAddSong(true)}
          />
          
          ) : (
            <MusicPlayer
              currentSong={currentSong ?? null}
              nextSong={queue[0] || null}
              previousSong={previousSong}
              isPlaying={isPlaying ?? false}
              onSongEnd={handleSongEnd}
              onPlayPause={handlePlayPause}
              onNext={handleNext}
              onPrevious={handlePrevious}
              crossfadeDuration={settings.crossfadeDuration || 0}
              manualSkipCrossfade={settings.manualSkipCrossfade || 3}
              isHost={true}
              isPlaybackDevice={playbackDevice === 'HOST'}
              roomCode={roomCode}
              triggerCrossfade={triggerCrossfade}
              onTimeUpdate={async (syncTime) => {
                // 🔴 NEW: Receive syncTime from MusicPlayer and write to Firebase
                // syncTime format: Date.now() - (currentTime * 1000)
                if (!roomCode) return;
                try {
                  await updateDoc(doc(db, 'sessions', roomCode), { syncTime });
                } catch (error) {
                  console.error('Error updating syncTime:', error);
                }
              }}
            />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-2 space-y-6">
            {currentSong && session.isPartyStarted && (
              <div className="bg-gradient-to-br from-gray-900 to-black border border-white/20 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    🎵 Now Playing
                  </h3>
                  {isPlaying ? (
                    <span className="text-green-400 text-sm">● LIVE</span>
                  ) : (
                    <span className="text-gray-400 text-sm">⏸ PAUSED</span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <img
                    src={currentSong.thumbnailUrl || `https://i.ytimg.com/vi/${currentSong.id.replace('youtube-', '')}/default.jpg`}
                    alt={currentSong.title}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-lg truncate">{currentSong.title}</p>
                    <p className="text-gray-300 truncate">{currentSong.artist || currentSong.channel}</p>
                    <p className="text-gray-500 text-sm">Added by {currentSong.addedBy}</p>
                  </div>
                </div>

                {queue[0] && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-gray-400 text-sm mb-2">Up Next:</p>
                    <div className="flex items-center gap-3">
                      <img
                        src={queue[0].thumbnailUrl || `https://i.ytimg.com/vi/${queue[0].id.replace('youtube-', '')}/default.jpg`}
                        alt={queue[0].title}
                        className="w-12 h-12 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{queue[0].title}</p>
                        <p className="text-gray-400 text-xs truncate">{queue[0].artist || queue[0].channel}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <QueueSection 
              queue={queue}
              previousSong={previousSong}
              allowVoting={settings.votingEnabled}
              onVote={handleVote}
              onRemove={handleRemove}
              onAddSong={() => setShowAddSong(true)}
              onClearQueue={handleClearQueue}
              onPlayNow={handlePlayNow}
              onMoveToNext={handleMoveToNext}
              onReorderQueue={handleReorderQueue}
              hostName={hostName}
              isHost={true}
            />
          </div>

          <div className="space-y-8">
            <GuestsCard 
              guests={session.guests}
              currentDJ={djName}
              currentSpeaker={playbackDevice}
              adminUsers={adminUsers}
              onSendMessage={handleSendMessage}
              onKickUser={handleKickUser}
              isHost={true}
            />

            <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  🕐 Recently Played
                </h2>
                <span className="text-sm text-gray-400">{session.history?.length || 0} songs</span>
              </div>

              {(session.history?.length || 0) === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No history yet! 🎵
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {session.history?.slice().reverse().map((song, index) => {
                    const isInQueue = queue.some(queueSong => queueSong.id === song.id);
                    
                    return (
                      <div
                        key={`${song.id}-${index}`}
                        className={`flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg transition-all ${
                          isInQueue ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800 cursor-pointer group'
                        }`}
                        onClick={() => !isInQueue && handleReplaySong(song)}
                      >
                        <img
                          src={song.thumbnailUrl || `https://i.ytimg.com/vi/${song.id.replace('youtube-', '')}/default.jpg`}
                          alt={song.title}
                          className="w-12 h-12 rounded object-cover"
                        />

                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold truncate group-hover:text-purple-400 transition-colors">
                            {song.title}
                          </p>
                          <p className="text-gray-300 text-sm truncate">
                            {song.artist}
                          </p>
                        </div>

                        {!isInQueue && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReplaySong(song);
                            }}
                            className="p-2 bg-purple-500/20 hover:bg-purple-500 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Add to queue"
                          >
                            <svg className="w-5 h-5 text-purple-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        )}

                        {isInQueue && (
                          <div className="p-2 text-gray-500 text-xs">
                            ✓ In Queue
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {(session.history?.length || 0) > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="w-full mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all text-sm"
                >
                  Clear History
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <AddSongModal 
        isOpen={showAddSong} 
        onClose={() => setShowAddSong(false)} 
        onAddSong={handleAddSong} 
        onRemoveSong={handleRemove}
        addedBy={hostName} 
        isHost={true} 
        queue={queue}
        disablePreview={false}
      />
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        settings={settings} 
        onSave={handleSaveSettings}
        guests={session.guests}
        hostName={hostName}
        currentDJ={djName}
        currentSpeaker={playbackDevice}
        adminUsers={adminUsers}
        onChangeDJ={handleGiveDJ}
        onChangeSpeaker={handleSetSpeaker}
        onToggleAdmin={handleToggleAdmin}
        onKickUser={handleKickUser}
      />
      <InviteModal isOpen={showInvite} onClose={() => setShowInvite(false)} code={roomCode!} roomName={session.roomName} hostName={hostName} />
      
      <ToastManager toasts={toasts} onDismiss={dismissToast} />
      
      <QuickReplyModal
        isOpen={showQuickReply}
        recipientName={replyRecipient}
        onClose={() => setShowQuickReply(false)}
        onSend={handleSendQuickMessage}
      />
    </div>
  );
}