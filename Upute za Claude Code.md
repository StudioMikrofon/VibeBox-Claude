<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# 🎵 VIBEBOX - CRITICAL PLAYBACK REWRITE \& BUG FIXES FOR CLAUDE CODE

**Date**: 15. Listopada 2025. - 19:46 CEST
**Priority**: 🔴 **HIGHEST** - Smooth, uninterrupted playback is \#1 priority for this app

***

## 🚨 CRITICAL INSTRUCTION FOR CLAUDE CODE

**COMPLETE PLAYBACK MAKEOVER REQUIRED**

You must **thoroughly review and rewrite the entire playback system** to ensure:

1. **Smooth and uninterrupted playback** is the \#1 priority[^1]
2. **Complete isolation**: Playback logic must be **completely separated** from all other app functions
3. **Zero interference**: Nothing should affect playback — not voting, not screen lock on guest devices, not adding songs, not any other user interactions
4. **Single source of truth**: Only ONE device (playback device) controls audio; all others sync passively
5. **Robust sync system**: Create a new, reliable synchronization mechanism that works regardless of network conditions or user actions

***

## 🎯 PLAYBACK SYSTEM REQUIREMENTS

### **Core Principles**

**Playback Must Be Isolated From**:

- Voting system (upvote/downvote)
- Adding/removing songs from queue
- Guest list updates
- Message system
- Screen lock/unlock on mobile devices
- App switching (going to WhatsApp and returning)
- Role transfers (DJ, Admin, Playback Device)
- Settings changes
- Any UI interactions

**Architecture Pattern**:

```typescript
// ✅ CORRECT: Separate Firebase listeners
useEffect(() => {
  // Listener 1: ONLY playback state
  const unsubPlayback = onSnapshot(
    doc(db, 'sessions', sessionCode),
    (snap) => {
      const { currentSong, syncTime, isPlaying, playbackDevice } = snap.data();
      // Handle ONLY playback updates
      handlePlaybackUpdate({ currentSong, syncTime, isPlaying, playbackDevice });
    },
    { includeMetadataChanges: false } // Ignore local writes
  );

  // Listener 2: Queue and voting (separate)
  const unsubQueue = onSnapshot(
    doc(db, 'sessions', sessionCode),
    (snap) => {
      const { queue } = snap.data();
      // Handle ONLY queue updates (no playback logic here!)
      setQueue(queue);
    }
  );

  // Listener 3: Social features (separate)
  const unsubSocial = onSnapshot(
    doc(db, 'sessions', sessionCode),
    (snap) => {
      const { guests, messages } = snap.data();
      // Handle ONLY social updates
      setGuests(guests);
      setMessages(messages);
    }
  );

  return () => {
    unsubPlayback();
    unsubQueue();
    unsubSocial();
  };
}, [sessionCode]);
```


***

## 🔴 CRITICAL BUGS TO FIX

### **Bug \#1: Playback Behaves Erratically**

**Symptoms**:

- Playback sometimes starts by itself
- When a second user connects, playback stops
- Playback doesn't exit properly (stays in loop or undefined state)

**Root Cause**: Multiple clients competing for playback control; no clear "single source of truth".[^1]

**Fix Instructions**:

1. **Enforce Single Playback Device**:
```typescript
// Only ONE device broadcasts playback position
const isPlaybackDevice = 
  (isHost && playbackDevice === 'HOST') || 
  (!isHost && playbackDevice === guestName);

if (isPlaybackDevice) {
  // I broadcast position every 1s
  broadcastPlaybackPosition();
} else {
  // I passively sync to playback device
  syncToPlaybackDevice();
}
```

2. **Prevent Auto-Start on Guest Join**:
```typescript
// When guest joins, do NOT trigger play
useEffect(() => {
  const unsubscribe = onSnapshot(sessionRef, (snap) => {
    const data = snap.data();
    
    // ✅ Only playback device can start playback
    if (data.isPlaying && !isPlaybackDevice) {
      player1Ref.current?.pauseVideo(); // Force pause for non-playback devices
      console.log('⏸️ Guest joined, but I am not playback device');
    }
  });
}, [isPlaybackDevice]);
```

