/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GameProject, SoundPreset, MusicTrack } from '../types';
import { 
  Volume2, 
  Play, 
  Pause, 
  Save, 
  Plus, 
  HelpCircle, 
  Music, 
  Undo2, 
  Redo2, 
  Trash2, 
  Music4, 
  CheckCircle,
  Download
} from 'lucide-react';

interface AudioEditorProps {
  sounds: SoundPreset[];
  music: MusicTrack[];
  onAddSound: (sound: SoundPreset) => void;
  onAddMusic: (music: MusicTrack) => void;
  onUpdateMusic: (track: MusicTrack) => void;
}

// Real 88-key Piano Roll scale list (A0 to C8)
const ALL_NOTES = [
  'A0', 'A#0', 'B0',
  'C1', 'C#1', 'D1', 'D#1', 'E1', 'F1', 'F#1', 'G1', 'G#1', 'A1', 'A#1', 'B1',
  'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2',
  'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
  'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
  'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5',
  'C6', 'C#6', 'D6', 'D#6', 'E6', 'F6', 'F#6', 'G6', 'G#6', 'A6', 'A#6', 'B6',
  'C7', 'C#7', 'D7', 'D#7', 'E7', 'F7', 'F#7', 'G7', 'G#7', 'A7', 'A#7', 'B7',
  'C8'
];

const PIANO_ROLL_NOTES_88 = [...ALL_NOTES].reverse();

interface DrumChannelDef {
  id: string;
  name: string;
  value: string;
  icon: string;
  play: (ctx: AudioContext, vol: number) => void;
}

const playKick = (ctx: AudioContext, vol: number) => {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    
    gain.gain.setValueAtTime(0.3 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    console.warn(e);
  }
};

const playSnare = (ctx: AudioContext, vol: number) => {
  try {
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = buffer;
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.18 * vol, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.12 * vol, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    
    noiseNode.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    
    noiseNode.start();
    osc.start();
    
    noiseNode.stop(ctx.currentTime + 0.18);
    osc.stop(ctx.currentTime + 0.18);
  } catch (e) {
    console.warn(e);
  }
};

const playHiHat = (ctx: AudioContext, vol: number) => {
  try {
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 8000;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    
    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    noiseNode.start();
    noiseNode.stop(ctx.currentTime + 0.06);
  } catch (e) {
    console.warn(e);
  }
};

