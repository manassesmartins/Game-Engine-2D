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
import WelcomeScreen from './components/WelcomeScreen';
import { Layout, Calendar, Music, Sparkles, Package, Play, Save, FolderOpen, Layers } from 'lucide-react';

export default function App() {
  const [project, setProject] = useState<GameProject | null>(null);
  const [activeTab, setActiveTab] = useState<'layout' | 'events' | 'pixel' | 'audio' | 'library' | 'export'>('layout');
  const [selectedObj, setSelectedObj] = useState<ProjectObject | null>(null);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);

  const handleNewProject = (p: GameProject) => {
    setProject(p);
    setSelectedObj(p.objects[0] || null);
    setActiveTab('layout');
  };

  if (!project) {
    return <WelcomeScreen onNewProject={handleNewProject} onLoadProject={handleNewProject} />;
  }

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
    const safeObj = {
      ...obj,
      id: 'lib_' + obj.id + '_' + Math.random().toString(36).substr(2, 5)
    };
    setProject({ ...project, objects: [...project.objects, safeObj] });
    setSelectedObj(safeObj);
    alert(`"${obj.name}" importado com sucesso!`);
  };

  const handleImportSoundFromLib = (sound: SoundPreset) => {
    setProject({ ...project, sounds: [...project.sounds, sound] });
    alert(`Som "${sound.name}" registrado!`);
  };

  const handleImportMusicFromLib = (musicTrack: MusicTrack) => {
    setProject({ ...project, music: [...project.music, musicTrack] });
    alert(`Trilha "${musicTrack.name}" adicionada!`);
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

  const currentScene = project.scenes.find(s => s.id === project.currentSceneId) || project.scenes[0];

  return (
    <div className="h-screen w-screen flex flex-col justify-stretch bg-[#1E1F26] text-[#E0E0E0] overflow-hidden select-none font-sans" id="studio_shell_container">
      
      <header className="h-12 bg-[#2B2C33] border-b border-[#3A3B44] px-4 flex items-center justify-between z-10 shrink-0">
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setProject(null); setSelectedObj(null); }}
            className="w-7 h-7 rounded bg-[#FFA000] flex items-center justify-center font-bold text-white shadow-sm text-sm cursor-pointer hover:bg-[#FFB300] transition-colors"
            title="Novo projeto"
          >
            C
          </button>
          <div>
            <h1 className="text-xs font-bold text-[#E0E0E0]">Constructo 2D Studio</h1>
            <input
              type="text"
              value={project.name}
              onChange={(e) => setProject({ ...project, name: e.target.value })}
              className="text-[9px] text-[#888] bg-transparent outline-none focus:underline font-medium p-0 leading-none w-40"
              title="Clique para renomear"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">

          <label className="text-[10px] text-[#A0A0A0] hover:text-white bg-[#3A3B44] hover:bg-[#4A4B54] border border-[#4A4B54] hover:border-[#5A5B64] py-1 px-2.5 rounded cursor-pointer flex items-center gap-1.5 font-medium transition-all select-none">
            <FolderOpen className="w-3 h-3" /> Abrir
            <input type="file" accept=".json" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                try {
                  const loaded = JSON.parse(ev.target?.result as string) as GameProject;
                  if (loaded.objects && loaded.scenes) handleNewProject(loaded);
                } catch (_) {}
              };
              reader.readAsText(file);
            }} className="hidden" />
          </label>

          <button
            onClick={handleSaveProjectLocal}
            className="text-[10px] text-[#A0A0A0] hover:text-white bg-[#3A3B44] hover:bg-[#4A4B54] border border-[#4A4B54] hover:border-[#5A5B64] py-1 px-2.5 rounded cursor-pointer flex items-center gap-1.5 font-medium transition-all"
          >
            <Save className="w-3 h-3" /> Salvar
          </button>

          <div className="h-4 w-[1px] bg-[#3A3B44]"></div>

          <button
            onClick={() => setIsPreviewing(true)}
            className="bg-[#FFA000] hover:bg-[#FFB300] text-white rounded py-1.5 px-4 text-xs font-bold transition-all active:scale-95 shadow-sm flex items-center gap-1.5 select-none cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Preview
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        <nav className="w-[52px] bg-[#2B2C33] border-r border-[#3A3B44] flex flex-col items-center py-3 gap-1 shrink-0">
          
          {[
            { id: 'layout' as const, icon: Layout, label: 'Cenas' },
            { id: 'events' as const, icon: Calendar, label: 'Eventos' },
            { id: 'pixel' as const, icon: Sparkles, label: 'Pixel' },
            { id: 'audio' as const, icon: Music, label: 'Áudio' },
            { id: 'library' as const, icon: Layers, label: 'Assets' },
            { id: 'export' as const, icon: Package, label: 'Exportar' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-[44px] h-[44px] rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all select-none ${
                activeTab === tab.id
                  ? 'bg-[#FFA000] text-white shadow-sm'
                  : 'text-[#888] hover:text-[#E0E0E0] hover:bg-[#3A3B44]'
              }`}
              title={tab.label}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-[7px] font-bold leading-none">{tab.label}</span>
            </button>
          ))}

        </nav>

        <main className="flex-1 flex overflow-hidden bg-[#1E1F26]">
          {activeTab === 'layout' && (
            <SceneEditor
              scene={currentScene}
              objects={project.objects}
              onUpdateScene={handleUpdateScene}
              selectedObject={selectedObj}
              onSelectObject={handleSelectObject}
              onAddObject={handleAddObject}
              onUpdateObject={handleUpdateObject}
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
              music={project.music}
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
            <Exporter project={project} />
          )}
        </main>
      </div>

      {isPreviewing && (
        <PreviewModal
          project={project}
          onClose={() => setIsPreviewing(false)}
        />
      )}
    </div>
  );
}