3. **Clear Exit Logic**:
```typescript
// On unmount or disconnect, clean up properly
useEffect(() => {
  return () => {
    clearAllPlaybackTimers();
    player1Ref.current?.stopVideo();
    player2Ref.current?.stopVideo();
    console.log('🛑 Playback cleaned up');
  };
}, []);
```

**Files**: `src/components/MusicPlayer.tsx` (lines 549-565 and full playback logic)[^1]

***

### **Bug \#2: Guest List Blurs on Host View**

**Symptom**: Guest list is clear initially, then becomes blurred (zamagljen) after some time.

**Fix Instructions**:

- Search for CSS classes like `blur-sm`, `backdrop-blur`, or `filter: blur()` on the guest list container
- Remove ALL blur effects from host view
- Ensure guest list is always sharp and readable

**Example Fix**:

```tsx
// ❌ WRONG:
<div className="guest-list blur-sm">

// ✅ CORRECT:
<div className="guest-list">
```

**Files**: `src/pages/HostDashboard.tsx` (guest list rendering section)

***

### **Bug \#3: Guest Auto-Rejoin After App Switch**

**Symptom**:

- Guest leaves app (e.g., goes to WhatsApp) and returns
- Guest must manually re-enter username to rejoin
- First time: Manual join required ✅
- Second time and after: Should auto-rejoin ❌ (currently broken)

**Fix Instructions**:

1. **Save Guest Name to LocalStorage**:
```typescript
// On first join:
const handleJoin = (username: string, sessionCode: string) => {
  localStorage.setItem(`vibebox_guest_${sessionCode}`, username);
  localStorage.setItem('vibebox_lastSession', sessionCode);
  // Proceed with join logic
};
```

2. **Auto-Rejoin on App Resume**:
```typescript
// On component mount (GuestView):
useEffect(() => {
  const savedUsername = localStorage.getItem(`vibebox_guest_${sessionCode}`);
  
  if (savedUsername && !isJoined) {
    console.log(`🔄 Auto-rejoining as ${savedUsername}`);
    handleAutoRejoin(savedUsername);
  }
}, [sessionCode]);

const handleAutoRejoin = async (username: string) => {
  setGuestName(username);
  setIsJoined(true);
  
  // Add to Firebase guests array (if not already present)
  const sessionRef = doc(db, 'sessions', sessionCode);
  await updateDoc(sessionRef, {
    guests: arrayUnion(username)
  });
  
  showToast(`Welcome back, ${username}! 🎉`);
};
```

**Files**: `src/pages/GuestView.tsx` (join logic and useEffect)

***

### **Bug \#4: Message Icon Visibility Issues**

**Symptom**:

- Message icon is invisible for some users
- For some users, it appears only when hovering over the user in guest list
- For others, it appears only when clicking on the user
- Must be **always visible** for all users

**Fix Instructions**:

1. **Remove Hover/Click-Only Visibility**:
```tsx
// ❌ WRONG:
<button className="opacity-0 hover:opacity-100">
  <MessageIcon />
</button>

// ❌ WRONG:
{isSelected && <MessageIcon />}

// ✅ CORRECT:
<button className="text-blue-500 hover:text-blue-700">
  <MessageIcon className="w-5 h-5" />
</button>
```

2. **Always Render Icon**:
```tsx
{guests.map((guest) => (
  <div key={guest.name} className="flex items-center justify-between p-2">
    <span>{guest.name}</span>
    
    {/* ✅ Always visible */}
    <button 
      onClick={() => openMessageModal(guest.name)}
      className="text-blue-500 hover:text-blue-700 transition-colors"
    >
      <MessageIcon className="w-5 h-5" />
    </button>
  </div>
))}
```

**Files**: `src/pages/HostDashboard.tsx` or guest list component

***

### **Bug \#5: "Listen on My Device" Only for Guests**

**Symptom**:

- "Listen on my device" toggle should **only appear for guests**, NOT for host
- Sometimes it disappears even after initially appearing

**Fix Instructions**:

