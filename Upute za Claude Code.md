<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# 🎵 VIBEBOX - UPDATED BUG REPORT \& FIX INSTRUCTIONS FOR CLAUDE CODE

**Last Updated**: 15. Listopada 2025. - 11:42 CEST
**Context**: Based on ChatGPT 5 diagnostic conversation + existing VibeBox architecture

***

## 📋 CRITICAL INFORMATION FOR CLAUDE CODE

### **Project Architecture** (from existing codebase)

- **Frontend**: React 18 + TypeScript + Vite[^1]
- **Backend**: Firebase Firestore (real-time sync)[^1]
- **Music Playback**: YouTube IFrame API (dual-player crossfade system)[^1]
- **Drag \& Drop**: `@dnd-kit` (host), `react-beautiful-dnd` (guest)[^1]
- **Routing**: React Router v7[^1]


### **Key Components**

- `src/components/MusicPlayer.tsx` (786 lines) - Dual-player system with crossfade[^1]
- `src/pages/HostDashboard.tsx` (790 lines) - Host UI \& Firebase listeners[^1]
- `src/pages/GuestView.tsx` (924 lines) - Guest UI \& Firebase listeners[^1]
- `src/components/host/QueueSection.tsx` (476 lines) - Drag \& drop queue[^1]


### **Current Playback Architecture**

**Dual-Player System**: Two YouTube IFrame players (`player1Ref`, `player2Ref`) alternate for seamless crossfade transitions.[^1]

**Role-Based Permissions**:

- **Host**: Full control (default playback device)[^1]
- **DJ**: Playback controls (play/pause/skip/next)[^1]
- **Admin**: Kick guests, transfer roles, settings access[^1]
- **Playback Device**: Device that actually plays audio (can be host or guest)[^1]

***

## 🔴 CRITICAL BUGS (Fix Priority Order)

### **Bug \#1: Infinite Guest Sync Loop** 🔥 HIGHEST PRIORITY

**Symptom**: Console spam:

```
🔄 Syncing guest player: Host is at 143.9s, Guest is at 144.1s. Seeking...
🔄 Syncing guest player: Host is at 144.0s, Guest is at 144.2s. Seeking...
[infinite repeat]
```

**Root Cause Analysis** (based on existing code):

- `syncGuestPlayer()` in `MusicPlayer.tsx` triggers in `onStateChange()` or `setInterval()` without checking who is the **Playback Source**[^1]
- Variable `playbackDevice` is NOT consistently checked before syncing
- ALL clients try to pull timestamp from Firestore `syncTime` field and seek simultaneously
- No cooldown mechanism prevents multiple `seekTo()` calls within short timeframe

**Current Problematic Logic** (likely in `MusicPlayer.tsx` lines 549-565):

```typescript
// ❌ WRONG: Guest syncs to host even when guest IS the playback device
useEffect(() => {
  const interval = setInterval(() => {
    if (!isHost) { // ❌ This is NOT enough!
      syncToHost(); // ❌ Triggers even if guest is playback device
    }
  }, 1000);
}, []);
```

**Fix Required**:

**1. Single Source of Truth in Firestore**:

```typescript
// Firebase schema update (sessions collection):
{
  "code": "ABC123",
  "playbackDevice": "HOST" | "guest_name", // WHO is playing audio
  "currentSong": { ... },
  "syncTime": 1697384923000, // Timestamp when song started
  "isPlaying": true
}
```

**2. Playback Source Logic** (in `MusicPlayer.tsx`):

```typescript
// ✅ CORRECT: Only playback device broadcasts position
const isPlaybackDevice = 
  (isHost && playbackDevice === 'HOST') || 
  (!isHost && playbackDevice === guestName);

useEffect(() => {
  if (isPlaybackDevice) {
    // I'm the active playback device
    const broadcastInterval = setInterval(() => {
      const currentTime = player1Ref.current?.getCurrentTime() || 0;
      updateDoc(sessionRef, {
        syncTime: Date.now() - (currentTime * 1000),
        isPlaying: playerState === 1 // 1 = playing
      });
    }, 1000); // Broadcast every 1s
    
    return () => clearInterval(broadcastInterval);
  } else {
    // I'm a listener (guest/host without playback)
    const syncInterval = setInterval(() => {
      syncToPlaybackDevice();
    }, 2000); // Check sync every 2s (less aggressive)
    
    return () => clearInterval(syncInterval);
  }
}, [isPlaybackDevice, guestName, playbackDevice]);
```

**3. Drift Correction with Cooldown**:

