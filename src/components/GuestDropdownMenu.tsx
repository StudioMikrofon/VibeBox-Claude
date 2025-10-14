import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

interface GuestDropdownMenuProps {
  guestName: string;
  _hostName?: string; // Prefix sa _
  currentDJ: string;
  currentSpeaker: string;
  onGiveDJ: () => void;
  onSetSpeaker: () => void;
  onSendMessage: () => void;
  onKick: () => void;
}

export default function GuestDropdownMenu({
  guestName,
  currentDJ,
  currentSpeaker,
  onGiveDJ,
  onSetSpeaker,
  onSendMessage,
  onKick
}: GuestDropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const isDJ = currentDJ === guestName;
  const isSpeaker = currentSpeaker === guestName;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
      >
        <MoreVertical className="w-5 h-5 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-64 bg-gray-900 rounded-xl shadow-2xl border border-white/20 overflow-hidden">
          <div className="p-4 border-b border-white/20 bg-gray-800">
            <p className="text-white font-semibold text-sm">{guestName}</p>
            <div className="flex gap-2 mt-1">
              {isDJ && (
                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">
                  👑 DJ
                </span>
              )}
              {isSpeaker && (
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                  🔊 Speaker
                </span>
              )}
            </div>
          </div>

          <div className="py-2">
            <button
              onClick={() => {
                onGiveDJ();
                setIsOpen(false);
              }}
              disabled={isDJ}
              className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                isDJ
                  ? 'text-gray-500 cursor-not-allowed'
                  : 'text-white hover:bg-gray-700 active:bg-gray-600'
              }`}
            >
              <span className="text-lg">👑</span>
              <div>
                <p className="text-sm font-semibold">Give DJ Controls</p>
                <p className="text-xs text-gray-400">
                  {isDJ ? 'Already DJ' : 'Transfer playback control'}
                </p>
              </div>
            </button>

            <button
              onClick={() => {
                onSetSpeaker();
                setIsOpen(false);
              }}
              disabled={isSpeaker}
              className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                isSpeaker
                  ? 'text-gray-500 cursor-not-allowed'
                  : 'text-white hover:bg-gray-700 active:bg-gray-600'
              }`}
            >
              <span className="text-lg">🔊</span>
              <div>
                <p className="text-sm font-semibold">Set as Speaker</p>
                <p className="text-xs text-gray-400">
                  {isSpeaker ? 'Already speaker' : 'Audio plays on their device'}
                </p>
              </div>
            </button>

            <button
              onClick={() => {
                onSendMessage();
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 text-left flex items-center gap-3 text-white hover:bg-gray-700 transition-colors active:bg-gray-600"
            >
              <span className="text-lg">💬</span>
              <div>
                <p className="text-sm font-semibold">Send Quick Message</p>
                <p className="text-xs text-gray-400">Send a quick note</p>
              </div>
            </button>

            <div className="border-t border-white/10 mt-2 pt-2">
              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to kick ${guestName}?`)) {
                    onKick();
                    setIsOpen(false);
                  }
                }}
                className="w-full px-4 py-3 text-left flex items-center gap-3 text-red-400 hover:bg-red-500/20 transition-colors active:bg-red-500/30"
              >
                <span className="text-lg">❌</span>
                <div>
                  <p className="text-sm font-semibold">Kick User</p>
                  <p className="text-xs text-red-300/70">Remove from session</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}