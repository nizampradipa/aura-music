import type { Track } from '../types/music';

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Lightweight, zero-asset Web Audio ambient chord synthesizer used only in Demo Mode
 * so portfolio viewers hear warm atmospheric pads while interacting with transport,
 * volume, mood modes, and sleep timer fade-outs.
 */
export class DemoAmbientSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private oscillators: Array<{ osc: OscillatorNode; gain: GainNode }> = [];
  private chordTimer: number | null = null;
  private chordIndex = 0;
  private currentTrack: Track | null = null;
  private volume = 0.72;
  private isPlaying = false;
  private mutedByUser = false;

  private ensureContext(): boolean {
    if (typeof window === 'undefined') return false;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 680;
      this.filter.Q.value = 0.8;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.0001;

      this.filter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return true;
  }

  private stopVoices(): void {
    const now = this.ctx?.currentTime ?? 0;
    for (const { osc, gain } of this.oscillators) {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0.0001, now, 0.25);
        osc.stop(now + 0.9);
      } catch {
        // already stopped
      }
    }
    this.oscillators = [];
  }

  private triggerChord(): void {
    if (!this.ctx || !this.filter || !this.currentTrack || !this.isPlaying) return;
    const harmony = this.currentTrack.demoHarmony ?? {
      rootMidi: 53,
      chords: [
        [0, 4, 7, 11],
        [-3, 0, 4, 7],
        [-5, 0, 2, 7],
        [-7, -3, 0, 4],
      ],
      tempoSeconds: 6.4,
    };

    const chord = harmony.chords[this.chordIndex % harmony.chords.length];
    this.chordIndex += 1;

    this.stopVoices();

    const now = this.ctx.currentTime;
    const perVoiceGain = 0.065 / Math.max(1, chord.length);

    chord.forEach((interval, idx) => {
      if (!this.ctx || !this.filter) return;
      const freq = midiToHz(harmony.rootMidi + interval);

      // Pair slightly detuned sine + triangle waves for lush tape warmth
      const osc = this.ctx.createOscillator();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.detune.setValueAtTime((idx % 2 === 0 ? -1 : 1) * (3 + idx * 1.4), now);

      const voiceGain = this.ctx.createGain();
      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(perVoiceGain, now + 1.4);

      osc.connect(voiceGain);
      voiceGain.connect(this.filter);
      osc.start(now);
      this.oscillators.push({ osc, gain: voiceGain });
    });

    // Subtle breathing filter sweep
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setValueAtTime(520, now);
    this.filter.frequency.linearRampToValueAtTime(920, now + harmony.tempoSeconds * 0.55);
    this.filter.frequency.linearRampToValueAtTime(560, now + harmony.tempoSeconds);
  }

  public setTrack(track: Track | null): void {
    const changed = this.currentTrack?.id !== track?.id;
    this.currentTrack = track;
    if (changed && this.isPlaying) {
      this.chordIndex = 0;
      this.startLoop();
    }
  }

  public setVolume(vol01: number): void {
    this.volume = Math.max(0, Math.min(1, vol01));
    if (this.ctx && this.masterGain && this.isPlaying && !this.mutedByUser) {
      this.masterGain.gain.setTargetAtTime(Math.max(0.0001, this.volume * 0.85), this.ctx.currentTime, 0.12);
    }
  }

  public setAudioMuted(muted: boolean): void {
    this.mutedByUser = muted;
    if (this.ctx && this.masterGain) {
      const target = !muted && this.isPlaying ? Math.max(0.0001, this.volume * 0.85) : 0.0001;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.15);
    }
  }

  public isAudioMuted(): boolean {
    return this.mutedByUser;
  }

  private startLoop(): void {
    if (this.chordTimer !== null) {
      window.clearInterval(this.chordTimer);
      this.chordTimer = null;
    }
    if (!this.ensureContext()) return;
    const tempoSec = this.currentTrack?.demoHarmony?.tempoSeconds ?? 6.4;
    this.triggerChord();
    if (this.ctx && this.masterGain) {
      const target = this.mutedByUser ? 0.0001 : Math.max(0.0001, this.volume * 0.85);
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.35);
    }
    this.chordTimer = window.setInterval(() => this.triggerChord(), tempoSec * 1000);
  }

  public setPlaying(playing: boolean): void {
    if (this.isPlaying === playing) return;
    this.isPlaying = playing;
    if (playing) {
      this.startLoop();
    } else {
      if (this.chordTimer !== null) {
        window.clearInterval(this.chordTimer);
        this.chordTimer = null;
      }
      if (this.ctx && this.masterGain) {
        this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.25);
      }
      this.stopVoices();
    }
  }

  public dispose(): void {
    this.setPlaying(false);
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
