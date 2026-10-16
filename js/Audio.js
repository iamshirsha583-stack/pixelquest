/**
 * PixelQuest - 8-Bit Web Audio API Sound Synthesizer
 * Generates dependency-free procedural retro audio effects using browser Web Audio API.
 */

class AudioSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    this.volume = 0.28;

    // Load persisted mute preference from localStorage
    try {
      const savedMute = localStorage.getItem('pixelquest_audio_muted');
      if (savedMute !== null) {
        this.muted = savedMute === 'true';
      }
    } catch (e) {
      // Ignore localStorage restrictions
    }

    this.setupUnlockListeners();
  }

  /**
   * Listens for first user gesture to unlock browser AudioContext autoplay policy
   */
  setupUnlockListeners() {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      this.ensureContext();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('click', unlock);
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('click', unlock, { passive: true });
  }

  /**
   * Initializes or resumes the AudioContext
   * @returns {AudioContext|null}
   */
  ensureContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  /**
   * Toggles audio mute state
   * @returns {boolean} New muted state
   */
  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, now);
    }
    try {
      localStorage.setItem('pixelquest_audio_muted', String(this.muted));
    } catch (e) {}
    return this.muted;
  }

  /**
   * Returns current mute status
   * @returns {boolean}
   */
  isMuted() {
    return this.muted;
  }

  /**
   * Sets master audio volume level (0.0 to 1.0)
   * @param {number} level
   */
  setVolume(level) {
    this.volume = Math.max(0, Math.min(1, level));
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  /**
   * Retro 8-Bit Jump Sound: Classic square wave ascending pitch sweep
   */
  playJump() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.15);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.16);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    } catch (e) {
      console.warn('Audio playJump error:', e);
    }
  }

  /**
   * Retro 8-Bit Coin Sound: High-frequency sparkling two-tone chime
   */
  playCoin() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Note 1: B5 (987.77 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'square';
      osc1.frequency.setValueAtTime(987.77, now);

      gain1.gain.setValueAtTime(0.22, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc1.connect(gain1);
      gain1.connect(this.masterGain);
      osc1.start(now);
      osc1.stop(now + 0.08);

      // Note 2: E6 (1318.51 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(1318.51, now + 0.07);

      gain2.gain.setValueAtTime(0.001, now);
      gain2.gain.setValueAtTime(0.26, now + 0.07);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start(now + 0.07);
      osc2.stop(now + 0.33);

      osc2.onended = () => {
        osc1.disconnect();
        gain1.disconnect();
        osc2.disconnect();
        gain2.disconnect();
      };
    } catch (e) {
      console.warn('Audio playCoin error:', e);
    }
  }

  /**
   * Retro 8-Bit Hit/Death Sound: Filtered white noise impact crunch + pitch slide
   */
  playDeath() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const duration = 0.42;

      // 1. Synthesize white noise buffer
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      // Lowpass downward sweep filter
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(90, now + duration);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.42, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      // 2. Accompanying low rumble sawtooth for arcade impact punch
      const rumble = ctx.createOscillator();
      const rumbleGain = ctx.createGain();
      rumble.type = 'sawtooth';
      rumble.frequency.setValueAtTime(140, now);
      rumble.frequency.exponentialRampToValueAtTime(32, now + 0.35);

      rumbleGain.gain.setValueAtTime(0.3, now);
      rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      rumble.connect(rumbleGain);
      rumbleGain.connect(this.masterGain);

      whiteNoise.start(now);
      whiteNoise.stop(now + duration);
      rumble.start(now);
      rumble.stop(now + 0.36);

      whiteNoise.onended = () => {
        whiteNoise.disconnect();
        filter.disconnect();
        noiseGain.disconnect();
        rumble.disconnect();
        rumbleGain.disconnect();
      };
    } catch (e) {
      console.warn('Audio playDeath error:', e);
    }
  }

  /**
   * Alias for hit/damage
   */
  playHit() {
    this.playDeath();
  }

  /**
   * Retro 8-Bit Button Click / Blip Sound
   */
  playClick() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.setValueAtTime(740, now + 0.025);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.055);
    } catch (e) {}
  }

  /**
   * Alias for UI blip
   */
  playBlip() {
    this.playClick();
  }

  /**
   * 8-Bit Fanfare for victory stage complete
   */
  playVictory() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const notes = [
        { f: 523.25, d: 0.12 }, // C5
        { f: 659.25, d: 0.12 }, // E5
        { f: 783.99, d: 0.14 }, // G5
        { f: 1046.50, d: 0.55 }, // C6
      ];

      const now = ctx.currentTime;
      let offset = 0;

      notes.forEach((note, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + offset;
        const dur = note.d;

        osc.type = index === notes.length - 1 ? 'square' : 'triangle';
        osc.frequency.setValueAtTime(note.f, startTime);

        gain.gain.setValueAtTime(0.24, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(startTime + dur + 0.02);

        offset += dur * 0.75;
      });
    } catch (e) {
      console.warn('Audio playVictory error:', e);
    }
  }

  /**
   * 8-Bit Descending Game Over Song
   */
  playGameOver() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const notes = [329.63, 293.66, 261.63, 196.00]; // E4, D4, C4, G3
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.22;
        const dur = 0.32;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.26, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(startTime + dur + 0.02);
      });
    } catch (e) {
      console.warn('Audio playGameOver error:', e);
    }
  }

  /**
   * Respawn warp chime
   */
  playRespawn() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(720, now + 0.22);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {}
  }
}

// Global browser attachments
if (typeof window !== 'undefined') {
  window.AudioSystem = AudioSystem;
  window.SoundSynthesizer = AudioSystem;
  window.gameAudio = new AudioSystem();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioSystem;
}
