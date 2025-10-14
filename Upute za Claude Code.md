<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# 🎵 VIBEBOX - UPDATED BUG LIST \& FIXES FOR CLAUDE CODE

## 🔴 CRITICAL PRIORITY BUGS (Fix These First)

### **Bug \#1: Playback System Chaos After Pause/Resume**

**Problem**: Nakon što se pauzira i ponovo pusti playlista, aplikacija ne zna više ko kontroliše playback, zapinje, ide u loop, timestamp se gubi.[^1]

**Root Cause**: Playback state management se miješa sa messaging i role transfer sistemom.[^1]

**Fix Required**:

- **Isolate playback logic** from messaging, DJ transfers, and admin operations
- **Separate Firebase listeners**: One for playback state (`currentSong`, `syncTime`, `isPlaying`), separate from role management
- **Add playback state validation**: Before every play/pause/skip, verify who has control
- **Implement state reconciliation**: After pause, clear all pending crossfade timers and reset player states

**Files to Modify**:

- `src/components/MusicPlayer.tsx` (lines 549-565, full playback logic)
- `src/pages/HostDashboard.tsx` (Firebase listeners separation)
- `src/pages/GuestView.tsx` (Firebase listeners separation)

**Implementation Steps**:

```typescript
// 1. Create separate Firebase listener for playback ONLY
useEffect(() => {
  const unsubPlayback = onSnapshot(
    doc(db, 'sessions', sessionCode),
    (snap) => {
      const data = snap.data();
      // ONLY update: currentSong, syncTime, isPlaying, activePlayer
      // DO NOT mix with messages, roles, guests
    }
  );
  return () => unsubPlayback();
}, [sessionCode]);

// 2. Add playback control validation
const handlePlayPause = async () => {
  // Check: Am I the playback device?
  if (playbackDevice !== currentUser) {
    console.warn('Not playback device, ignoring');
    return;
  }
  // Proceed with play/pause
};

// 3. Reset state on pause
const handlePause = () => {
  clearAllCrossfadeTimers();
  resetPlayerStates();
  updateFirebase({ isPlaying: false, syncTime: getCurrentTime() });
};

// 4. Sync validation on resume
const handleResume = () => {
  const currentTime = getCurrentTime();
  updateFirebase({ isPlaying: true, syncTime: currentTime });
  // Force all guests to sync to this exact time
};
```


***

### **Bug \#2: Guest Voting Still Reversed (CRITICAL)**

**Problem**: Kad gost glasa zeleno (palac gore, upvote), pjesma ide na začelje reda. Na hostu radi OK, ali na gostu je sjebano.[^1]

**Root Cause**: `GuestView.tsx` ima invertirane `arrayUnion`/`arrayRemove` operacije ili sort funkcija je pogrešna.

**Fix Required**:

- **Check voting logic in `GuestView.tsx`**: Ensure upvote adds to `upvotes` array, NOT `downvotes`
- **Verify sort function**: Queue should sort by `(upvotes.length - downvotes.length) DESC`
- **Test on both host and guest**: Confirm voting produces identical queue order

**Files to Modify**:

- `src/pages/GuestView.tsx` (voting handlers)

**Implementation**:

```typescript
// CORRECT voting logic:
const handleUpvote = async (songId: string) => {
  await updateDoc(doc(db, 'sessions', sessionCode), {
    [`queue.${songIndex}.upvotes`]: arrayUnion(guestName), // ✅ Add to upvotes
    [`queue.${songIndex}.downvotes`]: arrayRemove(guestName) // ✅ Remove from downvotes
  });
};

const handleDownvote = async (songId: string) => {
  await updateDoc(doc(db, 'sessions', sessionCode), {
    [`queue.${songIndex}.downvotes`]: arrayUnion(guestName), // ✅ Add to downvotes
    [`queue.${songIndex}.upvotes`]: arrayRemove(guestName) // ✅ Remove from upvotes
  });
};

// CORRECT sort function:
const sortedQueue = [...queue].sort((a, b) => {
  const scoreA = (a.upvotes?.length || 0) - (a.downvotes?.length || 0);
  const scoreB = (b.upvotes?.length || 0) - (b.downvotes?.length || 0);
  return scoreB - scoreA; // ✅ Higher score first
});
```


