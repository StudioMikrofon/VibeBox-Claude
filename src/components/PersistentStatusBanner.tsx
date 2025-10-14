import { UserRole } from '../types/session';

interface PersistentStatusBannerProps {
  role: UserRole;
  roomName: string;
  guestCount?: number;
  isDJ?: boolean;
  isAdmin?: boolean;
  isPlaybackDevice?: boolean;
}

export default function PersistentStatusBanner({
  role,
  roomName,
  guestCount,
  isDJ = false,
  isAdmin = false,
  isPlaybackDevice = false
}: PersistentStatusBannerProps) {

  // FIX: Ako imaš SVE 3 ROLE - prikaži SVI 3 BANNERA
  if (isDJ && isAdmin && isPlaybackDevice) {
    return (
      <div className="space-y-3 mb-6">
        {/* DJ BANNER */}
        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-sm border border-yellow-500/30 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎧</span>
              <div>
                <p className="text-white font-bold text-lg">YOU ARE THE DJ</p>
                <p className="text-white/70 text-sm">Full playback control & queue management</p>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-yellow-500/20 rounded-lg text-yellow-400 text-xs font-semibold">
              DJ ACTIVE
            </div>
          </div>
        </div>

        {/* ADMIN BANNER */}
        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm border border-purple-500/30 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🛡️</span>
              <div>
                <p className="text-white font-bold text-lg">ADMIN PRIVILEGES</p>
                <p className="text-white/70 text-sm">You can manage users, access settings, and kick members</p>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-purple-500/20 rounded-lg text-purple-400 text-xs font-semibold">
              ADMIN
            </div>
          </div>
        </div>

        {/* PLAYBACK BANNER */}
        <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-sm border border-blue-500/30 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔊</span>
              <div>
                <p className="text-white font-bold text-lg">PLAYBACK DEVICE</p>
                <p className="text-white/70 text-sm">Audio is playing from YOUR device. Don't close!</p>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-blue-500/20 rounded-lg text-blue-400 text-xs font-semibold animate-pulse">
              🔊 LIVE
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ako si DJ I Playback (ALI ne Admin)
  if (isDJ && isPlaybackDevice) {
    return (
      <div className="space-y-3 mb-6">
        {/* DJ BANNER */}
        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-sm border border-yellow-500/30 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎧</span>
              <div>
                <p className="text-white font-bold text-lg">YOU ARE THE DJ</p>
                <p className="text-white/70 text-sm">Full playback control & queue management</p>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-yellow-500/20 rounded-lg text-yellow-400 text-xs font-semibold">
              DJ ACTIVE
            </div>
          </div>
        </div>

        {/* PLAYBACK BANNER */}
        <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-sm border border-blue-500/30 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔊</span>
              <div>
                <p className="text-white font-bold text-lg">PLAYBACK DEVICE</p>
                <p className="text-white/70 text-sm">Audio is playing from YOUR device. Don't close!</p>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-blue-500/20 rounded-lg text-blue-400 text-xs font-semibold animate-pulse">
              🔊 LIVE
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ako si DJ I Admin (ALI ne Playback)
  if (isDJ && isAdmin) {
    return (
      <div className="space-y-3 mb-6">
        {/* DJ BANNER */}
        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-sm border border-yellow-500/30 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎧</span>
              <div>
                <p className="text-white font-bold text-lg">YOU ARE THE DJ</p>
                <p className="text-white/70 text-sm">Full playback control & queue management</p>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-yellow-500/20 rounded-lg text-yellow-400 text-xs font-semibold">
              DJ ACTIVE
            </div>
          </div>
        </div>

        {/* ADMIN BANNER */}
        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm border border-purple-500/30 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🛡️</span>
              <div>
                <p className="text-white font-bold text-lg">ADMIN PRIVILEGES</p>
                <p className="text-white/70 text-sm">You can manage users, access settings, and kick members</p>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-purple-500/20 rounded-lg text-purple-400 text-xs font-semibold">
              ADMIN
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ako si Admin I Playback (ALI ne DJ)
  if (isAdmin && isPlaybackDevice) {
    return (
      <div className="space-y-3 mb-6">
        {/* ADMIN BANNER */}
        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm border border-purple-500/30 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🛡️</span>
              <div>
                <p className="text-white font-bold text-lg">ADMIN PRIVILEGES</p>
                <p className="text-white/70 text-sm">You can manage users, access settings, and kick members</p>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-purple-500/20 rounded-lg text-purple-400 text-xs font-semibold">
              ADMIN
            </div>
          </div>
        </div>

        {/* PLAYBACK BANNER */}
        <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-sm border border-blue-500/30 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔊</span>
              <div>
                <p className="text-white font-bold text-lg">PLAYBACK DEVICE</p>
                <p className="text-white/70 text-sm">Audio is playing from YOUR device. Don't close!</p>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-blue-500/20 rounded-lg text-blue-400 text-xs font-semibold animate-pulse">
              🔊 LIVE
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ako si samo DJ
  if (isDJ) {
    return (
      <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-sm border border-yellow-500/30 rounded-2xl p-4 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎧</span>
            <div>
              <p className="text-white font-bold text-lg">YOU ARE THE DJ</p>
              <p className="text-white/70 text-sm">Full playback control & queue management</p>
            </div>
          </div>
          <div className="px-3 py-1.5 bg-yellow-500/20 rounded-lg text-yellow-400 text-xs font-semibold">
            DJ ACTIVE
          </div>
        </div>
      </div>
    );
  }

  // Ako si samo Admin
  if (isAdmin) {
    return (
      <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm border border-purple-500/30 rounded-2xl p-4 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🛡️</span>
            <div>
              <p className="text-white font-bold text-lg">ADMIN PRIVILEGES</p>
              <p className="text-white/70 text-sm">You can manage users, access settings, and kick members</p>
            </div>
          </div>
          <div className="px-3 py-1.5 bg-purple-500/20 rounded-lg text-purple-400 text-xs font-semibold">
            ADMIN
          </div>
        </div>
      </div>
    );
  }

  // Ako si samo Playback Device
  if (isPlaybackDevice) {
    return (
      <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-sm border border-blue-500/30 rounded-2xl p-4 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔊</span>
            <div>
              <p className="text-white font-bold text-lg">YOU ARE THE PLAYBACK DEVICE</p>
              <p className="text-white/70 text-sm">Audio is playing from YOUR device. Don't close!</p>
            </div>
          </div>
          <div className="px-3 py-1.5 bg-blue-500/20 rounded-lg text-blue-400 text-xs font-semibold animate-pulse">
            🔊 LIVE
          </div>
        </div>
      </div>
    );
  }

  // Default banners (Host/Guest)
  const getBannerContent = () => {
    switch (role) {
      case 'host':
        return {
          icon: '👤',
          text: `Host Mode | Room: ${roomName}`,
          subText: guestCount ? `${guestCount} guests` : '',
          color: 'from-purple-600/20 to-pink-600/20',
          border: 'border-purple-500/30'
        };

      case 'guest':
      default:
        return {
          icon: '👤',
          text: `Guest Mode | Room: ${roomName}`,
          subText: guestCount ? `${guestCount} guests` : '',
          color: 'from-gray-600/20 to-gray-700/20',
          border: 'border-gray-500/30'
        };
    }
  };

  const banner = getBannerContent();

  return (
    <div className={`bg-gradient-to-r ${banner.color} backdrop-blur-sm border ${banner.border} rounded-2xl p-4 mb-6 shadow-lg`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{banner.icon}</span>
          <div>
            <p className="text-white font-bold text-lg">{banner.text}</p>
            {banner.subText && (
              <p className="text-white/70 text-sm">{banner.subText}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