```typescript
// ✅ Prevent infinite seek loop
let lastSyncTimestamp = 0;
const SYNC_COOLDOWN = 2000; // 2 seconds minimum between syncs

const syncToPlaybackDevice = () => {
  if (isPlaybackDevice) return; // ✅ Don't sync if I'm the source!
  
  const now = Date.now();
  if (now - lastSyncTimestamp < SYNC_COOLDOWN) {
    console.log('⏳ Sync cooldown active, skipping...');
    return;
  }
  
  const currentTime = player1Ref.current?.getCurrentTime() || 0;
  const expectedTime = (now - syncTime) / 1000; // syncTime from Firestore
  const drift = Math.abs(currentTime - expectedTime);
  
  if (drift > 3.0) { // Only sync if drift > 3 seconds
    console.log(`🔄 Drift detected: ${drift.toFixed(1)}s, correcting...`);
    player1Ref.current?.seekTo(expectedTime, true);
    lastSyncTimestamp = now;
  }
};
```

**4. Stop Sync on Playback Transfer**:

```typescript
// When transferring playback device:
const transferPlaybackDevice = async (newDeviceId: string) => {
  // Clear all intervals
  clearAllSyncIntervals();
  
  // Update Firestore
  await updateDoc(sessionRef, {
    playbackDevice: newDeviceId,
    syncTime: Date.now() // Reset sync timestamp
  });
  
  // Restart sync logic
  setupPlaybackSync();
};
```

**Files to Modify**:

- `src/components/MusicPlayer.tsx` (main sync logic)
- `src/pages/HostDashboard.tsx` (playback device transfer)
- `src/pages/GuestView.tsx` (playback device transfer)

***

### **Bug \#2: Auto-play Nakon Ponovnog Ulaska u App**

**Symptom**: Kad korisnik zatvori i ponovno otvori aplikaciju, pjesma automatski krene svirati iako je bila pauzirana.[^1]

**Root Cause**:

- `isPlaying` state je `true` u Firestore
- Client automatski pokreće playback pri re-sync
- Nema provjere: "Jesam li ja playback device?"

**Fix Required** (in `MusicPlayer.tsx`):

```typescript
// ✅ Firebase listener for playback state
useEffect(() => {
  const unsubscribe = onSnapshot(sessionRef, (snap) => {
    const data = snap.data();
    
    if (data.isPlaying && !isPlaybackDevice) {
      // ✅ Guest/host without playback: DON'T auto-play
      player1Ref.current?.pauseVideo();
      console.log('⏸️ Not playback device, pausing local player');
    } else if (data.isPlaying && isPlaybackDevice) {
      // ✅ Playback device: Resume playback
      player1Ref.current?.playVideo();
      console.log('▶️ Playback device, resuming playback');
    }
  });
  
  return () => unsubscribe();
}, [isPlaybackDevice]);
```


***

### **Bug \#3: Party Code Predug na Mobitelu**

**Symptom**: Party Code na glavnom ekranu izlazi izvan vidljivog prostora u portrait mode-u.

**Fix Required** (in `HostDashboard.tsx` ili `GuestView.tsx`):

**Option A: Skrati Font i Dodaj Overflow**

```tsx
<div className="text-sm md:text-base font-mono truncate max-w-[150px]">
  Code: {roomCode}
</div>
```

**Option B: Premjesti Gore Desno** (preporučeno)

```tsx
<div className="flex items-center justify-between mb-4">
  <h1 className="text-2xl font-bold">VibeBox Party</h1>
  <div className="flex items-center gap-2">
    <InviteButton />
    <span className="text-xs bg-gray-800 px-3 py-1 rounded-full">
      {roomCode}
    </span>
  </div>
</div>
```

**Files to Modify**:

- `src/pages/HostDashboard.tsx` (header section)
- `src/pages/GuestView.tsx` (header section)

***

### **Bug \#4: DJ Control Transfer Ne Aktivira Odmah Playlistu**

**Symptom**: Kad host da DJ kontrolu gostu, taj gost mora ručno startati playlistu — ne prenosi se automatski `isDJ = true` + `canStart = true`.[^1]

**Current Issue**: DJ role se update-a u Firestore, ali novi DJ ne dobije playback controls odmah.[^1]

**Fix Required** (in `HostDashboard.tsx` and `GuestView.tsx`):

