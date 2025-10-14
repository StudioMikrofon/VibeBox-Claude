# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VibeBox is a collaborative music listening room application built with React, TypeScript, and Firebase. It enables hosts to create music sessions where guests can join, add songs to a shared queue, vote on tracks, and listen together in real-time using YouTube playback.

## Build & Development Commands

```bash
npm run dev          # Start development server (Vite)
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript type checking
```

## Architecture Overview

### Core User Flows

The application supports three main user roles:

1. **Host**: Creates and manages music sessions from `/host/:code`
2. **Guest**: Joins sessions via `/guest/:code` to add songs and vote
3. **DJ/Speaker**: Special guest roles with elevated privileges (control playback, manage queue)

### Real-time Synchronization Model

The app uses Firebase Firestore for real-time state synchronization:

- **Sessions collection**: Stores session metadata (code, hostName, roomName, queue, guests, settings)
- **Subcollections**: `activity` logs and `messages` for quick replies
- **Real-time listeners**: `onSnapshot` in HostDashboard.tsx and GuestView.tsx sync state changes
- **Audio sync**: Guest players sync to host's playback time via `syncTime` prop passed to MusicPlayer

### Music Player Architecture (src/components/MusicPlayer.tsx)

The player uses a dual-player crossfade system:

- Two YouTube IFrame players (`player1Ref`, `player2Ref`) alternate for seamless transitions
- `activePlayer` state (1 or 2) tracks which player is currently audible
- Crossfade logic fades out current player while fading in next player over `crossfadeDuration` seconds
- **Host mode**: Player controls full playback, updates Firebase with current time
- **Guest mode**: Player syncs to host's `syncTime`, with drift correction logic
- Volume normalization analyzes audio levels to balance loudness across tracks

### State Management Pattern

No global state library is used. State flows through:

1. **AuthContext** (src/contexts/AuthContext.tsx): Handles session creation and joining
2. **Component-level state**: HostDashboard and GuestView maintain session state via Firebase listeners
3. **Props drilling**: Session data flows down to child components (MusicPlayer, QueueSection, etc.)

### Queue and Voting System

- Queue stored as `Song[]` array in Firestore session document
- Each song has `upvotes` and `downvotes` arrays containing user IDs
- Voting triggers Firestore `arrayUnion`/`arrayRemove` operations
- Auto-skip feature can remove songs if downvotes exceed `autoSkipThreshold`
- Queue reordering uses drag-and-drop (dnd-kit for host, react-beautiful-dnd for guest)

### Role-Based Permissions

- `playbackDevice` field determines which user's device plays audio (default: 'HOST')
- `djName` field assigns DJ role (can control playback, skip songs)
- `adminUsers` array grants admin privileges (kick guests, transfer roles)
- Settings control queue permissions: 'all', 'host', 'public', 'private'

## Key Technical Details

### YouTube Integration

- Uses YouTube IFrame API for playback (src/services/youtube.ts for search)
- Videos must be embeddable (`videoEmbeddable=true` filter in search)
- API key in src/config/api.ts (hardcoded for YouTube, env vars for Spotify)

### Firebase Configuration

- Firebase config in src/services/firebase.ts uses environment variables:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
- Firestore rules in firestore.rules are extremely permissive (allow read/write if true for rooms)

### Deployment

- Builds to `dist/` directory via Vite
- Firebase hosting configured in firebase.json to serve from `dist/`
- Netlify config in netlify.toml for alternative hosting
- SPA routing: all routes redirect to index.html

### TypeScript Structure

- Type definitions in src/types/:
  - `Song` interface (id, title, youtubeId, votes, duration, etc.)
  - `SessionSettings` interface (crossfade, voting, permissions)
  - `Activity`, `QuickMessage`, `UserRole` types
- tsconfig.app.json for application code, tsconfig.node.json for Vite config

### Styling

- Tailwind CSS for utility-first styling (tailwind.config.js)
- Custom CSS visualizer component (src/components/CSSVisualizer.tsx) for audio visualization

## Important Patterns

### Adding Songs to Queue

1. Guest searches YouTube via AddSongModal
2. `searchYouTubeVideos()` returns results with metadata
3. `createYouTubeSong()` helper normalizes data to `Song` type
4. Song added to Firestore queue via `arrayUnion`
5. Real-time listener triggers queue update in UI

### Handling Song Transitions

1. MusicPlayer checks `currentTime` vs `duration - crossfadeDuration`
2. When threshold reached, loads next song into inactive player
3. Crossfade fades out active player, fades in inactive player
4. `onSongEnd` callback updates currentSong in parent component
5. Parent updates Firebase, triggering sync to all clients

### Guest-Host Synchronization

- Host MusicPlayer has `onTimeUpdate` callback that updates `syncTime` in state
- Parent component writes `syncTime` to Firebase periodically
- Guest reads `syncTime` from Firebase via real-time listener
- Guest MusicPlayer compares local playback time to `syncTime`, seeks if drift > threshold
