import { Users } from 'lucide-react';

interface GuestsCardProps {
  guests: string[];
  currentDJ: string;
  currentSpeaker: string;
  adminUsers: string[];
  onSendMessage: (guestName: string) => void;
  onKickUser?: (guestName: string) => void; // NEW: Kick functionality
  isHost?: boolean; // NEW: To show kick button only for host
}

export default function GuestsCard({ 
  guests, 
  currentDJ,
  currentSpeaker,
  adminUsers,
  onSendMessage,
  onKickUser,
  isHost = false
}: GuestsCardProps) {
  return (
    <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-secondary" />
          <h3 className="text-2xl font-bold text-white">Guests</h3>
        </div>
        <span className="text-gray-400 text-sm">{guests.length}</span>
      </div>
      
      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {guests.length === 0 ? (
          <p className="text-gray-400 text-center py-12">No guests yet</p>
        ) : (
          guests.map((guest, idx) => {
            const isDJ = currentDJ === guest;
            const isSpeaker = currentSpeaker === guest;
            const isAdmin = adminUsers.includes(guest);
            
            return (
              <div 
                key={idx} 
                className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between group hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" title="Online" />
                  <span className="text-white truncate font-medium">{guest}</span>
                  
                  <div className="flex gap-1 ml-2">
                    {isDJ && (
                      <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded" title="DJ">
                        👑
                      </span>
                    )}
                    {isSpeaker && (
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded" title="Speaker">
                        🔊
                      </span>
                    )}
                    {isAdmin && (
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded" title="Admin">
                        🛡️
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Message Button */}
                  <button
                    onClick={() => onSendMessage(guest)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Send message"
                  >
                    <svg className="w-5 h-5 text-gray-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </button>

                  {/* Kick Button - Only for Host */}
                  {isHost && onKickUser && (
                    <button
                      onClick={() => {
                        if (confirm(`Kick ${guest} from the session?`)) {
                          onKickUser(guest);
                        }
                      }}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Kick user"
                    >
                      <svg className="w-5 h-5 text-red-400 hover:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
