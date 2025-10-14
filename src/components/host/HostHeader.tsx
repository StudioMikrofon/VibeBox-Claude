import { ArrowLeft, Settings, Share2 } from 'lucide-react';

interface HostHeaderProps {
  onLeave: () => void;
  onSettingsClick: () => void;
  onInviteClick: () => void;
}

export default function HostHeader({ onLeave, onSettingsClick, onInviteClick }: HostHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-4">
        <button
          onClick={onLeave}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Leave Party</span>
        </button>
      </div>
      
      <div className="flex items-center gap-3">
        <button
          onClick={onSettingsClick}
          className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
        >
          <Settings className="w-6 h-6" />
        </button>
        <button
          onClick={onInviteClick}
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl transition-all shadow-lg"
        >
          <Share2 className="w-5 h-5" />
          <span className="font-semibold">Invite</span>
        </button>
      </div>
    </div>
  );
}