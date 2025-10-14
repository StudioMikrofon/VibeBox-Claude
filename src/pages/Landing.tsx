import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music2, Users, Radio, PartyPopper, Plus, LogIn } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function Landing() {
  const navigate = useNavigate();
  const [hostName, setHostName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [guestName, setGuestName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleHostParty = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔵 handleHostParty STARTED');
    console.log('🔵 hostName:', hostName, 'roomName:', roomName);
    
    if (!hostName.trim() || !roomName.trim()) {
      console.log('🔴 VALIDATION FAILED');
      return;
    }
  
    try {
      setIsCreating(true);
      console.log('🔵 setIsCreating(true)');
      
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      console.log('🔵 Generated roomCode:', roomCode);

      await setDoc(doc(db, 'sessions', roomCode), {
        code: roomCode,
        hostName: hostName,
        roomName: roomName,
        createdAt: serverTimestamp(),
        queue: [],
        guests: [],
        isPlaying: false,
        currentSong: null,
        history: [],
        settings: {
          maxSongsPerGuest: 5,
          queuePermission: 'all',
          votingEnabled: true,
          autoSkipNegative: false,
          autoSkipThreshold: -3,
          allowDuplicates: false,
          maxQueueSize: 50,
          crossfadeDuration: 5
        }
      });
      console.log('🟢 setDoc SUCCESS for room:', roomCode);

      navigate(`/host/${roomCode}`, { state: { hostName } });
      console.log('🟢 navigate SUCCESS to:', `/host/${roomCode}`);
    } catch (error) {
      console.error('🔴 ERROR in handleHostParty:', error);
    } finally {
      setIsCreating(false);
      console.log('🔵 setIsCreating(false)');
    }
  };

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || !guestName.trim()) return;

    try {
      const roomDoc = await getDocs(query(collection(db, 'sessions'), where('__name__', '==', joinCode.toUpperCase().trim())));
      if (roomDoc.empty) {
        alert('Room not found. Please check the code.');
        return;
      }
      navigate(`/guest/${joinCode.toUpperCase().trim()}`, { 
        state: { guestName: guestName.trim() } 
      });
    } catch (error) {
      console.error('Error joining room:', error);
      alert('Failed to join room.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-black">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-4 mb-6">
            <Music2 className="w-16 h-16 text-blue-400" />
            <h1 className="text-6xl font-bold text-white">VibeBox</h1>
          </div>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Create collaborative music queues for any occasion.
          </p>
          <div className="flex items-center justify-center gap-6 mt-8 text-gray-400">
            <div className="flex items-center gap-2"><Users className="w-5 h-5" /><span>Unlimited Guests</span></div>
            <div className="flex items-center gap-2"><Radio className="w-5 h-5" /><span>Real-time Voting</span></div>
            <div className="flex items-center gap-2"><PartyPopper className="w-5 h-5" /><span>YouTube Playback</span></div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6"><div className="p-3 bg-blue-500/20 rounded-xl"><Plus className="w-8 h-8 text-blue-400" /></div><h2 className="text-3xl font-bold text-white">Host a Party</h2></div>
            <form onSubmit={handleHostParty} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Your Name</label>
                <input type="text" value={hostName} onChange={(e) => setHostName(e.target.value)} placeholder="DJ Alex" className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Room Name</label>
                <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Alex's Birthday Bash" className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <button type="submit" disabled={isCreating} className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-blue-500/50 disabled:opacity-50">{isCreating ? 'Creating...' : 'Create Party 🎉'}</button>
            </form>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6"><div className="p-3 bg-purple-500/20 rounded-xl"><LogIn className="w-8 h-8 text-purple-400" /></div><h2 className="text-3xl font-bold text-white">Join a Party</h2></div>
            <form onSubmit={handleJoinSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Your Name</label>
                <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="John" className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Party Code</label>
                <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ABC123" className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase tracking-wider text-center text-xl font-bold" maxLength={6} required />
              </div>
              <button type="submit" className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-purple-500/50">Join Party 🎊</button>
            </form>
          </div>
        </div>

        <div className="mt-16 text-center text-gray-500 text-sm"><p>Powered by YouTube • No login required • Free forever</p></div>
      </div>
    </div>
  );
}
