interface PlayOnYouTubeButtonProps {
  videoId: string;
  title: string;
}

export default function PlayOnYouTubeButton({ videoId, title }: PlayOnYouTubeButtonProps) {
  const handlePlayOnYouTube = () => {
    const cleanVideoId = videoId.replace('youtube-', '');
    window.open(`https://www.youtube.com/watch?v=${cleanVideoId}`, '_blank');
  };

  return (
    <button
      onClick={handlePlayOnYouTube}
      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-all transform hover:scale-105 shadow-lg"
      title={`Play "${title}" on YouTube`}
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
      <span>Play on YouTube</span>
    </button>
  );
}