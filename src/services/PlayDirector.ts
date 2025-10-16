import {
  PlaybackState,
  PlaybackIntent,
  TrackRuntime,
  PlayDirectorConfig,
  IPlayDirector,
  createTrackRuntime,
  resetTrackRuntime,
} from '../types/playback';

/**
 * PlayDirector - Single source of truth for playback state
 *
 * Manages:
 * - Finite State Machine (FSM) for playback states
 * - YouTube player instances (A/B crossfade)
 * - Intent handling (all actions go through here)
 * - Broadcast/sync intervals
 * - Track lifecycle (load, play, pause, reset)
 *
 * Singleton per playback device
 */
export class PlayDirector implements IPlayDirector {
  // Singleton instance
  private static instance: PlayDirector | null = null;

  // FSM State
  private state: PlaybackState = 'IDLE';
  private currentTrack: TrackRuntime | null = null;

  // Player instances (YouTube IFrame API)
  private player1: any = null;
  private player2: any = null;
  private activePlayer: 1 | 2 = 1;

  // Configuration
  private config: PlayDirectorConfig;

  // Intervals & Timers
  private broadcastInterval: NodeJS.Timeout | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private crossfadeInterval: NodeJS.Timeout | null = null;
  private progressInterval: NodeJS.Timeout | null = null;

  // Flags
  private isCrossfading = false;
  private isInitialized = false;

  // Callbacks
  private stateChangeCallbacks: Array<(state: PlaybackState) => void> = [];
  private positionUpdateCallbacks: Array<(position: number) => void> = [];
  private trackEndCallbacks: Array<() => void> = [];
  private errorCallbacks: Array<(error: string) => void> = [];

