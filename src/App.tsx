/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GameProject, ProjectObject, Scene, SoundPreset, MusicTrack, EventBlock } from './types';
import SceneEditor from './components/SceneEditor';
import PixelEditor from './components/PixelEditor';
import AudioEditor from './components/AudioEditor';
import EventSheetEditor from './components/EventSheetEditor';
import AssetLibrary from './components/AssetLibrary';
import Exporter from './components/Exporter';
import PreviewModal from './components/PreviewModal';
import { Layout, Calendar, Music, Sparkles, Package, Play, HelpCircle, Save, FolderOpen, RefreshCw, Layers } from 'lucide-react';

const INITIAL_PROJECT: GameProject = {
  name: 'Meu Novo Jogo 2D',
  globalVariables: {
    'Pontos': 0,
    'Vidas': 3
  },
  objects: [
    {
      id: 'player_id',
      name: 'Jogador_Heroi',
      type: 'sprite',
      primaryColor: '#ec4899',
      frames: [
        {
          id: 'p_frame_1',
          width: 8,
          height: 8,
          pixels: [
            '','','#3b82f6','#3b82f6','#3b82f6','#3b82f6','','',
            '','#3b82f6','#e0f2fe','#000000','#e0f2fe','#000000','','',
            '','#3b82f6','#e0f2fe','#3b82f6','#3b82f6','#e0f2fe','','',
            '','#3b82f6','#3b82f6','#3b82f6','#3b82f6','#3b82f6','','',
            '','','#f43f5e','#f43f5e','#f43f5e','#f43f5e','','',
            '','','#3b82f6','#3b82f6','#3b82f6','#3b82f6','','',
            '','#3b82f6','#3b82f6','#3b82f6','#3b82f6','#3b82f6','#3b82f6','',
            '','#ef4444','','','','','#ef4444',''
          ]
        }
      ],
      animations: [{ id: 'walk', name: 'Andar', frames: ['p_frame_1'], speed: 6, loop: true }],
      currentAnimation: 'walk',
      behaviors: ['Platformer', 'DestroyOutside'],
      properties: {
        speed: 150,
        jumpStrength: 380,
        gravity: 800
      }
    },
    {
      id: 'coin_id',
      name: 'Moeda_Ouro',
      type: 'sprite',
      primaryColor: '#eab308',
      frames: [
        {
          id: 'c_frame_1',
          width: 8,
          height: 8,
          pixels: [
            '','','','#eab308','#eab308','','','',
            '','','#eab308','#eab308','#eab308','#eab308','','',
            '','#eab308','#facc15','#facc15','#facc15','#facc15','#eab308','',
            '','#eab308','#facc15','#ffffff','#ffffff','#facc15','#eab308','',
            '','#eab308','#facc15','#ffffff','#ffffff','#facc15','#eab308','',
            '','#eab308','#facc15','#facc15','#facc15','#facc15','#eab308','',
            '','','#eab308','#eab308','#eab308','#eab308','','',
            '','','','#eab308','#eab308','','',''
          ]
        }
      ],
      animations: [{ id: 'idle', name: 'Girar', frames: ['c_frame_1'], speed: 5, loop: true }],
      currentAnimation: 'idle',
      behaviors: [],
      properties: {}
    },
    {
      id: 'enemy_id',
      name: 'Fantasma_Malvado',
      type: 'sprite',
      primaryColor: '#a855f7',
      frames: [
        {
          id: 'e_frame_1',
          width: 8,
          height: 8,
          pixels: [
            '','','#a855f7','#a855f7','#a855f7','#a855f7','','',
            '','#a855f7','#ff0000','#000000','#ff0000','#000000','#a855f7','',
            '','#a855f7','#a855f7','#a855f7','#a855f7','#a855f7','#a855f7','',
            '','#a855f7','#a855f7','#a855f7','#a855f7','#a855f7','#a855f7','',
            '','#a855f7','#a855f7','#a855f7','#a855f7','#a855f7','#a855f7','',
            '','#a855f7','#a855f7','#a855f7','#a855f7','#a855f7','#a855f7','',
            '','#a855f7','#a855f7','#a855f7','#a855f7','#a855f7','#a855f7','',
            '','#a855f7','','#a855f7','','#a855f7','','#a855f7'
          ]
        }
      ],
      animations: [{ id: 'scare', name: 'Flutuar', frames: ['e_frame_1'], speed: 4, loop: true }],
      currentAnimation: 'scare',
      behaviors: ['Sine'],
      properties: {
        sineAmplitude: 60,
        sinePeriod: 3
      }
    }
  ],
  scenes: [
    {
      id: 'scene_main',
      name: 'Fase Inicial',
      width: 800,
      height: 600,
      gridSize: 32,
      layers: [
        { id: 'layer_main', name: 'Camada Principal', parallaxX: 1, parallaxY: 1, opacity: 1, visible: true },
        { id: 'layer_bg', name: 'Background Paralaxe', parallaxX: 0.5, parallaxY: 0.5, opacity: 1, visible: true }
      ],
      instances: [
        {
          id: 'player_inst',
          objectTypeId: 'player_id',
          x: 100,
          y: 400,
          width: 32,
          height: 32,
          angle: 0,
          opacity: 1,
          variables: {},
          layerId: 'layer_main'
        },
        {
          id: 'coin_inst_1',
          objectTypeId: 'coin_id',
          x: 400,
          y: 410,
          width: 32,
          height: 32,
          angle: 0,
          opacity: 1,
          variables: {},
          layerId: 'layer_main'
        },
        {
          id: 'enemy_inst',
          objectTypeId: 'enemy_id',
          x: 350,
          y: 200,
          width: 32,
          height: 32,
          angle: 0,
          opacity: 1,
          variables: {},
          layerId: 'layer_main'
        }
      ],
      tilemap: {
        id: 'layer_ground',
        name: 'Chão Sólido',
        grid: {
          '0,15': 1, '1,15': 1, '2,15': 1, '3,15': 1, '4,15': 1, '5,15': 1, '6,15': 3, '7,15': 3, '8,15': 3, '9,15': 3, '10,15': 1, '11,15': 1, '12,15': 1, '13,15': 1, '14,15': 1, '15,15': 1, '16,15': 1, '17,15': 1, '18,15': 1, '19,15': 1, '20,15': 1, '21,15': 1, '22,15': 1, '23,15': 1, '24,15': 1,
          '10,11': 3, '11,11': 3, '12,11': 3, '13,11': 3,
        }
      }
    }
  ],
  currentSceneId: 'scene_main',
  events: [
    {
      id: 'ev_start',
      conditions: [{ id: 'cond_st', type: 'system_onload' }],
      actions: [
        { id: 'act_st_1', type: 'system_add_variable', param1: 'Vidas', param2: '0' }
      ]
    },
    {
      id: 'ev_collect',
      conditions: [
        {
          id: 'cond_coll',
          type: 'object_collision',
          param1: 'player_id',
          param2: 'coin_id'
        }
      ],
      actions: [
        { id: 'act_coll_1', type: 'system_add_variable', targetObjectId: undefined, param1: 'Pontos', param2: '10' },
        { id: 'act_coll_2', type: 'object_destroy', targetObjectId: 'coin_id' },
        { id: 'act_coll_3', type: 'play_sound', param1: 'Moeda_Gong' }
      ]
    },
    {
      id: 'ev_hit',
      conditions: [
        {
          id: 'cond_hit',
          type: 'object_collision',
          param1: 'player_id',
          param2: 'enemy_id'
        }
      ],
      actions: [
        { id: 'act_hit_1', type: 'object_set_pos', targetObjectId: 'player_id', param1: '100', param2: '400' },
        { id: 'act_hit_2', type: 'system_add_variable', param1: 'Vidas', param2: '-1' },
        { id: 'act_hit_3', type: 'play_sound', param1: 'Dano_Baixo' }
      ]
    }
  ],
  sounds: [
    {
      id: 'sd_coin',
      name: 'Moeda_Gong',
      type: 'triangle',
      frequency: 950,
      duration: 0.1,
      attack: 0.01,
      decay: 0.08,
      sustain: 0,
      release: 0
    },
    {
      id: 'sd_hurt',
      name: 'Dano_Baixo',
      type: 'sawtooth',
      frequency: 180,
      duration: 0.25,
      attack: 0.05,
      decay: 0.2,
      sustain: 0,
      release: 0
    }
  ],
  music: [
    {
      id: 'm_main',
      name: 'Tema_Principal',
      bpm: 120,
      notes: {
        '0:0': 'C4', '0:4': 'E4', '0:8': 'G4', '0:12': 'C5',
        '1:0': 'A4', '1:4': 'F4', '1:8': 'D4', '1:12': 'G4'
      }
    }
  ],
  scripts: [
    {
      id: 's_phys',
      name: 'gravidade_suave.js',
      code: '// Script Personalizado Jogável\nconst player = getObjectInstance("player_id");\nif (player) {\n  // Altere física customizada a nível de frame\n  player.y += 0.2;\n}',
      active: true
    }
  ],
  dictionaries: [
    {
      id: 'd_conf',
      name: 'fase_config',
      entries: {
        'Dificuldade': 2,
        'AutoScroll': 1,
        'NomeFase': 'Fase Alpha 2D'
      }
    }
  ],
  arrays: [
    {
      id: 'a_inv',
      name: 'inventario_heroi',
      values: ['Espada Chata', 'Pocao de Vida', 'Escudo Madeira']
    }
  ],
  timelines: []
};

