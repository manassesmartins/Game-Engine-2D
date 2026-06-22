import { GameProject, GameTemplate, TileDef } from '../types';

const TILE_DEFS: TileDef[] = [
  { id: 1, color: '#4CAF50', solid: true, name: 'Grama' },
  { id: 2, color: '#2196F3', solid: false, name: 'Água' },
  { id: 3, color: '#795548', solid: true, name: 'Tijolo' },
  { id: 4, color: '#FF5722', solid: true, name: 'Lava' },
  { id: 5, color: '#9E9E9E', solid: true, name: 'Pedra' },
  { id: 6, color: '#FFC107', solid: false, name: 'Areia' },
];

function defaultSettings() {
  return {
    windowWidth: 1280,
    windowHeight: 720,
    fps: 60,
    renderMode: 'canvas2d' as const,
    fullscreen: false,
    pixelArt: true,
    backgroundColor: '#1a1a2e',
    startSceneId: '',
  };
}

function emptyProject(): GameProject {
  return {
    name: 'Novo Jogo',
    settings: defaultSettings(),
    objects: [],
    scenes: [],
    currentSceneId: '',
    events: [],
    sounds: [],
    music: [],
    globalVariables: {},
    scripts: [],
    timelines: [],
    dictionaries: [],
    arrays: [],
  };
}

function makeId(): string {
  return Math.random().toString(36).substr(2, 9);
}

const blankTemplate: GameTemplate = {
  id: 'blank',
  name: 'Projeto Vazio',
  description: 'Comece do zero com um projeto limpo, sem assets ou configurações.',
  icon: 'FilePlus',
  category: 'blank',
  project: emptyProject(),
};