  private constructor(config: PlayDirectorConfig) {
    this.config = config;
    console.log('🎬 PlayDirector initialized with config:', config);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: PlayDirectorConfig): PlayDirector {
    if (!PlayDirector.instance) {
      if (!config) {
        throw new Error('PlayDirector requires config on first initialization');
      }
      PlayDirector.instance = new PlayDirector(config);
    }
    return PlayDirector.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  public static resetInstance(): void {
    if (PlayDirector.instance) {
      PlayDirector.instance.destroy();
      PlayDirector.instance = null;
    }
  }

  // ==================== PUBLIC API ====================

  public getCurrentState(): PlaybackState {
    return this.state;
  }

  public getCurrentTrack(): TrackRuntime | null {
    return this.currentTrack;
  }

  public getCurrentPosition(): number {
    if (!this.isInitialized) return 0;
    const player = this.activePlayer === 1 ? this.player1 : this.player2;
    return player?.getCurrentTime?.() || 0;
  }

  public initialize(player1: any, player2: any): void {
    this.player1 = player1;
    this.player2 = player2;
    this.isInitialized = true;
    console.log('✅ PlayDirector players initialized');
  }

  public destroy(): void {
    console.log('🧹 PlayDirector destroying...');
    this.clearAllIntervals();
    this.isInitialized = false;
    this.state = 'IDLE';
    this.currentTrack = null;
  }

  // ==================== INTENT HANDLING ====================

  public async handleIntent(intent: PlaybackIntent): Promise<void> {
    console.log(`🎯 Intent received: ${intent.type}`, intent);

    try {
      switch (intent.type) {
        case 'LOAD_SONG':
          await this.loadSong(intent.song, intent.startAt);
          break;

        case 'PLAY':
          await this.play();
          break;

        case 'PAUSE':
          await this.pause();
          break;

        case 'SKIP_NEXT':
          await this.skipNext(intent.useCrossfade ?? true);
          break;

        case 'SKIP_PREVIOUS':
          await this.skipPrevious(intent.useCrossfade ?? true);
          break;

        case 'CROSSFADE_TO_NEXT':
          await this.startCrossfade();
          break;

        case 'SEEK':
          await this.seek(intent.position);
          break;

        case 'RESET_TRACK':
          await this.resetTrack(intent.song);
          break;

        case 'SET_VOLUME':
          await this.setVolume(intent.volume);
          break;

        case 'MUTE':
          await this.setMute(intent.muted);
          break;

        case 'ERROR':
          this.handleError(intent.error, intent.code);
          break;

        default:
          console.warn('⚠️ Unknown intent type:', (intent as any).type);
      }
    } catch (error) {
      console.error('❌ Intent handling error:', error);
      this.handleError(`Failed to handle intent: ${intent.type}`, error);
    }
  }

  // ==================== STATE TRANSITIONS ====================

  private transitionTo(newState: PlaybackState): void {
    if (this.state === newState) return;

    const oldState = this.state;
    this.state = newState;

    console.log(`🔄 State transition: ${oldState} → ${newState}`);
    this.notifyStateChange(newState);

    // State-specific side effects
    switch (newState) {
      case 'IDLE':
        this.clearAllIntervals();
        break;

      case 'PREPARING':
        // Clear any existing playback state
        this.clearAllIntervals();
        break;

      case 'PLAYING':
        // Start broadcast if playback device
        if (this.config.isPlaybackDevice) {
          this.startBroadcast();
        }
        break;

      case 'PAUSED':
        // Keep intervals but pause player
        break;

      case 'XFADING':
        this.isCrossfading = true;
        break;

      case 'ERROR':
        this.clearAllIntervals();
        break;
    }
  }

  // ==================== PLAYBACK ACTIONS ====================

  private async loadSong(song: any, startAt: number = 0): Promise<void> {
    this.transitionTo('PREPARING');

    // Check if this song needs to be reset (from history replay)
    const needsReset = this.shouldResetTrack(song);
    if (needsReset) {
      console.log('🔄 Resetting track for history replay (startAt = 0)');
      startAt = 0;
      this.clearTrackProgress(song);
    }

    const track = createTrackRuntime(song, startAt);
    this.currentTrack = track;

    const player = this.activePlayer === 1 ? this.player1 : this.player2;
    if (!player) {
      this.handleError('No player available');
      return;
    }

    const videoId = song.id.replace('youtube-', '');

    try {
      player.loadVideoById({ videoId, startSeconds: startAt });
      console.log(`🎬 Loaded song: ${song.title} at ${startAt}s (runtimeId: ${track.runtimeId})`);
    } catch (error) {
      this.handleError('Failed to load song', error);
    }
  }

  /**
   * Check if track should be reset (from history replay)
   * Tracks from history always start at 0:00 with new runtimeId
   */
  private shouldResetTrack(_song: any): boolean {
    // If there's no current track, this is the first play
    if (!this.currentTrack) return false;

    // If the song ID matches the current track, it's likely from history
    // (unless it's a consecutive play, which we allow)
    // This logic can be enhanced with explicit "fromHistory" flag in Intent
    return false; // For now, rely on explicit RESET_TRACK intent
  }

  /**
   * Clear saved progress for a track (localStorage cleanup)
   */
  private clearTrackProgress(song: any): void {
    // This will be called by external component that has roomCode
    // PlayDirector doesn't have roomCode, so we notify via callback
    console.log(`🧹 Clearing progress for song: ${song.id}`);

    // If roomCode is available in config, clear it
    // For now, this is handled by the component that calls PlayDirector
  }

  private async play(): Promise<void> {
    if (!this.isInitialized) {
      console.warn('⚠️ PlayDirector not initialized');
      return;
    }

    const player = this.activePlayer === 1 ? this.player1 : this.player2;
    player?.playVideo?.();

    this.transitionTo('PLAYING');
  }

  private async pause(): Promise<void> {
    if (!this.isInitialized) return;

    const player = this.activePlayer === 1 ? this.player1 : this.player2;
    player?.pauseVideo?.();

    this.transitionTo('PAUSED');
    this.clearAllIntervals();
  }

  private async skipNext(useCrossfade: boolean): Promise<void> {
    console.log(`⏭️ Skip next (crossfade: ${useCrossfade})`);

    // 🔴 CRITICAL: Always clear intervals/timers on skip
    this.clearAllIntervals();
    this.isCrossfading = false;

    if (useCrossfade && this.config.manualSkipCrossfade > 0) {
      // 🔴 Crossfade logic will be moved here in Phase 6
      // For now, transition to XFADING and notify
      this.transitionTo('XFADING');

      // External component will handle crossfade for now
      this.notifyTrackEnd();
    } else {
      // Instant skip - hard cut
      const currentPlayer = this.activePlayer === 1 ? this.player1 : this.player2;
      if (currentPlayer) {
        currentPlayer.pauseVideo?.();
        currentPlayer.setVolume?.(0);
      }

      this.transitionTo('IDLE');
      this.currentTrack = null;
      this.notifyTrackEnd();
    }
  }

  private async skipPrevious(useCrossfade: boolean): Promise<void> {
    console.log(`⏮️ Skip previous (crossfade: ${useCrossfade})`);

    // 🔴 CRITICAL: Always clear intervals/timers on skip
    this.clearAllIntervals();
    this.isCrossfading = false;

    if (useCrossfade && this.config.manualSkipCrossfade > 0) {
      // 🔴 Crossfade logic will be moved here in Phase 6
      this.transitionTo('XFADING');
      this.notifyTrackEnd();
    } else {
      // Instant skip - hard cut
      const currentPlayer = this.activePlayer === 1 ? this.player1 : this.player2;
      if (currentPlayer) {
        currentPlayer.pauseVideo?.();
        currentPlayer.setVolume?.(0);
      }

      this.transitionTo('IDLE');
      this.currentTrack = null;
      this.notifyTrackEnd();
    }
  }

  private async startCrossfade(): Promise<void> {
    if (this.isCrossfading) {
      console.warn('⚠️ Crossfade already in progress');
      return;
    }

    this.transitionTo('XFADING');

    // Crossfade logic will be implemented in Phase 6
    // For now, just transition back
    setTimeout(() => {
      this.isCrossfading = false;
      this.transitionTo('PLAYING');
    }, this.config.crossfadeDuration * 1000);
  }

  private async seek(position: number): Promise<void> {
    if (!this.isInitialized) return;

    const player = this.activePlayer === 1 ? this.player1 : this.player2;
    player?.seekTo?.(position, true);

    if (this.currentTrack) {
      this.currentTrack.lastKnownPosition = position;
    }

    console.log(`⏩ Seeked to ${position}s`);
  }

  private async resetTrack(song: any): Promise<void> {
    console.log('🔄 Resetting track for history replay - NEW RUNTIME');

    // 🔴 CRITICAL: Stop current playback completely
    const currentPlayer = this.activePlayer === 1 ? this.player1 : this.player2;
    if (currentPlayer) {
      currentPlayer.pauseVideo?.();
      currentPlayer.setVolume?.(0);
    }

    // 🔴 CRITICAL: Clear all intervals and timers
    this.clearAllIntervals();

    // 🔴 CRITICAL: Reset crossfade flag (if it exists)
    this.isCrossfading = false;

    // 🔴 CRITICAL: Create NEW runtime with fresh runtimeId
    const track = resetTrackRuntime(song);
    this.currentTrack = track;

    console.log(`✅ Track reset complete. New runtimeId: ${track.runtimeId}`);

    // 🔴 CRITICAL: Load song from 0:00 (no resume)
    await this.loadSong(song, 0);
  }

  private async setVolume(volume: number): Promise<void> {
    if (!this.isInitialized) return;

    const player = this.activePlayer === 1 ? this.player1 : this.player2;
    player?.setVolume?.(volume);
  }

  private async setMute(muted: boolean): Promise<void> {
    if (!this.isInitialized) return;

    const player = this.activePlayer === 1 ? this.player1 : this.player2;

    if (muted) {
      player?.mute?.();
    } else {
      player?.unMute?.();
    }
  }

  // ==================== INTERVALS ====================

  private startBroadcast(): void {
    if (this.broadcastInterval) return;

    console.log('📡 Starting broadcast interval');

    this.broadcastInterval = setInterval(() => {
      const position = this.getCurrentPosition();
      this.notifyPositionUpdate(position);
    }, this.config.broadcastInterval);
  }

  private clearAllIntervals(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.crossfadeInterval) {
      clearInterval(this.crossfadeInterval);
      this.crossfadeInterval = null;
    }

    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    console.log('✅ All intervals cleared');
  }

  // ==================== ERROR HANDLING ====================

  private handleError(error: string, code?: any): void {
    console.error(`❌ PlayDirector error: ${error}`, code);
    this.transitionTo('ERROR');
    this.notifyError(error);
  }

  // ==================== EVENT CALLBACKS ====================

  public onStateChange(callback: (state: PlaybackState) => void): void {
    this.stateChangeCallbacks.push(callback);
  }

  public onPositionUpdate(callback: (position: number) => void): void {
    this.positionUpdateCallbacks.push(callback);
  }

  public onTrackEnd(callback: () => void): void {
    this.trackEndCallbacks.push(callback);
  }

  public onError(callback: (error: string) => void): void {
    this.errorCallbacks.push(callback);
  }

  private notifyStateChange(state: PlaybackState): void {
    this.stateChangeCallbacks.forEach(cb => cb(state));
  }

  private notifyPositionUpdate(position: number): void {
    this.positionUpdateCallbacks.forEach(cb => cb(position));
  }

  private notifyTrackEnd(): void {
    this.trackEndCallbacks.forEach(cb => cb());
  }

  private notifyError(error: string): void {
    this.errorCallbacks.forEach(cb => cb(error));
  }
}