1. **Guest-Only Rendering**:
```tsx
// In MusicPlayer.tsx or GuestView.tsx
{!isHost && (
  <div className="flex items-center gap-3 mb-4">
    <label className="text-sm font-medium">Listen on My Device</label>
    <Toggle
      checked={isListeningLocally}
      disabled={isPlaybackDevice}
      onChange={handleToggleLocalAudio}
    />
    {isPlaybackDevice && (
      <span className="text-xs text-gray-400">
        (You are the playback device)
      </span>
    )}
  </div>
)}
```

2. **Prevent Disappearance**:
```typescript
// Keep toggle state persistent
const [isListeningLocally, setIsListeningLocally] = useState(() => {
  const saved = localStorage.getItem(`vibebox_listen_${sessionCode}_${guestName}`);
  return saved ? JSON.parse(saved) : !isPlaybackDevice;
});

useEffect(() => {
  localStorage.setItem(
    `vibebox_listen_${sessionCode}_${guestName}`,
    JSON.stringify(isListeningLocally)
  );
}, [isListeningLocally, sessionCode, guestName]);
```

**Files**: `src/components/MusicPlayer.tsx`, `src/pages/GuestView.tsx`[^1]

***

### **Bug \#6: "Listen on My Device" Alters Playback**

**Symptom**: Toggling "Listen on my device" interrupts, pauses, or alters the main playback for all users.

**Fix Instructions**:

**Critical Rule**: Local audio toggle must **NEVER** update Firebase or affect global playback state!

```typescript
// ✅ CORRECT: Local-only effect
const handleToggleLocalAudio = (enabled: boolean) => {
  setIsListeningLocally(enabled);
  
  // ✅ Only affect local player, no Firebase updates!
  if (enabled) {
    player1Ref.current?.unMute();
    player1Ref.current?.setVolume(volume);
  } else {
    player1Ref.current?.mute();
  }
  
  // ❌ DO NOT do this:
  // updateDoc(sessionRef, { isPlaying: false }); // WRONG!
  // player1Ref.current?.pauseVideo(); // WRONG!
};
```

**Files**: `src/components/MusicPlayer.tsx` (toggle handler)[^1]

***

## 🔧 COMPLETE PLAYBACK SYNC REWRITE

### **New Sync Architecture**

```typescript
// MusicPlayer.tsx - Rewritten sync logic

let syncIntervalId: NodeJS.Timeout | null = null;
let broadcastIntervalId: NodeJS.Timeout | null = null;
const SYNC_CHECK_INTERVAL = 2000; // Check sync every 2s
const BROADCAST_INTERVAL = 1000; // Broadcast position every 1s
const DRIFT_THRESHOLD = 3.0; // Max 3s drift before correction
const SYNC_COOLDOWN = 2000; // Min 2s between sync corrections
let lastSyncTimestamp = 0;

// Clear all timers
const clearAllPlaybackTimers = () => {
  if (syncIntervalId) clearInterval(syncIntervalId);
  if (broadcastIntervalId) clearInterval(broadcastIntervalId);
  syncIntervalId = null;
  broadcastIntervalId = null;
};

// Playback device: Broadcast position
const startBroadcasting = () => {
  clearAllPlaybackTimers();
  
  broadcastIntervalId = setInterval(() => {
    if (!isPlaybackDevice) {
      clearInterval(broadcastIntervalId!);
      return;
    }
    
    const currentTime = player1Ref.current?.getCurrentTime() || 0;
    const newSyncTime = Date.now() - (currentTime * 1000);
    
    updateDoc(sessionRef, {
      syncTime: newSyncTime,
      isPlaying: player1Ref.current?.getPlayerState() === 1
    }).catch((err) => console.error('Broadcast error:', err));
  }, BROADCAST_INTERVAL);
};

// Non-playback devices: Sync to playback device
const startSyncing = () => {
  clearAllPlaybackTimers();
  
  syncIntervalId = setInterval(() => {
    if (isPlaybackDevice) {
      clearInterval(syncIntervalId!);
      return;
    }
    
    const now = Date.now();
    if (now - lastSyncTimestamp < SYNC_COOLDOWN) {
      return; // Cooldown active
    }
    
    const currentTime = player1Ref.current?.getCurrentTime() || 0;
    const expectedTime = (now - syncTime) / 1000;
    const drift = Math.abs(currentTime - expectedTime);
    
    if (drift > DRIFT_THRESHOLD) {
      console.log(`🔄 Drift: ${drift.toFixed(1)}s, correcting...`);
      player1Ref.current?.seekTo(expectedTime, true);
      lastSyncTimestamp = now;
    }
  }, SYNC_CHECK_INTERVAL);
};

// Initialize sync based on role
useEffect(() => {
  clearAllPlaybackTimers();
  
  if (isPlaybackDevice) {
    console.log('📡 Starting broadcast mode');
    startBroadcasting();
  } else {
    console.log('🔄 Starting sync mode');
    startSyncing();
  }
  
  return () => clearAllPlaybackTimers();
}, [isPlaybackDevice, guestName, playbackDevice]);
```