const platformerTemplate: GameTemplate = {
  id: 'platformer',
  name: 'Plataforma',
  description: 'Jogo de plataforma com pulo, moedas, inimigos e fases.',
  icon: 'Gamepad2',
  category: 'platformer',
  project: {
    name: 'Meu Platformer',
    settings: defaultSettings(),
    globalVariables: { Pontos: 0, Vidas: 3, Fase: 1 },
    objects: [
      {
        id: 'player',
        name: 'Jogador',
        type: 'sprite',
        primaryColor: '#3b82f6',
        frames: [{
          id: 'p_frame',
          width: 8, height: 8,
          pixels: [
            '','','#3b82f6','#3b82f6','#3b82f6','#3b82f6','','',
            '','#3b82f6','#e0f2fe','#000','#e0f2fe','#000','','',
            '','#3b82f6','#e0f2fe','#3b82f6','#3b82f6','#e0f2fe','','',
            '','#3b82f6','#3b82f6','#3b82f6','#3b82f6','#3b82f6','','',
            '','','#f43f5e','#f43f5e','#f43f5e','#f43f5e','','',
            '','','#3b82f6','#3b82f6','#3b82f6','#3b82f6','','',
            '','#3b82f6','#3b82f6','#3b82f6','#3b82f6','#3b82f6','#3b82f6','',
            '','#ef4444','','','','','#ef4444',''
          ]
        }],
        animations: [{ id: 'run', name: 'Correr', frames: ['p_frame'], speed: 6, loop: true }],
        currentAnimation: 'run',
        behaviors: ['Platform', 'BoundToLayout', 'ScrollTo'],
        properties: { speed: 150, jumpStrength: 380, gravity: 800, acceleration: 600, deceleration: 850 }
      },
      {
        id: 'coin',
        name: 'Moeda',
        type: 'sprite',
        primaryColor: '#eab308',
        frames: [{
          id: 'c_frame', width: 8, height: 8,
          pixels: [
            '','','','#eab308','#eab308','','','',
            '','','#eab308','#eab308','#eab308','#eab308','','',
            '','#eab308','#facc15','#facc15','#facc15','#facc15','#eab308','',
            '','#eab308','#facc15','#fff','#fff','#facc15','#eab308','',
            '','#eab308','#facc15','#fff','#fff','#facc15','#eab308','',
            '','#eab308','#facc15','#facc15','#facc15','#facc15','#eab308','',
            '','','#eab308','#eab308','#eab308','#eab308','','',
            '','','','#eab308','#eab308','','',''
          ]
        }],
        animations: [{ id: 'spin', name: 'Girar', frames: ['c_frame'], speed: 5, loop: true }],
        currentAnimation: 'spin',
        behaviors: [],
        properties: {}
      },
      {
        id: 'enemy',
        name: 'Inimigo',
        type: 'sprite',
        primaryColor: '#a855f7',
        frames: [{
          id: 'e_frame', width: 8, height: 8,
          pixels: [
            '','','#a855f7','#a855f7','#a855f7','#a855f7','','',
            '','#a855f7','#ff0000','#000','#ff0000','#000','#a855f7','',
            '','#a855f7','#a855f7','#a855f7','#a855f7','#a855f7','#a855f7','',
            '','#a855f7','#a855f7','#a855f7','#a855f7','#a855f7','#a855f7','',
            '','#a855f7','#a855f7','#a855f7','#a855f7','#a855f7','#a855f7','',
            '','#a855f7','#a855f7','#a855f7','#a855f7','#a855f7','#a855f7','',
            '','#a855f7','#a855f7','#a855f7','#a855f7','#a855f7','#a855f7','',
            '','#a855f7','','#a855f7','','#a855f7','','#a855f7'
          ]
        }],
        animations: [{ id: 'float', name: 'Flutuar', frames: ['e_frame'], speed: 4, loop: true }],
        currentAnimation: 'float',
        behaviors: ['Sine'],
        properties: { sineAmplitude: 40, sinePeriod: 2 }
      },
    ],
    scenes: [{
      id: 'scene1', name: 'Fase 1', width: 1280, height: 600, gridSize: 32,
      layers: [
        { id: 'main', name: 'Principal', parallaxX: 1, parallaxY: 1, opacity: 1, visible: true },
        { id: 'bg', name: 'Fundo', parallaxX: 0.3, parallaxY: 0.3, opacity: 0.8, visible: true },
      ],
      instances: [
        { id: 'p_i', objectTypeId: 'player', x: 100, y: 400, width: 32, height: 32, angle: 0, opacity: 1, variables: {}, layerId: 'main' },
        { id: 'c_i_1', objectTypeId: 'coin', x: 400, y: 350, width: 24, height: 24, angle: 0, opacity: 1, variables: {}, layerId: 'main' },
        { id: 'c_i_2', objectTypeId: 'coin', x: 600, y: 250, width: 24, height: 24, angle: 0, opacity: 1, variables: {}, layerId: 'main' },
        { id: 'e_i', objectTypeId: 'enemy', x: 500, y: 200, width: 32, height: 32, angle: 0, opacity: 1, variables: {}, layerId: 'main' },
      ],
      tilemap: { id: 't_main', name: 'Chao', grid: {} },
      tilemaps: [{
        id: 't_main', name: 'Chao', grid: {
          '0,18':'1','1,18':'1','2,18':'1','3,18':'1','4,18':'1','5,18':'1','6,18':'1','7,18':'1','8,18':'1','9,18':'1',
          '10,18':'1','11,18':'1','12,18':'1','13,18':'1','14,18':'1','15,18':'1','16,18':'1','17,18':'1','18,18':'1','19,18':'1',
          '20,18':'1','21,18':'1','22,18':'1','23,18':'1','24,18':'1','25,18':'1','26,18':'1','27,18':'1','28,18':'1','29,18':'1',
          '30,18':'1','31,18':'1','32,18':'1','33,18':'1','34,18':'1','35,18':'1','36,18':'1','37,18':'1','38,18':'1','39,18':'1',
        }
      }],
    }],
    currentSceneId: 'scene1',
    events: [
      {
        id: 'ev_start', conditions: [{ id: 'c1', type: 'system_onload' }], actions: [
          { id: 'a1', type: 'system_set_variable', param1: 'Vidas', param2: '3' },
          { id: 'a2', type: 'system_set_variable', param1: 'Pontos', param2: '0' },
        ]
      },
      {
        id: 'ev_coin', conditions: [
          { id: 'c2', type: 'object_collision', param1: 'player', param2: 'coin' }
        ], actions: [
          { id: 'a3', type: 'system_add_variable', param1: 'Pontos', param2: '10' },
          { id: 'a4', type: 'object_destroy', targetObjectId: 'coin' },
          { id: 'a5', type: 'play_sound', param1: 'Moeda' },
        ]
      },
    ],
    sounds: [
      { id: 's_coin', name: 'Moeda', type: 'triangle', frequency: 950, duration: 0.1, attack: 0.01, decay: 0.08, sustain: 0, release: 0 },
    ],
    music: [], scripts: [], timelines: [], dictionaries: [], arrays: [],
  }
};

