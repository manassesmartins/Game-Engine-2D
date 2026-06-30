/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { GameProject } from '../types';
import { EngineRunner } from '../engine/EngineRunner';
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
    <div className="fixed inset-0 bg-[#1E1F26]/95 flex items-stretch justify-stretch z-50 p-4 overflow-hidden" id="preview_modal_screen">
      
      <div className="flex-1 flex flex-col md:flex-row gap-4 max-w-7xl mx-auto w-full">
        
        {/* RUNNING STAGE CONTAINER */}
        <div className="flex-1 flex flex-col justify-stretch bg-[#2B2C33] border border-[#3A3B44] rounded relative shadow-lg p-3 overflow-hidden">
          
          {/* Controls Bar */}
          <div className="flex items-center justify-between mb-3 border-b border-[#3A3B44] pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FFA000] animate-pulse"></span>
              <span className="text-xs font-bold text-[#E0E0E0]">PREVIEW</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTogglePause}
                className={`text-xs px-2.5 py-1 rounded font-medium transition-all active:scale-95 ${
                  isPaused ? 'bg-[#FFA000] text-white' : 'bg-[#3A3B44] text-[#E0E0E0]'
                }`}
              >
                {isPaused ? 'Resumir' : 'Pausar'}
              </button>

              <button
                onClick={handleRestart}
                className="text-xs bg-[#3A3B44] hover:bg-[#4A4B54] text-[#E0E0E0] px-2.5 py-1 rounded font-medium flex items-center gap-1 active:scale-95 transition-all border border-[#4A4B54]"
              >
                <RotateCcw className="w-3 h-3" /> Reiniciar
              </button>
            </div>
          </div>

          {/* Actual Active Canvas stage */}
          <div className="flex-1 flex items-center justify-center p-2 relative bg-[#1E1F26] rounded border border-[#3A3B44] overflow-hidden">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="max-w-full max-h-full rounded shadow bg-[#23242B] block"
              id="live_physics_stage"
            />
          </div>
        </div>

        {/* LOG DEBUGGER SIDE PANEL */}
        <div className="w-full md:w-72 bg-[#26272E] border border-[#3A3B44] rounded flex flex-col p-3 shadow">
          <div className="flex items-center justify-between border-b border-[#3A3B44] pb-2 mb-2">
            <span className="text-xs font-bold text-[#E0E0E0] tracking-wider flex items-center gap-1.5 uppercase">
              <AlertCircle className="w-3.5 h-3.5 text-[#FFA000]" /> Logs
            </span>
            <button
              onClick={onClose}
              className="p-0.5 hover:bg-[#3A1A1A] text-[#FF6B6B] rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Log lists stream */}
          <div className="flex-1 overflow-y-auto space-y-1 text-[10px] leading-relaxed pr-1" id="debugger_console_output">
            {logs.length === 0 ? (
              <span className="text-[#666] italic p-2 block text-center">Nenhum evento registrado.</span>
            ) : (
              logs.map((log, idx) => {
                let colorClass = 'text-[#888]';
                if (log.includes('Erro')) colorClass = 'text-[#FF6B6B] font-medium';
                if (log.includes('Iniciado')) colorClass = 'text-[#4CAF50]';
                if (log.includes('Variável')) colorClass = 'text-[#FFA000]';
                
                return (
                  <div key={idx} className={`p-1 bg-[#2B2C33] rounded border border-[#3A3B44]/50 ${colorClass}`}>
                    {log}
                  </div>
                );
              })
            )}
          </div>

          <div className="bg-[#2B2C33] p-2 rounded mt-2 border border-[#3A3B44]">
            <span className="text-[10px] text-[#FFA000] font-medium block mb-0.5">Como Testar:</span>
            <p className="text-[9px] text-[#888] leading-normal">
              Use setas ou WASD para mover. Clique em objetos com gatilhos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
