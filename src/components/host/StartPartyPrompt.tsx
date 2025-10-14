import { PartyPopper, Sparkles, Music } from 'lucide-react';

interface StartPartyPromptProps {
  queueLength: number;
  onStartParty: () => void;
  onAddSong?: () => void; // NOVO
}

export default function StartPartyPrompt({ queueLength, onStartParty, onAddSong }: StartPartyPromptProps) {
  return (
    <div className="mb-8 relative">
      {/* Animated Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-blue-600/20 rounded-2xl blur-3xl animate-pulse"></div>
      
      {/* Main Card */}
      <div className="relative bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 backdrop-blur-xl rounded-2xl p-12 text-center border border-purple-500/30 shadow-2xl overflow-hidden">
        
        {/* Animated Stars */}
        <div className="absolute top-4 left-4 animate-bounce">
          <Sparkles className="w-6 h-6 text-yellow-400" />
        </div>
        <div className="absolute top-8 right-8 animate-bounce" style={{ animationDelay: '0.3s' }}>
          <Sparkles className="w-5 h-5 text-pink-400" />
        </div>
        <div className="absolute bottom-12 left-12 animate-bounce" style={{ animationDelay: '0.6s' }}>
          <Sparkles className="w-4 h-4 text-blue-400" />
        </div>
        <div className="absolute bottom-8 right-16 animate-bounce" style={{ animationDelay: '0.9s' }}>
          <Music className="w-5 h-5 text-purple-400" />
        </div>

        {/* Main Icon with Glow */}
        <div className="relative inline-block mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full blur-2xl opacity-50 animate-pulse"></div>
          <PartyPopper className="relative w-24 h-24 mx-auto text-transparent bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400 bg-clip-text" style={{ filter: 'drop-shadow(0 0 20px rgba(168, 85, 247, 0.5))' }} />
        </div>

        {/* Title with Gradient */}
        <h3 className="text-4xl md:text-5xl font-black mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent animate-pulse">
          Ready to Start the Party?
        </h3>

        {/* Queue Info */}
        <div className="mb-8 inline-flex items-center gap-3 px-6 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full">
          <Music className="w-5 h-5 text-purple-400 animate-pulse" />
          <p className="text-white text-lg font-semibold">
            {queueLength} song{queueLength !== 1 ? 's' : ''} ready to play
          </p>
          <Sparkles className="w-5 h-5 text-pink-400 animate-spin" style={{ animationDuration: '3s' }} />
        </div>

        {/* Start Button with Hover Effects */}
        <button
          onClick={queueLength === 0 ? onAddSong : onStartParty}
          className="
            group relative px-10 py-5 text-2xl font-black rounded-2xl
            transition-all duration-300 transform
            bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white 
            hover:scale-110 hover:shadow-2xl hover:shadow-purple-500/50 active:scale-95
          "
        >
          {/* Animated Border Glow */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-300 -z-10"></div>
          
          <div className="flex items-center gap-3">
            <PartyPopper className="w-7 h-7 group-hover:rotate-12 group-hover:scale-125 transition-transform" />
            <span className="relative">
              {queueLength === 0 ? 'ADD SONGS FIRST' : 'START VIBEBOX'}
              {queueLength > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-ping"></span>
              )}
            </span>
            <Sparkles className="w-6 h-6 group-hover:animate-spin" />
          </div>
        </button>

        {/* Bottom Hint */}
        {queueLength === 0 && (
          <p className="mt-6 text-gray-400 text-sm animate-pulse">
            ⬆️ Click to add your first song
          </p>
        )}
      </div>
    </div>
  );
}
