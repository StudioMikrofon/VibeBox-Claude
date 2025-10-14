import { useState } from 'react';

interface QuickReplyModalProps {
  isOpen: boolean;
  recipientName: string;
  onClose: () => void;
  onSend: (message: string) => void;
}

const PRESET_MESSAGES = [
  '👍 Thanks!',
  '🔥 Fire choice!',
  '⏭️ Skip please',
  '🎉 Love it!',
  '💯 Perfect!',
  '🎵 Great song!',
];

export default function QuickReplyModal({
  isOpen,
  recipientName,
  onClose,
  onSend
}: QuickReplyModalProps) {
  const [customMessage, setCustomMessage] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  if (!isOpen) return null;

  const handleSendPreset = (message: string) => {
    onSend(message);
    onClose();
  };

  const handleSendCustom = () => {
    if (customMessage.trim()) {
      onSend(customMessage.trim());
      setCustomMessage('');
      setShowCustomInput(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-white">Quick Message</h3>
            <p className="text-gray-400 text-sm">to {recipientName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!showCustomInput ? (
          <>
            <p className="text-gray-300 text-sm mb-4">Select a quick reply:</p>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              {PRESET_MESSAGES.map((message) => (
                <button
                  key={message}
                  onClick={() => handleSendPreset(message)}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white text-sm font-semibold transition-colors text-left"
                >
                  {message}
                </button>
              ))}
            </div>

            <div className="border-t border-white/10 pt-4">
              <button
                onClick={() => setShowCustomInput(true)}
                className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <span>📝</span>
                <span>Type Custom Message</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Type your message..."
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
              rows={4}
              maxLength={200}
              autoFocus
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomMessage('');
                }}
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-semibold transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSendCustom}
                disabled={!customMessage.trim()}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                  customMessage.trim()
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                Send ➤
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}