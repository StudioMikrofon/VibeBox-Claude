import { ArrowLeft, Music2, MessageCircle, Settings, Headphones, VolumeX } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, onSnapshot, arrayRemove, addDoc, runTransaction } from 'firebase/firestore';
import AddSongModal from '../components/AddSongModal';
import MusicPlayer from '../components/MusicPlayer';
import PersistentStatusBanner from '../components/PersistentStatusBanner';
import ToastManager, { Toast } from '../components/ToastManager';
import QuickReplyModal from '../components/QuickReplyModal';
import QueueSection from '../components/host/QueueSection';
import GuestSettingsModal from '../components/GuestSettingsModal';
import { Song } from '../types/song';
import { UserRole, QuickMessage, SessionSettings, PlaybackSession } from '../types/session';
import { Users } from 'lucide-react';

// Helper function to create unique playback session tokens
function createPlaybackSession(
  playbackDevice: string,
  djName: string,
  currentSong: Song | null,
  isPlaying: boolean,
  currentTime: number = 0
): PlaybackSession {
  return {
    sessionId: Date.now().toString(),
    playbackDevice,
    djName,
    currentSong,
    isPlaying,
    currentTime,
    lastUpdate: Date.now()
  };
}

interface SessionData {
  code: string;
  hostName: string;
  roomName: string;
  queue: Song[];
  guests: string[];
  history: Song[];
  settings?: SessionSettings;
  playbackDevice?: string;
  djName?: string;
  adminUsers?: string[];
  currentSong?: Song | null;
  isPlaying?: boolean;
  playbackSession?: PlaybackSession; // NEW: Playback sync token
}

