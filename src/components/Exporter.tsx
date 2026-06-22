/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GameProject } from '../types';
import { Monitor, Smartphone, Globe, Download, CheckCircle, Package, ArrowRight } from 'lucide-react';

interface ExporterProps {
  project: GameProject;
}

export default function Exporter({ project }: ExporterProps) {
  const [platform, setPlatform] = useState<'windows' | 'linux' | 'mobile' | 'web'>('web');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportComplete, setExportComplete] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  const handleStartExport = () => {
    setIsExporting(true);
    setProgress(0);
    setExportComplete(false);

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsExporting(false);
          setExportComplete(true);
          return 100;
        }
        return prev + 10;
      });
    }, 180);
  };

  const triggerDownloadSimulation = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${project.name.replace(/\s+/g, '_')}_export_${platform}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#0f1015]" id="exporter_root">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-400" />
            Distribuição & Exportador Multiplataforma
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Gere builds de alta performance compiladas com renderizador WebGL nativo de forma simples em um clique, sem complicações de SDKs locais.
          </p>
        </div>

        {/* Platforms grid selector option list */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          <div
            onClick={() => { if(!isExporting) setPlatform('web'); }}
            className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center justify-between text-center transition-all ${
              platform === 'web'
                ? 'bg-indigo-950/40 border-indigo-500 shadow-md ring-2 ring-indigo-950/20'
                : 'bg-[#181922] border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg ${platform === 'web' ? 'bg-indigo-900 text-indigo-200' : 'bg-slate-800 text-gray-400'}`}>
              <Globe className="w-5 h-5" />
            </div>
            <div className="mt-3">
              <span className="text-xs font-bold text-slate-200 block">Navegadores</span>
              <span className="text-[9px] text-gray-500 block uppercase mt-0.5">HTML5 Offline</span>
            </div>
          </div>

          <div
            onClick={() => { if(!isExporting) setPlatform('windows'); }}
            className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center justify-between text-center transition-all ${
              platform === 'windows'
                ? 'bg-indigo-950/40 border-indigo-500 shadow-md ring-2 ring-indigo-950/20'
                : 'bg-[#181922] border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg ${platform === 'windows' ? 'bg-indigo-900 text-indigo-200' : 'bg-slate-800 text-gray-400'}`}>
              <Monitor className="w-5 h-5" />
            </div>
            <div className="mt-3">
              <span className="text-xs font-bold text-slate-200 block">Windows</span>
              <span className="text-[9px] text-gray-500 block uppercase mt-0.5">Standalone (.exe)</span>
            </div>
          </div>

          <div
            onClick={() => { if(!isExporting) setPlatform('linux'); }}
            className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center justify-between text-center transition-all ${
              platform === 'linux'
                ? 'bg-indigo-950/40 border-indigo-500 shadow-md ring-2 ring-indigo-950/20'
                : 'bg-[#181922] border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg ${platform === 'linux' ? 'bg-indigo-900 text-indigo-200' : 'bg-slate-800 text-gray-400'}`}>
              <Monitor className="w-5 h-5" />
            </div>
            <div className="mt-3">
              <span className="text-xs font-bold text-slate-200 block">Linux</span>
              <span className="text-[9px] text-gray-500 block uppercase mt-0.5">AppImage / Binary</span>
            </div>
          </div>

          <div
            onClick={() => { if(!isExporting) setPlatform('mobile'); }}
            className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center justify-between text-center transition-all ${
              platform === 'mobile'
                ? 'bg-indigo-950/40 border-indigo-500 shadow-md ring-2 ring-indigo-950/20'
                : 'bg-[#181922] border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg ${platform === 'mobile' ? 'bg-indigo-900 text-indigo-200' : 'bg-slate-800 text-gray-400'}`}>
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="mt-3">
              <span className="text-xs font-bold text-slate-200 block">Dispositivos Móveis</span>
              <span className="text-[9px] text-gray-500 block uppercase mt-0.5">APK Android & iOS</span>
            </div>
          </div>

        </div>

        {/* DETAILS OF CHOSEN PLATFORM */}
        <div className="bg-[#181922] border border-[#272834] rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <span>⚙</span> Detalhes técnicos do pacote ({platform})
          </h4>

          <ul className="space-y-2 text-xs text-gray-400 leading-relaxed" id="export_details_bullet_list">
            <li className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <span>Embala toda a lógica da <strong>Folha de Eventos Visuais</strong> e os recursos de <strong>Pixel Art</strong> em um único runtime otimizado.</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <span>Renderizador automatizado por WebGL / HTML5 Canvas2D de alto desempenho garantindo 60 FPS estáveis mesmo em dispositivos com poucos recursos.</span>
            </li>
            {platform === 'web' && (
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <span>Pode ser hospedado no GitHub Pages, Itch.io, Vercel ou qualquer servidor web convencional instantaneamente.</span>
              </li>
            )}
            {platform === 'windows' && (
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <span>Otimizado com wrapper Electron nativo, permitindo controle offline e integração direta com controles/teclado no desktop Windows.</span>
              </li>
            )}
            {platform === 'linux' && (
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <span>Embalado como formato binário universal portátil executável, compatível com Ubuntu, Debian, Fedora e Arch Linux sem dependências extras.</span>
              </li>
            )}
            {platform === 'mobile' && (
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <span>Integração de suporte touch e controles virtuais virtuais virtuais auto-gerados na tela para gameplays de smartphones e tablets.</span>
              </li>
            )}
          </ul>

          {/* ACTIVE PROGRESS BAR */}
          {isExporting && (
            <div className="space-y-2" id="export_progress_strip">
              <div className="flex justify-between text-xs font-mono text-indigo-400">
                <span>Compilando folha de de cenas e behaviors...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {exportComplete && (
            <div className="bg-emerald-950/20 border border-emerald-900/65 rounded-lg p-4 flex items-start gap-3" id="export_success_card">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-emerald-400 block">Compilação concluída com sucesso!</span>
                <p className="text-[11px] text-emerald-300 leading-normal mt-1">
                  Seu pacote de distribuição multiplataforma foi gerado. Você pode baixar as configurações compiladas do jogo em formato offline JSON estruturado e integrável.
                </p>
                <button
                  onClick={triggerDownloadSimulation}
                  className="mt-3 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold py-1.5 px-4 transition-all"
                >
                  <Download className="w-4 h-4" /> Baixar Build do Jogo
                </button>
              </div>
            </div>
          )}

          {!isExporting && !exportComplete && (
            <button
              onClick={handleStartExport}
              className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer w-full"
            >
              🚀 Exportar para {platform.toUpperCase()}
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
