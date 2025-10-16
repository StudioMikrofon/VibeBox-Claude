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

### **Phase 1: Planning & Preparation** ⏱️ 1-2h ✅ COMPLETE
- [x] Analyze current MusicPlayer.tsx architecture
- [x] Document current state flow
- [x] Create this refactoring plan
- [x] Design PlayDirector interface
- [x] Design Intent types
- [x] Design FSM state transitions
- [x] Create backup branch: `git checkout -b refactor/play-director`

### **Phase 2: PlayDirector Core Module** ⏱️ 3-4h ✅ COMPLETE
- [x] Create `src/services/PlayDirector.ts`
- [x] Implement FSM with states (IDLE, PREPARING, PLAYING, XFADING, PAUSED, ERROR)
- [x] Implement Intent handler (11 intent types)
- [x] Implement singleton pattern
- [x] Add state transition logging
- [x] Add error handling
- [x] Created `src/types/playback.ts` with all type definitions

### **Phase 3: Track Runtime & Reset** ⏱️ 1-2h ✅ COMPLETE
- [x] Add `runtimeId` to TrackRuntime interface in playback.ts
- [x] Implement `createTrackRuntime()` helper function
- [x] Implement `resetTrackRuntime()` function
- [x] Update resetTrack() in PlayDirector with full cleanup
- [x] skipNext/skipPrevious always clear intervals and timers

### **Phase 4: Refactor MusicPlayer to use PlayDirector** ⏱️ 2-3h 🔄 IN PROGRESS
**Phase 4A: ✅ COMPLETE**
- [x] Create `src/hooks/usePlayDirector.ts` React hook
- [x] Hook manages singleton lifecycle, subscribes to callbacks
- [x] Export helper functions for creating intents
- [x] Create `MusicPlayerPlayDirectorPOC.tsx` test component
- [x] Update hook with onCrossfadeNeeded callback

**Phase 4B: 🔄 IN PROGRESS (Complex - needs more planning)**
- [ ] Add `usePlayDirector?: boolean` flag to SessionSettings (Firebase)
- [ ] Add conditional rendering in HostDashboard/GuestView
- [ ] Create `MusicPlayerV2.tsx` - full implementation with PlayDirector
- [ ] Test V2 with flag on dev environment
- [ ] If stable, replace MusicPlayer.tsx with V2
- [ ] Remove old MusicPlayer.tsx (keep as .old backup)

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

### **Phase 6: Crossfade Improvements** ⏱️ 1-2h ✅ COMPLETE
- [x] Refactor crossfade to use proper A/B cleanup in PlayDirector
- [x] Implement volume ramping (50ms steps, linear gain)
- [x] Add hard-mute + pause + stop for old player instance
- [x] Prevent ghost-player loops (clearAllIntervals on skip)
- [x] Auto-crossfade detection (checkAutoCrossfade every 1s)
- [x] onCrossfadeNeeded callback for external component
- [ ] (Future) Implement exponential gain ramp option
- [ ] (Future) Add YouTube-specific fallback (hard cut if needed)
- [ ] (Future) Abstract audio source for future (YT|SPOT|FILE)

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