const rpgTemplate: GameTemplate = {
  id: 'rpg',
  name: 'RPG',
  description: 'Jogo RPG com herói, NPCs, inventário e diálogos.',
  icon: 'Sword',
  category: 'rpg',
  project: {
    name: 'Meu RPG',
    settings: defaultSettings(),
    globalVariables: { Ouro: 0, HP: 100, MP: 50, Level: 1, EXP: 0 },
    objects: [
      {
        id: 'hero', name: 'Herói', type: 'sprite', primaryColor: '#3b82f6',
        frames: [{
          id: 'h_f', width: 8, height: 8,
          pixels: [
            '','','#3b82f6','#3b82f6','#3b82f6','#3b82f6','','',
            '','#3b82f6','#facc15','#000','#facc15','#000','','',
            '','#3b82f6','#facc15','#3b82f6','#3b82f6','#facc15','','',
            '','#3b82f6','#3b82f6','#3b82f6','#3b82f6','#3b82f6','','',
            '','','#22c55e','#22c55e','#22c55e','#22c55e','','',
            '','#8b5cf6','#8b5cf6','#8b5cf6','#8b5cf6','#8b5cf6','#8b5cf6','',
            '','#8b5cf6','#8b5cf6','#8b5cf6','#8b5cf6','#8b5cf6','#8b5cf6','',
            '','#ef4444','','','','','#ef4444',''
          ]
        }],
        animations: [{ id: 'walk', name: 'Andar', frames: ['h_f'], speed: 6, loop: true }],
        currentAnimation: 'walk',
        behaviors: ['8Direction', 'BoundToLayout'],
        properties: { speed: 120 }
      },
      {
        id: 'npc', name: 'NPC', type: 'sprite', primaryColor: '#22c55e',
        frames: [{
          id: 'n_f', width: 8, height: 8,
          pixels: Array(64).fill('').map((_, i) => {
            const r = Math.floor(i / 8), c = i % 8;
            if (r === 0 && c >= 2 && c <= 5) return '#22c55e';
            if (r === 1 && c >= 1 && c <= 6) return '#22c55e';
            if (r === 2) return ['','#22c55e','#000','#fff','#000','#fff','#22c55e',''][c] || '';
            if (r === 3) return ['','#22c55e','#22c55e','#22c55e','#22c55e','#22c55e','#22c55e',''][c] || '';
            if (r >= 4 && r <= 5 && c >= 2 && c <= 5) return '#16a34a';
            if (r >= 6 && r <= 7 && c >= 2 && c <= 5) return '#15803d';
            return '';
          })
        }],
        animations: [{ id: 'idle', name: 'Parado', frames: ['n_f'], speed: 4, loop: true }],
        currentAnimation: 'idle',
        behaviors: [], properties: {}
      },
      {
        id: 'chest', name: 'Baú', type: 'sprite', primaryColor: '#b45309',
        frames: [{
          id: 'ch_f', width: 8, height: 8,
          pixels: [
            '','#b45309','#b45309','#b45309','#b45309','#b45309','#b45309','',
            '#b45309','#f59e0b','#f59e0b','#f59e0b','#f59e0b','#f59e0b','#f59e0b','#b45309',
            '#b45309','#f59e0b','#000','#f59e0b','#f59e0b','#000','#f59e0b','#b45309',
            '#b45309','#f59e0b','#f59e0b','#f59e0b','#f59e0b','#f59e0b','#f59e0b','#b45309',
            '#b45309','#78350f','#78350f','#78350f','#78350f','#78350f','#78350f','#b45309',
            '#b45309','#78350f','#78350f','#78350f','#78350f','#78350f','#78350f','#b45309',
            '#b45309','#78350f','#78350f','#78350f','#78350f','#78350f','#78350f','#b45309',
            '','#b45309','#b45309','#b45309','#b45309','#b45309','#b45309','',
          ]
        }],
        animations: [{ id: 'closed', name: 'Fechado', frames: ['ch_f'], speed: 4, loop: true }],
        currentAnimation: 'closed',
        behaviors: [], properties: {}
      },
    ],
    scenes: [{
      id: 'rpg_scene', name: 'Mundo Principal', width: 960, height: 640, gridSize: 32,
      layers: [
        { id: 'ground', name: 'Chão', parallaxX: 1, parallaxY: 1, opacity: 1, visible: true },
        { id: 'overlay', name: 'Sobreposição', parallaxX: 1, parallaxY: 1, opacity: 1, visible: true },
      ],
      instances: [
        { id: 'hero_i', objectTypeId: 'hero', x: 200, y: 300, width: 28, height: 32, angle: 0, opacity: 1, variables: {}, layerId: 'ground' },
        { id: 'npc_i', objectTypeId: 'npc', x: 500, y: 300, width: 28, height: 32, angle: 0, opacity: 1, variables: {}, layerId: 'ground' },
        { id: 'chest_i', objectTypeId: 'chest', x: 700, y: 350, width: 32, height: 28, angle: 0, opacity: 1, variables: {}, layerId: 'ground' },
      ],
      tilemap: { id: 'rpg_t', name: 'Tilemap', grid: {} },
      tilemaps: [{
        id: 'rpg_t', name: 'Tilemap', grid: {}
      }],
    }],
    currentSceneId: 'rpg_scene',
    events: [
      {
        id: 'rpg_start', conditions: [{ id: 'rc1', type: 'system_onload' }], actions: [
          { id: 'ra1', type: 'system_set_variable', param1: 'HP', param2: '100' },
          { id: 'ra2', type: 'system_set_variable', param1: 'MP', param2: '50' },
        ]
      },
    ],
    sounds: [], music: [], scripts: [], timelines: [], dictionaries: [], arrays: [],
  }
};