```typescript
// ✅ Host: Transfer DJ control
const transferDJControl = async (guestName: string) => {
  await updateDoc(sessionRef, {
    djName: guestName,
    // ✅ Also update playback device if needed
    playbackDevice: guestName // Or keep as 'HOST' if host wants audio
  });
  
  // ✅ Send notification to new DJ
  await addDoc(collection(db, `sessions/${sessionCode}/notifications`), {
    type: 'dj_assigned',
    targetUser: guestName,
    message: `You are now the DJ! 🎧`,
    timestamp: Date.now()
  });
};

// ✅ Guest: Listen for DJ role assignment
useEffect(() => {
  const unsubscribe = onSnapshot(sessionRef, (snap) => {
    const data = snap.data();
    
    if (data.djName === guestName && !isDJ) {
      setIsDJ(true);
      showToast('You are now the DJ! 🎧', 5000);
      
      // ✅ Auto-start playlist if not playing
      if (!data.isPlaying && data.queue.length > 0) {
        startPlaylist();
      }
    }
  });
  
  return () => unsubscribe();
}, [guestName]);
```

**Files to Modify**:

- `src/pages/HostDashboard.tsx` (transferDJControl function)
- `src/pages/GuestView.tsx` (DJ role listener)

***

### **Bug \#5: Guest List - Nema "Send Message" i "Kick" Za Sve**

**Symptom**: Samo host vidi "kick" i "message" ikone; gosti ih nemaju.

**Expected Behavior**:

- **Svi useri** vide "Send Message" ikonu
- **Samo Host i Admin** vide "Kick" ikonu

**Fix Required** (in `GuestList.tsx` ili gdje se renderira guest lista):

```tsx
{guests.map((guest) => (
  <div key={guest.name} className="flex items-center justify-between">
    <span>{guest.name}</span>
    
    <div className="flex gap-2">
      {/* ✅ Message icon visible to ALL users */}
      <button onClick={() => openChat(guest.name)}>
        <MessageIcon className="w-5 h-5" />
      </button>
      
      {/* ✅ Kick icon only for Host and Admin */}
      {(isHost || isAdmin) && guest.name !== guestName && (
        <button onClick={() => kickUser(guest.name)}>
          <KickIcon className="w-5 h-5 text-red-500" />
        </button>
      )}
      
      {/* ✅ Role badges */}
      {guest.isDJ && <Badge>DJ</Badge>}
      {guest.isAdmin && <Badge>Admin</Badge>}
    </div>
  </div>
))}
```

**Files to Modify**:

- Component that renders guest list (likely in `HostDashboard.tsx` or separate `GuestList.tsx`)

***

### **Bug \#6: "Listen on My Device" Gumb Se Gubi ili Je Neaktivan**

**Symptom**: Gumb se pojavljuje/nestaje, i playback ga ne može kontrolirati kad treba.[^1]

**Current Issue**: Toggle je vidljiv samo na mobile, ne na desktop.[^1]

**Expected Behavior**:

- **Uvijek vidljiv** kod svih usera
- **Disabled** kad si playback device
- **Enabled** kad nisi playback device (možeš uključiti lokalni audio)

**Fix Required** (in `MusicPlayer.tsx`):

```tsx
{/* ✅ Always visible toggle */}
<div className="flex items-center gap-3 mb-4">
  <label className="text-sm font-medium">Listen on My Device</label>
  <Toggle
    checked={isListeningLocally}
    disabled={isPlaybackDevice} // ✅ Disable if user is playback device
    onChange={handleToggleLocalAudio}
  />
  {isPlaybackDevice && (
    <span className="text-xs text-gray-400">
      (You are the playback device)
    </span>
  )}
</div>

{/* Logic */}
const isPlaybackDevice = 
  (isHost && playbackDevice === 'HOST') || 
  (!isHost && playbackDevice === guestName);

const [isListeningLocally, setIsListeningLocally] = useState(!isPlaybackDevice);

const handleToggleLocalAudio = (enabled: boolean) => {
  setIsListeningLocally(enabled);
  
  if (enabled) {
    player1Ref.current?.unMute();
    player1Ref.current?.setVolume(volume);
  } else {
    player1Ref.current?.mute();
  }
};
```

**Files to Modify**:

- `src/components/MusicPlayer.tsx` (toggle UI and logic)

***

### **Bug \#7: Scroll Playlist-e na Mobitelu**

**Symptom**: Nazivi pjesama ne skrolaju i predugi su.

**Fix Required**: CSS animacija za marquee efekt

```css
/* Add to global CSS or component styles */
.song-title {
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  max-width: 200px; /* Adjust based on mobile width */
}

.song-title:hover {
  animation: scroll-text 8s linear infinite;
}

@keyframes scroll-text {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-100%);
  }
}
```

**Alternative**: Use `react-text-marquee` library for better UX

```bash
npm install react-text-marquee
```

