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
    <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 backdrop-blur-sm border border-white/10 rounded-2xl p-4 md:p-6 mb-8">
      {/* ✅ BUG FIX #5: Mobile-responsive layout - party code top right on mobile */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Party Code - Top on mobile, Right on desktop */}
        <div className="flex items-center justify-between md:order-2">
          <div className="text-center md:text-right">
            <div className="text-xs md:text-sm text-gray-200 mb-1 md:mb-2 font-bold">Party Code</div>
            <button
              onClick={onCopyCode}
              className="flex items-center gap-2 px-3 py-2 md:px-6 md:py-3 bg-transparent border border-white hover:bg-white/10 rounded-lg md:rounded-xl transition-all shadow-lg"
            >
              <span className="text-lg md:text-2xl lg:text-3xl font-bold tracking-wider text-white">{code}</span>
              <Copy className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-white" />
            </button>
            {copied && (
              <div className="text-green-300 text-sm md:text-base mt-2 md:mt-3 font-bold text-center">Copied!</div>
            )}
          </div>
        </div>

        {/* Room Info - Bottom on mobile, Left on desktop */}
        <div className="md:order-1">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 md:mb-4 text-white">{roomName}</h1>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-sm md:text-base lg:text-lg font-medium text-white">
            <div className="flex items-center gap-2">
              <Music2 className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              <span>Host: {hostName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 md:w-6 md:h-6 text-secondary" />
              <span>{guestCount} Guests</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}