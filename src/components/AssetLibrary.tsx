/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sparkles, Gamepad2, Volume2, Image, Layers } from 'lucide-react';
import { ProjectObject, SoundPreset, MusicTrack } from '../types';

interface AssetLibraryProps {
  onImportObject: (obj: ProjectObject) => void;
  onImportSound: (sound: SoundPreset) => void;
  onImportMusic: (music: MusicTrack) => void;
}

export default function AssetLibrary({ onImportObject, onImportSound, onImportMusic }: AssetLibraryProps) {
  
  // Custom pre-configured retro actors
  const actors: { name: string; desc: string; icon: string; category: string; data: ProjectObject }[] = [
    {
      name: 'Herói Pixelado',
      desc: 'Personagem principal com animação básica e comportamento de Plataforma pré-carregado.',
      category: 'Player',
      icon: '👾',
      data: {
        id: 'hero_sprite',
        name: 'Jogador',
        type: 'sprite',
        primaryColor: '#ec4899',
        frames: [
          {
            id: 'hero_f1',
            width: 8,
            height: 8,
            pixels: [
              '','','#f43f5e','#f43f5e','#f43f5e','#f43f5e','','',
              '','#3b82f6','#3b82f6','#fbbf24','#fbbf24','#3b82f6','#3b82f6','',
              '','#3b82f6','#fbbf24','#000000','#000000','#fbbf24','#3b82f6','',
              '','#3b82f6','#fbbf24','#fbbf24','#fbbf24','#fbbf24','#3b82f6','',
              '','','#fbbf24','#fbbf24','#fbbf24','#fbbf24','','',
              '','','#3b82f6','#3b82f6','#3b82f6','#3b82f6','','',
              '','#3b82f6','#3b82f6','#3b82f6','#3b82f6','#3b82f6','#3b82f6','',
              '','#ef4444','','','','','#ef4444',''
            ]
          }
        ],
        animations: [
          {
            id: 'walk',
            name: 'Andar',
            frames: ['hero_f1'],
            speed: 8,
            loop: true
          }
        ],
        currentAnimation: 'walk',
        behaviors: ['Platform', 'BoundToLayout'],
        properties: {
          speed: 160,
          jumpStrength: 380,
          gravity: 800
        }
      }
    },
    {
      name: 'Inimigo Fantasma',
      desc: 'Flutua horizontalmente de um lado para o outro usando comportamento Senoide (Sine wave).',
      category: 'Enemy',
      icon: '👻',
      data: {
        id: 'enemy_ghost',
        name: 'Fantasma',
        type: 'sprite',
        primaryColor: '#a855f7',
        frames: [
          {
            id: 'ghost_f1',
            width: 8,
            height: 8,
            pixels: [
              '','','#9333ea','#9333ea','#9333ea','#9333ea','','',
              '','#9333ea','#ffffff','#000000','#ffffff','#000000','#9333ea','',
              '','#9333ea','#9333ea','#9333ea','#9333ea','#9333ea','#9333ea','',
              '','#9333ea','#9333ea','#9333ea','#9333ea','#9333ea','#9333ea','',
              '','#9333ea','#9333ea','#9333ea','#9333ea','#9333ea','#9333ea','',
              '','#9333ea','#9333ea','#9333ea','#9333ea','#9333ea','#9333ea','',
              '','#9333ea','#9333ea','#9333ea','#9333ea','#9333ea','#9333ea','',
              '','#9333ea','','#9333ea','','#9333ea','','#9333ea'
            ]
          }
        ],
        animations: [
          { id: 'idle', name: 'Flutuar', frames: ['ghost_f1'], speed: 4, loop: true }
        ],
        currentAnimation: 'idle',
        behaviors: ['Sine'],
        properties: {
          sineAmplitude: 70,
          sinePeriod: 3
        }
      }
    },
    {
      name: 'Moeda de Ouro',
      desc: 'Item colecionável com pixels dourados brilhantes, ideal para objetivos de pontuação.',
      category: 'Collectible',
      icon: '🪙',
      data: {
        id: 'collectible_coin',
        name: 'Moeda',
        type: 'sprite',
        primaryColor: '#eab308',
        frames: [
          {
            id: 'coin_f1',
            width: 8,
            height: 8,
            pixels: [
              '','','','#facc15','#facc15','','','',
              '','','#facc15','#ca8a04','#ca8a04','#facc15','','',
              '','#facc15','#ca8a04','#eab308','#eab308','#ca8a04','#facc15','',
              '','#facc15','#ca8a04','#ca8a04','#ca8a04','#ca8a04','#facc15','',
              '','#facc15','#ca8a04','#ca8a04','#ca8a04','#ca8a04','#facc15','',
              '','#facc15','#ca8a04','#eab308','#eab308','#ca8a04','#facc15','',
              '','','#facc15','#ca8a04','#ca8a04','#facc15','','',
              '','','','#facc15','#facc15','','',''
            ]
          }
        ],
        animations: [{ id: 'spin', name: 'Girar', frames: ['coin_f1'], speed: 6, loop: true }],
        currentAnimation: 'spin',
        behaviors: [],
        properties: {}
      }
    },
    {
      name: 'Projétil Místico',
      desc: 'Bala horizontal automática com alta velocidade configurada (comportamento Bullet).',
      category: 'VFX',
      icon: '⚡',
      data: {
        id: 'bullet_vfx',
        name: 'Projetil',
        type: 'sprite',
        primaryColor: '#38bdf8',
        frames: [
          {
            id: 'bullet_f1',
            width: 8,
            height: 8,
            pixels: [
              '','','','','','','','',
              '','','','','#38bdf8','#38bdf8','','',
              '','','#38bdf8','#0ea5e9','#0ea5e9','#38bdf8','','',
              '','#38bdf8','#0ea5e9','#f0f9ff','#f0f9ff','#0ea5e9','#38bdf8','',
              '','#38bdf8','#0ea5e9','#f0f9ff','#f0f9ff','#0ea5e9','#38bdf8','',
              '','','#38bdf8','#0ea5e9','#0ea5e9','#38bdf8','','',
              '','','','','#38bdf8','#38bdf8','','',
              '','','','','','','',''
            ]
          }
        ],
        animations: [{ id: 'fly', name: 'Voar', frames: ['bullet_f1'], speed: 10, loop: true }],
        currentAnimation: 'fly',
        behaviors: ['Bullet', 'BoundToLayout'],
        properties: {
          bulletSpeed: 380
        }
      }
    }
  ];

  const soundPresets: SoundPreset[] = [
    {
      id: 'coin_preset',
      name: 'Pegar_Moeda',
      type: 'triangle',
      frequency: 880,
      duration: 0.1,
      attack: 0.02,
      decay: 0.08,
      sustain: 0.1,
      release: 0.05
    },
    {
      id: 'jump_preset',
      name: 'Pulo_Retro',
      type: 'square',
      frequency: 240,
      duration: 0.15,
      attack: 0.04,
      decay: 0.1,
      sustain: 0.1,
      release: 0.05
    },
    {
      id: 'laser_preset',
      name: 'Disparo_Laser',
      type: 'sawtooth',
      frequency: 600,
      duration: 0.2,
      attack: 0.02,
      decay: 0.18,
      sustain: 0.05,
      release: 0.1
    },
    {
      id: 'explosion_preset',
      name: 'Explosao',
      type: 'noise',
      frequency: 90,
      duration: 0.4,
      attack: 0.05,
      decay: 0.35,
      sustain: 0,
      release: 0.2
    }
  ];

  const musicPreset: MusicTrack = {
    id: 'retro_beat_1',
    name: 'Chiptune_Calmo',
    bpm: 110,
    notes: {
      '0:0': 'C4', '0:4': 'G4', '0:8': 'A4', '0:12': 'F4',
      '1:2': 'E4', '1:6': 'C4', '1:10': 'D4', '1:14': 'G4'
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#0f1015]" id="asset_library_root">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Biblioteca de Assets & Plug-ins
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Componentes prontos e otimizados para acelerar a criação do seu jogo. Basta clicar para importar.
          </p>
        </div>

        {/* 1. Predefined Actives / Sprites */}
        <div className="space-y-4">
          <h3 className="text-md font-semibold text-[#a855f7] flex items-center gap-2">
            <Gamepad2 className="w-4 h-4" />
            Atores & Sprites com Inteligência / Comportamentos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {actors.map((actor, idx) => (
              <div 
                key={idx} 
                className="bg-[#181922] border border-[#272834] rounded-lg p-4 flex gap-4 hover:border-violet-500/50 transition-all shadow-md group"
                id={`asset_actor_${idx}`}
              >
                <div className="w-16 h-16 rounded-md bg-[#222330] flex items-center justify-center text-4xl shadow-inner select-none">
                  {actor.icon}
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 text-sm">{actor.name}</span>
                      <span className="text-[10px] bg-violet-950 text-violet-300 font-mono px-2 py-0.5 rounded-full border border-violet-800">
                        {actor.category}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2 md:line-clamp-none">{actor.desc}</p>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {actor.data.behaviors.map((b, i) => (
                        <span key={i} className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                          ★ {b}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => onImportObject(actor.data)}
                    className="mt-3 text-xs bg-violet-600 hover:bg-violet-700 text-white py-1 px-3 rounded text-center transition-all font-medium self-start active:scale-95"
                  >
                    Importar Ator
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Synthesized Sound Effects Panel */}
        <div className="space-y-4">
          <h3 className="text-md font-semibold text-emerald-400 flex items-center gap-2">
            <Volume2 className="w-4 h-4" />
            Efeitos de Som Retro 8-Bit (Sintetizador)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {soundPresets.map((sound, idx) => (
              <div 
                key={idx} 
                className="bg-[#181922] border border-[#272834] rounded-lg p-3 flex flex-col justify-between items-stretch hover:border-emerald-500/40 transition-all shadow-sm text-center"
                id={`asset_sound_${idx}`}
              >
                <div>
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-lg text-emerald-400 mb-2">
                    🔊
                  </div>
                  <span className="font-semibold text-slate-300 text-xs block truncate">{sound.name}</span>
                  <span className="text-[9px] font-mono text-gray-500 uppercase">{sound.type} OSC</span>
                </div>
                <button
                  onClick={() => onImportSound(sound)}
                  className="mt-4 text-xs bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-900/40 hover:border-emerald-500/30 py-1 rounded transition-colors active:scale-95"
                >
                  Importar Som
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Demo Chiptune tracks */}
        <div className="space-y-4">
          <h3 className="text-md font-semibold text-rose-400 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Músicas & Trilhas de Fundo Chiptune
          </h3>
          <div className="bg-[#181922] border border-[#272834] rounded-lg p-4 flex items-center justify-between" id="asset_music_block">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎹</span>
              <div>
                <span className="font-bold text-slate-200 text-sm block">{musicPreset.name}</span>
                <span className="text-xs text-slate-400">Trilha de fundo calibrada a {musicPreset.bpm} BPM com progressão de acordes 8-Bit.</span>
              </div>
            </div>
            <button
              onClick={() => onImportMusic(musicPreset)}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white rounded px-4 py-2 font-medium transition-all active:scale-95"
            >
              Importar Chiptune
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