```tsx
import Marquee from 'react-text-marquee';

<Marquee className="song-title" speed={30}>
  {song.title}
</Marquee>
```

**Files to Modify**:

- Queue component (where song titles are rendered)
- Global CSS file or Tailwind config

***

## ⚙️ ADDITIONAL IMPROVEMENTS (Preporuke)

### **1. Debug Mode Flag**

```typescript
// Add to .env
VITE_DEBUG_SYNC=true

// Use in MusicPlayer.tsx
const DEBUG = import.meta.env.VITE_DEBUG_SYNC === 'true';

if (DEBUG) {
  console.log('🔄 Syncing guest player:', { currentTime, expectedTime, drift });
}
```


### **2. Sync Cooldown Mechanism**

Already included in Bug \#1 fix (see `SYNC_COOLDOWN` constant).

### **3. Recursion Loop Protection**

```typescript
// ✅ Prevent play/pause recursion
let selfTriggered = false;

const handlePlay = () => {
  if (selfTriggered) {
    selfTriggered = false;
    return;
  }
  
  selfTriggered = true;
  player1Ref.current?.playVideo();
  updateFirestore({ isPlaying: true });
};

const handlePause = () => {
  if (selfTriggered) {
    selfTriggered = false;
    return;
  }
  
  selfTriggered = true;
  player1Ref.current?.pauseVideo();
  updateFirestore({ isPlaying: false });
};
```


***

## 📋 FINAL PRIORITY FIX ORDER FOR CLAUDE CODE

| \# | Bug | Priority | Impact | Files |
| :-- | :-- | :-- | :-- | :-- |
| 1 | Infinite sync loop | 🔴 CRITICAL | App unusable, console spam | `MusicPlayer.tsx` |
| 2 | Auto-play after re-entry | 🔴 CRITICAL | Unexpected behavior | `MusicPlayer.tsx` |
| 3 | "Listen on my device" missing | 🔴 HIGH | Core feature broken | `MusicPlayer.tsx` |
| 4 | DJ control transfer | 🔴 HIGH | Role system broken | `HostDashboard.tsx`, `GuestView.tsx` |
| 5 | Party code overflow | 🟡 MEDIUM | UI issue on mobile | `HostDashboard.tsx`, `GuestView.tsx` |
| 6 | Guest list buttons | 🟡 MEDIUM | Social feature missing | `GuestList.tsx` |
| 7 | Song title scroll | 🟢 LOW | UI polish | Queue component + CSS |


***

## 🚀 TESTING INSTRUCTIONS FOR CLAUDE CODE

**After Each Fix**:

1. **Test playback sync**: Open 2 devices, assign playback to guest, verify NO infinite loop
2. **Test pause/resume**: Close app, reopen, verify playback doesn't auto-start if paused
3. **Test DJ transfer**: Host assigns DJ to guest, verify guest gets controls immediately
4. **Test mobile UI**: Check party code visibility, song title scroll
5. **Test role permissions**: Verify message/kick buttons appear correctly

**Final Integration Test**:

- Create session on device A (host)
- Join on device B (guest)
- Transfer DJ to guest → Verify controls appear
- Transfer playback to guest → Verify host stops playing, guest starts
- Pause and close app → Reopen → Verify doesn't auto-play
- Check console → Verify NO sync loop messages

***

## 🔥 FIRESTORE SCHEMA UPDATE REQUIRED

```typescript
// sessions/{sessionCode}
{
  "code": "ABC123",
  "hostName": "John",
  "roomName": "Party Room",
  "queue": Song[],
  "guests": string[],
  "djName": string, // Who has DJ controls
  "playbackDevice": "HOST" | string, // ✅ WHO plays audio (source of truth)
  "adminUsers": string[],
  "settings": SessionSettings,
  "isPartyStarted": boolean,
  "currentSong": Song | null,
  "syncTime": number, // ✅ Timestamp when song started (ms)
  "isPlaying": boolean // ✅ Is playback active
}
```

**Key Change**: `playbackDevice` field now determines who broadcasts sync position.[^1]

***

**IMPORTANT NOTES FOR CLAUDE CODE**:

- Focus on Bug \#1 (sync loop) FIRST — it's the most critical issue blocking app usage
- Use existing dual-player architecture (don't rewrite entire playback system)[^1]
- Respect existing role-based permission system (Host/DJ/Admin/Playback Device)[^1]
- Test thoroughly after each fix — playback system is fragile
- Use console logs with emoji prefixes for easy debugging (🔄 for sync, ⏸️ for pause, etc.)

<div align="center">⁂</div>

[^1]: VibeBox-pdf-summary.pdf

