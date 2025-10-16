# 🎯 VibeBox PlayDirector Refactoring Plan

**Created**: 2025-10-16
**Status**: Planning Phase
**Estimated Time**: 8-12 hours of work

---

## 📊 Current Architecture Analysis

### ✅ What Works Well
- **A/B Player System**: Two YouTube IFrame players for crossfade
- **Wake Lock**: Implemented for playback device
- **Separate Intervals**: Broadcast (1s) and sync (2s) intervals isolated
- **Cleanup Functions**: `clearAllPlaybackTimers()` exists
- **Role Separation**: `isHost`, `isDJ`, `isPlaybackDevice` props
- **Sync Architecture**: `syncTime` broadcast and drift correction

### ❌ Current Issues
1. **No Centralized State Machine**: Logic scattered across multiple useEffects
2. **Direct Prop Actions**: `onPlayPause`, `onNext`, etc. called directly
3. **No FSM States**: No explicit 'IDLE'|'PREPARING'|'PLAYING'|'XFADING' states
4. **History Track Issues**: Songs from history may not fully reset
5. **Crossfade Complexity**: Manual intervals, potential for ghost timers
6. **Room Code Position**: Fixed top-right instead of in header

---

## 🏗️ Refactoring Phases

### **Phase 1: Planning & Preparation** ⏱️ 1-2h
- [x] Analyze current MusicPlayer.tsx architecture
- [x] Document current state flow
- [x] Create this refactoring plan
- [ ] Design PlayDirector interface
- [ ] Design Intent types
- [ ] Design FSM state transitions
- [ ] Create backup branch: `git checkout -b refactor/play-director`

### **Phase 2: PlayDirector Core Module** ⏱️ 3-4h
- [ ] Create `src/services/PlayDirector.ts`
- [ ] Implement FSM with states:
  ```typescript
  type PlaybackState =
    | 'IDLE'           // No song loaded
    | 'PREPARING'      // Loading song, setting up player
    | 'PLAYING'        // Active playback
    | 'XFADING'        // Crossfade in progress
    | 'PAUSED'         // Paused by user
    | 'ERROR'          // Error state
  ```
- [ ] Implement Intent handler:
  ```typescript
  type Intent =
    | { type: 'QUEUE_ADD', song: Song }
    | { type: 'QUEUE_REORDER', queue: Song[] }
    | { type: 'SKIP', direction: 'next'|'previous' }
    | { type: 'PLAY' }
    | { type: 'PAUSE' }
    | { type: 'CROSSFADE_TO_NEXT' }
    | { type: 'LOAD_SONG', song: Song, startAt: number }
    | { type: 'RESET_TRACK', song: Song }
  ```
- [ ] Implement singleton pattern
- [ ] Add state transition logging
- [ ] Add error handling

### **Phase 3: Track Runtime & Reset** ⏱️ 1-2h
- [ ] Add `runtimeId` to Song type (or create Track wrapper):
  ```typescript
  interface TrackRuntime {
    song: Song;
    runtimeId: string;      // UUID for this playback instance
    resumeAt: number;        // Start position (0 for fresh)
    lastKnownPosition: number;
    startedAt: number;       // Timestamp when started
  }
  ```
- [ ] Implement `resetTrackRuntime()` function
- [ ] Update history replay logic to always reset to 0:00
- [ ] Clear localStorage progress for replayed tracks

### **Phase 4: Refactor MusicPlayer to use PlayDirector** ⏱️ 2-3h
- [ ] Replace direct prop calls with Intent dispatch
- [ ] Remove scattered useEffect logic → move to PlayDirector
- [ ] Keep MusicPlayer as "dumb" UI component
- [ ] PlayDirector manages:
  - Player instances (player1Ref, player2Ref)
  - Active player switching
  - Crossfade intervals
  - Broadcast intervals
  - Sync intervals
- [ ] MusicPlayer only renders UI based on PlayDirector state

### **Phase 5: Server-Based Room Clock** ⏱️ 1-2h
- [ ] Add `roomClock` field to Firebase session:
  ```typescript
  interface SessionData {
    // ... existing fields
    roomClock: number;  // Server timestamp for sync reference
  }
  ```
- [ ] Update sync logic to use `roomClock` instead of device timestamps
- [ ] Playback device sends heartbeat with `nowPlaying`, `position`, `runtimeId`
- [ ] Other clients display, don't broadcast

