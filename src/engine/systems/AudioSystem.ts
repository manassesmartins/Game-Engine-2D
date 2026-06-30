import type { SoundPreset } from '../../types';

export class AudioSystem {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicOsc: OscillatorNode | null = null;
  private musicGain: GainNode | null = null;
  private volume = 0.5;
  private musicVolume = 0.3;

  private getContext(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx!.currentTime);
    }
  }

  getVolume(): number {
    return this.volume;
  }

  playSound(sound: SoundPreset) {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = sound.type === 'noise' ? 'square' : sound.type;
      osc.frequency.setValueAtTime(sound.frequency, ctx.currentTime);

      const totalDuration = sound.attack + sound.decay + (sound.sustain || 0) + (sound.duration || 0.2) + (sound.release || 0.05);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + sound.attack);
      if (sound.sustain > 0) {
        gain.gain.setValueAtTime(0.2, ctx.currentTime + sound.attack + sound.decay);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + sound.attack + sound.decay + sound.sustain);
      }
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + totalDuration);

      if (this.masterGain) {
        osc.connect(gain);
        gain.connect(this.masterGain);
      } else {
        osc.connect(gain);
        gain.connect(ctx.destination);
      }

      osc.start();
      osc.stop(ctx.currentTime + totalDuration + 0.1);
    } catch {
      // Audio not available
    }
  }

  playTone(type: OscillatorType, frequency: number, duration: number, attack = 0.01, decay = 0.1) {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + attack + decay + duration);

      if (this.masterGain) {
        osc.connect(gain);
        gain.connect(this.masterGain);
      } else {
        osc.connect(gain);
        gain.connect(ctx.destination);
      }

      osc.start();
      osc.stop(ctx.currentTime + attack + decay + duration + 0.1);
    } catch {
      // Audio not available
    }
  }

  playMusic(bpm: number, notes: Record<string, string>, tempoLimit?: number) {
    this.stopMusic();
    try {
      const ctx = this.getContext();
      const noteDuration = 60 / bpm;
      const maxNotes = tempoLimit || Object.keys(notes).length;

      this.musicGain = ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume, ctx.currentTime);
      if (this.masterGain) {
        this.musicGain.connect(this.masterGain);
      } else {
        this.musicGain.connect(ctx.destination);
      }

      let idx = 0;
      const scheduleNext = () => {
        if (idx >= maxNotes) {
          if (notes['loop'] === 'true') {
            idx = 0;
            this.playMusic(bpm, notes, tempoLimit);
          }
          return;
        }
        const key = Object.keys(notes)[idx];
        const freq = parseFloat(notes[key]) || 440;
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        noteGain.gain.setValueAtTime(0.15, ctx.currentTime);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + noteDuration * 0.9);
        osc.connect(noteGain);
        noteGain.connect(this.musicGain!);
        osc.start();
        osc.stop(ctx.currentTime + noteDuration);
        idx++;
        setTimeout(scheduleNext, noteDuration * 1000 * 0.9);
      };

      scheduleNext();
      this.musicOsc = null;
    } catch {
      // Audio not available
    }
  }

  stopMusic() {
    this.musicOsc = null;
    this.musicGain = null;
  }

  destroy() {
    this.stopMusic();
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}
