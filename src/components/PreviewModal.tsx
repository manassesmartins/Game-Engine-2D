/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { GameProject } from '../types';
import { EngineRunner } from '../utils/engineRunner';
import { Play, RotateCcw, X, AlertCircle } from 'lucide-react';

interface PreviewModalProps {
  project: GameProject;
  onClose: () => void;
}

export default function PreviewModal({ project, onClose }: PreviewModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runnerRef = useRef<EngineRunner | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  useEffect(() => {
    startEngine();
    return () => {
      stopEngine();
    };
  }, []);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 35)]);
  };

  const startEngine = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Reset log
    setLogs([]);
    addLog('Inicializando Motor Gráfico Canvas2D...');

    try {
      const runner = new EngineRunner(canvas, project, (msg) => addLog(msg));
      runnerRef.current = runner;
      runner.start();
      setIsPaused(false);
    } catch (e) {
      addLog(`Erro crítico de Inicialização: ${e}`);
    }
  };

  const stopEngine = () => {
    if (runnerRef.current) {
      runnerRef.current.stop();
    }
  };

  const handleTogglePause = () => {
    if (!runnerRef.current) return;
    if (isPaused) {
      runnerRef.current.start();
      setIsPaused(false);
    } else {
      runnerRef.current.stop();
      setIsPaused(true);
    }
  };

  const handleRestart = () => {
    stopEngine();
    startEngine();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-stretch justify-stretch z-50 p-6 overflow-hidden animate-in fade-induration-150" id="preview_modal_screen">
      
      {/* Dynamic preview content split */}
      <div className="flex-1 flex flex-col md:flex-row gap-6 max-w-7xl mx-auto w-full">
        
        {/* RUNNING STAGE CONTAINER */}
        <div className="flex-1 flex flex-col justify-stretch bg-[#111218] border border-slate-800 rounded-2xl relative shadow-2xl p-4 overflow-hidden">
          
          {/* Controls Bar */}
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold font-mono text-emerald-400">EXECUTADOR SANDBOX LIVE</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTogglePause}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all active:scale-95 ${
                  isPaused ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                }`}
              >
                {isPaused ? 'Resumir' : 'Pausar'}
              </button>

              <button
                onClick={handleRestart}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 active:scale-95 transition-all border border-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reiniciar
              </button>
            </div>
          </div>

          {/* Actual Active Canvas stage */}
          <div className="flex-1 flex items-center justify-center p-3 relative bg-[#07080b] rounded-xl border border-slate-900 overflow-hidden">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="max-w-full max-h-full rounded shadow-lg bg-[#181924] block"
              id="live_physics_stage"
            />
          </div>
        </div>

        {/* LOG DEBUGGER SIDE PANEL */}
        <div className="w-full md:w-80 bg-[#161720] border border-slate-800 rounded-2xl flex flex-col p-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <span className="text-xs font-bold text-slate-400 tracking-wider flex items-center gap-1.5 uppercase font-mono">
              <AlertCircle className="w-4 h-4 text-indigo-400" /> Console de Debug (Logs)
            </span>
            <button
              onClick={onClose}
              className="p-1 hover:bg-rose-950/20 text-rose-400 rounded-lg transition-colors border border-transparent hover:border-slate-805"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Log lists stream */}
          <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-[10px] leading-relaxed pr-1" id="debugger_console_output">
            {logs.length === 0 ? (
              <span className="text-gray-500 italic p-3 block text-center">Nenhum evento registrado ainda.</span>
            ) : (
              logs.map((log, idx) => {
                let colorClass = 'text-gray-400';
                if (log.includes('Erro')) colorClass = 'text-rose-400 font-semibold';
                if (log.includes('Iniciado')) colorClass = 'text-emerald-400';
                if (log.includes('Variável')) colorClass = 'text-indigo-300';
                
                return (
                  <div key={idx} className={`p-1.5 bg-[#1a1b24] rounded border border-slate-800/40 ${colorClass}`}>
                    {log}
                  </div>
                );
              })
            )}
          </div>

          <div className="bg-[#1e1f2b] p-3 rounded-lg mt-3 border border-slate-850">
            <span className="text-[10px] text-indigo-400 font-bold block mb-0.5">Como Testar:</span>
            <p className="text-[9px] text-gray-400 leading-normal">
              Utilize as setas do teclado ou WSAD para movimentar personagens que possuam comportamentos ativos. Clique em personagens com gatilhos programados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