***

### **Bug \#3: "Listen on My Device" Toggle Missing for All Users**

**Problem**: Toggle treba biti **UVIJEK PRISUTAN** kod svih usera. Kad si playback device (host ili gost sa privilegijom), button je **disabled**.[^1]

**Current Behavior**: Toggle se prikazuje samo na mobile, ne na desktop.

**Expected Behavior**:

- **Always visible** for all users (host + guests)
- **Enabled** when user is NOT playback device
- **Disabled** when user IS playback device (shows "You are the playback device")

**Files to Modify**:

- `src/components/MusicPlayer.tsx`

**Implementation**:

```typescript
// Always show toggle (remove mobile-only condition)
<div className="flex items-center gap-2">
  <label>Listen on My Device</label>
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

// Logic:
const isPlaybackDevice = 
  (isHost && playbackDevice === 'HOST') || 
  (!isHost && playbackDevice === guestName);

const isListeningLocally = !isPlaybackDevice; // Auto-enable for non-playback users
```


***

### **Bug \#4: Skip/Next/Previous Toast Only Shows on Initiator Device**

**Problem**: Kad neko skipuje, pausira, ili ide na next/previous song, toast se vidi samo na tom deviceu, ne izlazi na drugim gostima ili hostovima.[^1]

**Fix Required**:

- **Add toast trigger to Firebase**: When host/DJ skips, write to Firestore: `lastAction: { type: 'skip', songTitle: '...', timestamp: Date.now() }`
- **All clients listen for `lastAction`**: Display toast when `lastAction` timestamp changes
- **Auto-dismiss after 2s**: Remove toast locally after timeout

**Files to Modify**:

- `src/components/ToastManager.tsx`
- `src/components/MusicPlayer.tsx` (skip/next/previous handlers)
- Firebase schema: Add `lastAction` field to session document

**Implementation**:

```typescript
// On skip/next/previous:
const handleSkip = async () => {
  await updateDoc(doc(db, 'sessions', sessionCode), {
    lastAction: {
      type: 'skip',
      songTitle: currentSong.title,
      initiator: currentUser,
      timestamp: Date.now()
    }
  });
  // Trigger crossfade
};

// All clients listen:
useEffect(() => {
  const unsub = onSnapshot(doc(db, 'sessions', sessionCode), (snap) => {
    const lastAction = snap.data()?.lastAction;
    if (lastAction && lastAction.timestamp > lastSeenActionTimestamp) {
      showToast(`${lastAction.initiator} skipped to ${lastAction.songTitle}`);
      setLastSeenActionTimestamp(lastAction.timestamp);
    }
  });
  return unsub;
}, [sessionCode]);
```


***

## 🟡 MEDIUM PRIORITY

### **Bug \#5: Guest Message Button Missing**

**Problem**: Gosti moraju ići skroz gore na "Messages" da bi poslali poruku. Nemaju mali button kao host.[^1]

**Fix Required**:

- **Add floating message icon button** (bottom-right) for guests
- **Same UI as host**: Small icon button that opens message modal
- **Position**: Bottom-right corner, fixed position

**Files to Modify**:

- `src/pages/GuestView.tsx`

**Implementation**:

```typescript
// Add floating button in GuestView:
<button
  className="fixed bottom-4 right-4 p-3 bg-purple-600 rounded-full shadow-lg hover:bg-purple-700"
  onClick={() => setShowMessageModal(true)}
>
  <MessageIcon className="w-6 h-6 text-white" />
</button>
```


***

## 🔧 ENHANCED PLAYBACK SYNC REQUIREMENTS

### **Requirement: Bulletproof Sync Regardless of Skip/Seek Operations**

**Goal**: Kolko god skipas ili seekas, playback mora biti **uvijek sinkronizirano i smooth**.[^1]

**Implementation Checklist**:

1. **Drift Correction Algorithm**:
```typescript
// Every 500ms, check sync drift:
useEffect(() => {
  const interval = setInterval(() => {
    if (!isPlaybackDevice) {
      const currentTime = player.getCurrentTime();
      const expectedTime = (Date.now() - syncTime) / 1000;
      const drift = Math.abs(currentTime - expectedTime);
      
      if (drift > 2.0) { // 2s tolerance
        console.warn(`Drift detected: ${drift}s, correcting...`);
        player.seekTo(expectedTime);
      }
    }
  }, 500);
  return () => clearInterval(interval);
}, [syncTime, isPlaybackDevice]);
```

