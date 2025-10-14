// Spotify Web Playback SDK Service
let player: any = null;
let deviceId: string | null = null;

export const initializeSpotifyPlayer = async (accessToken: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (player) {
      resolve(deviceId || '');
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);

    (window as any).onSpotifyWebPlaybackSDKReady = () => {
      player = new (window as any).Spotify.Player({
        name: 'VoteBox Player',
        getOAuthToken: (cb: (token: string) => void) => {
          cb(accessToken);
        },
        volume: 0.7
      });

      player.addListener('initialization_error', ({ message }: any) => {
        console.error('Initialization error:', message);
        reject(message);
      });

      player.addListener('authentication_error', ({ message }: any) => {
        console.error('Authentication error:', message);
        reject(message);
      });

      player.addListener('account_error', ({ message }: any) => {
        console.error('Account error:', message);
        reject(message);
      });

      player.addListener('playback_error', ({ message }: any) => {
        console.error('Playback error:', message);
      });

      player.addListener('ready', ({ device_id }: any) => {
        console.log('Spotify Player Ready with Device ID:', device_id);
        deviceId = device_id;
        resolve(device_id);
      });

      player.addListener('not_ready', ({ device_id }: any) => {
        console.log('Device ID has gone offline', device_id);
      });

      player.addListener('player_state_changed', (state: any) => {
        console.log('Player state changed:', state);
      });

      player.connect();
    };
  });
};

export const playSpotifyTrack = async (trackId: string, accessToken: string) => {
  if (!deviceId) {
    throw new Error('Spotify player not initialized');
  }

  const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      uris: [`spotify:track:${trackId}`]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Spotify play error:', error);
    throw new Error('Failed to play track');
  }
};

export const pauseSpotifyPlayback = async (accessToken: string) => {
  if (!deviceId) return;

  await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
};

export const resumeSpotifyPlayback = async (accessToken: string) => {
  if (!deviceId) return;

  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
};

export const seekSpotifyPlayback = async (positionMs: number, accessToken: string) => {
  if (!deviceId) return;

  await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${positionMs}&device_id=${deviceId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
};

export const setSpotifyVolume = async (volumePercent: number, accessToken: string) => {
  if (!deviceId) return;

  await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${volumePercent}&device_id=${deviceId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
};

export const getSpotifyPlayer = () => player;
export const getSpotifyDeviceId = () => deviceId;
export const disconnectSpotifyPlayer = () => {
  if (player) {
    player.disconnect();
    player = null;
    deviceId = null;
  }
};
