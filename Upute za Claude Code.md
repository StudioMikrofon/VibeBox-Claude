<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# 🚨 CRITICAL PLAYBACK BUG ANALYSIS \#2 - Multiple Fatal Issues

## ⚠️ ROOT CAUSES IDENTIFIED

### **Issue \#1: Infinite Clear/Restart Loop** 🔥 MOST CRITICAL

**Evidence**:

```
📡 Broadcasting syncTime: 1760572620918, currentTime: 0.0s
🧹 Cleanup: clearing broadcast interval
📡 Starting broadcast mode (1s interval)
📡 Broadcasting syncTime: 1760572621933, currentTime: 0.0s
🧹 Cleanup: clearing broadcast interval
📡 Starting broadcast mode (1s interval)
[repeats infinitely]
```

**Problem**: The broadcast interval is being **cleared and restarted every single second**. This means:

- Interval broadcasts once
- Immediately gets cleared
- Immediately restarts
- Broadcasts again
- Gets cleared again
- Infinite loop

**Root Cause**: The `useEffect` that manages broadcasting is re-running on **every broadcast** because Firebase updates are triggering it. This creates a vicious cycle:

1. Broadcast updates Firebase →
2. Firebase update triggers `useEffect` →
3. `useEffect` clears and restarts interval →
4. Interval broadcasts again →
5. Back to step 1

***

### **Issue \#2: YouTube API 503 Service Unavailable** 🔥 CRITICAL

**Evidence**:

```
POST https://www.youtube.com/youtubei/v1/embedded_player?prettyPrint=false 503 (Service Unavailable)
POST https://www.youtube.com/youtubei/v1/player?prettyPrint=false 503 (Service Unavailable)
[repeated 3+ times]
```

**Problem**: YouTube API is returning **503 errors** (service unavailable). This could be due to:

- Rate limiting from too many API requests
- YouTube temporarily blocking your IP/domain
- Network issue
- Invalid API key or domain restrictions

**Consequence**: Player cannot load videos, stays stuck at 0s.

***

### **Issue \#3: TypeError - Cannot Read `toFixed` of Undefined**

**Evidence**:

```
Uncaught TypeError: Cannot read properties of undefined (reading 'toFixed')
    at index-C6WTnL0D.js:3390:10556
```

**Problem**: Code is trying to call `.toFixed()` on `undefined`. This happens when:

```typescript
const currentTime = player1Ref.current?.getCurrentTime(); // Returns undefined
console.log(`currentTime: ${currentTime.toFixed(1)}s`); // ❌ Crashes!
```

**Root Cause**: Player is not ready yet, so `getCurrentTime()` returns `undefined`.

***

### **Issue \#4: Broadcast Running Even When Paused**

**Evidence**:

```
🔄 isPlaying changed: false isPlaybackDevice: true
⏸️ IMMEDIATE pauseVideo() call (playback device)
📡 Broadcasting syncTime: 1760572637111, currentTime: 0.0s
📡 Broadcasting syncTime: 1760572638124, currentTime: 0.0s
[continues broadcasting even though paused]
```

**Problem**: Broadcast interval continues running even when `isPlaying: false`. This wastes resources and causes unnecessary Firebase writes.

***

### **Issue \#5: useEffect Dependency Hell**

**Problem**: The `useEffect` that manages broadcast/sync is triggering on **every Firebase update**, causing the infinite clear/restart loop.

**Likely Code** (in `MusicPlayer.tsx`):

```typescript
// ❌ WRONG: Re-runs on every Firebase update
useEffect(() => {
  if (isPlaybackDevice) {
    startBroadcasting();
  }
  return () => clearAllPlaybackTimers();
}, [isPlaybackDevice, isPlaying, currentSong, syncTime]); // ❌ Too many deps!
```

When `startBroadcasting()` updates `syncTime` in Firebase, it triggers this `useEffect` again, which clears and restarts the interval.

***

## 🔧 COMPREHENSIVE FIX FOR CLAUDE CODE

### **Fix \#1: Stop Infinite useEffect Loop** 🔴 HIGHEST PRIORITY

