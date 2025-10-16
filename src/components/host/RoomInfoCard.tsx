import { Music2, Users } from 'lucide-react';

interface RoomInfoCardProps {
  roomName: string;
  hostName: string;
  guestCount: number;
}

export default function RoomInfoCard({
  roomName,
  hostName,
  guestCount
}: RoomInfoCardProps) {
  return (
    <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 backdrop-blur-sm border border-white/10 rounded-2xl p-4 md:p-6 mb-8">
      {/* 🔴 BUG FIX #6: Room code moved to fixed top-right corner (see HostDashboard) */}
      <div>
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
  );
}