const puzzleTemplate: GameTemplate = {
  id: 'puzzle',
  name: 'Puzzle',
  description: 'Jogo de quebra-cabeça com peças, lógica e desafios.',
  icon: 'Puzzle',
  category: 'puzzle',
  project: {
    name: 'Meu Puzzle',
    settings: defaultSettings(),
    globalVariables: { Pontuacao: 0, Tempo: 60, Nivel: 1 },
    objects: [
      {
        id: 'tile_piece', name: 'Peça', type: 'sprite', primaryColor: '#6366f1',
        frames: [{
          id: 'tp_f', width: 8, height: 8,
          pixels: [
            '#6366f1','#6366f1','#6366f1','#6366f1','#6366f1','#6366f1','#6366f1','#6366f1',
            '#6366f1','#818cf8','#818cf8','#818cf8','#818cf8','#818cf8','#818cf8','#6366f1',
            '#6366f1','#818cf8','#fff','#fff','#fff','#fff','#818cf8','#6366f1',
            '#6366f1','#818cf8','#fff','#6366f1','#6366f1','#fff','#818cf8','#6366f1',
            '#6366f1','#818cf8','#fff','#6366f1','#6366f1','#fff','#818cf8','#6366f1',
            '#6366f1','#818cf8','#fff','#fff','#fff','#fff','#818cf8','#6366f1',
            '#6366f1','#818cf8','#818cf8','#818cf8','#818cf8','#818cf8','#818cf8','#6366f1',
            '#6366f1','#6366f1','#6366f1','#6366f1','#6366f1','#6366f1','#6366f1','#6366f1',
          ]
        }],
        animations: [{ id: 'idle', name: 'Parado', frames: ['tp_f'], speed: 4, loop: true }],
        currentAnimation: 'idle',
        behaviors: [], properties: {}
      },
    ],
    scenes: [{
      id: 'puz_scene', name: 'Tabuleiro', width: 800, height: 600, gridSize: 32,
      layers: [
        { id: 'main_puz', name: 'Principal', parallaxX: 1, parallaxY: 1, opacity: 1, visible: true },
      ],
      instances: [
        { id: 'p1', objectTypeId: 'tile_piece', x: 100, y: 100, width: 32, height: 32, angle: 0, opacity: 1, variables: { tipo: '1' }, layerId: 'main_puz' },
        { id: 'p2', objectTypeId: 'tile_piece', x: 140, y: 100, width: 32, height: 32, angle: 0, opacity: 1, variables: { tipo: '2' }, layerId: 'main_puz' },
        { id: 'p3', objectTypeId: 'tile_piece', x: 180, y: 100, width: 32, height: 32, angle: 0, opacity: 1, variables: { tipo: '3' }, layerId: 'main_puz' },
      ],
      tilemap: { id: 'puz_t', name: 'Tilemap', grid: {} },
      tilemaps: [],
    }],
    currentSceneId: 'puz_scene',
    events: [], sounds: [], music: [], scripts: [], timelines: [], dictionaries: [], arrays: [],
  }
};

