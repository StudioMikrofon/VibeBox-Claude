import { Music2, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function DirectJoin() {
  const { code } = useParams<{ code: string }>();
  const [guestName, setGuestName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roomName, setRoomName] = useState('');
  const [loadingRoomInfo, setLoadingRoomInfo] = useState(true);
  const navigate = useNavigate();
  const { joinSession } = useAuth();

  useEffect(() => {
    const fetchRoomInfo = async () => {
      if (!code) {
        setError('Invalid room code');
        setLoadingRoomInfo(false);
        return;
      }

      try {
        const q = query(collection(db, 'sessions'), where('code', '==', code));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setError('Room not found');
        } else {
          const sessionData = querySnapshot.docs[0].data();
          setRoomName(sessionData.roomName || 'Party');
        }
      } catch (err) {
        console.error('Error fetching room info:', err);
        setError('Failed to load room info');
      } finally {
        setLoadingRoomInfo(false);
      }
    };

    fetchRoomInfo();
  }, [code]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setError('Please enter your nickname');
      return;
    }
    if (!code) {
      setError('Invalid room code');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await joinSession(code, guestName.trim());
      navigate(`/guest/${code}`, { state: { guestName: guestName.trim() } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join party');
    } finally {
      setLoading(false);
    }
  };

  if (loadingRoomInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-primary/20 to-secondary/20 relative overflow-hidden flex items-center justify-center">
        <div className="text-white text-xl">Loading room info...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-primary/20 to-secondary/20 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.1),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(236,72,153,0.1),transparent_50%)]"></div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center space-y-8 mb-12 animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Music2 className="w-16 h-16 text-primary animate-pulse" />
            <h1 className="text-7xl md:text-8xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent animate-gradient">
              VibeBox
            </h1>
          </div>

          {roomName && (
            <div>
              <p className="text-xl text-gray-400 mb-2">You're joining</p>
              <h2 className="text-4xl font-bold text-white">{roomName}</h2>
            </div>
          )}

          <p className="text-lg text-gray-400">
            Room Code: <span className="font-mono font-bold text-primary text-2xl">{code}</span>
          </p>
        </div>

        {error && (
          <div className="max-w-md w-full mb-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 text-center animate-scale-in">
            {error}
          </div>
        )}

        <form onSubmit={handleJoin} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 max-w-md w-full hover:bg-white/10 transition-all duration-300">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Users className="w-8 h-8 text-secondary" />
            <h2 className="text-3xl font-bold text-white">Join the Party</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="guestName" className="block text-sm font-medium text-gray-300 mb-2">
                Your Nickname
              </label>
              <input
                id="guestName"
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Enter your name"
                maxLength={30}
                disabled={loading}
                autoFocus
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-4 bg-gradient-to-r from-secondary to-secondary/80 rounded-xl text-white font-semibold text-lg shadow-lg shadow-secondary/50 hover:shadow-xl hover:shadow-secondary/60 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? 'Joining...' : 'Join Party'}
            </button>
          </div>
        </form>

        <button
          onClick={() => navigate('/')}
          className="mt-8 text-gray-400 hover:text-white transition-colors"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