**Files**: `src/components/MusicPlayer.tsx` (complete rewrite of sync logic)[^1]

***

## 📋 TESTING CHECKLIST FOR CLAUDE CODE

After implementing all fixes, test the following scenarios:

### **Playback Tests**:

- [ ] Host starts playback → Guest joins → Playback continues smoothly (no stop/restart)
- [ ] Guest assigned as playback device → Host audio stops, guest audio starts
- [ ] Playback device leaves → New playback device assigned → Seamless transition
- [ ] Skip/Next/Previous → All devices sync within 2 seconds
- [ ] Pause/Resume → All devices respond correctly
- [ ] Screen lock on mobile → Playback continues uninterrupted


### **Voting \& Queue Tests**:

- [ ] Upvote song → Playback NOT affected
- [ ] Downvote song → Playback NOT affected
- [ ] Add song to queue → Playback NOT affected
- [ ] Remove song from queue → Playback NOT affected


### **Guest Rejoin Tests**:

- [ ] Guest joins first time → Manual username entry ✅
- [ ] Guest switches to WhatsApp → Returns to VibeBox → Auto-rejoins ✅
- [ ] Guest closes app → Reopens → Auto-rejoins ✅


### **UI Tests**:

- [ ] Guest list is NEVER blurred on host view
- [ ] Message icon is ALWAYS visible for every guest
- [ ] "Listen on my device" toggle only appears for guests, NOT host
- [ ] Toggling "Listen on my device" does NOT affect global playback


### **Console Tests**:

- [ ] No infinite sync loop messages
- [ ] No playback errors in console
- [ ] Clear logs showing who is playback device

***

## 🚀 IMPLEMENTATION PRIORITY

| \# | Task | Priority | Files |
| :-- | :-- | :-- | :-- |
| 1 | Complete playback sync rewrite | 🔴 CRITICAL | `MusicPlayer.tsx` |
| 2 | Isolate playback from voting/queue | 🔴 CRITICAL | `MusicPlayer.tsx`, `GuestView.tsx`, `HostDashboard.tsx` |
| 3 | Fix playback device enforcement | 🔴 CRITICAL | `MusicPlayer.tsx` |
| 4 | Fix guest auto-rejoin | 🔴 HIGH | `GuestView.tsx` |
| 5 | Fix guest list blur on host | 🔴 HIGH | `HostDashboard.tsx` |
| 6 | Fix message icon visibility | 🔴 HIGH | `HostDashboard.tsx` or guest list component |
| 7 | Fix "Listen on my device" (guests only) | 🟡 MEDIUM | `MusicPlayer.tsx`, `GuestView.tsx` |
| 8 | Prevent "Listen on my device" from altering playback | 🔴 CRITICAL | `MusicPlayer.tsx` |


***

## 🔥 FINAL INSTRUCTIONS FOR CLAUDE CODE

1. **Start with playback rewrite** (Bug \#1, \#6, \#8) — This is the foundation
2. **Test playback thoroughly** before moving to other bugs
3. **Isolate ALL playback logic** from social features, voting, and queue management
4. **Use separate Firebase listeners** for playback vs. other features
5. **Add comprehensive console logs** with emoji prefixes for easy debugging
6. **Respect existing dual-player architecture** — don't rewrite everything, just fix sync logic[^1]
7. **Test on multiple devices** (host + 2 guests minimum) before considering complete

**Remember**: Smooth, uninterrupted playback is the \#1 priority for this entire app.[^1]

<div align="center">⁂</div>

[^1]: VibeBox-pdf-summary.pdf