const arcadeTemplate: GameTemplate = {
  id: 'arcade',
  name: 'Arcade',
  description: 'Jogo arcade rápido com pontuação, níveis e power-ups.',
  icon: 'Zap',
  category: 'arcade',
  project: {
    name: 'Meu Arcade',
    settings: defaultSettings(),
    globalVariables: { Score: 0, Level: 1, Lives: 3, Combo: 0 },
    objects: [
      {
        id: 'ship', name: 'Nave', type: 'sprite', primaryColor: '#0ea5e9',
        frames: [{
          id: 's_f', width: 8, height: 8,
          pixels: [
            '','','','#0ea5e9','#0ea5e9','','','',
            '','','#0ea5e9','#38bdf8','#38bdf8','#0ea5e9','','',
            '','#0ea5e9','#38bdf8','#fff','#fff','#38bdf8','#0ea5e9','',
            '#0ea5e9','#0ea5e9','#0ea5e9','#0ea5e9','#0ea5e9','#0ea5e9','#0ea5e9','#0ea5e9',
            '','#0ea5e9','#0ea5e9','#0ea5e9','#0ea5e9','#0ea5e9','#0ea5e9','',
            '','','#0ea5e9','#0ea5e9','#0ea5e9','#0ea5e9','','',
            '','','','#ef4444','#ef4444','','','',
            '','','','#ef4444','#ef4444','','','',
          ]
        }],
        animations: [{ id: 'fly', name: 'Voar', frames: ['s_f'], speed: 6, loop: true }],
        currentAnimation: 'fly',
        behaviors: ['8Direction', 'BoundToLayout'],
        properties: { speed: 200 }
      },
      {
        id: 'enemy_ship', name: 'Inimigo', type: 'sprite', primaryColor: '#ef4444',
        frames: [{
          id: 'es_f', width: 8, height: 8,
          pixels: [
            '','','','#ef4444','#ef4444','','','',
            '','','#ef4444','#fca5a5','#fca5a5','#ef4444','','',
            '','#ef4444','#fca5a5','#fff','#fff','#fca5a5','#ef4444','',
            '#ef4444','#ef4444','#ef4444','#000','#000','#ef4444','#ef4444','#ef4444',
            '','#ef4444','#ef4444','#ef4444','#ef4444','#ef4444','#ef4444','',
            '','','#ef4444','#ef4444','#ef4444','#ef4444','','',
            '','','','','','','','',
            '','','','','','','','',
          ]
        }],
        animations: [{ id: 'fly_e', name: 'Voar', frames: ['es_f'], speed: 6, loop: true }],
        currentAnimation: 'fly_e',
        behaviors: ['Bullet', 'BoundToLayout'],
        properties: { bulletSpeed: 100, bulletGravity: 0 }
      },
      {
        id: 'bullet', name: 'Tiro', type: 'sprite', primaryColor: '#facc15',
        frames: [{
          id: 'b_f', width: 4, height: 4,
          pixels: [
            '','#facc15','#facc15','',
            '','#fef08a','#fef08a','',
            '','#fef08a','#fef08a','',
            '','#facc15','#facc15','',
          ]
        }],
        animations: [{ id: 'shot', name: 'Tiro', frames: ['b_f'], speed: 8, loop: true }],
        currentAnimation: 'shot',
        behaviors: ['Bullet'],
        properties: { bulletSpeed: 400, bulletGravity: 0 }
      },
    ],
    scenes: [{
      id: 'arc_scene', name: 'Fase 1', width: 800, height: 600, gridSize: 32,
      layers: [
        { id: 'main_arc', name: 'Principal', parallaxX: 1, parallaxY: 1, opacity: 1, visible: true },
      ],
      instances: [
        { id: 'ship_i', objectTypeId: 'ship', x: 400, y: 500, width: 32, height: 32, angle: 0, opacity: 1, variables: {}, layerId: 'main_arc' },
        { id: 'enemy_i', objectTypeId: 'enemy_ship', x: 200, y: 50, width: 32, height: 32, angle: 180, opacity: 1, variables: {}, layerId: 'main_arc' },
      ],
      tilemap: { id: 'arc_t', name: 'Tilemap', grid: {} },
      tilemaps: [],
    }],
    currentSceneId: 'arc_scene',
    events: [
      {
        id: 'arc_start', conditions: [{ id: 'ac1', type: 'system_onload' }], actions: [
          { id: 'aa1', type: 'system_set_variable', param1: 'Score', param2: '0' },
          { id: 'aa2', type: 'system_set_variable', param1: 'Lives', param2: '3' },
        ]
      },
    ],
    sounds: [
      { id: 's_shoot', name: 'Tiro', type: 'square', frequency: 800, duration: 0.05, attack: 0, decay: 0.05, sustain: 0, release: 0 },
      { id: 's_explode', name: 'Explosao', type: 'noise', frequency: 200, duration: 0.3, attack: 0.01, decay: 0.2, sustain: 0, release: 0.05 },
    ],
    music: [], scripts: [], timelines: [], dictionaries: [], arrays: [],
  }
};

