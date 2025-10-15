import { Music2, Plus, Trash2, Youtube, Trophy, Medal, ChevronUp, ChevronDown, SkipForward, Play, ListMusic, GripVertical } from 'lucide-react';
import { Song } from '../../types/song';
import { formatDuration } from '../../utils/formatters';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMemo } from 'react';

// Generate random scroll duration between 8-16 seconds based on song ID for consistency
const getScrollDuration = (songId: string): number => {
  const hash = songId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return 8 + (hash % 9); // Random between 8-16 seconds
};

interface QueueSectionProps {
  queue: Song[];
  previousSong: Song | null;
  allowVoting: boolean;
  isHost: boolean;
  isDJ?: boolean;
  canAddSongs?: boolean; // NOVO
  onVote: (songId: string, type: 'up' | 'down') => void;
  onRemove: (songId: string) => void;
  onAddSong: () => void;
  onClearQueue: () => void;
  onPlayNow: (song: Song) => void;
  onMoveToNext: (song: Song) => void;
  onReorderQueue: (newQueue: Song[]) => void;
  hostName: string;
}

// Sortable Queue Item Component - MOBILE OPTIMIZED
function SortableQueueItem({
  song,
  index,
  allowVoting,
  isHost,
  isDJ,
  hostName,
  onVote,
  onRemove,
  onPlayNow,
  onMoveToNext,
  getTrophyIcon
}: {
  song: Song;
  index: number;
  allowVoting: boolean;
  isHost: boolean;
  isDJ: boolean;
  hostName: string;
  onVote: (songId: string, type: 'up' | 'down') => void;
  onRemove: (songId: string) => void;
  onPlayNow: (song: Song) => void;
  onMoveToNext: (song: Song) => void;
  getTrophyIcon: (index: number) => JSX.Element;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: song.id, 
    disabled: !isDJ && !isHost
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isOwnSong = song.addedBy === hostName;

  // Generate consistent random scroll duration for this song
  const scrollDuration = useMemo(() => getScrollDuration(song.id), [song.id]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-gray-800/50 rounded-lg p-3 md:p-4 hover:bg-gray-700 transition-colors ${isDragging ? 'shadow-2xl ring-2 ring-secondary z-50' : ''}`}
    >
      {/* DESKTOP LAYOUT */}
      <div className="hidden lg:flex items-center gap-2 md:gap-4">
        {/* Drag Handle - ZA HOSTA I DJ-A */}
        {(isDJ || isHost) && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-white/10 rounded transition-colors"
          >
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
        )}

        {/* Trophy/Position */}
        <div className="text-lg md:text-2xl font-bold text-secondary w-6 md:w-8 text-center flex-shrink-0">
          {getTrophyIcon(index)}
        </div>

        {/* Thumbnail */}
        {song.thumbnailUrl && (
          <img
            src={song.thumbnailUrl}
            alt={song.title}
            className="w-12 h-12 md:w-16 md:h-16 rounded-lg object-cover flex-shrink-0"
          />
        )}

        {/* Song Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* Mobile: marquee scrolling for long titles */}
            <div className="lg:hidden mobile-marquee">
              <h3
                className="text-white font-semibold text-sm mobile-marquee-text overflow"
                style={{ animationDuration: `${scrollDuration}s` }}
              >
                {song.title} {song.title}
              </h3>
            </div>
            {/* Desktop: simple truncate */}
            <h3 className="hidden lg:block text-white font-semibold text-base truncate">
              {song.title}
            </h3>
            <Youtube className="w-3 h-3 md:w-4 md:h-4 text-[#FF0000] flex-shrink-0" />
          </div>
          <div className="text-gray-400 text-xs md:text-sm truncate">
            {song.artist || song.channel} {song.duration > 0 && `• ${formatDuration(song.duration)}`}
          </div>
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <span>Added by {song.addedBy}</span>
          </div>
        </div>

        {/* HOST CONTROLS */}
        {isHost && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onPlayNow(song)}
              className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 text-xs rounded flex items-center gap-1 transition-colors"
              title="Play now"
            >
              <Play className="w-3 h-3" />
              Play
            </button>
            <button
              onClick={() => onMoveToNext(song)}
              className="px-2 py-1 bg-green-500/20 hover:bg-green-500/40 text-green-400 text-xs rounded flex items-center gap-1 transition-colors"
              title="Move to next"
            >
              <SkipForward className="w-3 h-3" />
              Next
            </button>
          </div>
        )}

        {/* VOTING CONTROLS */}
        {!allowVoting ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`font-bold text-lg px-4 py-2 rounded-lg bg-white/5 ${
              (song.votes ?? 0) > 0 ? 'text-green-400' : (song.votes ?? 0) < 0 ? 'text-red-400' : 'text-gray-400'
            }`}>
              {song.votes ?? 0}
            </div>
          </div>
        ) : isOwnSong ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`font-bold text-lg px-4 py-2 rounded-lg bg-white/5 ${
              (song.votes ?? 0) > 0 ? 'text-green-400' : (song.votes ?? 0) < 0 ? 'text-red-400' : 'text-gray-400'
            }`}>
              {song.votes ?? 0}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onVote(song.id, 'up')}
              className={`p-1.5 rounded-lg transition-all min-w-[40px] min-h-[40px] flex items-center justify-center ${
                song.upvotes?.includes(hostName)
                  ? 'bg-green-500 text-white'
                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/40'
              }`}
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <div className="font-bold text-lg min-w-[40px] text-center text-white">
              {song.votes ?? 0}
            </div>
            <button
              onClick={() => onVote(song.id, 'down')}
              className={`p-1.5 rounded-lg transition-all min-w-[40px] min-h-[40px] flex items-center justify-center ${
                song.downvotes?.includes(hostName)
                  ? 'bg-red-500 text-white'
                  : 'bg-red-500/20 text-red-400 hover:bg-red-500/40'
              }`}
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Remove Button */}
        {isHost && (
          <button
            onClick={() => onRemove(song.id)}
            className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg transition-all flex-shrink-0"
            title="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* MOBILE LAYOUT */}
      <div className="lg:hidden space-y-3">
        {/* Red 1: Song Info */}
        <div className="flex items-center gap-3">
          {/* Drag Handle - ZA HOSTA I DJ-A (Mobile) */}
          {(isDJ || isHost) && (
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
            >
              <GripVertical className="w-4 h-4 text-gray-400" />
            </div>
          )}

          <div className="text-xl font-bold text-secondary w-6 text-center flex-shrink-0">
            {getTrophyIcon(index)}
          </div>

          {song.thumbnailUrl && (
            <img
              src={song.thumbnailUrl}
              alt={song.title}
              className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
            />
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* ✅ Marquee scrolling for long song titles on mobile */}
              <div className="mobile-marquee">
                <h3
                  className="text-white font-semibold text-sm mobile-marquee-text overflow"
                  style={{ animationDuration: `${scrollDuration}s` }}
                >
                  {song.title} {song.title}
                </h3>
              </div>
              <Youtube className="w-3 h-3 text-[#FF0000] flex-shrink-0" />
            </div>
            <div className="text-gray-400 text-xs truncate">
              {song.artist || song.channel}
            </div>
            <div className="text-gray-500 text-xs">
              {song.duration > 0 && formatDuration(song.duration)}
            </div>
          </div>
        </div>

        {/* Red 2: Controls */}
        <div className={`flex items-center gap-1.5 ${(isDJ || isHost) ? 'pl-[28px]' : 'pl-6'}`}>
          {/* Host Controls */}
          {isHost && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onPlayNow(song)}
                className="px-1.5 py-0.5 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 text-[10px] rounded flex items-center gap-0.5"
              >
                <Play className="w-2.5 h-2.5" />
                Play
              </button>
              <button
                onClick={() => onMoveToNext(song)}
                className="px-1.5 py-0.5 bg-green-500/20 hover:bg-green-500/40 text-green-400 text-[10px] rounded flex items-center gap-0.5"
              >
                <SkipForward className="w-2.5 h-2.5" />
                Next
              </button>
              <button
                onClick={() => onRemove(song.id)}
                className="p-0.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          )}

          {/* Voting */}
          {allowVoting && !isOwnSong && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onVote(song.id, 'up')}
                className={`p-1 rounded transition-all ${
                  song.upvotes?.includes(hostName)
                    ? 'bg-green-500 text-white'
                    : 'bg-green-500/20 text-green-400'
                }`}
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <div className="font-bold text-xs min-w-[20px] text-center text-white">
                {song.votes ?? 0}
              </div>
              <button
                onClick={() => onVote(song.id, 'down')}
                className={`p-1 rounded transition-all ${
                  song.downvotes?.includes(hostName)
                    ? 'bg-red-500 text-white'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Own song - just show votes */}
          {isOwnSong && (
            <div className="text-xs text-gray-400">
              {song.votes ?? 0} votes
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QueueSection({
  queue,
  previousSong,
  allowVoting,
  isHost,
  isDJ = false,
  canAddSongs = true, // NOVO default
  onVote,
  onRemove,
  onAddSong,
  onClearQueue,
  onPlayNow,
  onMoveToNext,
  onReorderQueue,
  hostName
}: QueueSectionProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const getTrophyIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-400" />;
    if (index === 1) return <Medal className="w-5 h-5 text-gray-300" />;
    if (index === 2) return <Medal className="w-5 h-5 text-yellow-600" />;
    return <span className="font-mono text-sm text-gray-400">#{index + 1}</span>;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || (!isDJ && !isHost)) return;

    const oldIndex = queue.findIndex((s) => s.id === active.id);
    const newIndex = queue.findIndex((s) => s.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newQueue = [...queue];
    const [movedSong] = newQueue.splice(oldIndex, 1);
    newQueue.splice(newIndex, 0, movedSong);

    onReorderQueue(newQueue);
  };

  return (
    <div className="bg-gradient-to-br from-gray-900/80 to-black/60 border border-white/10 rounded-2xl p-4 md:p-6 max-h-[600px] lg:h-full backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <h3 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Music2 className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
          </div>
          <span>Song Queue</span>
          <span className="text-sm text-gray-400 font-normal">({queue.length})</span>
        </h3>

        <div className="flex items-center gap-2">
          {isHost && (
            <>
              <button
                onClick={onAddSong}
                className="px-3 md:px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg text-white flex items-center gap-2 transition-all text-sm md:text-base"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Song</span>
                <span className="sm:hidden">Add</span>
              </button>
              <button
                onClick={onClearQueue}
                className="p-2 bg-red-500/80 hover:bg-red-500 rounded-lg text-white transition-all"
                title="Clear queue"
              >
                <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </>
          )}
          {!isHost && (
            <button
              onClick={onAddSong}
              disabled={!canAddSongs}
              className={`px-3 md:px-4 py-2 rounded-lg text-white flex items-center gap-2 transition-all text-sm ${
                canAddSongs
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'
                  : 'bg-gray-600 cursor-not-allowed opacity-50'
              }`}
              title={!canAddSongs ? 'Song limit reached' : 'Add a song to the queue'}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Song</span>
              <span className="sm:hidden">Add</span>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6 overflow-y-auto flex-1 min-h-0">
        {/* Previously Played */}
        {previousSong && (
          <div className="mb-6">
            <p className="text-xs text-gray-500 mb-3 flex items-center gap-2">
              <span>◀️</span>
              <span className="uppercase tracking-wider font-semibold">Previously Played</span>
            </p>
            <div className="flex items-center gap-4 p-3 md:p-4 bg-gradient-to-r from-gray-800/40 to-gray-900/40 rounded-xl opacity-70 hover:opacity-90 border border-gray-700/50 transition-all">
              <img
                src={previousSong.thumbnailUrl}
                alt={previousSong.title}
                className="w-12 h-12 md:w-14 md:h-14 rounded-lg grayscale hover:grayscale-0 transition-all object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-gray-300 font-semibold truncate text-sm md:text-base">{previousSong.title}</p>
                <p className="text-gray-500 text-xs md:text-sm truncate">{previousSong.artist}</p>
              </div>
              {isHost && (
                <button
                  onClick={() => onPlayNow?.(previousSong)}
                  className="px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 text-white text-xs md:text-sm rounded-lg transition-all flex items-center gap-2"
                >
                  <span>🔁</span>
                  <span className="hidden md:inline">Replay</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Queue List */}
        {queue.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex p-6 bg-white/5 rounded-full mb-4">
              <ListMusic className="w-10 h-10 md:w-12 md:h-12 text-gray-500" />
            </div>
            <p className="text-gray-400 text-base md:text-lg">No songs in queue</p>
            <p className="text-gray-500 text-xs md:text-sm mt-2">Add some tracks to get started!</p>
          </div>
        ) : (
          <div>
            <h4 className="text-base md:text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>🎵 Up Next</span>
              {(isDJ || isHost) && <span className="hidden md:inline text-xs text-gray-500">(Drag to reorder)</span>}
            </h4>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={queue.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {queue.map((song, idx) => (
                    <SortableQueueItem
                      key={song.id}
                      song={song}
                      index={idx}
                      allowVoting={allowVoting}
                      isHost={isHost}
                      isDJ={isDJ}
                      hostName={hostName}
                      onVote={onVote}
                      onRemove={onRemove}
                      onPlayNow={onPlayNow}
                      onMoveToNext={onMoveToNext}
                      getTrophyIcon={getTrophyIcon}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>
    </div>
  );
}
