import { useEffect, useState } from 'react';
import { Song } from '../types/song';
import { QuickMessage } from '../types/session';

export type ToastType = 'skip' | 'dj_transfer' | 'speaker' | 'message' | 'kicked' | 'song_added' | 'error';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  song?: Song;
  quickMessage?: QuickMessage;
  autoDismiss: boolean;
  dismissTime?: number;
  onReply?: () => void;
  onReact?: (emoji: string) => void;
}

interface ToastManagerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export default function ToastManager({ toasts, onDismiss }: ToastManagerProps) {
  const [visibleToasts, setVisibleToasts] = useState<string[]>([]);
  const [sendingEmoji, setSendingEmoji] = useState<string | null>(null);

  useEffect(() => {
    toasts.forEach((toast) => {
      if (!visibleToasts.includes(toast.id)) {
        setVisibleToasts((prev) => [...prev, toast.id]);

        if (toast.autoDismiss) {
          setTimeout(() => {
            setVisibleToasts((prev) => prev.filter((id) => id !== toast.id));
            setTimeout(() => onDismiss(toast.id), 300);
          }, toast.dismissTime || 3000);
        }
      }
    });
  }, [toasts]);

  const getToastIcon = (type: ToastType) => {
    switch (type) {
      case 'skip': return '⏭️';
      case 'dj_transfer': return '👑';
      case 'speaker': return '🔊';
      case 'message': return '💬';
      case 'kicked': return '❌';
      case 'song_added': return '➕';
      case 'error': return '❗';
      default: return '🔔';
    }
  };

  const getToastColor = (type: ToastType) => {
    switch (type) {
      case 'skip': return 'from-purple-600 to-pink-600';
      case 'dj_transfer': return 'from-yellow-500 to-orange-500';
      case 'speaker': return 'from-blue-500 to-cyan-500';
      case 'message': return 'from-green-500 to-teal-500';
      case 'kicked': return 'from-red-600 to-pink-600';
      case 'song_added': return 'from-indigo-500 to-purple-500';
      case 'error': return 'from-red-700 to-red-900';
      default: return 'from-gray-600 to-gray-700';
    }
  };

  return (
    <>
      {/* Top-Center Toast Container - za skip i next notifikacije */}
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 space-y-3 max-w-md">
        {toasts
          .filter((toast) => toast.type === 'skip')
          .map((toast) => (
            <div
              key={toast.id}
              className={`transition-all duration-300 ${
                visibleToasts.includes(toast.id)
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 -translate-y-2'
              }`}
            >
              <div className={`bg-gradient-to-r ${getToastColor(toast.type)} rounded-2xl shadow-2xl p-4 border border-white/20`}>
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getToastIcon(toast.type)}</span>
                    <p className="text-white font-bold text-sm">{toast.title}</p>
                  </div>
                  {!toast.autoDismiss && (
                    <button
                      onClick={() => onDismiss(toast.id)}
                      className="text-white/80 hover:text-white transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Content */}
                <p className="text-white/90 text-sm mb-3">{toast.message}</p>

                {/* Song Preview */}
                {toast.song && (
                  <div className="flex items-center gap-3 bg-black/20 rounded-lg p-2">
                    <img
                      src={toast.song.thumbnailUrl || `https://i.ytimg.com/vi/${toast.song.id.replace('youtube-', '')}/default.jpg`}
                      alt={toast.song.title}
                      className="w-12 h-12 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-xs truncate">{toast.song.title}</p>
                      <p className="text-white/70 text-xs truncate">{toast.song.artist}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>

      {/* Bottom-Right Toast Container - za messages, kicked i ostale notifikacije */}
      <div className="fixed bottom-6 right-6 z-50 space-y-3 max-w-md">
        {toasts
          .filter((toast) => toast.type !== 'skip')
          .map((toast) => (
            <div
              key={toast.id}
              className={`transition-all duration-300 ${
                visibleToasts.includes(toast.id)
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 translate-x-full'
              }`}
            >
              <div className={`bg-gradient-to-r ${getToastColor(toast.type)} rounded-2xl shadow-2xl p-4 border border-white/20`}>
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getToastIcon(toast.type)}</span>
                    <p className="text-white font-bold text-sm">{toast.title}</p>
                  </div>
                  {!toast.autoDismiss && (
                    <button
                      onClick={() => onDismiss(toast.id)}
                      className="text-white/80 hover:text-white transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Content */}
                <p className="text-white/90 text-sm mb-3">{toast.message}</p>

                {/* Song Preview (for songadded) */}
                {toast.song && (
                  <div className="flex items-center gap-3 bg-black/20 rounded-lg p-2 mb-3">
                    <img
                      src={toast.song.thumbnailUrl || `https://i.ytimg.com/vi/${toast.song.id.replace('youtube-', '')}/default.jpg`}
                      alt={toast.song.title}
                      className="w-12 h-12 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-xs truncate">{toast.song.title}</p>
                      <p className="text-white/70 text-xs truncate">{toast.song.artist}</p>
                    </div>
                  </div>
                )}

                {/* Message Actions (Reply/React) */}
                {toast.type === 'message' && (
                  <div className="flex items-center gap-2">
                    {toast.onReply && (
                      <button
                        onClick={async () => {
                          try {
                            await toast.onReply!();
                            onDismiss(toast.id);
                          } catch (error) {
                            console.error('Reply failed:', error);
                          }
                        }}
                        className="flex-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xs font-semibold transition-colors"
                      >
                        Reply
                      </button>
                    )}
                    {toast.onReact && (
                      <div className="flex gap-1">
                        {['👍', '❤️', '🔥', '😂', '🎉'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={async () => {
                              setSendingEmoji(emoji);
                              try {
                                await toast.onReact!(emoji);
                                onDismiss(toast.id);
                              } catch (error) {
                                console.error('Failed to send emoji reaction:', error);
                              } finally {
                                setSendingEmoji(null);
                              }
                            }}
                            disabled={sendingEmoji !== null}
                            className={`w-8 h-8 rounded-lg transition-all text-sm ${
                              sendingEmoji === emoji
                                ? 'bg-green-500 text-white animate-pulse'
                                : 'bg-white/20 hover:bg-white/30'
                            }`}
                          >
                            {sendingEmoji === emoji ? '✓' : emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Manual Dismiss Button */}
                {!toast.autoDismiss && toast.type !== 'message' && (
                  <button
                    onClick={() => onDismiss(toast.id)}
                    className="w-full mt-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-semibold transition-colors"
                  >
                    OK, Got it!
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>
    </>
  );
}