### **Phase 6: Crossfade Improvements** ⏱️ 1-2h
- [ ] Refactor crossfade to use proper A/B cleanup
- [ ] Implement exponential gain ramp option
- [ ] Add hard-mute + destroy for old player instance
- [ ] Prevent ghost-player loops
- [ ] Add YouTube-specific fallback (hard cut if needed)
- [ ] Abstract audio source for future (YT|SPOT|FILE)

### **Phase 7: UI/UX Fixes** ⏱️ 1-2h
- [ ] **Room Code**: Move from fixed position to header container
  ```css
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .room-code { position: relative; right: 0; }
  ```
- [ ] **Mobile Drag & Drop**: Consider SortableJS or improve current
  - delay: 200ms
  - touchStartThreshold: 4px
  - forceFallback: true
  - Fallback: ▲▼ buttons (≥44px touch target)
- [ ] **Settings Input**: Ensure `<input type="number">` works on mobile (font-size ≥16px)

### **Phase 8: QA Checklist** ⏱️ 1-2h
Run through entire QA checklist:
- [ ] Song from history starts at 0:00, no state inheritance
- [ ] previous/next leaves no ghost timers or player instances
- [ ] Crossfade doesn't loop at last second
- [ ] DJ screen off has no effect on playback state
- [ ] "Listen on my device" works instantly (local mute/unmute)
- [ ] Drag & drop works on mobile (long-press)
- [ ] Fallback buttons (▲▼) always available
- [ ] Room code in header, not sticky
- [ ] "Max songs" input can be manually typed/deleted
- [ ] Test on: Desktop Chrome, Mobile Safari, Mobile Chrome

---

## 🎯 Priority Order

### **Critical (Do First)**
1. Phase 2: PlayDirector Core Module
2. Phase 3: Track Runtime & Reset
3. Phase 4: Refactor MusicPlayer

### **High (Do Next)**
4. Phase 6: Crossfade Improvements
5. Phase 8: QA Checklist

### **Medium (If Time Permits)**
6. Phase 5: Server-Based Room Clock
7. Phase 7: UI/UX Fixes (room code, mobile DnD)

---

## 📁 File Structure

```
src/
├── services/
│   ├── PlayDirector.ts          // NEW: Main playback state machine
│   ├── TrackRuntime.ts           // NEW: Track runtime management
│   └── youtube.ts                // Existing
├── components/
│   ├── MusicPlayer.tsx           // REFACTOR: Simplified UI component
│   └── ...
├── types/
│   ├── playback.ts               // NEW: Intent, PlaybackState types
│   └── song.ts                   // UPDATE: Add TrackRuntime
└── ...
```

---

## 🔄 Git Strategy

```bash
# Create backup branch
git checkout -b refactor/play-director

# Create checkpoints after each phase
git commit -m "Phase 2: Implement PlayDirector core"
git commit -m "Phase 3: Add Track runtime reset"
# etc...

# When done and tested:
git checkout main
git merge refactor/play-director
git push
```

---

## ⚠️ Risk Mitigation

### **High Risk Areas**
1. **Breaking Existing Sync**: Test thoroughly with multiple devices
2. **YouTube IFrame API Quirks**: May need fallbacks for crossfade
3. **Firebase Rate Limits**: Be careful with broadcast frequency

### **Fallback Plan**
- Keep current MusicPlayer.tsx as `MusicPlayer.old.tsx` backup
- If major issues, can revert branch
- Test each phase incrementally before moving to next

---

## 📝 Notes for Future Sessions

### **Key Architecture Decisions**
- PlayDirector is singleton per playback device
- Intents flow: UI → Firebase → PlayDirector → Player API
- DJ/Host/Admin send intents, PlayDirector decides execution
- Sync based on server roomClock, not device timestamps

### **What NOT to Change**
- Firebase structure (minimize schema changes)
- Role system (DJ, Admin, Playback Device)
- Queue voting system
- Authentication flow

### **Testing Checklist Before Merge**
1. Create room as host
2. Join as guest on mobile
3. Transfer DJ to guest
4. Transfer playback device to guest
5. Guest turns off screen → playback continues
6. Replay song from history → starts at 0:00
7. Manual skip with crossfade → smooth transition
8. Auto-crossfade at end of song → no loop
9. "Listen on my device" toggle → instant effect
10. Mobile drag & drop → works with 200ms delay

---

## 🎓 Learning Resources

- [Finite State Machines](https://en.wikipedia.org/wiki/Finite-state_machine)
- [YouTube IFrame API Docs](https://developers.google.com/youtube/iframe_api_reference)
- [SortableJS Docs](https://github.com/SortableJS/Sortable)

---

**Last Updated**: 2025-10-16 by Claude Code
