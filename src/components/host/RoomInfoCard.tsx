import { Music2, Users, Copy } from 'lucide-react';

interface RoomInfoCardProps {
  roomName: string;
  hostName: string;
  guestCount: number;
  code: string;
  onCopyCode: () => void;
  copied: boolean;
}

export default function RoomInfoCard({
  roomName,
  hostName,
  guestCount,
  code,
  onCopyCode,
  copied
}: RoomInfoCardProps) {
  return (
    <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-4xl font-bold mb-4 text-white">{roomName}</h1>
          <div className="flex items-center gap-6 text-lg font-medium text-white">
            <div className="flex items-center gap-2">
              <Music2 className="w-6 h-6 text-primary" />
              <span>Host: {hostName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-secondary" />
              <span>{guestCount} Guests</span>
            </div>
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-200 mb-2 font-bold">Party Code</div>
          <button
            onClick={onCopyCode}
            className="flex items-center gap-2 px-8 py-4 bg-transparent border border-white hover:bg-white/10 rounded-xl transition-all shadow-lg"
          >
            <span className="text-3xl font-bold tracking-wider text-white">{code}</span>
            <Copy className="w-6 h-6 text-white" />
          </button>
          {copied && (
            <div className="text-green-300 text-base mt-3 font-bold text-center">Copied!</div>
          )}
        </div>
      </div>
    </div>
  );
}