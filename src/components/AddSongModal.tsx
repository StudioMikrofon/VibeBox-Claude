import { useState, useEffect } from 'react';
import { X, Search, Plus, Check, Trash2 } from 'lucide-react';
import { searchYouTubeVideos, YouTubeVideo } from '../services/youtube';
import { createYouTubeSong, Song } from '../types/song';
import PreviewPlayer from './PreviewPlayer';
import { formatDuration } from '../utils/formatters';

interface AddSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSong: (song: Song) => void;
  onRemoveSong?: (songId: string) => void;
  addedBy: string;
  isHost?: boolean;
  queue: Song[];
  disablePreview?: boolean;
}

export default function AddSongModal({ 
  isOpen, 
  onClose, 
  onAddSong, 
  onRemoveSong, 
  addedBy, 
  queue,
  disablePreview = false
}: AddSongModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [youtubeResults, setYoutubeResults] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewSong, setPreviewSong] = useState<YouTubeVideo | null>(null);
  const [addedSongs, setAddedSongs] = useState<string[]>([]);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setYoutubeResults([]);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    const timer = setTimeout(async () => {
      try {
        const results = await searchYouTubeVideos(searchQuery);
        setYoutubeResults(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setYoutubeResults([]);
      setError('');
      setPreviewSong(null);
      setAddedSongs([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddSong = async (video: YouTubeVideo) => {
    const song = createYouTubeSong(
      video.id,
      video.title,
      video.channel,
      video.thumbnailUrl,
      video.duration,
      addedBy
    );
    await onAddSong(song);
    
    setAddedSongs([...addedSongs, video.id]);
  };

  const handleRemoveSong = async (videoId: string) => {
    const songId = `youtube-${videoId}`;
    
    if (onRemoveSong) {
      await onRemoveSong(songId);
      setAddedSongs(addedSongs.filter(id => id !== videoId));
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setYoutubeResults([]);
    setError('');
    setPreviewSong(null);
    setAddedSongs([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      ></div>

      <div className="relative bg-gray-900/95 backdrop-blur-xl border border-white/20 rounded-2xl w-full max-w-3xl max-h-[80vh] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-3xl font-bold text-white">Add Song</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type to search for a song..."
              className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Preview Disabled Warning */}
          {disablePreview && (
            <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4 text-blue-400 text-sm flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Preview disabled - You are the playback device. Previews would interrupt the main stream.</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-400">Searching...</p>
              </div>
            </div>
          )}

          {!loading && youtubeResults.length > 0 && (
            <div className="space-y-3">
              {youtubeResults.map((video) => {
                const isInQueue = (queue || []).some(q => q.id === `youtube-${video.id}`);
                const isJustAdded = addedSongs.includes(video.id);
                const isAdded = isInQueue || isJustAdded;

                return (
                  <div
                    key={video.id}
                    id={`song-${video.id}`}
                    className="bg-white/5 rounded-xl p-4 hover:bg-white/10 transition-all border border-white/5 hover:border-white/10"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-20 h-14 md:w-24 md:h-16 rounded-lg object-cover flex-shrink-0 shadow-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-semibold truncate text-sm md:text-base">{video.title}</div>
                        <div className="text-gray-400 text-xs md:text-sm truncate">{video.channel}</div>
                        <div className="text-gray-500 text-xs md:text-sm mt-1">
                          {formatDuration(video.duration)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {/* Preview Button - Disabled or Active */}
                      {disablePreview ? (
                        <div className="relative group">
                          <button
                            disabled
                            className="px-4 py-2 bg-gray-600/50 text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed opacity-50"
                          >
                            Preview Disabled
                          </button>
                          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-gray-800 border border-white/20 rounded-lg p-3 text-xs text-white w-64 shadow-2xl z-10">
                            You are the playback device. Preview would interrupt the main stream.
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPreviewSong(video)}
                          className="px-4 py-2 bg-blue-600/80 hover:bg-blue-500 rounded-lg text-white text-sm font-medium transition-all transform hover:scale-105 shadow-lg"
                        >
                          Preview
                        </button>
                      )}
                      
                      {/* Add/Remove Button */}
                      {!isAdded ? (
                        <button
                          onClick={() => handleAddSong(video)}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-lg transition-all transform hover:scale-105 shadow-lg font-medium"
                        >
                          <Plus className="w-5 h-5" />
                          <span>Add</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 text-green-400 rounded-lg font-medium">
                            <Check className="w-5 h-5" />
                            <span>Added!</span>
                          </div>
                          
                          {onRemoveSong && isJustAdded && (
                            <button
                              onClick={() => handleRemoveSong(video.id)}
                              className="p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-all transform hover:scale-105 shadow-lg"
                              title="Remove from queue"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!loading && searchQuery.length >= 2 && youtubeResults.length === 0 && !error && (
            <div className="text-center py-12 text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No results found. Try a different search term.</p>
            </div>
          )}

          {!loading && !searchQuery && (
            <div className="text-center py-12 text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Type at least 2 characters to search</p>
            </div>
          )}

          {!loading && searchQuery.length > 0 && searchQuery.length < 2 && (
            <div className="text-center py-12 text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Type at least 2 characters to search</p>
            </div>
          )}
        </div>
      </div>

      {/* Preview Player - Only if preview not disabled */}
      {!disablePreview && previewSong && (
        <PreviewPlayer
          youtubeId={previewSong.id}
          title={previewSong.title}
          channel={previewSong.channel}
          thumbnailUrl={previewSong.thumbnailUrl}
          duration={previewSong.duration}
          onClose={() => setPreviewSong(null)}
          onAdd={() => {
            handleAddSong(previewSong);
            setPreviewSong(null);
          }}
        />
      )}
    </div>
  );
}
