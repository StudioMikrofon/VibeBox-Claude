<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# 🛠️ VibeBox Bug Report \& Precise Fix Instructions for Claude Code

## 1. Message Icon Not Visible for Guests

**Bug**: Guest message icon in GuestList is present but invisible; it only appears on mouse hover.

**Instructions**:

- Message icon (`MessageIcon`) MUST be clearly visible next to every guest in the GuestList at all times.
- Remove any CSS like `opacity-0 hover:opacity-100` or `{visibility: hidden}`.
- Set icon opacity and visibility to `opacity: 1` and `visibility: visible` by default.
- Recommended CSS:

```tsx
<button className="mx-1 text-blue-500 hover:text-blue-700">
  <MessageIcon className="w-5 h-5" />
</button>
```

- Add proper spacing so the icon does not overlap with guest name or other icons.

**Files**:

- `src/pages/HostDashboard.tsx` or component that renders GuestList.

***

## 2. Blurred Guest List for Host

**Bug**: Host sees a blurred (zamagljen) guest list.

**Instructions**:

- Check for CSS filters such as `backdrop-blur`, `blur-sm`, or similar on the container.
- Remove any CSS or component prop causing blur effect for host view.
- Example fix:

```tsx
// Remove: className="blur-sm" or style={{ filter: 'blur(5px)' }}
// Replace with:
className="bg-transparent" // or no filter/style
```

- Verify that the guest list is sharp and fully readable for Host.

**Files**:

- `src/pages/HostDashboard.tsx` (guest list rendering component)

***

## 3. Duplicate "Listen on My Device" \& Messages Buttons

**Bug**: Two instances of "Listen on My Device" toggle/button exist; one at the top near messages and another under the player. Messages button also redundantly appears in the header.

**Instructions**:

- **Remove** the upper "Listen on My Device" toggle/button from anywhere outside the player interface. It must only exist directly below the player.[^1]
- **Remove** the header/top-level Messages button. Messages should **only** be accessible via visible icons in the GuestList (see Bug 1).
- Ensure no code duplicates or maps these components into the header, sidebar, or global navigation.

**Files**:

- Header component (common UI)
- `MusicPlayer.tsx` for correct placement of "Listen on My Device"
- GuestList component for messages

***

## 4. Playback Interruption from "Listen on My Device"

**Bug**: Toggling "Listen on My Device" interrupts, pauses, or alters the main player playback.

**Instructions**:

- Refactor playback and local listening logic so toggling local audio (mute/unmute, volume) DOES NOT affect the global playback or queue state.
- Ensure that toggling "Listen on My Device" only mutes/unmutes the user's local audio, without altering the Firebase session, `isPlaying`, `syncTime`, or affecting other users.
- Example approach:

```tsx
// Local only effect:
const handleToggleLocalAudio = (enabled: boolean) => {
  setIsListeningLocally(enabled); // Only for this client
  if (enabled) {
    player1Ref.current?.unMute();
  } else {
    player1Ref.current?.mute();
  }
  // DO NOT change any global playback/firebase state!
}
```

- Double-check no effect or action handler dispatches any playback/pause/stop to Firestore.

**Files**:

- `MusicPlayer.tsx` (listen toggle logic)
- Guest/Host dashboard components (event handlers)

***

## 5. Messages System Update

**Instructions**:

- Make messages accessible EXCLUSIVELY through clearly visible icons/buttons in the GuestList (see Bug 1).
- Remove any header, sidebar, or global messages button.
- Confirm clicking the icon next to a guest directly opens the message/chat modal or drawer.

***

## 6. General UI Enhancements \& Separation

**Instructions**:

- Ensure only ONE "Listen on My Device" toggle exists per session page and it is always visible under the player.
- All user interactions for social/chat (Messages) route through the GuestList.
- All playback controls and toggles are grouped together directly below the music player; do not scatter controls in other parts of UI.
- Visually segregate playback area from GuestList/message area to prevent overlap or UI confusion.

***

## 7. Testing Checklist for Fixes

- On Host: Guest list is always sharp, never blurred.
- On Guest/Host: Message icon is always visible for every user in the GuestList.
- "Listen on My Device" only appears below music player, nowhere else.
- No message button in app header.
- Toggling "Listen on My Device" never interrupts playback for anyone.
- Clicking message icon in GuestList directly opens chat modal.

***

**Summary**:
These fixes must keep the UI and state logic clear, prevent accidental playback interruption, and ensure every user sees correct icons for messaging and listening in the right spot at all times. Do not introduce any global playback or sync logic into message or local audio toggling components.

**Hand this entire document to Claude Code for precise implementation and code review.**

<div align="center">⁂</div>

[^1]: VibeBox-pdf-summary.pdf