```typescript
// MusicPlayer.tsx

// ❌ DELETE THIS:
// useEffect with too many dependencies that cause infinite loop

// ✅ ADD THIS: Separate effects for different concerns

// Effect 1: Initialize broadcast/sync based on playback device role (ONCE)
useEffect(() => {
  console.log(`🎛️ Playback device changed: ${isPlaybackDevice ? 'BROADCAST' : 'SYNC'}`);
  
  clearAllPlaybackTimers();
  
  if (isPlaybackDevice) {
    startBroadcasting();
  } else {
    startSyncing();
  }
  
  return () => {
    console.log('🧹 Unmounting: clearing all timers');
    clearAllPlaybackTimers();
  };
}, [isPlaybackDevice]); // ✅ ONLY re-run when playback device role changes

// Effect 2: Handle play/pause WITHOUT restarting intervals
useEffect(() => {
  console.log(`🔄 Play state changed: ${isPlaying}`);
  
  // DO NOT restart intervals here!
  // Just play/pause the player
  if (isPlaybackDevice) {
    if (isPlaying) {
      player1Ref.current?.playVideo();
      console.log('▶️ Playing (no interval restart)');
    } else {
      player1Ref.current?.pauseVideo();
      console.log('⏸️ Paused (no interval restart)');
    }
  }
  
  // ✅ NO cleanup, NO interval restart
}, [isPlaying, isPlaybackDevice]);

// Effect 3: Handle song changes WITHOUT restarting intervals
useEffect(() => {
  if (!currentSong) return;
  
  console.log(`🎵 Song changed: ${currentSong.title}`);
  
  // Load new song, but DON'T restart broadcast interval
  const activePlayer = activePlayerRef.current === 1 ? player1Ref : player2Ref;
  activePlayer.current?.loadVideoById(currentSong.id);
  
  if (isPlaybackDevice && isPlaying) {
    activePlayer.current?.playVideo();
  }
  
  // ✅ NO cleanup, NO interval restart
}, [currentSong?.id]); // Only when song ID changes
```


***

### **Fix \#2: Stop Broadcasting When Paused**

```typescript
// MusicPlayer.tsx

const startBroadcasting = () => {
  clearAllPlaybackTimers();
  
  console.log('📡 Starting broadcast mode (1s interval)');
  
  broadcastIntervalId = setInterval(() => {
    // ✅ Check if still playback device
    if (!isPlaybackDevice) {
      console.log('⚠️ No longer playback device, stopping broadcast');
      clearAllPlaybackTimers();
      return;
    }
    
    // ✅ Don't broadcast if paused (save Firebase writes)
    const playerState = player1Ref.current?.getPlayerState();
    if (playerState !== 1) { // 1 = PLAYING
      console.log('⏸️ Player paused/stopped, skipping broadcast');
      return; // Skip this broadcast, but keep interval running
    }
    
    // ✅ Safely get current time with fallback
    const currentTime = player1Ref.current?.getCurrentTime() || 0;
    const newSyncTime = Date.now() - (currentTime * 1000);
    
    console.log(`📡 Broadcasting: ${currentTime.toFixed(1)}s`);
    
    updateDoc(sessionRef, {
      syncTime: newSyncTime,
      isPlaying: true
    }).catch((err) => console.error('❌ Broadcast error:', err));
    
  }, 1000);
};
```


***

### **Fix \#3: Fix TypeError - Safe toFixed Usage**

```typescript
// MusicPlayer.tsx

// ❌ WRONG:
const currentTime = player1Ref.current?.getCurrentTime();
console.log(`Time: ${currentTime.toFixed(1)}s`); // Crashes if undefined

// ✅ CORRECT:
const currentTime = player1Ref.current?.getCurrentTime() || 0;
console.log(`Time: ${currentTime.toFixed(1)}s`); // Safe, defaults to 0

// OR even safer:
const currentTime = player1Ref.current?.getCurrentTime();
if (currentTime !== undefined) {
  console.log(`Time: ${currentTime.toFixed(1)}s`);
} else {
  console.log('⚠️ Player not ready yet');
}
```


***

### **Fix \#4: Handle YouTube 503 Errors**

```typescript
// MusicPlayer.tsx

// Add retry logic for 503 errors
let retryCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

const loadVideoWithRetry = (videoId: string, player: any) => {
  try {
    player.loadVideoById(videoId);
    retryCount = 0; // Reset on success
  } catch (error) {
    console.error('❌ Failed to load video:', error);
    
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(`⏳ Retrying in ${RETRY_DELAY / 1000}s... (attempt ${retryCount}/${MAX_RETRIES})`);
      
      setTimeout(() => {
        loadVideoWithRetry(videoId, player);
      }, RETRY_DELAY);
    } else {
      console.error('❌ Max retries reached, skipping song');
      showToast('Failed to load video, skipping...', 3000);
      skipToNext();
    }
  }
};

// Use in song loading:
useEffect(() => {
  if (!currentSong) return;
  
  console.log(`🎬 Loading: ${currentSong.title}`);
  const activePlayer = activePlayerRef.current === 1 ? player1Ref : player2Ref;
  
  loadVideoWithRetry(currentSong.id, activePlayer.current);
}, [currentSong?.id]);

// Handle YouTube API errors
const onPlayerError = (event: any) => {
  const errorCode = event.data;
  console.error(`❌ YouTube Error ${errorCode}`);
  
  switch (errorCode) {
    case 2: // Invalid video ID
    case 100: // Video not found
    case 101: // Restricted
    case 150: // Embedding disabled
      console.log('⏭️ Skipping unavailable video');
      showToast('Video unavailable, skipping...', 2000);
      skipToNext();
      break;
    case 5: // HTML5 player error
      console.log('⏳ Retrying playback...');
      setTimeout(() => {
        player1Ref.current?.playVideo();
      }, 2000);
      break;
    default:
      console.error(`Unknown error: ${errorCode}`);
  }
};
```


