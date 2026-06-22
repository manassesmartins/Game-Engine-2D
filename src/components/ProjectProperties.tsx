import React from 'react';
import { ProjectSettings, Scene } from '../types';
import { X } from 'lucide-react';

interface ProjectPropertiesProps {
  settings: ProjectSettings;
  scenes: Scene[];
  onUpdateSettings: (s: ProjectSettings) => void;
  onClose: () => void;
}

export default function ProjectProperties({ settings, scenes, onUpdateSettings, onClose }: ProjectPropertiesProps) {
  const update = (partial: Partial<ProjectSettings>) => {
    onUpdateSettings({ ...settings, ...partial });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" onClick={onClose}>
      <div
        className="bg-[#2B2C33] border border-[#3A3B44] rounded-lg shadow-2xl w-[440px] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3A3B44]">
          <h2 className="text-sm font-bold text-[#E0E0E0] uppercase tracking-wider">Propriedades do Projeto</h2>
          <button onClick={onClose} className="text-[#888] hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-medium text-[#888] uppercase tracking-wide block mb-1">Largura da Janela</label>
              <input
                type="number"
                value={settings.windowWidth}
                onChange={(e) => update({ windowWidth: parseInt(e.target.value) || 320 })}
                className="w-full bg-[#1E1F26] border border-[#3A3B44] focus:border-[#FFA000] text-xs text-[#E0E0E0] rounded p-2 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-[#888] uppercase tracking-wide block mb-1">Altura da Janela</label>
              <input
                type="number"
                value={settings.windowHeight}
                onChange={(e) => update({ windowHeight: parseInt(e.target.value) || 240 })}
                className="w-full bg-[#1E1F26] border border-[#3A3B44] focus:border-[#FFA000] text-xs text-[#E0E0E0] rounded p-2 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium text-[#888] uppercase tracking-wide block mb-1">FPS (Quadros por Segundo)</label>
            <select
              value={settings.fps}
              onChange={(e) => update({ fps: parseInt(e.target.value) as 30 | 60 })}
              className="w-full bg-[#1E1F26] border border-[#3A3B44] text-xs text-[#E0E0E0] rounded p-2 outline-none focus:border-[#FFA000]"
            >
              <option value={30}>30 FPS</option>
              <option value={60}>60 FPS</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-medium text-[#888] uppercase tracking-wide block mb-1">Modo de Renderização</label>
            <select
              value={settings.renderMode}
              onChange={(e) => update({ renderMode: e.target.value as 'canvas2d' | 'webgl' })}
              className="w-full bg-[#1E1F26] border border-[#3A3B44] text-xs text-[#E0E0E0] rounded p-2 outline-none focus:border-[#FFA000]"
            >
              <option value="canvas2d">Canvas 2D</option>
              <option value="webgl">WebGL</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-medium text-[#888] uppercase tracking-wide block mb-1">Cor de Fundo</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={settings.backgroundColor}
                onChange={(e) => update({ backgroundColor: e.target.value })}
                className="w-10 h-9 p-0.5 bg-[#1E1F26] border border-[#3A3B44] rounded cursor-pointer"
              />
              <input
                type="text"
                value={settings.backgroundColor}
                onChange={(e) => update({ backgroundColor: e.target.value })}
                className="flex-1 bg-[#1E1F26] border border-[#3A3B44] focus:border-[#FFA000] text-xs text-[#E0E0E0] rounded p-2 outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium text-[#888] uppercase tracking-wide block mb-1">Cena Inicial</label>
            <select
              value={settings.startSceneId}
              onChange={(e) => update({ startSceneId: e.target.value })}
              className="w-full bg-[#1E1F26] border border-[#3A3B44] text-xs text-[#E0E0E0] rounded p-2 outline-none focus:border-[#FFA000]"
            >
              <option value="">Selecione...</option>
              {scenes.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-[#888] cursor-pointer">
              <input
                type="checkbox"
                checked={settings.fullscreen}
                onChange={(e) => update({ fullscreen: e.target.checked })}
                className="rounded accent-[#FFA000] w-4 h-4"
              />
              Tela Cheia (Fullscreen)
            </label>
            <label className="flex items-center gap-2 text-xs text-[#888] cursor-pointer">
              <input
                type="checkbox"
                checked={settings.pixelArt}
                onChange={(e) => update({ pixelArt: e.target.checked })}
                className="rounded accent-[#FFA000] w-4 h-4"
              />
              Pixel Art (escalonamento linear)
            </label>
          </div>
        </div>

        <div className="flex justify-end px-4 py-3 border-t border-[#3A3B44]">
          <button
            onClick={onClose}
            className="text-xs bg-[#FFA000] hover:bg-[#FFB300] text-white font-bold py-1.5 px-4 rounded transition-all active:scale-95 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
