import React, { useState } from 'react';
import { GameProject } from '../types';
import { GAME_TEMPLATES, createProjectFromTemplate } from '../templates/gameTemplates';
import { Gamepad2, Sword, Puzzle, Zap, Dices, FilePlus, Upload, Sparkles, ChevronRight, RotateCw } from 'lucide-react';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  platformer: Gamepad2,
  rpg: Sword,
  puzzle: Puzzle,
  arcade: Zap,
  board: Dices,
  blank: FilePlus,
};

const CATEGORY_LABELS: Record<string, string> = {
  platformer: 'Plataforma',
  rpg: 'RPG',
  puzzle: 'Puzzle',
  arcade: 'Arcade',
  board: 'Tabuleiro',
  blank: 'Vazio',
};

interface WelcomeScreenProps {
  onNewProject: (project: GameProject) => void;
  onLoadProject: (project: GameProject) => void;
}

export default function WelcomeScreen({ onNewProject, onLoadProject }: WelcomeScreenProps) {
  const [step, setStep] = useState<'main' | 'templates'>('main');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleCreateFromTemplate = () => {
    if (!selectedTemplate) return;
    const project = createProjectFromTemplate(selectedTemplate);
    if (project) {
      onNewProject(project);
    }
  };

  const handleLoadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const loaded = JSON.parse(event.target?.result as string) as GameProject;
        if (loaded.objects && loaded.scenes) {
          onLoadProject(loaded);
        }
      } catch (_) { /* ignore */ }
    };
    reader.readAsText(file);
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#1E1F26] select-none">
      <div className="w-full max-w-3xl p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-[#FFA000] flex items-center justify-center mb-4 shadow-lg">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Constructo 2D Studio</h1>
          <p className="text-sm text-[#888] mt-1">Motor de jogos 2D — Crie sem limites</p>
        </div>

        {step === 'main' && (
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => setStep('templates')}
              className="w-72 bg-[#FFA000] hover:bg-[#FFB300] text-white rounded-xl py-3.5 px-6 text-sm font-bold transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <FilePlus className="w-4 h-4" />
              Novo Projeto
              <ChevronRight className="w-4 h-4 ml-auto opacity-60" />
            </button>

            <label className="w-72 bg-[#2B2C33] hover:bg-[#3A3B44] border border-[#3A3B44] hover:border-[#4A4B54] text-[#A0A0A0] hover:text-white rounded-xl py-3.5 px-6 text-sm font-medium transition-all flex items-center justify-center gap-2.5 cursor-pointer">
              <Upload className="w-4 h-4" />
              Carregar Projeto
              <input type="file" accept=".json" onChange={handleLoadFile} className="hidden" />
            </label>

            <p className="text-[10px] text-[#666] mt-4 text-center max-w-xs leading-relaxed">
              Crie um jogo 2D do zero com sprites, eventos, áudio e física embutidos — sem escrever código.
            </p>
          </div>
        )}

        {step === 'templates' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-bold text-white">Escolha um Modelo</h2>
              <button
                onClick={() => { setStep('main'); setSelectedTemplate(null); }}
                className="text-[10px] text-[#888] hover:text-white bg-[#2B2C33] hover:bg-[#3A3B44] py-1.5 px-3 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RotateCw className="w-3 h-3" /> Voltar
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {GAME_TEMPLATES.map(t => {
                const Icon = CATEGORY_ICONS[t.category] || FilePlus;
                const isSelected = selectedTemplate === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`rounded-xl p-4 text-left transition-all border-2 cursor-pointer ${
                      isSelected
                        ? 'bg-[#2B2C33] border-[#FFA000] shadow-md'
                        : 'bg-[#22232A] border-[#2B2C33] hover:border-[#4A4B54] hover:bg-[#2B2C33]'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                      isSelected ? 'bg-[#FFA000]' : 'bg-[#3A3B44]'
                    }`}>
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-[#888]'}`} />
                    </div>
                    <h3 className={`text-sm font-bold mb-1 ${isSelected ? 'text-white' : 'text-[#C0C0C0]'}`}>
                      {t.name}
                    </h3>
                    <p className="text-[10px] text-[#777] leading-relaxed">{t.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleCreateFromTemplate}
                disabled={!selectedTemplate}
                className={`w-72 rounded-xl py-3 px-6 text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                  selectedTemplate
                    ? 'bg-[#FFA000] hover:bg-[#FFB300] text-white active:scale-[0.98]'
                    : 'bg-[#2B2C33] text-[#555] cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                {selectedTemplate ? 'Criar Projeto' : 'Selecione um modelo'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