const boardTemplate: GameTemplate = {
  id: 'board',
  name: 'Tabuleiro',
  description: 'Jogo de tabuleiro com casas, dados e turnos.',
  icon: 'Dices',
  category: 'board',
  project: {
    name: 'Meu Tabuleiro',
    settings: defaultSettings(),
    globalVariables: { Turno: 1, Jogador1: 0, Jogador2: 0, Dado: 0 },
    objects: [
      {
        id: 'pawn1', name: 'Peão 1', type: 'sprite', primaryColor: '#3b82f6',
        frames: [{
          id: 'p1_f', width: 6, height: 8,
          pixels: [
            '','#3b82f6','#3b82f6','#3b82f6','#3b82f6','',
            '#3b82f6','#93c5fd','#93c5fd','#93c5fd','#93c5fd','#3b82f6',
            '#3b82f6','#93c5fd','#fff','#fff','#93c5fd','#3b82f6',
            '#3b82f6','#93c5fd','#93c5fd','#93c5fd','#93c5fd','#3b82f6',
            '','#3b82f6','#3b82f6','#3b82f6','#3b82f6','',
            '','#1d4ed8','#1d4ed8','#1d4ed8','#1d4ed8','',
            '','#1d4ed8','#1d4ed8','#1d4ed8','#1d4ed8','',
            '','#1e3a8a','#1e3a8a','#1e3a8a','#1e3a8a','',
          ]
        }],
        animations: [{ id: 'idle', name: 'Parado', frames: ['p1_f'], speed: 4, loop: true }],
        currentAnimation: 'idle',
        behaviors: [], properties: {}
      },
      {
        id: 'pawn2', name: 'Peão 2', type: 'sprite', primaryColor: '#ef4444',
        frames: [{
          id: 'p2_f', width: 6, height: 8,
          pixels: [
            '','#ef4444','#ef4444','#ef4444','#ef4444','',
            '#ef4444','#fca5a5','#fca5a5','#fca5a5','#fca5a5','#ef4444',
            '#ef4444','#fca5a5','#fff','#fff','#fca5a5','#ef4444',
            '#ef4444','#fca5a5','#fca5a5','#fca5a5','#fca5a5','#ef4444',
            '','#ef4444','#ef4444','#ef4444','#ef4444','',
            '','#dc2626','#dc2626','#dc2626','#dc2626','',
            '','#dc2626','#dc2626','#dc2626','#dc2626','',
            '','#991b1b','#991b1b','#991b1b','#991b1b','',
          ]
        }],
        animations: [{ id: 'idle2', name: 'Parado', frames: ['p2_f'], speed: 4, loop: true }],
        currentAnimation: 'idle2',
        behaviors: [], properties: {}
      },
    ],
    scenes: [{
      id: 'board_scene', name: 'Tabuleiro', width: 800, height: 600, gridSize: 64,
      layers: [
        { id: 'board_main', name: 'Tabuleiro', parallaxX: 1, parallaxY: 1, opacity: 1, visible: true },
      ],
      instances: [
        { id: 'pawn1_i', objectTypeId: 'pawn1', x: 100, y: 300, width: 24, height: 32, angle: 0, opacity: 1, variables: { pos: '0' }, layerId: 'board_main' },
        { id: 'pawn2_i', objectTypeId: 'pawn2', x: 700, y: 300, width: 24, height: 32, angle: 0, opacity: 1, variables: { pos: '0' }, layerId: 'board_main' },
      ],
      tilemap: { id: 'board_t', name: 'Tabuleiro', grid: {} },
      tilemaps: [{
        id: 'board_t', name: 'Tabuleiro', grid: {}
      }],
    }],
    currentSceneId: 'board_scene',
    events: [], sounds: [], music: [], scripts: [], timelines: [], dictionaries: [], arrays: [],
  }
};

export const GAME_TEMPLATES: GameTemplate[] = [
  blankTemplate,
  platformerTemplate,
  rpgTemplate,
  puzzleTemplate,
  arcadeTemplate,
  boardTemplate,
];

export function createProjectFromTemplate(templateId: string): GameProject | null {
  const template = GAME_TEMPLATES.find(t => t.id === templateId);
  if (!template) return null;
  return JSON.parse(JSON.stringify(template.project));
}