export default function App() {
  const [project, setProject] = useState<GameProject>(INITIAL_PROJECT);
  const [activeTab, setActiveTab] = useState<'layout' | 'events' | 'pixel' | 'audio' | 'library' | 'export'>('layout');
  const [selectedObj, setSelectedObj] = useState<ProjectObject | null>(INITIAL_PROJECT.objects[0]);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);

  const handleUpdateScene = (updatedScene: Scene) => {
    const updatedScenes = project.scenes.map(s => s.id === updatedScene.id ? updatedScene : s);
    setProject({ ...project, scenes: updatedScenes });
  };

  const handleUpdateObject = (updatedObj: ProjectObject) => {
    const updatedObjects = project.objects.map(o => o.id === updatedObj.id ? updatedObj : o);
    setProject({ ...project, objects: updatedObjects });
    if (selectedObj?.id === updatedObj.id) {
      setSelectedObj(updatedObj);
    }
  };

  const handleSelectObject = (obj: ProjectObject) => {
    setSelectedObj(obj);
    // Auto switch to correct editor when user intends to craft assets
    if (activeTab === 'library' || activeTab === 'export') {
      setActiveTab('pixel');
    }
  };

  const handleAddObject = () => {
    const newId = 'obj_' + Math.random().toString(36).substr(2, 9);
    const newObj: ProjectObject = {
      id: newId,
      name: 'Novo_Ator_' + (project.objects.length + 1),
      type: 'sprite',
      primaryColor: '#' + Math.floor(Math.random()*16777215).toString(16),
      frames: [
        {
          id: 'fr_' + Math.random().toString(36).substr(2, 9),
          width: 8,
          height: 8,
          pixels: Array(64).fill('')
        }
      ],
      animations: [{ id: 'anim_idle', name: 'Repouso', frames: [], speed: 4, loop: true }],
      currentAnimation: 'anim_idle',
      behaviors: [],
      properties: {}
    };

    setProject({ ...project, objects: [...project.objects, newObj] });
    setSelectedObj(newObj);
  };

  const handleImportObjectFromLib = (obj: ProjectObject) => {
    // Prevent duplicate ID collision
    const safeObj = {
      ...obj,
      id: 'lib_' + obj.id + '_' + Math.random().toString(36).substr(2, 5)
    };
    setProject({ ...project, objects: [...project.objects, safeObj] });
    setSelectedObj(safeObj);
    // Toast simulation
    alert(`"${obj.name}" importado com sucesso! Encontre-o no menu lateral.`);
  };

  const handleImportSoundFromLib = (sound: SoundPreset) => {
    setProject({ ...project, sounds: [...project.sounds, sound] });
    alert(`Som "${sound.name}" registrado nos presets!`);
  };

  const handleImportMusicFromLib = (musicTrack: MusicTrack) => {
    setProject({ ...project, music: [...project.music, musicTrack] });
    alert(`Trilha "${musicTrack.name}" adicionada ao sequenciador!`);
  };

  const handleSaveProjectLocal = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${project.name.replace(/\s+/g, '_')}_projeto.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      console.error(e);
    }
  };

  const handleLoadProjectLocal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const loaded = JSON.parse(event.target?.result as string) as GameProject;
        if (loaded.objects && loaded.scenes) {
          setProject(loaded);
          if (loaded.objects.length > 0) {
            setSelectedObj(loaded.objects[0]);
          }
          alert('Projeto carregado com sucesso!');
        }
      } catch (err) {
        alert('Erro ao carregar projeto: arquivo JSON inválido');
      }
    };
    reader.readAsText(file);
  };

  const currentScene = project.scenes.find(s => s.id === project.currentSceneId) || project.scenes[0];

  return (
    <div className="h-screen w-screen flex flex-col justify-stretch bg-[#090a0f] text-slate-100 overflow-hidden select-none font-sans" id="studio_shell_container">
      
      {/* MASTER TOP APPLICATION BAR */}
      <header className="h-14 bg-[#111218] border-b border-[#252632] px-6 flex items-center justify-between z-10 shrink-0">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md text-lg">
            C
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              Constructo 2D Studio <span className="text-[9px] bg-indigo-950 text-indigo-400 font-mono px-2 py-0.5 rounded-full border border-indigo-900/60">No-Code</span>
            </h1>
            <input
              type="text"
              value={project.name}
              onChange={(e) => setProject({ ...project, name: e.target.value })}
              className="text-[10px] text-gray-400 bg-transparent outline-none focus:underline font-medium p-0"
              title="Clique para renomear"
            />
          </div>
        </div>

        {/* Studio quick action controls */}
        <div className="flex items-center gap-3.5">
          
          <label className="text-[10px] text-slate-400 hover:text-white bg-slate-850/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 py-1.5 px-3 rounded-lg cursor-pointer flex items-center gap-1.5 font-bold transition-all transition-colors select-none">
            <FolderOpen className="w-3.5 h-3.5" /> Abrir Projeto
            <input 
              type="file" 
              accept=".json" 
              onChange={handleLoadProjectLocal} 
              className="hidden" 
            />
          </label>

          <button
            onClick={handleSaveProjectLocal}
            className="text-[10px] text-slate-400 hover:text-white bg-slate-850/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 py-1.5 px-3 rounded-lg cursor-pointer flex items-center gap-1.5 font-bold transition-all"
          >
            <Save className="w-3.5 h-3.5" /> Salvar Projeto
          </button>

          <div className="h-5 w-[1px] bg-slate-800"></div>

          {/* RUN SIMULATOR BUTTON */}
          <button
            onClick={() => setIsPreviewing(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-1.8 px-5 text-xs font-bold transition-all active:scale-95 shadow-md flex items-center gap-1.5 select-none cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" /> Jogar Preview (Live)
          </button>
        </div>
      </header>

      {/* BOTTOM WORKSPACE ZONE */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* SIDE MENU BAR TABS */}
        <nav className="w-20 bg-[#111218] border-r border-[#252632] flex flex-col justify-stretch items-center py-4 space-y-6 shrink-0">
          
          <button
            onClick={() => setActiveTab('layout')}
            className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all select-none ${
              activeTab === 'layout'
                ? 'bg-indigo-600/10 border border-indigo-500/60 text-indigo-400 shadow-sm'
                : 'text-gray-400 hover:text-slate-100 hover:bg-slate-900/30 border border-transparent'
            }`}
          >
            <Layout className="w-5 h-5" />
            <span className="text-[8px] font-bold">Cenas</span>
          </button>

          <button
            onClick={() => setActiveTab('events')}
            className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all select-none ${
              activeTab === 'events'
                ? 'bg-indigo-600/10 border border-indigo-500/60 text-indigo-400 shadow-sm'
                : 'text-gray-400 hover:text-slate-100 hover:bg-slate-900/30 border border-transparent'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[8px] font-bold">Eventos</span>
          </button>

          <button
            onClick={() => setActiveTab('pixel')}
            className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all select-none ${
              activeTab === 'pixel'
                ? 'bg-indigo-600/10 border border-indigo-500/60 text-indigo-400 shadow-sm'
                : 'text-gray-400 hover:text-slate-100 hover:bg-slate-900/30 border border-transparent'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[8px] font-bold">Pixel Art</span>
          </button>

          <button
            onClick={() => setActiveTab('audio')}
            className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all select-none ${
              activeTab === 'audio'
                ? 'bg-indigo-600/10 border border-indigo-500/60 text-indigo-400 shadow-sm'
                : 'text-gray-400 hover:text-slate-100 hover:bg-slate-900/30 border border-transparent'
            }`}
          >
            <Music className="w-5 h-5" />
            <span className="text-[8px] font-bold">Som/Música</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all select-none ${
              activeTab === 'library'
                ? 'bg-indigo-600/10 border border-indigo-500/60 text-indigo-400 shadow-sm'
                : 'text-gray-400 hover:text-slate-100 hover:bg-slate-900/30 border border-transparent'
            }`}
          >
            <Layers className="w-5 h-5" />
            <span className="text-[8px] font-bold">Assets</span>
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all select-none ${
              activeTab === 'export'
                ? 'bg-indigo-600/10 border border-indigo-500/60 text-indigo-400 shadow-sm'
                : 'text-gray-400 hover:text-slate-100 hover:bg-slate-900/30 border border-transparent'
            }`}
          >
            <Package className="w-5 h-5" />
            <span className="text-[8px] font-bold">Exportar</span>
          </button>

        </nav>

        {/* WORKSPACE CENTRAL DISPATCHER CONTROL VIEWPORT */}
        <main className="flex-1 flex overflow-hidden bg-[#090a0f]">
          {activeTab === 'layout' && (
            <SceneEditor
              scene={currentScene}
              objects={project.objects}
              onUpdateScene={handleUpdateScene}
              selectedObject={selectedObj}
              onSelectObject={handleSelectObject}
              onAddObject={handleAddObject}
            />
          )}

          {activeTab === 'pixel' && (
            <PixelEditor
              selectedObject={selectedObj}
              onUpdateObject={handleUpdateObject}
            />
          )}

          {activeTab === 'audio' && (
            <AudioEditor
              sounds={project.sounds}
              music={project.music}
              onAddSound={(s) => setProject({ ...project, sounds: [...project.sounds, s] })}
              onAddMusic={(m) => setProject({ ...project, music: [...project.music, m] })}
              onUpdateMusic={(updated) => {
                const upTrack = project.music.map(item => item.id === updated.id ? updated : item);
                setProject({ ...project, music: upTrack });
              }}
            />
          )}

          {activeTab === 'events' && (
            <EventSheetEditor
              events={project.events}
              objects={project.objects}
              sounds={project.sounds}
              globalVariables={project.globalVariables}
              onUpdateEvents={(ev) => setProject({ ...project, events: ev })}
              onUpdateGlobalVars={(gv) => setProject({ ...project, globalVariables: gv })}
              scripts={project.scripts || []}
              onUpdateScripts={(sc) => setProject({ ...project, scripts: sc })}
              dictionaries={project.dictionaries || []}
              onUpdateDictionaries={(dc) => setProject({ ...project, dictionaries: dc })}
              arrays={project.arrays || []}
              onUpdateArrays={(ar) => setProject({ ...project, arrays: ar })}
            />
          )}

          {activeTab === 'library' && (
            <AssetLibrary
              onImportObject={handleImportObjectFromLib}
              onImportSound={handleImportSoundFromLib}
              onImportMusic={handleImportMusicFromLib}
            />
          )}

          {activeTab === 'export' && (
            <Exporter
              project={project}
            />
          )}
        </main>
      </div>

      {/* FLOATING PREVIEW MODAL FRAME */}
      {isPreviewing && (
        <PreviewModal
          project={project}
          onClose={() => setIsPreviewing(false)}
        />
      )}
    </div>
  );
}