export default function GuestView() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const guestName = location.state?.guestName || 'Guest';

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddSong, setShowAddSong] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sessionDocId, setSessionDocId] = useState<string | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [nextSong, setNextSong] = useState<Song | null>(null);
  const [previousSong, setPreviousSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [userSongCount, setUserSongCount] = useState(0);
  const [syncTime, setSyncTime] = useState<number>();
  const [audioEnabled, setAudioEnabled] = useState(() => {
    const saved = localStorage.getItem('guestAudioEnabled');
    return saved === 'true';
  });
  const [listenLocally, setListenLocally] = useState(false);

  const [userRole, setUserRole] = useState<UserRole>('guest');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showQuickReply, setShowQuickReply] = useState(false);
  const [replyRecipient, setReplyRecipient] = useState<string>('');
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [isDJ, setIsDJ] = useState(false);
  const [isPlaybackDevice, setIsPlaybackDevice] = useState(false);
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);

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

  // BUG FIX #4: Log activity for skip/next to broadcast to all users
  const logActivity = async (type: string, message: string, metadata?: any) => {
    if (!sessionDocId) return;
    try {
      await addDoc(collection(db, 'sessions', sessionDocId, 'activity'), {
        type,
        userName: guestName,
        message,
        timestamp: Date.now(),
        metadata: metadata || {}
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  useEffect(() => {
    if (!code) {
      navigate('/');
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let playbackUnsubscribe: (() => void) | undefined;
    let messagesUnsubscribe: (() => void) | undefined;
    let activityUnsubscribe: (() => void) | undefined;

    const fetchSession = async () => {
      try {
        const q = query(collection(db, 'sessions'), where('code', '==', code));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          navigate('/');
          return;
        }

        const sessionDoc = querySnapshot.docs[0];
        setSessionDocId(sessionDoc.id);

        try {
          await updateDoc(doc(db, 'sessions', sessionDoc.id), {
            guests: arrayUnion(guestName)
          });
        } catch (error) {
          console.error('Failed to add guest:', error);
        }

        // SEPARATE LISTENER #1: Playback state ONLY (currentSong, isPlaying, syncTime)
        playbackUnsubscribe = onSnapshot(doc(db, 'sessions', sessionDoc.id), (doc) => {
          if (!doc.exists()) return;

          const data = doc.data();

          // ONLY update playback-related state
          setCurrentSong(data.currentSong || null);
          setIsPlaying(data.isPlaying || false);

          if (typeof data.currentTime === 'number') {
            setSyncTime(data.currentTime);
          }
        });

        // SEPARATE LISTENER #2: Session data (queue, guests, roles, settings)
        unsubscribe = onSnapshot(doc(db, 'sessions', sessionDoc.id), (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            let queue = data.queue || [];

            // FIX: SORTIRAJ queue po votes (DESC) - najviše glasova GORE!
            if (data.settings?.allowVoting) {
              queue = [...queue].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
            }

            const sessionData = {
              code: data.code,
              hostName: data.hostName,
              roomName: data.roomName || 'Party',
              queue,
              history: data.history || [],
              guests: data.guests || [],
              settings: data.settings || { maxSongsPerGuest: 3, queuePermission: 'public', allowVoting: true },
              playbackDevice: data.playbackDevice || 'HOST',
              djName: data.djName || data.hostName,
              adminUsers: data.adminUsers || [],
              currentSong: data.currentSong || null,
              isPlaying: data.isPlaying || false
            };
            setSession(sessionData);

            const isAdmin = sessionData.adminUsers?.includes(guestName) || false;
            const isDJNow = sessionData.djName === guestName;
            const isPlayback = sessionData.playbackDevice === guestName;

            setIsUserAdmin(isAdmin);
            setIsDJ(isDJNow);
            setIsPlaybackDevice(isPlayback);

            const songCount = queue.filter((song: Song) => song.addedBy === guestName).length;
            setUserSongCount(songCount);

            if (queue.length > 0) {
              setNextSong(queue[0]);
            } else {
              setNextSong(null);
            }

            if (data.history && data.history.length > 0) {
              setPreviousSong(data.history[data.history.length - 1]);
            } else {
              setPreviousSong(null);
            }

            if (isDJNow && isPlayback) {
              setUserRole('dj');
            } else if (isDJNow) {
              setUserRole('dj');
            } else if (isPlayback) {
              setUserRole('speaker');
            } else {
              setUserRole('guest');
            }
          }
        });

        messagesUnsubscribe = onSnapshot(
          query(collection(db, 'sessions', sessionDoc.id, 'messages'), where('to', '==', guestName)),
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
                    // FIX: Emoji instant reply - šalje message i markira kao read
                    onReact: async (emoji) => {
                      try {
                        // 1. Pošalji quick message sa emoji-jem kao reply
                        await addDoc(collection(db, 'sessions', sessionDoc.id, 'messages'), {
                          from: guestName,
                          to: msg.from,
                          text: emoji,
                          timestamp: Date.now(),
                          read: false
                        });

                        // 2. Markirati originalnu poruku kao pročitanu
                        await updateDoc(doc(db, 'sessions', sessionDoc.id, 'messages', change.doc.id), {
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

                  // Markirati kao read odmah nakon prikazivanja toasta
                  updateDoc(doc(db, 'sessions', sessionDoc.id, 'messages', change.doc.id), {
                    read: true
                  });
                }
              }
            });
          }
        );

        activityUnsubscribe = onSnapshot(
          collection(db, 'sessions', sessionDoc.id, 'activity'),
          (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const activity = change.doc.data();
                
                if (activity.type === 'skip' && activity.userName !== guestName) {
                  addToast({
                    type: 'skip',
                    title: 'Song Skipped',
                    message: activity.message,
                    song: activity.metadata?.songTitle ? {
                      id: activity.metadata.songId || '',
                      title: activity.metadata.songTitle,
                      artist: '',
                      duration: 0,
                      addedBy: '',
                      votes: 0,
                      thumbnailUrl: ''
                    } as Song : undefined,
                    autoDismiss: true,
                    dismissTime: 3000
                  });
                }

                if (activity.type === 'dj_transfer' && activity.metadata?.targetUser === guestName) {
                  addToast({
                    type: 'dj_transfer',
                    title: 'You are now the DJ!',
                    message: 'You have full playback control and can reorder the queue',
                    autoDismiss: false
                  });
                }

                if (activity.type === 'speaker_change' && activity.metadata?.targetUser === guestName) {
                  addToast({
                    type: 'speaker',
                    title: 'You are now the playback device',
                    message: 'Audio is playing from YOUR device. Don\'t close!',
                    autoDismiss: false
                  });
                  setAudioEnabled(true);
                  localStorage.setItem('guestAudioEnabled', 'true');
                }

                if (activity.type === 'admin_grant' && activity.metadata?.targetUser === guestName) {
                  addToast({
                    type: 'message',
                    title: 'You are now an Admin!',
                    message: 'You can manage users, access settings, and kick members',
                    autoDismiss: false
                  });
                }
              }
            });
          }
        );

        setLoading(false);
      } catch (error) {
        console.error('Error fetching session:', error);
        setLoading(false);
      }
    };

    fetchSession();

    // Cleanup function for component unmount and window close/blur
    return () => {
      if (unsubscribe) unsubscribe();
      if (playbackUnsubscribe) playbackUnsubscribe();
      if (messagesUnsubscribe) messagesUnsubscribe();
      if (activityUnsubscribe) activityUnsubscribe();
    };
  }, [code, navigate, guestName]);

  // Handle window close/blur - remove guest from session
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (sessionDocId && guestName) {
        try {
          await updateDoc(doc(db, 'sessions', sessionDocId), {
            guests: arrayRemove(guestName)
          });
        } catch (error) {
          console.error('Error removing guest on window close:', error);
        }
      }
    };

    const handleVisibilityChange = () => {
      // Only cleanup if page is being hidden/closed (not just switching tabs temporarily)
      if (document.visibilityState === 'hidden') {
        if (sessionDocId && guestName) {
          // Use sendBeacon for reliable delivery during page unload
          navigator.sendBeacon?.(`/cleanup-guest-${Date.now()}`) || handleBeforeUnload();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionDocId, guestName]);

  useEffect(() => {
    if (!session) return;
    
    if (!session.guests.includes(guestName)) {
      addToast({
        type: 'kicked',
        title: 'You were removed from the session',
        message: 'Host has kicked you from the room. Redirecting...',
        autoDismiss: false
      });

      setTimeout(() => {
        navigate('/');
      }, 3000);
    }
  }, [session?.guests, guestName, navigate]);

  useEffect(() => {
    if (userRole !== 'speaker' && audioEnabled && localStorage.getItem('wasSpeaker') === 'true') {
      setAudioEnabled(false);
      localStorage.setItem('guestAudioEnabled', 'false');
      localStorage.removeItem('wasSpeaker');
    } else if (userRole === 'speaker') {
      localStorage.setItem('wasSpeaker', 'true');
    }
  }, [userRole, audioEnabled]);

  // ✅ BUG FIX #4: Auto-enable listenLocally when user becomes DJ
  useEffect(() => {
    if (isDJ && !listenLocally) {
      console.log('✅ User became DJ, enabling listenLocally');
      setListenLocally(true);
    }
  }, [isDJ]);

  const handleAddSong = async (song: Song) => {
    if (!sessionDocId || !session) return;

    const maxSongs = session.settings?.maxSongsPerGuest || 5;
    if (userSongCount >= maxSongs) {
      addToast({
        type: 'message',
        title: 'Song Limit Reached',
        message: `You can only add ${maxSongs} songs to the queue`,
        autoDismiss: true,
        dismissTime: 3000
      });
      return;
    }

    try {
      await updateDoc(doc(db, 'sessions', sessionDocId), {
        queue: arrayUnion(song)
      });
    } catch (error) {
      console.error('Error adding song:', error);
    }
  };

  // BUG FIX #2: Use runTransaction to prevent race conditions and ensure vote order
  const handleVote = async (songId: string, voteType: 'up' | 'down') => {
    if (!sessionDocId) return;

    try {
      await runTransaction(db, async (transaction) => {
        const roomRef = doc(db, 'sessions', sessionDocId);
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) throw 'Room does not exist!';

        const queue = roomDoc.data().queue as Song[];
        const songIndex = queue.findIndex(s => s.id === songId);
        if (songIndex === -1) throw 'Song not in queue!';

        const song = queue[songIndex];
        const upvotes = song.upvotes || [];
        const downvotes = song.downvotes || [];

        const hasUpvoted = upvotes.includes(guestName);
        const hasDownvoted = downvotes.includes(guestName);

        if (voteType === 'up') {
          if (hasUpvoted) return; // Already upvoted, no change
          queue[songIndex].upvotes = [...upvotes, guestName];
          if (hasDownvoted) {
            queue[songIndex].downvotes = downvotes.filter(u => u !== guestName);
          }
        } else {
          if (hasDownvoted) return; // Already downvoted, no change
          queue[songIndex].downvotes = [...downvotes, guestName];
          if (hasUpvoted) {
            queue[songIndex].upvotes = upvotes.filter(u => u !== guestName);
          }
        }

        // Calculate votes and sort queue
        queue[songIndex].votes = (queue[songIndex].upvotes?.length || 0) - (queue[songIndex].downvotes?.length || 0);
        queue.sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));

        transaction.update(roomRef, { queue });
      });
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleSendQuickMessage = async (message: string) => {
    if (!sessionDocId || !replyRecipient) return;

    try {
      const messageData: Omit<QuickMessage, 'id'> = {
        from: guestName,
        to: replyRecipient,
        text: message,
        timestamp: Date.now(),
        read: false
      };

      await addDoc(collection(db, 'sessions', sessionDocId, 'messages'), messageData);
      
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

  const handleKickGuest = async (guestToKick: string) => {
    if (!sessionDocId || !isUserAdmin) return;
  
    try {
      await updateDoc(doc(db, 'sessions', sessionDocId), {
        guests: arrayRemove(guestToKick)
      });
    } catch (error) {
      console.error('Error kicking guest:', error);
    }
  };

  const handlePlayNow = async (song: Song) => {
    if (!sessionDocId || (!isDJ && !isUserAdmin) || !session) return;

    try {
      const updatedQueue = session.queue.filter(s => s.id !== song.id);

      // Create new playback session token
      const newPlaybackSession = createPlaybackSession(
        session.playbackDevice || 'HOST',
        session.djName || session.hostName,
        { ...song, startedAt: Date.now() },
        true,
        0
      );

      await updateDoc(doc(db, 'sessions', sessionDocId), {
        currentSong: { ...song, startedAt: Date.now() },
        queue: updatedQueue,
        history: currentSong ? arrayUnion(currentSong) : [],
        triggerCrossfade: true,
        playbackSession: newPlaybackSession
      });
    } catch (error) {
      console.error('Error playing now:', error);
    }
  };

  const handleMoveToNext = async (song: Song) => {
    if (!sessionDocId || (!isDJ && !isUserAdmin)) return;

    try {
      const updatedQueue = session!.queue.filter(s => s.id !== song.id);
      updatedQueue.unshift(song);

      await updateDoc(doc(db, 'sessions', sessionDocId), {
        queue: updatedQueue
      });
    } catch (error) {
      console.error('Error moving to next:', error);
    }
  };

  const handleReorderQueue = async (reorderedQueue: Song[]) => {
    if (!sessionDocId || !isDJ) return;

    try {
      await updateDoc(doc(db, 'sessions', sessionDocId), {
        queue: reorderedQueue
      });
    } catch (error) {
      console.error('Error reordering queue:', error);
    }
  };

  const handleRemove = async (songId: string) => {
    if (!sessionDocId) return;
    const updatedQueue = session!.queue.filter(s => s.id !== songId);
    await updateDoc(doc(db, 'sessions', sessionDocId), { queue: updatedQueue });
  };

  const handleReplaySong = async (song: Song) => {
    if (!sessionDocId || !session) return;
    
    const isAlreadyInQueue = session.queue.some(queueSong => queueSong.id === song.id);
    if (isAlreadyInQueue) return;

    const maxSongs = session.settings?.maxSongsPerGuest || 5;
    if (userSongCount >= maxSongs) {
      addToast({
        type: 'message',
        title: 'Song Limit Reached',
        message: `You can only add ${maxSongs} songs to the queue`,
        autoDismiss: true,
        dismissTime: 3000
      });
      return;
    }

    await updateDoc(doc(db, 'sessions', sessionDocId), { queue: arrayUnion(song) });
  };

  const handleSaveSettings = async (settings: SessionSettings) => {
    if (!sessionDocId || !isUserAdmin) return;
    
    try {
      await updateDoc(doc(db, 'sessions', sessionDocId), {
        settings
      });
      
      addToast({
        type: 'message',
        title: 'Settings Updated',
        message: 'Room settings have been saved successfully',
        autoDismiss: true,
        dismissTime: 3000
      });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center">
        <div className="text-white text-xl">Session not found</div>
      </div>
    );
  }

  const allUsers = [session.hostName, ...session.guests].filter(user => user !== guestName);
  const maxSongs = session.settings?.maxSongsPerGuest || 5;
  const canAddSongs = userSongCount < maxSongs;

  const sortedGuests = [...session.guests].sort((a, b) => {
    if (a === guestName) return -1;
    if (b === guestName) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white pb-32">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </button>

          <div className="flex items-center gap-2">
            {/* Listen Locally Toggle */}
            <button
              onClick={() => {
                setListenLocally(!listenLocally);
                if (!listenLocally) {
                  addToast({
                    type: 'message',
                    title: 'Local Playback Enabled',
                    message: 'Audio is now playing on your device',
                    autoDismiss: true,
                    dismissTime: 3000
                  });
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-all ${
                listenLocally
                  ? 'bg-green-600 hover:bg-green-500'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={listenLocally ? 'Stop listening locally' : 'Listen on my device'}
            >
              {listenLocally ? <Headphones className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              <span className="hidden sm:inline">{listenLocally ? 'Listening' : 'Listen'}</span>
            </button>

            {isUserAdmin && (
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                title="Room Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}

            <div className="relative">
              <button
                onClick={() => setShowMessageDropdown(!showMessageDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                <span>Message</span>
              </button>

              {showMessageDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-gray-800 border border-white/20 rounded-lg shadow-2xl z-50 max-h-96 overflow-y-auto">
                  <div className="p-2">
                    <p className="text-gray-400 text-xs px-3 py-2">Send message to:</p>
                    {allUsers.map(user => (
                      <button
                        key={user}
                        onClick={() => {
                          setReplyRecipient(user);
                          setShowQuickReply(true);
                          setShowMessageDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-700 rounded-lg text-white transition-colors flex items-center gap-2"
                      >
                        {user === session.hostName && <span className="text-xs text-red-400">👑</span>}
                        <span>{user}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <PersistentStatusBanner
          role={userRole}
          roomName={session.roomName}
          guestCount={session.guests.length}
          isDJ={isDJ}
          isAdmin={isUserAdmin}
          isPlaybackDevice={isPlaybackDevice}
        />

        <div className="text-center space-y-4 mb-8">
          <div className="flex items-center justify-center gap-3">
            <Music2 className="w-12 h-12 text-secondary" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
              Guest View
            </h1>
          </div>
          <p className="text-xl text-gray-400">Welcome, {guestName}!</p>
          <p className="text-lg text-gray-500">Party hosted by {session.hostName}</p>
        </div>

        {(listenLocally || isPlaybackDevice || isDJ) && currentSong && (
          <div className="mb-8">
            <MusicPlayer
              currentSong={currentSong}
              nextSong={nextSong}
              previousSong={previousSong}
              isPlaying={isPlaying}
              onSongEnd={() => {}}
              onPlayPause={isDJ ? async () => {
                if (!sessionDocId || !session) return;

                const newPlaybackSession = createPlaybackSession(
                  session.playbackDevice || 'HOST',
                  guestName,
                  currentSong,
                  !isPlaying,
                  0
                );

                await updateDoc(doc(db, 'sessions', sessionDocId), {
                  isPlaying: !isPlaying,
                  playbackSession: newPlaybackSession
                });
              } : () => {}}
              onNext={isDJ ? async () => {
                if (!sessionDocId || !session?.queue || session.queue.length === 0) return;
                const [nextSong, ...remainingQueue] = session.queue;

                const newPlaybackSession = createPlaybackSession(
                  session.playbackDevice || 'HOST',
                  guestName,
                  { ...nextSong, startedAt: Date.now() },
                  true,
                  0
                );

                await updateDoc(doc(db, 'sessions', sessionDocId), {
                  currentSong: { ...nextSong, startedAt: Date.now() },
                  queue: remainingQueue,
                  history: arrayUnion(currentSong),
                  playbackSession: newPlaybackSession
                });

                // BUG FIX #4: Log skip activity to broadcast to all users
                await logActivity('skip', `${guestName} skipped to "${nextSong.title}"`, {
                  songTitle: nextSong.title,
                  songId: nextSong.id
                });
              } : () => {}}
              onPrevious={isDJ ? async () => {
                if (!sessionDocId || !session?.history || session.history.length === 0) return;
                const lastSong = session.history[session.history.length - 1];
                const updatedHistory = session.history.slice(0, -1);

                const newPlaybackSession = createPlaybackSession(
                  session.playbackDevice || 'HOST',
                  guestName,
                  { ...lastSong, startedAt: Date.now() },
                  true,
                  0
                );

                await updateDoc(doc(db, 'sessions', sessionDocId), {
                  currentSong: { ...lastSong, startedAt: Date.now() },
                  queue: currentSong ? [currentSong, ...session.queue] : session.queue,
                  history: updatedHistory,
                  playbackSession: newPlaybackSession
                });
              } : () => {}}
              crossfadeDuration={0}
              isHost={false}
              isDJ={isDJ}
              isPlaybackDevice={isPlaybackDevice}
              roomCode={code || ''}
              triggerCrossfade={false}
              syncTime={syncTime}
              onToggleAudio={(enabled) => {
                setAudioEnabled(enabled);
                localStorage.setItem('guestAudioEnabled', enabled ? 'true' : 'false');
              }}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Only show Now Playing card if user is NOT DJ/speaker/listening locally (they already have MusicPlayer) */}
            {currentSong && !listenLocally && !isPlaybackDevice && !isDJ && (
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

                {nextSong && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-gray-400 text-sm mb-2">Up Next:</p>
                    <div className="flex items-center gap-3">
                      <img
                        src={nextSong.thumbnailUrl || `https://i.ytimg.com/vi/${nextSong.id.replace('youtube-', '')}/default.jpg`}
                        alt={nextSong.title}
                        className="w-12 h-12 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{nextSong.title}</p>
                        <p className="text-gray-400 text-xs truncate">{nextSong.artist || nextSong.channel}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="relative">
              {!canAddSongs && (
                <div className="absolute top-20 right-6 z-10 px-3 py-1 bg-red-500/20 border border-red-500/50 text-red-400 text-sm rounded-lg">
                  Song limit reached ({userSongCount}/{maxSongs})
                </div>
              )}
              <QueueSection
                queue={session.queue}
                previousSong={previousSong}
                allowVoting={session.settings?.allowVoting ?? true}
                canAddSongs={canAddSongs}
                onVote={handleVote}
                onRemove={handleRemove}
                onAddSong={() => {
                  if (canAddSongs) {
                    setShowAddSong(true);
                  } else {
                    addToast({
                      type: 'message',
                      title: 'Song Limit Reached',
                      message: `You can only add ${maxSongs} songs to the queue`,
                      autoDismiss: true,
                      dismissTime: 3000
                    });
                  }
                }}
                onClearQueue={async () => {}}
                onPlayNow={handlePlayNow}
                onMoveToNext={handleMoveToNext}
                onReorderQueue={handleReorderQueue}
                hostName={guestName}
                isHost={false}
                isDJ={isDJ}
              />
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-secondary" />
                  <h3 className="text-2xl font-bold text-white">Guests</h3>
                </div>
                <span className="text-gray-400 text-sm">{session.guests.length + 1}</span>
              </div>
              
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                <div className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between group hover:bg-gray-800 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-2 h-2 bg-green-500 rounded-full" title="Online" />
                    <span className="text-white truncate font-medium">{session.hostName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded" title="Host">👑</span>
                    {session.djName === session.hostName && <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded" title="DJ Controls">🎧</span>}
                    {session.playbackDevice === 'HOST' && <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded" title="Playback Device">🔊</span>}

                    {/* ✅ BUG FIX #6: Message button for host - visible to ALL users */}
                    <button
                      onClick={() => {
                        setReplyRecipient(session.hostName);
                        setShowQuickReply(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 px-2 py-1 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 text-xs rounded transition-all"
                      title="Send message to host"
                    >
                      💬
                    </button>
                  </div>
                </div>

                {sortedGuests.map((guest, idx) => {
                  const isDJGuest = session.djName === guest;
                  const isSpeaker = session.playbackDevice === guest;
                  const isAdmin = session.adminUsers?.includes(guest);
                  const isMe = guest === guestName;

                  return (
                    <div
                      key={idx}
                      className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between group hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-2 h-2 bg-green-500 rounded-full" title="Online" />
                        <span className="text-white truncate font-medium">
                          {guest} {isMe && <span className="text-gray-400">(You)</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isDJGuest && <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded" title="DJ Controls">🎧</span>}
                        {isSpeaker && <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded" title="Playback Device">🔊</span>}
                        {isAdmin && <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded" title="Admin Privileges">🛡️</span>}

                        {/* ✅ BUG FIX #6: Message button visible to ALL users */}
                        {!isMe && (
                          <button
                            onClick={() => {
                              setReplyRecipient(guest);
                              setShowQuickReply(true);
                            }}
                            className="opacity-0 group-hover:opacity-100 px-2 py-1 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 text-xs rounded transition-all"
                            title="Send message"
                          >
                            💬
                          </button>
                        )}

                        {/* ✅ BUG FIX #6: Kick button only for Admin */}
                        {isUserAdmin && !isMe && (
                          <button
                            onClick={() => handleKickGuest(guest)}
                            className="opacity-0 group-hover:opacity-100 px-2 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 text-xs rounded transition-all"
                            title="Kick guest"
                          >
                            ❌
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-black border border-white/20 rounded-2xl p-6 shadow-2xl">
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
                    const isInQueue = session.queue.some(queueSong => queueSong.id === song.id);
                    
                    return (
                      <div
                        key={`${song.id}-${index}`}
                        className={`flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg transition-all ${
                          isInQueue || !canAddSongs ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800 cursor-pointer group'
                        }`}
                        onClick={() => !isInQueue && canAddSongs && handleReplaySong(song)}
                      >
                        <img
                          src={song.thumbnailUrl || `https://i.ytimg.com/vi/${song.id.replace('youtube-', '')}/default.jpg`}
                          alt={song.title}
                          className="w-12 h-12 rounded object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold truncate group-hover:text-purple-400 transition-colors">{song.title}</p>
                          <p className="text-gray-300 text-sm truncate">{song.artist}</p>
                        </div>

                        {!isInQueue && canAddSongs && (
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
            </div>
          </div>
        </div>
      </div>

      <AddSongModal
        isOpen={showAddSong}
        onClose={() => setShowAddSong(false)}
        onAddSong={handleAddSong}
        addedBy={guestName}
        queue={session.queue}
        disablePreview={isPlaybackDevice}
      />
      
      {isUserAdmin && session.settings && (
        <GuestSettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          settings={session.settings}
          onSave={handleSaveSettings}
        />
      )}
      
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