const playClap = (ctx: AudioContext, vol: number) => {
  try {
    const bufferSize = ctx.sampleRate * 0.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    
    const now = ctx.currentTime;
    gain.gain.linearRampToValueAtTime(0.15 * vol, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.01 * vol, now + 0.015);
    
    gain.gain.linearRampToValueAtTime(0.15 * vol, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01 * vol, now + 0.03);
    
    gain.gain.linearRampToValueAtTime(0.18 * vol, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    
    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    noiseNode.start();
    noiseNode.stop(ctx.currentTime + 0.2);
  } catch (e) {
    console.warn(e);
  }
};

const DRUM_CHANNELS: DrumChannelDef[] = [
  { id: 'kick', name: 'Bumbo (Kick)', value: 'KICK', icon: '🥁', play: playKick },
  { id: 'snare', name: 'Caixa (Snare)', value: 'SNARE', icon: '🥁', play: playSnare },
  { id: 'hihat', name: 'Prato (Hi-Hat)', value: 'HIHAT', icon: '🤖', play: playHiHat },
  { id: 'clap', name: 'Palma (Clap)', value: 'CLAP', icon: '👏', play: playClap },
];

interface KeyboardTimbre {
  id: string;
  name: string;
  wave: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';
  duration: number;
  attack: number;
  decay: number;
}

const KEYBOARD_TIMBRES: KeyboardTimbre[] = [
  { id: 'piano', name: '🎹 Piano Clássico', wave: 'sine', duration: 0.3, attack: 0.01, decay: 0.15 },
  { id: 'chiptune', name: '👾 Arcade Square', wave: 'square', duration: 0.2, attack: 0.01, decay: 0.1 },
  { id: 'brass', name: '🎺 Sopro Retro (Saw)', wave: 'sawtooth', duration: 0.3, attack: 0.06, decay: 0.15 },
  { id: 'flute', name: '🪈 Flauta Doce', wave: 'triangle', duration: 0.4, attack: 0.08, decay: 0.2 },
  { id: 'bell', name: '🔔 Sino de Vidro', wave: 'sine', duration: 0.15, attack: 0.002, decay: 0.25 },
  { id: 'bass', name: '🎸 Baixo Sintético', wave: 'triangle', duration: 0.3, attack: 0.02, decay: 0.08 },
  { id: 'noise_perc', name: '🥁 Percussão Ruído', wave: 'noise', duration: 0.1, attack: 0.005, decay: 0.05 },
];

export default function AudioEditor({ sounds, music, onAddSound, onAddMusic, onUpdateMusic }: AudioEditorProps) {
  // Synth states
  const [synthType, setSynthType] = useState<string>('square');
  const [freq, setFreq] = useState<number>(330);
  const [duration, setDuration] = useState<number>(0.2);
  const [attack, setAttack] = useState<number>(0.05);
  const [decay, setDecay] = useState<number>(0.15);
  const [soundName, setSoundName] = useState<string>('Pulo_Novo');

  // Music sequencer tracker states
  const [activeTrackIdx, setActiveTrackIdx] = useState<number>(0);
  const [isPlayingSeq, setIsPlayingSeq] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [bpm, setBpm] = useState<number>(120);

  // Dynamic sequencer setup
  const [numChannels, setNumChannels] = useState<number>(4);
  const [stepCount, setStepCount] = useState<number>(16);
  const [channelWaves, setChannelWaves] = useState<string[]>([
    'square', 'triangle', 'sawtooth', 'sine', 'square', 'sine', 'triangle', 'sawtooth'
  ]);
  const [channelOffsets, setChannelOffsets] = useState<number[]>([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
  ]);
  const [channelVolumes, setChannelVolumes] = useState<number[]>([
    0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8
  ]);
  const [selectedKeyboardTimbre, setSelectedKeyboardTimbre] = useState<string>('piano');

  // Active placing note "Pluma de Notas" (Paintbrush for notes tracker)
  const [activePaintNote, setActivePaintNote] = useState<string>('C4');

  // Local feedback notification states
  const [showSaveToast, setShowSaveToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Undo / Redo histories for Notes modifications
  const [notesUndoStack, setNotesUndoStack] = useState<Record<string, string>[]>([]);
  const [notesRedoStack, setNotesRedoStack] = useState<Record<string, string>[]>([]);

  // AstroBeat Studio styled states for easy note placement and resizing
  const [selectedPianoChannel, setSelectedPianoChannel] = useState<number>(0);
  const [selectedNoteStep, setSelectedNoteStep] = useState<number | null>(null);
  const [selectedNotePitch, setSelectedNotePitch] = useState<string | null>(null);
  const [activeNoteLength, setActiveNoteLength] = useState<number>(1);
  const [copiedNotes, setCopiedNotes] = useState<Record<string, string> | null>(null);
  const [draggedNote, setDraggedNote] = useState<{ stepIdx: number; pitch: string } | null>(null);

  // AstroBeat Track Colors for gorgeous neon customization
  const CHANNEL_COLORS = [
    { border: 'border-fuchsia-500/30', bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', active: 'border-fuchsia-500 bg-fuchsia-950/40 text-fuchsia-300', fill: 'bg-fuchsia-500 hover:bg-fuchsia-400', raw: '#ec4899', lightBg: 'bg-fuchsia-950/20' },
    { border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', text: 'text-cyan-400', active: 'border-cyan-500 bg-cyan-950/40 text-cyan-300', fill: 'bg-cyan-500 hover:bg-cyan-400', raw: '#06b6d4', lightBg: 'bg-cyan-950/20' },
    { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-400', active: 'border-emerald-500 bg-emerald-950/40 text-emerald-300', fill: 'bg-emerald-500 hover:bg-emerald-400', raw: '#10b981', lightBg: 'bg-emerald-950/20' },
    { border: 'border-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-400', active: 'border-amber-500 bg-amber-950/40 text-amber-300', fill: 'bg-amber-500 hover:bg-amber-400', raw: '#f59e0b', lightBg: 'bg-amber-950/20' },
    { border: 'border-indigo-500/30', bg: 'bg-indigo-500/10', text: 'text-indigo-400', active: 'border-indigo-500 bg-indigo-950/40 text-indigo-300', fill: 'bg-indigo-500 hover:bg-indigo-400', raw: '#6366f1', lightBg: 'bg-indigo-950/20' },
    { border: 'border-rose-500/30', bg: 'bg-rose-500/10', text: 'text-rose-400', active: 'border-rose-500 bg-rose-950/40 text-rose-300', fill: 'bg-rose-500 hover:bg-rose-400', raw: '#f43f5e', lightBg: 'bg-rose-950/20' },
    { border: 'border-teal-500/30', bg: 'bg-teal-500/10', text: 'text-teal-400', active: 'border-teal-500 bg-teal-950/40 text-teal-300', fill: 'bg-teal-500 hover:bg-teal-400', raw: '#14b8a6', lightBg: 'bg-teal-950/20' },
    { border: 'border-yellow-500/30', bg: 'bg-yellow-500/10', text: 'text-yellow-400', active: 'border-yellow-500 bg-yellow-950/40 text-yellow-300', fill: 'bg-yellow-500 hover:bg-yellow-450', raw: '#eab308', lightBg: 'bg-yellow-950/20' },
  ];

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sequencerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const activeTrack = music[activeTrackIdx] || music[0] || { id: 'temp', name: 'Melodia Chiptune 1', bpm: 120, notes: {} };

  const getAudioContext = (): AudioContext => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Convert note name (e.g. C#4, G5) to frequency Hertz
  const getFrequencyForNote = (note: string): number => {
    if (!note) return 0;
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const res = /([A-G]#?)(\d)/.exec(note);
    if (!res) return 440;
    const name = res[1];
    const octave = parseInt(res[2]);

    const semitonesFromA4 = noteNames.indexOf(name) - noteNames.indexOf('A') + (octave - 4) * 12;
    return 440 * Math.pow(2, semitonesFromA4 / 12);
  };

  // Trigger synthesized audio note
  const triggerSynthTone = (
    customFreq?: number, 
    wave?: typeof synthType, 
    customDuration?: number, 
    customAttack?: number, 
    customDecay?: number,
    customVolume?: number
  ) => {
    try {
      const ctx = getAudioContext();
      const actType = wave || synthType;
      const vol = customVolume !== undefined ? customVolume : 0.8;
      
      const att = customAttack !== undefined ? customAttack : attack;
      const dec = customDecay !== undefined ? customDecay : decay;
      const dur = customDuration !== undefined ? customDuration : duration;

      if (actType === 'noise') {
        const bufferSize = Math.max(100, Math.floor(ctx.sampleRate * (att + dec + dur)));
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noiseNode = ctx.createBufferSource();
        noiseNode.buffer = buffer;
        
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2 * vol, ctx.currentTime + Math.max(0.001, att));
        gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + att + dec + dur);
        
        noiseNode.connect(gainNode);
        gainNode.connect(ctx.destination);
        noiseNode.start();
        noiseNode.stop(ctx.currentTime + att + dec + dur + 0.5);
      } else {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        // Base types supported by browser
        const baseType = (actType === 'pulse' || actType === 'organ') ? 'square' : 
                         (actType === 'noise' ? 'square' : actType);
        
        osc.type = baseType as OscillatorType;
        const targetFreq = customFreq || freq;
        osc.frequency.setValueAtTime(targetFreq, ctx.currentTime);

        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2 * vol, ctx.currentTime + Math.max(0.001, att));
        gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + att + dec + dur);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        // Add harmonics for special types
        if (actType === 'organ') {
          const osc2 = ctx.createOscillator();
          const osc3 = ctx.createOscillator();
          osc2.type = 'sine';
          osc3.type = 'triangle';
          osc2.frequency.setValueAtTime(targetFreq * 2, ctx.currentTime); // 1 Octave up
          osc3.frequency.setValueAtTime(targetFreq * 3, ctx.currentTime); // 1 Octave + fifth
          osc2.connect(gainNode);
          osc3.connect(gainNode);
          osc2.start();
          osc2.stop(ctx.currentTime + att + dec + dur + 0.5);
          osc3.start();
          osc3.stop(ctx.currentTime + att + dec + dur + 0.5);
        } else if (actType === 'pulse') {
          // simple sub-osc detune to make it fat
          const sub = ctx.createOscillator();
          sub.type = 'sawtooth';
          sub.frequency.setValueAtTime(targetFreq * 0.99, ctx.currentTime);
          sub.connect(gainNode);
          sub.start();
          sub.stop(ctx.currentTime + att + dec + dur + 0.5);
        }

        osc.start();
        osc.stop(ctx.currentTime + att + dec + dur + 0.5);
      }
    } catch (e) {
      console.warn('Som sintetizado blocked', e);
    }
  };

  // Handle sequencer clock interval triggers with custom waveforms, pitches, and compass beats
  useEffect(() => {
    if (!isPlayingSeq) {
      if (sequencerIntervalRef.current) clearInterval(sequencerIntervalRef.current);
      return;
    }

    const intervalMs = (60000 / (bpm || 120)) / 4; // 16th notes calculation

    sequencerIntervalRef.current = setInterval(() => {
      setCurrentStep(prev => {
        const next = (prev + 1) % stepCount;
        
        // Trigger active row notes for active column step
        const currentMusic = music[activeTrackIdx] || music[0];
        if (currentMusic) {
          // Melodic Channels
          for (let row = 0; row < numChannels; row++) {
            const noteRaw = currentMusic.notes[`${row}:${next}`];
            if (noteRaw) {
              const parts = noteRaw.split(':');
              const noteName = parts[0];
              const lengthMultiplier = parts[1] ? parseInt(parts[1]) : 1;
              const baseF = getFrequencyForNote(noteName);
              const octaveTranspose = channelOffsets[row] || 0;
              const transposedF = baseF * Math.pow(2, octaveTranspose / 12);
              const waveForm = channelWaves[row] || 'square';
              const chVol = channelVolumes[row] !== undefined ? channelVolumes[row] : 0.8;
              
              // Calculate correct duration in seconds based on bpm
              const stepSec = (60 / (bpm || 120)) / 4;
              const customDuration = stepSec * lengthMultiplier;

              // Synthesize tone with custom duration, slight release padding
              triggerSynthTone(transposedF, waveForm, customDuration * 0.95, 0.015, customDuration * 0.75, chVol);
            }
          }

          // Drum Sequencer Channels (offset 12 to 15 in channelVolumes)
          const ctx = getAudioContext();
          DRUM_CHANNELS.forEach((drum, dIdx) => {
            const doubleKey = `drum:${dIdx}:${next}`;
            if (currentMusic.notes[doubleKey] === drum.value) {
              const dVol = channelVolumes[12 + dIdx] !== undefined ? channelVolumes[12 + dIdx] : 0.8;
              drum.play(ctx, dVol);
            }
          });
        }

        return next;
      });
    }, intervalMs);

    return () => {
      if (sequencerIntervalRef.current) clearInterval(sequencerIntervalRef.current);
    };
  }, [isPlayingSeq, bpm, activeTrackIdx, music, numChannels, stepCount, channelWaves, channelOffsets, channelVolumes]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setDraggedNote(null);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // Helper to move notes via drag and drop on the piano roll
  const moveNote = (fromStep: number, fromPitch: string, toStep: number, toPitch: string) => {
    const currentTrack = music[activeTrackIdx] || music[0];
    if (!currentTrack) return;
    const fromKey = `${selectedPianoChannel}:${fromStep}`;
    const toKey = `${selectedPianoChannel}:${toStep}`;
    const noteDataRaw = currentTrack.notes[fromKey];
    if (!noteDataRaw) return;
    
    const notesCopy = { ...currentTrack.notes };
    // Delete original
    delete notesCopy[fromKey];
    // Place at new key preserving its duration
    const len = noteDataRaw.split(':')[1] ? parseInt(noteDataRaw.split(':')[1]) : 1;
    notesCopy[toKey] = `${toPitch}:${len}`;
    
    onUpdateMusic({ ...currentTrack, notes: notesCopy });
    saveSequencerStateToUndo(notesCopy);

    // Update active selection parameters
    setSelectedNoteStep(toStep);
    setSelectedNotePitch(toPitch);

    // Audio preview trigger
    const activeWave = channelWaves[selectedPianoChannel] || 'square';
    const chVol = channelVolumes[selectedPianoChannel] !== undefined ? channelVolumes[selectedPianoChannel] : 0.8;
    const stepSec = (60 / (bpm || 120)) / 4;
    triggerSynthTone(getFrequencyForNote(toPitch), activeWave, stepSec * len * 0.9, 0.012, stepSec * len * 0.7, chVol);
  };

  // Helper to change note length directly inside the piano roll grid cell
  const changeNoteLength = (stepIdx: number, pitch: string, delta: number) => {
    const currentTrack = music[activeTrackIdx] || music[0];
    if (!currentTrack) return;
    const key = `${selectedPianoChannel}:${stepIdx}`;
    const noteDataRaw = currentTrack.notes[key];
    if (!noteDataRaw) return;
    const oldLen = noteDataRaw.split(':')[1] ? parseInt(noteDataRaw.split(':')[1]) : 1;
    const newLen = Math.max(1, Math.min(16, oldLen + delta));
    const notesCopy = { ...currentTrack.notes };
    notesCopy[key] = `${pitch}:${newLen}`;
    onUpdateMusic({ ...currentTrack, notes: notesCopy });
    saveSequencerStateToUndo(notesCopy);
    
    setSelectedNoteStep(stepIdx);
    setSelectedNotePitch(pitch);

    const activeWave = channelWaves[selectedPianoChannel] || 'square';
    const chVol = channelVolumes[selectedPianoChannel] !== undefined ? channelVolumes[selectedPianoChannel] : 0.8;
    const stepSec = (60 / (bpm || 120)) / 4;
    triggerSynthTone(getFrequencyForNote(pitch), activeWave, stepSec * newLen * 0.9, 0.012, stepSec * newLen * 0.7, chVol);
  };

  // Helper to delete individual notes via direct click or trash icon
  const deleteNote = (stepIdx: number, pitch: string) => {
    const currentTrack = music[activeTrackIdx] || music[0];
    if (!currentTrack) return;
    const key = `${selectedPianoChannel}:${stepIdx}`;
    const notesCopy = { ...currentTrack.notes };
    delete notesCopy[key];
    onUpdateMusic({ ...currentTrack, notes: notesCopy });
    saveSequencerStateToUndo(notesCopy);
    if (selectedNoteStep === stepIdx && selectedNotePitch === pitch) {
      setSelectedNoteStep(null);
      setSelectedNotePitch(null);
    }
  };

  // Setup undo once for sequencer edits
  const saveSequencerStateToUndo = (notesState: Record<string, string>) => {
    setNotesUndoStack(prev => [...prev, { ...notesState }].slice(-40));
    setNotesRedoStack([]); // Clear Redo list
  };

  const handleNotesUndo = () => {
    if (notesUndoStack.length <= 1) {
      // If only 1, restore initial empty state or block
      if (notesUndoStack.length === 1) {
        const prev = notesUndoStack[0];
        onUpdateMusic({ ...activeTrack, notes: {} });
        setNotesUndoStack([]);
        setNotesRedoStack(p => [...p, { ...prev }]);
      }
      return;
    }
    const current = notesUndoStack[notesUndoStack.length - 1];
    const previous = notesUndoStack[notesUndoStack.length - 2];

    const copy = { ...previous };
    onUpdateMusic({
      ...activeTrack,
      notes: copy
    });

    setNotesUndoStack(prev => prev.slice(0, -1));
    setNotesRedoStack(prev => [...prev, { ...current }]);
  };

  const handleNotesRedo = () => {
    if (notesRedoStack.length === 0) return;
    const nextState = notesRedoStack[notesRedoStack.length - 1];

    onUpdateMusic({
      ...activeTrack,
      notes: { ...nextState }
    });

    setNotesUndoStack(prev => [...prev, { ...nextState }]);
    setNotesRedoStack(prev => prev.slice(0, -1));
  };

  // Click on a cell: Paint the active selected note OR delete note
  const handleSequencerCellClick = (rowIdx: number, stepIdx: number) => {
    if (!activeTrack) return;

    if (notesUndoStack.length === 0) {
      setNotesUndoStack([{ ...activeTrack.notes }]);
    }

    const key = `${rowIdx}:${stepIdx}`;
    const notesCopy = { ...activeTrack.notes };
    const currentNoteValue = notesCopy[key] || '';

    if (activePaintNote === 'eraser') {
      // Eraser active: clear this step
      if (currentNoteValue) {
        delete notesCopy[key];
      }
    } else {
      // Paint active paint note
      if (currentNoteValue === activePaintNote) {
        // Double click/same click toggles / deletes
        delete notesCopy[key];
      } else {
        notesCopy[key] = activePaintNote;
        // Test note tonal sound briefly on placement
        triggerSynthTone(getFrequencyForNote(activePaintNote), 'square', 0.1, 0.01, 0.04);
      }
    }

    saveSequencerStateToUndo(notesCopy);

    onUpdateMusic({
      ...activeTrack,
      notes: notesCopy
    });
  };

  // Specific dropdown modification for precise adjustments
  const handleCellSelectChange = (rowIdx: number, stepIdx: number, value: string) => {
    if (!activeTrack) return;

    if (notesUndoStack.length === 0) {
      setNotesUndoStack([{ ...activeTrack.notes }]);
    }

    const key = `${rowIdx}:${stepIdx}`;
    const notesCopy = { ...activeTrack.notes };

    if (value === '') {
      delete notesCopy[key];
    } else {
      notesCopy[key] = value;
      triggerSynthTone(getFrequencyForNote(value), 'square', 0.1, 0.01, 0.04);
    }

    saveSequencerStateToUndo(notesCopy);

    onUpdateMusic({
      ...activeTrack,
      notes: notesCopy
    });
  };

  // Save current SFX preset
  const handleSaveSynthPreset = () => {
    const newSound: SoundPreset = {
      id: 'sound_' + Math.random().toString(36).substr(2, 9),
      name: soundName.replace(/\s+/g, '_'),
      type: synthType,
      frequency: freq,
      duration: duration,
      attack: attack,
      decay: decay,
      sustain: 0.1,
      release: 0.1
    };
    onAddSound(newSound);
    triggerSynthTone();

    // Trigger sweet feedback message
    setToastMessage(`Preset SFX "${newSound.name}" registrado com sucesso!`);
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 3500);
  };

  // Create new music track in App listing
  const handleCreateMusicTrack = () => {
    const newTrack: MusicTrack = {
      id: 'music_' + Math.random().toString(36).substr(2, 9),
      name: 'Melodia_Chiptune_' + (music.length + 1),
      bpm: 120,
      notes: {}
    };
    onAddMusic(newTrack);
    setActiveTrackIdx(music.length);

    setNotesUndoStack([]);
    setNotesRedoStack([]);
  };

  // Play a beautiful piano sweep melody test with selected keyboard timbre
  const triggerPianoKeyClick = (noteStr: string) => {
    setActivePaintNote(noteStr);
    const hz = getFrequencyForNote(noteStr);
    const activeTimbre = KEYBOARD_TIMBRES.find(t => t.id === selectedKeyboardTimbre) || KEYBOARD_TIMBRES[0];
    triggerSynthTone(hz, activeTimbre.wave, activeTimbre.duration, activeTimbre.attack, activeTimbre.decay);
  };

  // EXPLICIT ACTION: Save the melody for use inside the game triggers
  const handleSaveMelodyForGame = () => {
    if (!activeTrack) return;

    // Explicitly update BPM and notes
    onUpdateMusic({
      ...activeTrack,
      bpm: bpm
    });

    setToastMessage(`Melodia "${activeTrack.name}" sincronizada e salva com êxito para o Game!`);
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 4000);
  };

  // Export current active track notes as file format download
  const handleDownloadMelodyJSON = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeTrack, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${activeTrack.name}_notes.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch(e) {
      console.error(e);
    }
  };

  // Dynamic 88-Key Piano roll generator (Keys range from A0 to C8)
  const generate88PianoKeys = () => {
    const list: { note: string, type: 'white' | 'black' }[] = [];
    const chromaticNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // 1. Octave 0 white and b keys
    list.push({ note: 'A0', type: 'white' });
    list.push({ note: 'A#0', type: 'black' });
    list.push({ note: 'B0', type: 'white' });

    // 2. Octaves 1 to 7
    for (let oct = 1; oct <= 7; oct++) {
      chromaticNames.forEach(name => {
        list.push({
          note: `${name}${oct}`,
          type: name.includes('#') ? 'black' : 'white'
        });
      });
    }

    // 3. Octave 8 (C8)
    list.push({ note: 'C8', type: 'white' });
    return list;
  };

  const pianoKeys = generate88PianoKeys();

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#0f1015]" id="audio_editor_root">
      
      {/* FLOATING SUCCESS NOTIFICATION TOAST */}
      {showSaveToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#161720] border-2 border-emerald-500 rounded-xl p-4 shadow-2xl flex items-center gap-3 animate-bounce shrink-0 min-w-[300px]" id="save_success_toast">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <span className="text-xs font-bold text-white block">Sucesso!</span>
            <p className="text-[10px] text-gray-300 leading-normal">{toastMessage}</p>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* TOP HEADER TITLE */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-emerald-400" />
              Sintetizador SFX e Sequenciador de Músicas
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Gere seus efeitos sonoros em tempo real e crie arranjos com a escala cromática completa (sustenidos e todas as notas musicais) para usar em seu jogo!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* LEFT: Retro SFX Synthesizer panel */}
          <div className="bg-[#181922] border border-[#272834] rounded-xl p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#4ade80] uppercase tracking-wider flex items-center gap-1.5">
                <span>⚡</span> Gerador de Efeitos Sonoros SFX (8-Bit)
              </h3>
              <span className="text-[10px] bg-slate-800 text-slate-400 font-mono px-2 py-0.5 rounded">OSCILADOR WEB</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1 font-semibold">Nome do Som:</label>
                <input
                  type="text"
                  value={soundName}
                  onChange={(e) => setSoundName(e.target.value)}
                  className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded focus:border-emerald-500 font-mono"
                  placeholder="Nome sfx"
                />
              </div>

              {/* Osc Wave Selectors */}
              <div>
                <label className="text-xs text-gray-400 block mb-1.5 font-semibold">Tipo do Sinal (Forma de Onda):</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['square', 'triangle', 'sawtooth', 'sine', 'noise', 'pulse', 'organ'].map(wt => (
                    <button
                      key={wt}
                      onClick={() => {
                        setSynthType(wt);
                        triggerSynthTone(freq, wt);
                      }}
                      className={`text-[10px] py-1.5 rounded text-center font-semibold capitalize border transition-all ${
                        synthType === wt
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-md font-bold'
                          : 'bg-[#1e1f29] border-transparent text-gray-400 hover:text-white'
                      }`}
                    >
                      {wt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider Freq */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Frequência Base:</span>
                  <span className="font-mono text-emerald-400">{freq} Hz</span>
                </div>
                <input
                  type="range"
                  min="52"
                  max="1700"
                  value={freq}
                  onChange={(e) => setFreq(parseInt(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* Attack slider */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Ataque (Attack Rampa):</span>
                  <span className="font-mono text-emerald-400">{attack}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.01"
                  value={attack}
                  onChange={(e) => setAttack(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* Decay slider */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Decaimento (Decay Fração):</span>
                  <span className="font-mono text-emerald-400">{decay}s</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.8"
                  step="0.01"
                  value={decay}
                  onChange={(e) => setDecay(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* Wave Duration slider */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Duração total:</span>
                  <span className="font-mono text-emerald-400">{duration}s</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1.2"
                  step="0.05"
                  value={duration}
                  onChange={(e) => setDuration(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  onClick={() => triggerSynthTone()}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-950 py-2.5 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer"
                >
                  🔊 Testar Som SFX
                </button>
                <button
                  onClick={handleSaveSynthPreset}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Registrar SFX
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Active Registered Audio Presets */}
          <div className="bg-[#181922] border border-[#272834] rounded-xl p-5 flex flex-col justify-between shadow-lg" id="sfx_registers">
            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>🔊</span> Lista de SFX Registrados
            </h4>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[300px] min-h-[160px]">
              {sounds.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-8">
                  <span className="text-2xl text-gray-600">🚷</span>
                  <p className="text-[11px] text-gray-500 italic mt-2">Nenhum som registrado ainda. Crie ao lado para poder ser usado em colisões ou heróis!</p>
                </div>
              ) : (
                sounds.map(sound => (
                  <div 
                    key={sound.id}
                    className="flex justify-between items-center bg-[#1e202b] border border-[#2d2e3d] p-2.5 rounded-lg hover:border-emerald-500/20 transition-all group"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">"{sound.name}"</span>
                      <span className="text-[9px] text-[#22c55e] font-mono">{sound.frequency}Hz | {sound.type}</span>
                    </div>
                    <button
                      onClick={() => triggerSynthTone(sound.frequency, sound.type, sound.duration, sound.attack, sound.decay)}
                      className="text-[10px] bg-emerald-950/40 border border-emerald-800 text-emerald-400 hover:bg-emerald-600 hover:text-white px-2.5 py-1 rounded transition-all font-medium"
                    >
                      Play 🔊
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="bg-emerald-950/25 border border-emerald-900/40 rounded p-2.5 mt-2 flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-emerald-300/85 leading-normal">
                Dons de efeitos sonoros podem ser acoplados diretamente ao seu jogo na folha de eventos logísticos!
              </p>
            </div>
          </div>
        </div>

        {/* 16-STEP MIDI SEQUENCER (CHIPTUNE TRACKS) - SYNTHWEAVE STUDIO STYLE REDESIGN */}
        <div className="bg-[#0b0c11] border-2 border-slate-900 rounded-2xl p-6 space-y-6 shadow-2xl relative overflow-hidden select-none" id="sequencer_tracker_card">
          
          {/* HEADER ROW CONTROLS */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-900 pb-5 gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center animate-pulse">
                <Music className="w-5 h-5 text-fuchsia-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
                  SYNTHWEAVE STUDIO <span className="text-[10px] py-0.5 px-1.5 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded text-fuchsia-400 font-mono">Sequencer v3.5</span>
                </h3>
                <p className="text-[10px] text-slate-500 font-medium">Estúdio de produção musical chiptune multitrilha com Piano Roll de alta precisão</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-[#13141f] p-2 rounded-xl border border-slate-850">
              <div className="flex items-center gap-2 pr-2 border-r border-slate-800">
                <span className="text-[10px] text-slate-500 font-mono uppercase font-bold">Trilha:</span>
                <select
                  value={activeTrackIdx}
                  onChange={(e) => {
                    setActiveTrackIdx(parseInt(e.target.value));
                    setNotesUndoStack([]);
                    setNotesRedoStack([]);
                    setSelectedNoteStep(null);
                    setSelectedNotePitch(null);
                  }}
                  className="bg-[#0c0d12] text-xs text-fuchsia-300 font-mono font-bold border border-slate-850 p-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-fuchsia-500 cursor-pointer"
                >
                  {music.map((item, idx) => (
                    <option key={item.id} value={idx}>{item.name}</option>
                  ))}
                </select>

                <button
                  onClick={handleCreateMusicTrack}
                  className="p-1.5 px-2 bg-fuchsia-600 hover:bg-fuchsia-505 text-white rounded-lg transition-all font-bold flex items-center gap-1 cursor-pointer hover:shadow-lg"
                  title="Criar nova trilha"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* TIMING CONTROL IN SYNTHWEAVE STUDIO BLUE-PINK COLORS */}
              <div className="flex items-center gap-2 pr-2 border-r border-slate-800">
                <span className="text-[10px] text-slate-500 font-mono font-bold">BPM:</span>
                <input
                  type="number"
                  min="60"
                  max="240"
                  value={bpm}
                  onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
                  className="w-12 bg-[#0c0d12] border border-slate-800 text-xs text-cyan-400 rounded-lg p-1 text-center font-mono font-bold focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              {/* UNDO / REDO FOR NOTES */}
              <div className="flex items-center gap-1 px-1 border-r border-slate-800">
                <button
                  onClick={handleNotesUndo}
                  className="p-1 px-2.5 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-400 hover:text-white rounded border border-slate-800 flex items-center gap-1 font-semibold transition-colors"
                  title="Desfazer nota"
                >
                  <Undo2 className="w-3 h-3" />
                </button>
                <button
                  onClick={handleNotesRedo}
                  className="p-1 px-2.5 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-400 hover:text-white rounded border border-slate-800 flex items-center gap-1 font-semibold transition-colors"
                  title="Refazer nota"
                >
                  <Redo2 className="w-3 h-3" />
                </button>
              </div>

              <button
                onClick={() => setIsPlayingSeq(!isPlayingSeq)}
                className={`py-1.5 px-3.5 text-xs font-black rounded-lg flex items-center gap-2 transition-all active:scale-95 cursor-pointer shadow-lg ${
                  isPlayingSeq 
                    ? 'bg-amber-600 text-white shadow-amber-955/30' 
                    : 'bg-fuchsia-600 text-white hover:bg-fuchsia-500 shadow-fuchsia-955/30'
                }`}
              >
                {isPlayingSeq ? <Pause className="w-3.5 h-3.5 animate-pulse" /> : <Play className="w-3.5 h-3.5" />}
                {isPlayingSeq ? 'PAUSAR SOLO' : 'PRODUZIR SOLO'}
              </button>
            </div>
          </div>

          {/* PLAYBACK STEPS COUNTER TIMELINE PREVIEW */}
          <div className="flex items-center bg-[#13141f] border border-slate-850 p-2 rounded-xl text-xs font-mono font-bold text-slate-400">
            <span className="w-48 shrink-0 text-[10px] uppercase text-emerald-400 tracking-wider">⏱ COMPASSOS ATIVOS</span>
            <div className="flex-1 flex gap-1">
              {Array.from({ length: stepCount }).map((_, stepIdx) => {
                const isHeading = stepIdx % 4 === 0;
                const isCurrent = currentStep === stepIdx && isPlayingSeq;
                return (
                  <span 
                    key={stepIdx} 
                    className={`flex-1 text-center py-1 rounded text-[10px] transition-all ${
                      isCurrent 
                        ? 'bg-[#ec4899] text-white font-black scale-105 shadow-md shadow-fuchsia-955/30' 
                        : isHeading
                        ? 'text-cyan-400 bg-slate-900/40 border border-slate-800/60 font-black'
                        : 'text-slate-600'
                    }`}
                  >
                    {(stepIdx + 1).toString().padStart(2, '0')}
                  </span>
                );
              })}
            </div>
          </div>

          {/* SynthWeave Studio Playlist Rack Lanes Panel */}
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="text-[11px] font-bold text-slate-400 tracking-widest uppercase flex items-center gap-1.5">
                <span className="text-cyan-400">⚡</span> RACK DE INSTRUMENTOS (VIRTUAL CHANNELS)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-500 font-semibold uppercase">Canais visíveis:</span>
                <div className="flex bg-[#13141f] rounded-lg p-0.5 border border-slate-850 text-[10px] font-mono leading-none">
                  <button 
                    onClick={() => setNumChannels(prev => Math.max(2, prev - 1))} 
                    className="p-1 px-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded font-black cursor-pointer"
                  >-</button>
                  <span className="p-1 px-3 text-fuchsia-400 bg-[#0c0d12] rounded-md font-black">{numChannels} CH</span>
                  <button 
                    onClick={() => setNumChannels(prev => Math.min(8, prev + 1))} 
                    className="p-1 px-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded font-black cursor-pointer"
                  >+</button>
                </div>
              </div>
            </div>

            {/* CHANNEL RACK ITEMS */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {Array.from({ length: numChannels }).map((_, rowIdx) => {
                const currentTrack = music[activeTrackIdx] || music[0];
                const activeWave = channelWaves[rowIdx] || 'square';
                const activeOffset = channelOffsets[rowIdx] || 0;
                const chVol = channelVolumes[rowIdx] !== undefined ? channelVolumes[rowIdx] : 0.8;
                const theme = CHANNEL_COLORS[rowIdx] || CHANNEL_COLORS[0];
                const isSelectedForRoll = selectedPianoChannel === rowIdx;

                return (
                  <div 
                    key={rowIdx} 
                    className={`flex flex-col md:flex-row gap-3 items-stretch bg-[#11121d]/85 p-3 rounded-xl border transition-all ${
                      isSelectedForRoll 
                        ? 'border-fuchsia-500 shadow-xl shadow-fuchsia-955/10 bg-[#161424]' 
                        : 'border-slate-900/60 hover:border-slate-800 hover:bg-[#131422]'
                    }`}
                  >
                    {/* LEFT: SynthWeave Studio Channel Controller Knob Box */}
                    <div className="w-full md:w-48 shrink-0 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-905 pr-0 md:pr-3 pb-2.5 md:pb-0">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${theme.fill} animate-pulse shadow-md`} />
                          <span className={`text-[11px] font-black uppercase font-mono ${theme.text}`}>
                            CH0{rowIdx + 1} • {activeWave.toUpperCase()}
                          </span>
                        </div>

                        {/* Mute and Solo knobs mimicking SynthWeave Studio button styling */}
                        <div className="flex items-center gap-1 text-[8.5px] font-mono leading-none">
                          <button 
                            onClick={() => {
                              const volsCopy = [...channelVolumes];
                              volsCopy[rowIdx] = volsCopy[rowIdx] === 0 ? 0.8 : 0;
                              setChannelVolumes(volsCopy);
                            }}
                            className={`w-4 h-4 rounded text-center font-bold font-mono text-[8px] transition-all cursor-pointer ${
                              chVol === 0 ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                            title="Mute"
                          >
                            M
                          </button>
                          <button 
                            onClick={() => {
                              // Solo: mute all other channels
                              const volsCopy = channelVolumes.map((v, idx) => idx === rowIdx ? 0.8 : 0);
                              setChannelVolumes(volsCopy);
                            }}
                            className={`w-4 h-4 rounded text-center font-bold font-mono text-[8px] transition-all cursor-pointer bg-slate-800 hover:bg-slate-700 text-amber-500`}
                            title="Solo"
                          >
                            S
                          </button>
                        </div>
                      </div>

                      {/* Customize wave and pitch for this channel lane */}
                      <div className="flex items-center gap-1.5 mt-2 justify-between">
                        <select
                          value={activeWave}
                          onChange={(e) => {
                            const wavesCopy = [...channelWaves];
                            wavesCopy[rowIdx] = e.target.value as any;
                            setChannelWaves(wavesCopy);
                          }}
                          className="bg-[#0b0c12] text-[9px] text-[#94a3b8] font-bold font-mono border border-slate-850 rounded py-0.5 px-1 cursor-pointer focus:ring-1 focus:ring-fuchsia-500"
                        >
                          <option value="square">SQUARE ▢</option>
                          <option value="sine">SINE ∿</option>
                          <option value="triangle">TRIANGLE 𝝠</option>
                          <option value="sawtooth">SAW 𝝡</option>
                          <option value="pulse">PULSE ⎍</option>
                          <option value="organ">ORGAN 🎹</option>
                          <option value="noise">NOISE ♒</option>
                          <option value="subbass">SUB BASS</option>
                          <option value="acid">ACID SAW</option>
                        </select>

                        <div className="flex items-center gap-1">
                          <span className="text-[8.5px] text-slate-500 font-bold uppercase font-mono">OCT:</span>
                          <select
                            value={activeOffset}
                            onChange={(e) => {
                              const offsetsCopy = [...channelOffsets];
                              offsetsCopy[rowIdx] = parseInt(e.target.value);
                              setChannelOffsets(offsetsCopy);
                            }}
                            className="bg-[#0b0c12] text-[9px] text-emerald-400 font-bold font-mono border border-slate-850 rounded py-0.5 px-1 cursor-pointer focus:ring-1 focus:ring-fuchsia-500"
                          >
                            <option value="-24">-24</option>
                            <option value="-12">-12</option>
                            <option value="-7">-7</option>
                            <option value="-5">-5</option>
                            <option value="0">STD</option>
                            <option value="5">+5</option>
                            <option value="7">+7</option>
                            <option value="12">+12</option>
                            <option value="24">+24</option>
                          </select>
                        </div>
                      </div>

                      {/* Volume Slider Rail */}
                      <div className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-900/30">
                        <span className="text-[8px] text-slate-500 font-black uppercase font-mono">VOL:</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={chVol}
                          onChange={(e) => {
                            const volsCopy = [...channelVolumes];
                            volsCopy[rowIdx] = parseFloat(e.target.value);
                            setChannelVolumes(volsCopy);
                          }}
                          className="w-full accent-fuchsia-500 h-1 bg-[#090a0f] rounded-lg cursor-pointer"
                        />
                        <span className="text-[8px] font-mono font-bold text-slate-400 w-6 text-right">
                          {Math.round(chVol * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* RIGHT: Playlist clip view grid displaying existing notes as horizontal bars */}
                    <div className="flex-1 flex flex-col gap-1.5 justify-center">
                      <div className="flex justify-between items-center bg-slate-950/30 px-2 py-1 rounded">
                        <span className="text-[9px] text-slate-500 font-bold font-mono">CLIPS DE COMPASSO (GRID PREVIEW)</span>
                        <button
                          onClick={() => setSelectedPianoChannel(rowIdx)}
                          className={`text-[9.5px] font-black uppercase px-2.5 py-0.5 rounded transition-all cursor-pointer ${
                            isSelectedForRoll 
                              ? 'bg-fuchsia-600 text-white shadow-md' 
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          🎹 ABRIR PIANO ROLL
                        </button>
                      </div>

                      {/* Horizontal note arrangement line timeline display */}
                      <div className="flex gap-1 items-center bg-[#090a10] rounded-xl p-2 border border-slate-900 relative min-h-[46px] overflow-hidden">
                        
                        {/* Playback progress bar shade */}
                        {isPlayingSeq && (
                          <div 
                            className="absolute top-0 bottom-0 w-[4px] bg-amber-500/80 shadow-md z-30 transition-all pointer-events-none"
                            style={{ left: `calc((${currentStep} / ${stepCount}) * 100%)` }}
                          />
                        )}

                        {Array.from({ length: stepCount }).map((_, stepIdx) => {
                          const noteDataRaw = currentTrack?.notes[`${rowIdx}:${stepIdx}`];
                          if (!noteDataRaw) {
                            return (
                              <div 
                                key={stepIdx} 
                                onClick={() => setSelectedPianoChannel(rowIdx)}
                                className="flex-1 h-8 rounded border border-transparent hover:bg-slate-800/10 cursor-pointer text-[8px] flex items-center justify-center transition-colors"
                              >
                                <span className="opacity-0 hover:opacity-100 text-slate-500">•</span>
                              </div>
                            );
                          }

                          // If note exists, parse pitch and width length
                          const parts = noteDataRaw.split(':');
                          const notePitch = parts[0];
                          const lengthMultiplier = parts[1] ? parseInt(parts[1]) : 1;

                          return (
                            <div 
                              key={stepIdx}
                              onClick={() => {
                                setSelectedPianoChannel(rowIdx);
                                setSelectedNoteStep(stepIdx);
                                setSelectedNotePitch(notePitch);
                                setActiveNoteLength(lengthMultiplier);
                                triggerSynthTone(getFrequencyForNote(notePitch), activeWave, 0.15, 0.01, 0.05, chVol);
                              }}
                              className={`rounded-md border p-1 select-none flex flex-col justify-center items-center transition-all cursor-pointer shadow-md text-center max-w-[200px] ${
                                selectedNoteStep === stepIdx && isSelectedForRoll
                                  ? 'border-white bg-slate-900 ring-2 ring-fuchsia-500 ring-offset-2 ring-offset-slate-950 z-20'
                                  : `${theme.border} ${theme.bg} ${theme.text}`
                              }`}
                              style={{
                                flex: lengthMultiplier,
                                minWidth: `${30 * lengthMultiplier}px`,
                              }}
                              title={`Nota: ${notePitch}, Duração: ${lengthMultiplier} passos`}
                            >
                              <span className="text-[10px] uppercase font-black tracking-tighter leading-tight block">
                                {notePitch}
                              </span>
                              <span className="text-[7.5px] opacity-75 font-mono leading-none block font-semibold text-center w-full">
                                {lengthMultiplier}x
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. THE GRAND INTERACTIVE PIANO ROLL WORKSTATION */}
          <div className="bg-[#10111a] p-4.5 rounded-2xl border-2 border-slate-900 space-y-4 shadow-xl">
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-900 pb-3.5 gap-3.5 rounded">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <Play className="w-4 h-4 text-cyan-400 rotate-90" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
                    PIANO ROLL ESTÚDIO — CANAL {selectedPianoChannel + 1}
                  </h4>
                  <p className="text-[9px] text-[#94a3b8] font-semibold font-mono uppercase">
                    Selecione compasso e nota para gerar sonoridades complexas com o mouse
                  </p>
                </div>
              </div>

              {/* CHANNEL COPY / PASTE / CLEAR SYSTEM TRIMS */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => {
                    const copied: Record<string, string> = {};
                    const currentTrack = music[activeTrackIdx] || music[0];
                    if (currentTrack) {
                      Object.entries(currentTrack.notes).forEach(([k, v]) => {
                        if (k.startsWith(`${selectedPianoChannel}:`)) {
                          const stepIdx = k.split(':')[1];
                          copied[stepIdx] = v;
                        }
                      });
                      setCopiedNotes(copied);
                      setToastMessage(`Notas do Canal ${selectedPianoChannel + 1} copiadas!`);
                      setShowSaveToast(true);
                      setTimeout(() => setShowSaveToast(false), 2000);
                    }
                  }}
                  className="px-2.5 py-1 text-[9px] font-bold bg-[#13141f] border border-slate-850 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Copiar todas as notas deste canal"
                >
                  📄 Copiar Canal
                </button>
                
                <button
                  onClick={() => {
                    if (!copiedNotes) {
                      setToastMessage("Selecione Copiar Canal primeiro!");
                      setShowSaveToast(true);
                      setTimeout(() => setShowSaveToast(false), 2000);
                      return;
                    }
                    const currentTrack = music[activeTrackIdx] || music[0];
                    if (currentTrack) {
                      const notesCopy = { ...currentTrack.notes };
                      // clear target channel first
                      Object.keys(notesCopy).forEach(k => {
                        if (k.startsWith(`${selectedPianoChannel}:`)) {
                          delete notesCopy[k];
                        }
                      });
                      // apply copied notes
                      Object.entries(copiedNotes).forEach(([stepStr, val]) => {
                        notesCopy[`${selectedPianoChannel}:${stepStr}`] = val as string;
                      });
                      onUpdateMusic({ ...currentTrack, notes: notesCopy });
                      saveSequencerStateToUndo(notesCopy);
                      setToastMessage(`Notas coladas no Canal ${selectedPianoChannel + 1}!`);
                      setShowSaveToast(true);
                      setTimeout(() => setShowSaveToast(false), 2000);
                    }
                  }}
                  className="px-2.5 py-1 text-[9px] font-bold bg-[#13141f] border border-slate-850 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Colar notas copiadas neste canal"
                >
                  📋 Colar Notas
                </button>

                <button
                  onClick={() => {
                    const currentTrack = music[activeTrackIdx] || music[0];
                    if (currentTrack && window.confirm("Limpar todas as notas deste canal?")) {
                      const notesCopy = { ...currentTrack.notes };
                      Object.keys(notesCopy).forEach(k => {
                        if (k.startsWith(`${selectedPianoChannel}:`)) {
                          delete notesCopy[k];
                        }
                      });
                      onUpdateMusic({ ...currentTrack, notes: notesCopy });
                      saveSequencerStateToUndo(notesCopy);
                      setSelectedNoteStep(null);
                      setSelectedNotePitch(null);
                    }
                  }}
                  className="px-2.5 py-1 text-[9px] font-bold bg-rose-950/20 border border-rose-900/30 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-900/10 transition-colors cursor-pointer"
                >
                  🧹 Limpar Canal
                </button>
              </div>
            </div>

            {/* GRAND INTERACTIVE MIDI PIANO KEYS AND GRID TIMELINE */}
            <div className="border-2 border-slate-950 rounded-xl bg-[#0c0d12] max-h-[380px] overflow-auto relative flex select-none no-scrollbar">
              
              {/* VERTICAL SCROLLABLE PIANO ROLL KEYBOARD COLUMN */}
              <div className="sticky left-0 z-40 w-[64px] bg-[#11121d] flex flex-col select-none shrink-0 border-r border-[#191a27] shadow-[4px_0_15px_rgba(0,0,0,0.6)]">
                {/* STICKY TOP-LEFT CORNER CAP */}
                <div className="sticky top-0 z-50 w-full h-8 bg-[#11121d] border-b border-[#1a1b28]/80 shrink-0 flex items-center justify-center font-mono text-[8.5px] text-fuchsia-400 font-black tracking-wider uppercase shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                  Tom
                </div>

                {PIANO_ROLL_NOTES_88.map((pitch) => {
                  const isBlackKey = pitch.includes('#');
                  const currentTrack = music[activeTrackIdx] || music[0];
                  const isPitchTriggeredInRoll = Object.values(currentTrack?.notes || {}).some(v => (v as string).split(':')[0] === pitch);
                  
                  return (
                    <div
                      key={pitch}
                      onClick={() => {
                        const activeWave = channelWaves[selectedPianoChannel] || 'square';
                        const chVol = channelVolumes[selectedPianoChannel] !== undefined ? channelVolumes[selectedPianoChannel] : 0.8;
                        triggerSynthTone(getFrequencyForNote(pitch), activeWave, 0.35, 0.01, 0.12, chVol);
                        setActivePaintNote(pitch);
                      }}
                      className={`h-[32px] w-[64px] shrink-0 border-b border-[#181926] px-1.5 flex items-center justify-between text-[8px] font-mono select-none cursor-pointer group transition-colors ${
                        isBlackKey 
                          ? 'bg-black text-slate-300 hover:bg-slate-900 shadow-inner' 
                          : 'bg-white text-slate-800 hover:bg-slate-100'
                      } ${isPitchTriggeredInRoll ? 'ring-2 ring-inset ring-amber-500/25' : ''}`}
                    >
                      <span className={`font-black uppercase tracking-tight text-[8px] ${isBlackKey ? 'text-slate-400' : 'text-slate-800'}`}>
                        {pitch}
                      </span>
                      {isBlackKey ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-750 block shrink-0" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-200 block shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* GRID INTERACTIVE STEPS WORKSPACE */}
              <div className="flex-1 flex flex-col relative min-w-max">
                
                {/* Timeline Header steps index info */}
                <div className="flex bg-[#0b0c11] border-b border-[#1c1d2e] select-none text-[8.5px] font-mono leading-none tracking-wider text-slate-400 sticky top-0 z-30 h-8 shrink-0 items-center animate-fade-in shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                  {Array.from({ length: stepCount }).map((_, stepIdx) => {
                    const isBeat = stepIdx % 4 === 0;
                    return (
                      <div 
                        key={stepIdx} 
                        className={`flex-1 text-center py-2 border-r border-[#151622] min-w-[64px] max-w-[64px] ${
                          isBeat ? 'text-fuchsia-400 bg-fuchsia-950/10 font-bold' : ''
                        }`}
                      >
                        B{(Math.floor(stepIdx / 4) + 1)}:{((stepIdx % 4) + 1)}
                      </div>
                    );
                  })}
                </div>

                {/* Draw Row of the Grid for each single note */}
                {PIANO_ROLL_NOTES_88.map((pitch) => {
                  return (
                    <div key={pitch} className="flex h-[32px] shrink-0 font-mono">
                      {Array.from({ length: stepCount }).map((_, stepIdx) => {
                        const currentTrack = music[activeTrackIdx] || music[0];
                        const noteDataRaw = currentTrack?.notes[`${selectedPianoChannel}:${stepIdx}`];
                        
                        // Parse values if they are correct
                        const hasNoteStartingHere = noteDataRaw && noteDataRaw.split(':')[0] === pitch;
                        const noteLengthMultiplier = hasNoteStartingHere && noteDataRaw.split(':')[1] ? parseInt(noteDataRaw.split(':')[1]) : 1;
                        
                        const isCurrentPlayingStepFlashing = currentStep === stepIdx && isPlayingSeq;
                        const isBeatColumn = stepIdx % 4 === 0;
                        const theme = CHANNEL_COLORS[selectedPianoChannel] || CHANNEL_COLORS[0];

                        return (
                          <div
                            key={stepIdx}
                            onClick={() => {
                              if (!currentTrack) return;
                              if (draggedNote) return; // ignore standard click when dragging

                              const key = `${selectedPianoChannel}:${stepIdx}`;
                              const notesCopy = { ...currentTrack.notes };

                              if (hasNoteStartingHere) {
                                // Selecting existing notes smoothly sets selection active!
                                setSelectedNoteStep(stepIdx);
                                setSelectedNotePitch(pitch);
                                
                                const activeWave = channelWaves[selectedPianoChannel] || 'square';
                                const chVol = channelVolumes[selectedPianoChannel] !== undefined ? channelVolumes[selectedPianoChannel] : 0.8;
                                const stepSec = (60 / (bpm || 120)) / 4;
                                triggerSynthTone(getFrequencyForNote(pitch), activeWave, stepSec * noteLengthMultiplier * 0.9, 0.012, stepSec * noteLengthMultiplier * 0.7, chVol);
                              } else {
                                // Add/Paint note at this step
                                const cleanPitch = pitch;
                                notesCopy[key] = `${cleanPitch}:${activeNoteLength}`;
                                
                                // Set active selection properties instantly
                                setSelectedNoteStep(stepIdx);
                                setSelectedNotePitch(cleanPitch);
                                
                                // Trigger audible sound play
                                const activeWave = channelWaves[selectedPianoChannel] || 'square';
                                const chVol = channelVolumes[selectedPianoChannel] !== undefined ? channelVolumes[selectedPianoChannel] : 0.8;
                                const stepSec = (60 / (bpm || 120)) / 4;
                                triggerSynthTone(getFrequencyForNote(cleanPitch), activeWave, stepSec * activeNoteLength * 0.9, 0.012, stepSec * activeNoteLength * 0.7, chVol);
                                
                                onUpdateMusic({ ...currentTrack, notes: notesCopy });
                                saveSequencerStateToUndo(notesCopy);
                              }
                            }}
                            onMouseUp={(e) => {
                              if (draggedNote) {
                                e.stopPropagation();
                                if (draggedNote.stepIdx !== stepIdx || draggedNote.pitch !== pitch) {
                                  moveNote(draggedNote.stepIdx, draggedNote.pitch, stepIdx, pitch);
                                }
                                setDraggedNote(null);
                              }
                            }}
                            className={`flex-1 border-r border-[#151624] border-b border-[#141521] min-w-[64px] max-w-[64px] relative transition-all cursor-pointer ${
                              isCurrentPlayingStepFlashing 
                                ? 'bg-[#ffe4e6]/5 brightness-110 z-10' 
                                : isBeatColumn 
                                ? 'bg-slate-900/35 hover:bg-slate-850/10' 
                                : 'bg-[#0c0d12] hover:bg-slate-850/10'
                            }`}
                          >
                            {/* Visual glowing bar spanning dynamically across columns based on note length */}
                            {hasNoteStartingHere && (
                              <div
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  if (e.button === 0) { // left click drag
                                    setDraggedNote({ stepIdx, pitch });
                                  }
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedNoteStep(stepIdx);
                                  setSelectedNotePitch(pitch);
                                  
                                  const activeWave = channelWaves[selectedPianoChannel] || 'square';
                                  const chVol = channelVolumes[selectedPianoChannel] !== undefined ? channelVolumes[selectedPianoChannel] : 0.8;
                                  const stepSec = (60 / (bpm || 120)) / 4;
                                  triggerSynthTone(getFrequencyForNote(pitch), activeWave, stepSec * noteLengthMultiplier * 0.9, 0.012, stepSec * noteLengthMultiplier * 0.7, chVol);
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  deleteNote(stepIdx, pitch);
                                }}
                                className={`absolute top-0.5 bottom-0.5 left-0.5 rounded shadow-lg flex items-center justify-between px-1.5 text-white font-mono text-[9px] cursor-grab active:cursor-grabbing border border-white/20 select-none group transition-opacity z-20 ${
                                  selectedNoteStep === stepIdx
                                    ? 'ring-2 ring-white scale-[1.01] shadow-fuchsia-500/30'
                                    : ''
                                }`}
                                style={{
                                  width: `calc(${noteLengthMultiplier} * 100% + (${noteLengthMultiplier} - 1) * 1px - 4px)`,
                                  boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                                  backgroundImage: selectedNoteStep === stepIdx 
                                    ? 'linear-gradient(135deg, #ec4899, #d946ef)'
                                    : theme.raw === '#ec4899' 
                                      ? 'linear-gradient(135deg, #ec4899, #be185d)' 
                                      : theme.raw === '#06b6d4' 
                                        ? 'linear-gradient(135deg, #06b6d4, #0891b2)' 
                                        : theme.raw === '#10b981' 
                                          ? 'linear-gradient(135deg, #10b981, #047857)' 
                                          : theme.raw === '#f59e0b' 
                                            ? 'linear-gradient(135deg, #f59e0b, #b45309)' 
                                            : 'linear-gradient(135deg, #6366f1, #4338ca)',
                                }}
                              >
                                {/* Note Controls and Value adjustment */}
                                <div className="flex items-center gap-1 shrink-0 select-none max-w-full overflow-hidden">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      changeNoteLength(stepIdx, pitch, -1);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="w-3.5 h-3.5 rounded bg-black/45 hover:bg-black/65 text-white font-black flex items-center justify-center text-[8px] border border-white/10"
                                    title="Diminuir duração"
                                  >
                                    -
                                  </button>
                                  <span className="text-[9px] uppercase font-mono font-black drop-shadow text-white leading-none whitespace-nowrap px-0.5">
                                    {pitch}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      changeNoteLength(stepIdx, pitch, 1);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="w-3.5 h-3.5 rounded bg-black/45 hover:bg-black/65 text-white font-black flex items-center justify-center text-[8px] border border-white/10"
                                    title="Aumentar duração"
                                  >
                                    +
                                  </button>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[7.5px] font-mono leading-none tracking-tight opacity-75 font-bold bg-black/25 px-1 py-0.5 rounded">
                                    {noteLengthMultiplier}x
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteNote(stepIdx, pitch);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="w-3.5 h-3.5 rounded bg-rose-600/30 hover:bg-rose-600/90 hover:text-white text-rose-200 font-extrabold flex items-center justify-center text-[8px] border border-rose-500/10 transition-colors"
                                    title="Apagar nota"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* EXTREMELY INTUITIVE NOTE PROPERTIES CONTROLLER & RESIZER PANEL */}
            <div className="bg-[#0b0c11] border border-slate-900 p-3.5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">🎹</span>
                <div>
                  <span className="text-[10px] text-slate-550 font-bold uppercase block tracking-wider font-mono animate-pulse">CONSOLA DE INTEGRIDADE DA NOTA</span>
                  {selectedNoteStep !== null && selectedNotePitch !== null ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-fuchsia-400 font-mono uppercase bg-fuchsia-500/10 py-1 px-2.5 rounded-lg border border-fuchsia-500/20">
                        {selectedNotePitch}
                      </span>
                      <span className="text-[10px] text-[#94a3b8] font-mono">
                        no Compasso <span className="text-cyan-400 font-bold font-mono">{(selectedNoteStep + 1)}</span>
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10.5px] text-slate-500 italic block font-mono">
                      Clique em qualquer barra de nota ou compasso na grade acima para selecioná-la
                    </span>
                  )}
                </div>
              </div>

              {/* DURAÇÃO (TAMANHO DA NOTA) MODIFY SLIDE CONTROLLER */}
              <div className="flex items-center gap-4 flex-wrap select-none font-mono">
                <div className="flex items-center gap-2 bg-[#13141f] p-1 px-3 rounded-lg border border-slate-850">
                  <span className="text-[10px] text-slate-500 font-bold uppercase font-mono">Resizer de Durabilidade:</span>
                  <div className="flex items-center gap-1 font-mono">
                    <button 
                      onClick={() => {
                        const nextLen = Math.max(1, activeNoteLength - 1);
                        setActiveNoteLength(nextLen);
                        
                        // If there is an active note selected, update its length instantly in activeTrack!
                        if (selectedNoteStep !== null && selectedNotePitch !== null) {
                          const currentTrack = music[activeTrackIdx] || music[0];
                          if (currentTrack) {
                            const key = `${selectedPianoChannel}:${selectedNoteStep}`;
                            const notesCopy = { ...currentTrack.notes };
                            notesCopy[key] = `${selectedNotePitch}:${nextLen}`;
                            onUpdateMusic({ ...currentTrack, notes: notesCopy });
                            saveSequencerStateToUndo(notesCopy);
                          }
                        }
                      }}
                      className="w-5 h-5 bg-slate-950 hover:bg-slate-800 text-slate-350 font-black rounded flex items-center justify-center text-xs cursor-pointer select-none"
                      title="Diminuir tamanho"
                    >
                      -
                    </button>
                    <span className="text-xs font-mono font-black text-[#ec4899] px-2 text-center w-14 bg-black p-0.5 rounded">
                      {activeNoteLength} BLOS
                    </span>
                    <button 
                      onClick={() => {
                        const nextLen = Math.min(16, activeNoteLength + 1);
                        setActiveNoteLength(nextLen);
                        
                        // If there is an active note selected, update its length instantly in activeTrack!
                        if (selectedNoteStep !== null && selectedNotePitch !== null) {
                          const currentTrack = music[activeTrackIdx] || music[0];
                          if (currentTrack) {
                            const key = `${selectedPianoChannel}:${selectedNoteStep}`;
                            const notesCopy = { ...currentTrack.notes };
                            notesCopy[key] = `${selectedNotePitch}:${nextLen}`;
                            onUpdateMusic({ ...currentTrack, notes: notesCopy });
                            saveSequencerStateToUndo(notesCopy);
                          }
                        }
                      }}
                      className="w-5 h-5 bg-slate-950 hover:bg-slate-800 text-slate-350 font-black rounded flex items-center justify-center text-xs cursor-pointer select-none"
                      title="Aumentar tamanho"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* ACTIONS TRIMS FOR SELECTED NOTE */}
                {selectedNoteStep !== null && (
                  <div className="flex items-center gap-1.5 animate-fade-in font-mono">
                    {/* Transpose pitch dropdown */}
                    <select
                      value={selectedNotePitch || 'C4'}
                      onChange={(e) => {
                        const newPitch = e.target.value;
                        setSelectedNotePitch(newPitch);
                        const currentTrack = music[activeTrackIdx] || music[0];
                        if (currentTrack) {
                          const key = `${selectedPianoChannel}:${selectedNoteStep}`;
                          const notesCopy = { ...currentTrack.notes };
                          notesCopy[key] = `${newPitch}:${activeNoteLength}`;
                          onUpdateMusic({ ...currentTrack, notes: notesCopy });
                          saveSequencerStateToUndo(notesCopy);

                          // Trigger audible sound play
                          const activeWave = channelWaves[selectedPianoChannel] || 'square';
                          const chVol = channelVolumes[selectedPianoChannel] !== undefined ? channelVolumes[selectedPianoChannel] : 0.8;
                          triggerSynthTone(getFrequencyForNote(newPitch), activeWave, 0.25, 0.015, 0.1, chVol);
                        }
                      }}
                      className="bg-[#13141f] text-[10px] text-cyan-405 font-bold border border-slate-850 p-1 px-1.5 rounded-lg cursor-pointer text-cyan-400"
                    >
                      {[
                        'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
                        'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
                        'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5',
                        'C6'
                      ].map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>

                    <button
                      onClick={() => {
                        if (selectedNoteStep === null) return;
                        const currentTrack = music[activeTrackIdx] || music[0];
                        if (currentTrack) {
                          const key = `${selectedPianoChannel}:${selectedNoteStep}`;
                          const notesCopy = { ...currentTrack.notes };
                          delete notesCopy[key];
                          onUpdateMusic({ ...currentTrack, notes: notesCopy });
                          saveSequencerStateToUndo(notesCopy);
                          setSelectedNoteStep(null);
                          setSelectedNotePitch(null);
                        }
                      }}
                      className="p-1 px-2.5 bg-rose-600 hover:bg-rose-500 rounded-lg text-[9px] font-bold text-white transition-all flex items-center justify-center gap-1 cursor-pointer shadow font-mono"
                    >
                      <Trash2 className="w-3 h-3 text-white" /> Apagar
                    </button>
                  </div>
                )}
              </div>
            </div>

            <p className="text-[10px] text-slate-500 leading-tight text-center font-mono">
              SynthWeave Studio Roll Tip: <span className="text-fuchsia-400 font-semibold">Clique na grade para posicionar uma nota</span>. Selecione-a para <span className="text-[#ec4899] font-bold">ajustar seu tamanho e tom</span> na consola. Clique novamente para limpar de forma ágil!
            </p>
          </div>

          {/* DRUM SEQUENCE TRACK PANEL */}
          <div className="bg-[#10111a] p-4.5 rounded-2xl border-2 border-[#1c1d2e] space-y-4 shadow-xl select-none">
            <span className="text-[11px] font-extrabold text-slate-400 block tracking-widest uppercase flex items-center gap-2">
              🥁 SEQUENCIADOR DE BATERIA (RÍTMICO RETRO-CHIPTUNE)
            </span>
            
            {DRUM_CHANNELS.map((drum, dIdx) => {
              const drumRowIdx = 12 + dIdx; // Offset drum volumes under indexes 12-15
              const currentTrack = music[activeTrackIdx] || music[0];
              const dVol = channelVolumes[drumRowIdx] !== undefined ? channelVolumes[drumRowIdx] : 0.8;

              return (
                <div key={drum.id} className="flex flex-col md:flex-row gap-3 items-center bg-[#13141f]/45 p-2 rounded-xl border border-slate-900/65">
                  {/* Drum Channel Column Header */}
                  <div className="w-full md:w-36 shrink-0 flex flex-col justify-center border-r-0 md:border-r border-slate-900 pr-0 md:pr-3">
                    <div className="flex justify-between items-center font-mono font-bold">
                      <span className="text-[11px] text-amber-300 uppercase flex items-center gap-1">
                        {drum.icon} {drum.name}
                      </span>
                      <button
                        onClick={() => {
                          const ctx = getAudioContext();
                          drum.play(ctx, dVol);
                        }}
                        className="text-[8px] bg-slate-800 hover:bg-slate-700 text-slate-200 py-0.5 px-2 rounded border border-slate-700 font-mono transition-colors active:scale-95 cursor-pointer"
                        title="Testar batida"
                      >
                        Play
                      </button>
                    </div>
                    
                    {/* Independent Drum channel volume slider */}
                    <div className="flex items-center gap-1.5 mt-2 justify-between">
                      <span className="text-[8px] text-slate-500 font-bold uppercase font-mono">Vol:</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={dVol}
                        onChange={(e) => {
                          const volsCopy = [...channelVolumes];
                          volsCopy[drumRowIdx] = parseFloat(e.target.value);
                          setChannelVolumes(volsCopy);
                        }}
                        className="w-full h-1 accent-amber-500 bg-black rounded cursor-pointer"
                        title={`Volume do ${drum.name}`}
                      />
                      <span className="text-[8px] font-mono font-bold text-slate-400 w-6 text-right">
                        {Math.round(dVol * 105)}%
                      </span>
                    </div>
                  </div>

                  {/* Drum Step Row layout */}
                  <div className="flex-1 w-full flex gap-1 items-center font-mono">
                    {Array.from({ length: stepCount }).map((_, stepIdx) => {
                      const key = `drum:${dIdx}:${stepIdx}`;
                      const isTriggered = currentTrack?.notes[key] === drum.value;
                      const isCurrentStepFlashing = currentStep === stepIdx && isPlayingSeq;

                      return (
                        <div 
                          key={stepIdx} 
                          onClick={() => {
                            if (!currentTrack) return;
                            if (notesUndoStack.length === 0) {
                              setNotesUndoStack([{ ...currentTrack.notes }]);
                            }
                            const notesCopy = { ...currentTrack.notes };
                            if (isTriggered) {
                              delete notesCopy[key];
                            } else {
                              notesCopy[key] = drum.value;
                              // Live test sound on placement
                              const ctx = getAudioContext();
                              drum.play(ctx, dVol);
                            }
                            saveSequencerStateToUndo(notesCopy);
                            onUpdateMusic({
                              ...currentTrack,
                              notes: notesCopy
                            });
                          }}
                          className={`flex-1 h-10 rounded-lg border cursor-pointer flex flex-col items-center justify-center transition-all relative select-none ${
                            isCurrentStepFlashing
                              ? 'border-amber-500 shadow-md ring-2 ring-amber-950 bg-amber-900/40'
                              : isTriggered
                              ? 'bg-amber-500/15 border-amber-500/70 shadow-inner scale-[1.02]'
                              : 'bg-[#0c0d12] border-slate-900 hover:bg-[#1a1b24]'
                          }`}
                          title={isTriggered ? `${drum.name} ativado` : `Bateria ${drum.name}, Bloco ${stepIdx+1}`}
                        >
                          <span className={`text-[10px] font-extrabold font-mono uppercase ${isTriggered ? 'text-amber-400' : 'text-slate-800'}`}>
                            {isTriggered ? '■' : '•'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 3. GAME COUPLING & MUSIC EXPORT ACTIONS */}
          <div className="bg-[#11121d] p-4 rounded-xl border border-slate-900 flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 select-none relative overflow-hidden font-sans">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-fuchsia-600 animate-pulse" />
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center shrink-0">
                <Music4 className="w-5 h-5 text-fuchsia-400 font-bold" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Sincronizar Melodia com os Eventos do Jogo</span>
                <p className="text-[10px] text-slate-400 max-w-md mt-0.5 leading-normal">
                  Salva as dotações em formato comprimido para carregar durante ações dinâmicas do personagem ou no ciclo loop!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto font-mono">
              <button
                onClick={handleDownloadMelodyJSON}
                className="bg-[#0b0c11] hover:bg-slate-900 w-full sm:w-auto text-[10px] text-slate-300 font-bold py-2.5 px-4 rounded-lg border border-slate-850 font-mono transition-all flex items-center justify-center gap-1 hover:text-white"
                title="Download do JSON notas"
              >
                <Download className="w-3.5 h-3.5" /> Exportar JSON
              </button>
              
              <button
                onClick={handleSaveMelodyForGame}
                className="bg-fuchsia-600 hover:bg-fuchsia-500 w-full sm:w-auto text-[10px] text-white font-black py-2.5 px-5 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-fuchsia-950/20"
              >
                <Save className="w-4 h-4" /> SALVAR NA MELODIA
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
