import { Volume2, VolumeX } from 'lucide-react';

interface VolumeControlProps {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMuteToggle: () => void;
  normalization: boolean;
  onNormalizationToggle: () => void;
}

export default function VolumeControl({
  volume,
  isMuted,
  onVolumeChange,
  onMuteToggle,
  normalization,
  onNormalizationToggle
}: VolumeControlProps) {
  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <button 
          onClick={onMuteToggle} 
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-gray-400" />
          ) : (
            <Volume2 className="w-5 h-5 text-white" />
          )}
        </button>
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={volume} 
          onChange={onVolumeChange} 
          className="flex-1 h-1 bg-white/10 rounded-lg" 
        />
        <span className="text-xs text-gray-400 w-10">{volume}%</span>
      </div>
      
      <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white">🔊 Auto Normalize</span>
          <span className="text-xs text-gray-400">(Balance volume levels)</span>
        </div>
        <button 
          onClick={onNormalizationToggle} 
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ 
            normalization ? 'bg-purple-500' : 'bg-gray-600' 
          }`}
        >
          <span 
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${ 
              normalization ? 'translate-x-6' : 'translate-x-1' 
            }`} 
          />
        </button>
      </div>
    </>
  );
}