2. **Skip Validation**:
```typescript
// Before every skip, validate playback device:
const handleSkip = () => {
  if (!isPlaybackDevice) {
    console.error('Not playback device, cannot skip');
    return;
  }
  // Clear all timers
  clearAllTimers();
  // Update Firebase with new syncTime
  const newSyncTime = Date.now();
  updateFirebase({ syncTime: newSyncTime, currentSong: nextSong });
};
```

3. **Seek Sync Broadcast**:
```typescript
// When playback device seeks, broadcast to all:
const handleSeek = (newTime: number) => {
  if (!isPlaybackDevice) return;
  
  const newSyncTime = Date.now() - (newTime * 1000);
  updateFirebase({ syncTime: newSyncTime });
  // All guests will auto-sync to this new time
};
```

4. **Crossfade During Seek**:
```typescript
// Pause crossfade if seek happens in last X seconds:
const handleSeek = (newTime: number) => {
  const duration = player.getDuration();
  if (duration - newTime < crossfadeDuration) {
    console.log('Seek in crossfade zone, pausing auto-crossfade');
    clearCrossfadeTimer();
  }
};
```

5. **State Reset on Error**:
```typescript
// If player enters error state, reset completely:
const onPlayerError = () => {
  console.error('Player error, resetting...');
  clearAllTimers();
  player.stopVideo();
  player.loadVideoById(currentSong.id);
  updateFirebase({ syncTime: Date.now() });
};
```


***

## 📋 FINAL CHECKLIST FOR CLAUDE CODE

### **Priority Fix Order**:

| \# | Bug | Priority | Files |
| :-- | :-- | :-- | :-- |
| 1 | Playback chaos after pause/resume | 🔴 CRITICAL | `MusicPlayer.tsx`, `HostDashboard.tsx`, `GuestView.tsx` |
| 2 | Guest voting reversed | 🔴 CRITICAL | `GuestView.tsx` |
| 3 | "Listen on my device" toggle missing | 🔴 CRITICAL | `MusicPlayer.tsx` |
| 4 | Skip/next/previous toast only on initiator | 🔴 CRITICAL | `ToastManager.tsx`, `MusicPlayer.tsx` |
| 5 | Guest message button missing | 🟡 MEDIUM | `GuestView.tsx` |
| 6 | Enhanced playback sync (drift correction) | 🔴 CRITICAL | `MusicPlayer.tsx` |

### **Testing Requirements**:

1. **Test playback after pause/resume**: No loops, no timestamp loss
2. **Test voting on guest**: Upvote moves song UP in queue (not down)
3. **Test "Listen on my device" toggle**: Visible for all, disabled for playback device
4. **Test skip/next toast**: Appears on ALL devices, not just initiator
5. **Test heavy skip/seek usage**: Playback stays synced, no audio jumps
6. **Test role changes**: Messaging and admin changes don't break playback

### **Code Architecture Requirements**:

- **Separate Firebase listeners**: Playback state separate from roles/messaging
- **Validation on every action**: Check `isPlaybackDevice` before play/pause/skip
- **Drift correction**: Run every 500ms for non-playback devices
- **Error handling**: Reset player state on errors, don't crash
- **Toast broadcasting**: Use Firebase `lastAction` field for global notifications

***

## 🚀 DEPLOYMENT INSTRUCTIONS FOR CLAUDE CODE

```bash
# 1. Test locally first:
npm run dev

# 2. Test with multiple devices:
# - Open http://localhost:5173 on 2+ devices
# - Create session, join as guest
# - Test all 6 bugs above

# 3. Deploy to Firebase:
npm run build
firebase deploy --only hosting

# 4. Verify on live URL:
# https://vibebox-58735465-afa10.web.app/
```


***

**Note**: Fokusiraj se PRVO na playback system (Bug \#1, \#6) jer to je najkriticnije. Nakon toga ispravi voting (\#2), toggle (\#3), toast (\#4), i na kraju message button (\#5).[^1]

<div align="center">⁂</div>

[^1]: VibeBox-pdf-summary.pdf