***

### **Fix \#5: Isolate Firebase Listeners from Playback Logic**

```typescript
// MusicPlayer.tsx

// ✅ CORRECT: Separate listener for playback state
useEffect(() => {
  console.log('👂 Setting up Firebase listener for playback state');
  
  const unsubscribe = onSnapshot(
    doc(db, 'sessions', sessionCode),
    (snap) => {
      const data = snap.data();
      if (!data) return;
      
      // ✅ Use local state setters, don't restart intervals here!
      setIsPlaying(data.isPlaying);
      setCurrentSong(data.currentSong);
      setSyncTime(data.syncTime);
      
      // ✅ DO NOT call startBroadcasting() or startSyncing() here!
      // That's handled by the separate useEffect with [isPlaybackDevice] dep
    },
    {
      includeMetadataChanges: false // ✅ Ignore local writes
    }
  );
  
  return () => {
    console.log('👂 Cleaning up Firebase listener');
    unsubscribe();
  };
}, [sessionCode]); // Only re-run if session code changes
```


***

## 📋 COMPLETE REWRITE INSTRUCTIONS FOR CLAUDE CODE

### **Step 1: Remove ALL existing interval logic**

Delete:

- All `useEffect` hooks that call `startBroadcasting()` or `startSyncing()`
- Any interval cleanup code inside Firebase listeners
- Any code that restarts intervals on state changes


### **Step 2: Implement THREE separate useEffect hooks**

1. **Playback Device Role** (runs once when role changes):
    - Starts broadcast (if playback device) OR sync (if listener)
    - Cleans up on unmount
2. **Play/Pause State** (runs when isPlaying changes):
    - Calls `playVideo()` or `pauseVideo()`
    - Does NOT restart intervals
3. **Song Changes** (runs when currentSong.id changes):
    - Loads new video
    - Does NOT restart intervals

### **Step 3: Implement ONE Firebase listener**

- Listens to `sessions/{code}` document
- Updates local state ONLY (`setIsPlaying`, `setCurrentSong`, etc.)
- Does NOT call any playback functions
- Uses `includeMetadataChanges: false` to ignore local writes


### **Step 4: Fix broadcast interval**

- Check `playerState === 1` before broadcasting
- Skip broadcast if paused (but keep interval running)
- Use safe `getCurrentTime() || 0` to prevent TypeError


### **Step 5: Add YouTube error handling**

- Implement `onPlayerError` handler
- Retry on 503 errors (max 3 attempts)
- Skip song on fatal errors (100, 101, 150)

***

## 🚀 TESTING CHECKLIST

After fixes:

- [ ] Console shows **only ONE** "Starting broadcast mode" message (no repeats)
- [ ] Broadcast interval runs continuously without clearing/restarting
- [ ] `currentTime` increments: 0s → 1s → 2s → 3s (not stuck at 0s)
- [ ] No "Cleanup: clearing broadcast interval" spam
- [ ] No TypeError crashes
- [ ] Playback pauses → Broadcast stops (but interval keeps running)
- [ ] Playback resumes → Broadcast resumes
- [ ] YouTube 503 errors trigger retry logic (not crash)

***

## 🔑 KEY PRINCIPLES FOR CLAUDE CODE

1. **ONE interval per mode**: Broadcast OR sync, never both, never restart
2. **Separate concerns**: Playback device role, play/pause state, song changes
3. **State updates ≠ interval restart**: Firebase updates should NOT restart intervals
4. **Safe fallbacks**: Always use `|| 0` when calling `getCurrentTime()`
5. **Error handling**: Retry 503 errors, skip unavailable videos

**Files to Modify**:

- `src/components/MusicPlayer.tsx` (complete interval logic rewrite)[^1]

***

**Critical**: The core issue is **useEffect dependency hell** causing infinite clear/restart loops. Fix this by separating concerns into multiple focused `useEffect` hooks with minimal dependencies.

<div align="center">⁂</div>

[^1]: VibeBox-pdf-summary.pdf

