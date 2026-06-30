/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  EventBlock, ProjectObject, SoundPreset, MusicTrack, ConditionType, ActionType, 
  EventCondition, EventAction, ScriptFile, DictionaryPluginData, ArrayPluginData 
} from '../types';
import { 
  Play, Plus, Trash2, ArrowRight, Sparkles, FolderPlus, HelpCircle, Undo2, Redo2, 
  Code, Settings, FileCode, Check, ListFilter, PlusCircle, Database, Braces,
  Copy, Edit3, Eye, EyeOff, MessageSquare, Layers
} from 'lucide-react';
import ContextMenu, { ContextMenuItem } from './ContextMenu';

interface EventSheetEditorProps {
  events: EventBlock[];
  objects: ProjectObject[];
  sounds: SoundPreset[];
  music: MusicTrack[];
  globalVariables: Record<string, number>;
  onUpdateEvents: (updatedEvents: EventBlock[]) => void;
  onUpdateGlobalVars: (updatedVars: Record<string, number>) => void;
  
  // Advanced optional components passed natively
  scripts?: ScriptFile[];
  onUpdateScripts?: (updatedScripts: ScriptFile[]) => void;
  dictionaries?: DictionaryPluginData[];
  onUpdateDictionaries?: (updatedDicts: DictionaryPluginData[]) => void;
  arrays?: ArrayPluginData[];
  onUpdateArrays?: (updatedArrays: ArrayPluginData[]) => void;
}

export default function EventSheetEditor({
  events,
  objects,
  sounds,
  music,
  globalVariables,
  onUpdateEvents,
  onUpdateGlobalVars,
  scripts = [],
  onUpdateScripts = () => {},
  dictionaries = [],
  onUpdateDictionaries = () => {},
  arrays = [],
  onUpdateArrays = () => {}
}: EventSheetEditorProps) {
  
  const [activeTab, setActiveTab] = useState<'nocode' | 'scripts' | 'plugins'>('nocode');

  const [showConditionModal, setShowConditionModal] = useState<boolean>(false);
  const [showActionModal, setShowActionModal] = useState<boolean>(false);
  const [targetBlockId, setTargetBlockId] = useState<string | null>(null);
  const [isSubEventTarget, setIsSubEventTarget] = useState<boolean>(false);

  // Undo/Redo Event Sheet history tracking
  const [eventHistory, setEventHistory] = useState<EventBlock[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'eventBlock' | 'condition' | 'action'; targetBlockId?: string; targetCondId?: string; targetActId?: string } | null>(null);

  // New Global/Local Var creation
  const [newVarName, setNewVarName] = useState<string>('Pontos');
  const [newVarVal, setNewVarVal] = useState<number>(0);

  // JS scripts local management
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(scripts[0]?.id || null);
  const [newScriptName, setNewScriptName] = useState<string>('movimento_ia.js');

  // Plugins additions
  const [newPluginName, setNewPluginName] = useState<string>('');
  const [newPluginType, setNewPluginType] = useState<'dictionary' | 'array'>('dictionary');
  const [dictKey, setDictKey] = useState('');
  const [dictVal, setDictVal] = useState('');
  const [arrayVal, setArrayVal] = useState('');

  // Local variables form states
  const [localBlockVarName, setLocalBlockVarName] = useState('');
  const [localBlockVarValue, setLocalBlockVarValue] = useState('');

  // Modal active selection temporary carriers
  const [selectedCondType, setSelectedCondType] = useState<ConditionType>('keyboard_keypress');
  const [condParam1, setCondParam1] = useState<string>('ArrowRight');
  const [condParam2, setCondParam2] = useState<string>('');
  const [condParam3, setCondParam3] = useState<string>('');

  const [selectedActType, setSelectedActType] = useState<ActionType>('object_move');
  const [actTargetObj, setActTargetObj] = useState<string>('');
  const [actParam1, setActParam1] = useState<string>('5');
  const [actParam2, setActParam2] = useState<string>('0');
  const [actParam3, setActParam3] = useState<string>('');
  const [actParam4, setActParam4] = useState<string>('');

  const pushState = (newEvents: EventBlock[]) => {
    const nextHistory = eventHistory.slice(0, historyIndex + 1);
    nextHistory.push(JSON.parse(JSON.stringify(newEvents)));
    setEventHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    onUpdateEvents(newEvents);
  };

  const handleUndo = () => {
    if (eventHistory.length === 0 || historyIndex < 0) return;
    if (historyIndex === 0) {
      setHistoryIndex(-1);
      onUpdateEvents([]);
      return;
    }
    const prevIndex = historyIndex - 1;
    setHistoryIndex(prevIndex);
    onUpdateEvents(JSON.parse(JSON.stringify(eventHistory[prevIndex])));
  };

  const handleRedo = () => {
    if (historyIndex >= eventHistory.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    onUpdateEvents(JSON.parse(JSON.stringify(eventHistory[nextIndex])));
  };

  const handleAddEventBlock = () => {
    const newBlock: EventBlock = {
      id: 'event_' + Math.random().toString(36).substr(2, 9),
      conditions: [],
      actions: [],
      collapsed: false,
      subEvents: [],
      localVars: {}
    };
    const updated = [...events, newBlock];
    pushState(updated);
  };

  const handleCreateGlobalVar = () => {
    if (!newVarName.trim()) return;
    onUpdateGlobalVars({
      ...globalVariables,
      [newVarName.replace(/\s+/g, '_')]: newVarVal
    });
    setNewVarName('');
  };

  const handleDeleteGlobalVar = (keyToDelete: string) => {
    const copy = { ...globalVariables };
    delete copy[keyToDelete];
    onUpdateGlobalVars(copy);
  };

  // RECURSIVE BLOCKS UPDATER (Handles Sub-events seamlessly)
  const updateBlockInTree = (
    tree: EventBlock[], 
    targetId: string, 
    updater: (block: EventBlock) => EventBlock
  ): EventBlock[] => {
    return tree.map(block => {
      if (block.id === targetId) {
        return updater(block);
      }
      if (block.subEvents && block.subEvents.length > 0) {
        return {
          ...block,
          subEvents: updateBlockInTree(block.subEvents, targetId, updater)
        };
      }
      return block;
    });
  };

  // RECURSIVE BLOCKS DELETER
  const deleteBlockInTree = (tree: EventBlock[], targetId: string): EventBlock[] => {
    return tree
      .filter(block => block.id !== targetId)
      .map(block => {
        if (block.subEvents && block.subEvents.length > 0) {
          return {
            ...block,
            subEvents: deleteBlockInTree(block.subEvents, targetId)
          };
        }
        return block;
      });
  };

  const handleDeleteEventBlock = (blockId: string) => {
    const updated = deleteBlockInTree(events, blockId);
    pushState(updated);
  };

  const handleAddSubEvent = (parentBlockId: string) => {
    const childBlock: EventBlock = {
      id: 'sub_' + Math.random().toString(36).substr(2, 7),
      conditions: [],
      actions: [],
      collapsed: false,
      subEvents: [],
      localVars: {}
    };

    const updated = updateBlockInTree(events, parentBlockId, (block) => {
      return {
        ...block,
        subEvents: [...(block.subEvents || []), childBlock]
      };
    });

    pushState(updated);
  };

  // Block localized variable setters
  const handleAddLocalVar = (blockId: string, name: string, val: string) => {
    if (!name.trim()) return;
    const finalVal = isNaN(parseFloat(val)) ? val : parseFloat(val);

    const updated = updateBlockInTree(events, blockId, (block) => {
      return {
        ...block,
        localVars: {
          ...(block.localVars || {}),
          [name.trim()]: finalVal
        }
      };
    });
    pushState(updated);
  };

  const handleDeleteLocalVar = (blockId: string, varName: string) => {
    const updated = updateBlockInTree(events, blockId, (block) => {
      const copy = { ...(block.localVars || {}) };
      delete copy[varName];
      return {
        ...block,
        localVars: copy
      };
    });
    pushState(updated);
  };

  const handleOpenConditionModal = (blockId: string, isSub: boolean = false) => {
    setTargetBlockId(blockId);
    setIsSubEventTarget(isSub);
    if (objects.length > 0) {
      setCondParam1(objects[0].id);
      setCondParam2(objects[0].id);
    }
    setShowConditionModal(true);
  };

  const handleSaveCondition = () => {
    if (!targetBlockId) return;

    const newCond: EventCondition = {
      id: 'cond_' + Math.random().toString(36).substr(2, 9),
      type: selectedCondType,
      param1: condParam1,
      param2: condParam2,
      param3: condParam3 || undefined
    };

    const updated = updateBlockInTree(events, targetBlockId, (block) => {
      return {
        ...block,
        conditions: [...block.conditions, newCond]
      };
    });

    pushState(updated);
    setShowConditionModal(false);
  };

  const handleOpenActionModal = (blockId: string, isSub: boolean = false) => {
    setTargetBlockId(blockId);
    setIsSubEventTarget(isSub);
    if (objects.length > 0) {
      setActTargetObj(objects[0].id);
    }
    setShowActionModal(true);
  };

  const handleSaveAction = () => {
    if (!targetBlockId) return;

    const newAct: EventAction = {
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      type: selectedActType,
      targetObjectId: actTargetObj || undefined,
      param1: actParam1,
      param2: actParam2,
      param3: actParam3 || undefined,
      param4: actParam4 || undefined
    };

    const updated = updateBlockInTree(events, targetBlockId, (block) => {
      return {
        ...block,
        actions: [...block.actions, newAct]
      };
    });

    pushState(updated);
    setShowActionModal(false);
  };

  // SCRIPTS MANAGEMENTS FUNCTIONS
  const handleAddScript = () => {
    if (!newScriptName.trim()) return;
    const codeExt = newScriptName.endsWith('.js') ? newScriptName : newScriptName + '.js';
    const newScr: ScriptFile = {
      id: 'scr_' + Math.random().toString(36).substr(2, 5),
      name: codeExt,
      code: `// Código do Jogo - Executa no início de cada Tick\n// Acesse instâncias pelo ID\n\nconst player = getObjectInstance("player_inst");\nif (player) {\n  // Implemente lógicas adicionais aqui!\n}`,
      active: true
    };
    onUpdateScripts([...scripts, newScr]);
    setSelectedScriptId(newScr.id);
  };

  const handleUpdateScriptCode = (id: string, codeVal: string) => {
    const nextS = scripts.map(s => s.id === id ? { ...s, code: codeVal } : s);
    onUpdateScripts(nextS);
  };

  const handleToggleScriptActive = (id: string) => {
    const nextS = scripts.map(s => s.id === id ? { ...s, active: !s.active } : s);
    onUpdateScripts(nextS);
  };

  const handleDeleteScript = (id: string) => {
    const nextS = scripts.filter(s => s.id !== id);
    onUpdateScripts(nextS);
    if (selectedScriptId === id) {
      setSelectedScriptId(nextS[0]?.id || null);
    }
  };

  // NATIVE PLUGINS DICTIONARY / ARRAY CREATION
  const handleAddPluginNode = () => {
    if (!newPluginName.trim()) return;
    const nameSafe = newPluginName.replace(/\s+/g, '_');
    
    if (newPluginType === 'dictionary') {
      const nextD: DictionaryPluginData = {
        id: 'dict_' + Math.random().toString(36).substr(2, 5),
        name: nameSafe,
        entries: { 'ScoreMulti': 2, 'Title': 'Bento Platformer' }
      };
      onUpdateDictionaries([...dictionaries, nextD]);
    } else {
      const nextA: ArrayPluginData = {
        id: 'arr_' + Math.random().toString(36).substr(2, 5),
        name: nameSafe,
        values: [100, 200, 'Gold', 'Silver']
      };
      onUpdateArrays([...arrays, nextA]);
    }
    setNewPluginName('');
  };

  const handleAddDictRow = (dictId: string) => {
    if (!dictKey.trim()) return;
    const valFinal = isNaN(parseFloat(dictVal)) ? dictVal : parseFloat(dictVal);
    const nextD = dictionaries.map(d => {
      if (d.id === dictId) {
        return {
          ...d,
          entries: {
            ...d.entries,
            [dictKey.trim()]: valFinal
          }
        };
      }
      return d;
    });
    onUpdateDictionaries(nextD);
    setDictKey('');
    setDictVal('');
  };

  const handleDeleteDictRow = (dictId: string, entryKey: string) => {
    const nextD = dictionaries.map(d => {
      if (d.id === dictId) {
        const copy = { ...d.entries };
        delete copy[entryKey];
        return { ...d, entries: copy };
      }
      return d;
    });
    onUpdateDictionaries(nextD);
  };

  const handlePushArrayVal = (arrayId: string) => {
    if (!arrayVal.trim()) return;
    const valFinal = isNaN(parseFloat(arrayVal)) ? arrayVal : parseFloat(arrayVal);
    const nextA = arrays.map(a => {
      if (a.id === arrayId) {
        return {
          ...a,
          values: [...a.values, valFinal]
        };
      }
      return a;
    });
    onUpdateArrays(nextA);
    setArrayVal('');
  };

  const handleClearArray = (arrayId: string) => {
    const nextA = arrays.map(a => a.id === arrayId ? { ...a, values: [] } : a);
    onUpdateArrays(nextA);
  };

  const handleDeletePlugin = (id: string, type: 'dict' | 'arr') => {
    if (type === 'dict') {
      onUpdateDictionaries(dictionaries.filter(d => d.id !== id));
    } else {
      onUpdateArrays(arrays.filter(a => a.id !== id));
    }
  };

  const getConditionLabel = (cond: EventCondition) => {
    switch (cond.type) {
      case 'system_onload':
        return '🏁 No início do Layout (On Start)';
      case 'system_tick':
        return '⏳ A cada quadro de atualização (Tick)';
      case 'every_x_seconds':
        return `⏱ A cada ${cond.param1 || '1'} segundos`;
      case 'every_x_ticks':
        return `⏱ A cada ${cond.param1 || '1'} ticks`;
      case 'trigger_once':
        return '🎯 Disparar uma única vez (Trigger Once)';
      case 'keyboard_keypress':
        return `⌨ Ao pressionar tecla: [${cond.param1}]`;
      case 'keyboard_keyholding':
        return `⌨ Enquanto segura tecla: [${cond.param1}]`;
      case 'keyboard_keyrelease':
        return `⌨ Ao soltar tecla: [${cond.param1}]`;
      case 'object_collision':
        const objA = objects.find(o => o.id === cond.param1)?.name || cond.param1;
        const objB = objects.find(o => o.id === cond.param2)?.name || cond.param2;
        return `⚔ Quando '${objA}' colidir com '${objB}'`;
      case 'object_click':
        const objClickName = objects.find(o => o.id === cond.param1)?.name || cond.param1;
        return `🖱 Ao clicar com mouse no objeto '${objClickName}'`;
      case 'mouse_click':
        return `🖱 Ao clicar em qualquer local na tela`;
      case 'object_distance':
        return `📏 Distância entre '${cond.param1}' e '${cond.param2}' < ${cond.param3 || '100'}px`;
      case 'object_count_compare':
        return `🔢 Contagem de '${cond.param1}' ${cond.param2 || '>'}= ${cond.param3 || '1'}`;
      case 'mouse_cursor_on_object':
        return `🖱 Mouse sobre o objeto '${cond.param1}'`;
      case 'timer_elapsed':
        return `⏳ Relógio: Quando decorrido [${cond.param1}s]`;
      case 'function_called':
        return `🔊 Gatilho de Função: Ao chamar "${cond.param1}"`;
      case 'gesture_touch':
        return `📱 Toque na Tela: Gestos e deslizes`;
      case 'global_var_compare':
        return `📊 Variável Global '${cond.param1}' ${cond.param2 || '=='} ${cond.param3 || '0'}`;
      case 'instance_var_compare':
        return `📊 Variável de '${cond.param1}' ${cond.param2 || '=='} ${cond.param3 || '0'}`;
      case 'compare_dictionary_value':
        return `📖 Dicionário '${cond.param1}' chave ${cond.param2} ${cond.param3 || '=='}`;
      case 'array_compare_at_index':
        return `📊 Array '${cond.param1}' índice ${cond.param2} ${cond.param3 || '=='}`;
      case 'else_condition':
        return '🚫 Senão (Else)';
      case 'always':
        return '✅ Sempre (Always)';
      case 'pick_random_instance':
        return `🎲 Pegar instância aleatória de '${cond.param1}'`;
      case 'pick_nearest':
        return `📍 Pegar '${cond.param1}' mais próximo de '${cond.param2}'`;
      case 'pick_farthest':
        return `📍 Pegar '${cond.param1}' mais distante de '${cond.param2}'`;
      case 'double_jump_available':
        return `💨 Pulo duplo disponível para '${cond.param1}'`;
      case 'is_on_floor':
        return `⬇ '${cond.param1}' está no chão`;
      case 'animation_finished':
        return `🎬 Animação de '${cond.param1}' terminou`;
      default:
        return 'Condição Customizada';
    }
  };

  const getActionLabel = (act: EventAction) => {
    const targetName = objects.find(o => o.id === act.targetObjectId)?.name || 'Sistema';
    switch (act.type) {
      case 'object_move':
        return `🏃 Mover '${targetName}' por (${act.param1}px, ${act.param2}px)`;
      case 'object_move_to':
        return `🎯 Mover '${targetName}' para (${act.param1}px, ${act.param2}px) em ${act.param3 || '0'}s`;
      case 'object_set_pos':
        return `📍 Definir posição de '${targetName}' para (${act.param1}px, ${act.param2}px)`;
      case 'object_spawn':
        const spawnedName = objects.find(o => o.id === act.param1)?.name || act.param1;
        return `✨ '${targetName}' invoca/spawn '${spawnedName}'`;
      case 'object_destroy':
        return `💥 Destruir '${targetName}'`;
      case 'object_set_angle':
        return `🔄 Definir rotação de '${targetName}' para ${act.param1}°`;
      case 'object_set_scale':
        return `↕ Redimensionar '${targetName}' escala para ${act.param1}x`;
      case 'object_set_opacity':
        return `👁 Opacidade de '${targetName}' para ${act.param1}`;
      case 'object_set_filter':
        return `🎨 Aplicar Filtro Shader de '${targetName}' para "${act.param1}"`;
      case 'object_set_blend':
        return `🔗 Mudar Blend Mode de '${targetName}' para "${act.param1}"`;
      case 'object_set_visible':
        return `👁 Visibilidade de '${targetName}' = ${act.param1}`;
      case 'object_set_animation':
        return `🎬 Animação de '${targetName}' = "${act.param1}"`;
      case 'object_set_frame':
        return `🖼 Frame de '${targetName}' para ${act.param1}`;
      case 'object_set_size':
        return `📐 Tamanho de '${targetName}' = ${act.param1}x${act.param2}`;
      case 'object_flash':
        return `📳 Flash em '${targetName}' por ${act.param1}s`;
      case 'object_fade':
        return `🌫 Fade em '${targetName}' por ${act.param1}s`;
      case 'object_pin':
        return `📌 Fixar '${targetName}' em '${act.param1}'`;
      case 'object_unpin':
        return `📌 Soltar '${targetName}'`;
      case 'play_sound':
        return `🔊 Tocar Som: "${act.param1}"`;
      case 'play_music':
        return `🎵 Tocar Música: "${act.param1}"`;
      case 'stop_music':
        return `⏹ Parar Música`;
      case 'system_add_variable':
        return `➕ Somar ${act.param2} em "${act.param1}"`;
      case 'system_set_variable':
        return `⚙ Definir "${act.param1}" = ${act.param2}`;
      case 'system_sub_variable':
        return `➖ Subtrair ${act.param2} de "${act.param1}"`;
      case 'set_instance_variable':
        return `⚙ Variável de '${targetName}' = ${act.param1} = ${act.param2}`;
      case 'timer_start':
        return `⏳ Timer "${targetName}" = ${act.param1}s`;
      case 'wait':
        return `⏸ Aguardar ${act.param1}s`;
      case 'call_function':
        return `🎮 Chamar Função: "${act.param1}"`;
      case 'broadcast_function':
        return `📢 Transmitir Função: "${act.param1}"`;
      case 'go_to_layout':
        return `🚪 Ir para cena: "${act.param1}"`;
      case 'restart_layout':
        return `🔄 Reiniciar cena atual`;
      case 'next_layout':
        return `⏭ Próxima cena`;
      case 'dictionary_set':
        return `📖 Dicionário: "${act.param1}" = "${act.param2}"`;
      case 'array_push':
        return `📊 Array: push "${act.param1}"`;
      case 'array_pop':
        return `📊 Array: pop`;
      case 'array_insert':
        return `📊 Array: inserir "${act.param1}" na posição ${act.param2}`;
      case 'array_remove':
        return `📊 Array: remover índice ${act.param1}`;
      case 'array_set':
        return `📊 Array: índice ${act.param1} = "${act.param2}"`;
      case 'array_clear':
        return `📊 Array: limpar`;
      case 'set_camera_position':
        return `📷 Camera para (${act.param1}, ${act.param2})`;
      case 'scroll_to_object':
        return `📷 Rolar camera até '${act.param1}'`;
      case 'shake_camera':
        return `📷 Chacoalhar câmera`;
      case 'log_message':
        return `📝 Log: "${act.param1}"`;
      case 'set_gravity':
        return `🌎 Gravidade = ${act.param1}`;
      case 'set_velocity':
        return `💨 Velocidade de '${targetName}' = (${act.param1}, ${act.param2})`;
      case 'apply_force':
        return `💥 Força em '${targetName}' = (${act.param1}, ${act.param2})`;
      default:
        return 'Ação do Sistema';
    }
  };

  // RECURSIVE BLOCKS RENDERER Component
  const renderEventsList = (blocksList: EventBlock[], depth: number = 0) => {
    return blocksList.map((block, idx) => {
      return (
        <div 
          key={block.id}
          className="relative transition-all"
          style={{ marginLeft: `${depth * 28}px` }}
        >
          {/* Visual depth connector lines */}
          {depth > 0 && (
            <div className="absolute left-[-16px] top-0 bottom-0 w-[2px] border-l-2 border-dashed border-slate-700/80 pointer-events-none"></div>
          )}

          <div 
            className={`bg-[#14151e] border rounded-xl overflow-hidden shadow-lg transition-all mb-4 ${
              depth > 0 ? 'border-slate-800 bg-[#121319]' : 'border-[#262732] hover:border-slate-700'
            }`}
            id={`event_block_${block.id}`}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'eventBlock', targetBlockId: block.id }); }}
          >
            {/* Header block strip */}
            <div className="bg-[#181923] px-4 py-2.5 flex items-center justify-between border-b border-slate-850">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded">
                  {depth > 0 ? 'Sub-Bloco' : 'Bloco Principal'}
                </span>
                {Object.keys(block.localVars || {}).length > 0 && (
                  <span className="text-[9px] text-[#4f46e5] bg-[#e0e7ff] dark:bg-indigo-950/30 dark:text-indigo-300 font-bold px-2 rounded-full">
                    {Object.keys(block.localVars || {}).length} Var Locais
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleAddSubEvent(block.id)}
                  className="p-1 px-2.5 bg-slate-800/50 hover:bg-slate-800 text-[9px] text-indigo-300 font-bold rounded flex items-center gap-1 cursor-pointer transition-all border border-slate-800"
                  title="Aninhar nova subcondição complexa"
                >
                  <Plus className="w-3 h-3 text-[#818cf8]" /> +SubEvent
                </button>
                <div className="w-[1px] h-3 bg-slate-850 mx-1"></div>
                <button
                  onClick={() => handleDeleteEventBlock(block.id)}
                  className="p-1 hover:bg-rose-950/20 text-rose-400 hover:text-rose-300 rounded transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Split conditions & actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-850">
              
              {/* SE... (Conditions panel) */}
              <div className="p-3.5 space-y-2.5 bg-[#14151e]">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">SE (Condição)...</span>
                  <button
                    onClick={() => handleOpenConditionModal(block.id)}
                    className="p-0.5 px-2 bg-[#1b1c27] hover:bg-slate-800 border border-slate-800 hover:border-indigo-505 text-[9px] text-indigo-300 font-bold rounded flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-indigo-400" /> Condição
                  </button>
                </div>

                <div className="space-y-1.5" id={`block_conditions_${block.id}`}>
                  {block.conditions.length === 0 ? (
                    <span className="text-[9px] text-gray-550 italic block p-1">Sempre ativo (Tick constante a cada quadro)</span>
                  ) : (
                    block.conditions.map(cond => (
                      <div key={cond.id} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'condition', targetBlockId: block.id, targetCondId: cond.id }); }} className="bg-[#181923] border border-slate-850 p-2 rounded-lg text-[11px] text-slate-200 font-semibold shadow-inner">
                        {getConditionLabel(cond)}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ENTÃO... (Actions panel) */}
              <div className="p-3.5 space-y-2.5 bg-[#121319]">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">ENTÃO (Ação)...</span>
                  <button
                    onClick={() => handleOpenActionModal(block.id)}
                    className="p-0.5 px-2 bg-[#1b1c27] hover:bg-slate-800 border border-slate-800 hover:border-indigo-505 text-[9px] text-indigo-300 font-bold rounded flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-indigo-400" /> Ação
                  </button>
                </div>

                <div className="space-y-1.5" id={`block_actions_${block.id}`}>
                  {block.actions.length === 0 ? (
                    <span className="text-[9px] text-gray-550 italic block p-1">Nenhuma ação vinculada. Adicione uma ação.</span>
                  ) : (
                    block.actions.map(act => (
                      <div key={act.id} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'action', targetBlockId: block.id, targetActId: act.id }); }} className="bg-indigo-950/15 border border-[#27283c] p-2 rounded-lg text-[11px] text-[#a5b4fc] font-semibold flex items-center justify-between">
                        <span>{getActionLabel(act)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Block Local variables list drawer */}
            <div className="bg-[#181924]/60 p-2.5 border-t border-slate-850 flex items-center flex-wrap gap-2 justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Variáveis Locais:</span>
                {Object.entries(block.localVars || {}).map(([vn, vv]) => (
                  <span key={vn} className="inline-flex items-center gap-1.5 bg-[#101117] border border-slate-800 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400">
                    <span className="text-gray-500">{vn}:</span> {vv}
                    <button 
                      onClick={() => handleDeleteLocalVar(block.id, vn)}
                      className="text-rose-450 hover:text-red-400 ml-1 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              {/* Add localized inline var form */}
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Nome Var"
                  id={`var_name_${block.id}`}
                  className="bg-slate-900 border border-slate-800 text-[9px] font-mono text-slate-200 rounded px-1.5 py-0.5 w-20"
                />
                <input
                  type="text"
                  placeholder="Valor"
                  id={`var_val_${block.id}`}
                  className="bg-slate-900 border border-slate-800 text-[9px] font-mono text-slate-200 rounded px-1.5 py-0.5 w-14"
                />
                <button
                  onClick={() => {
                    const nameEl = document.getElementById(`var_name_${block.id}`) as HTMLInputElement;
                    const valEl = document.getElementById(`var_val_${block.id}`) as HTMLInputElement;
                    if (nameEl && valEl && nameEl.value.trim()) {
                      handleAddLocalVar(block.id, nameEl.value, valEl.value);
                      nameEl.value = '';
                      valEl.value = '';
                    }
                  }}
                  className="bg-indigo-650 hover:bg-indigo-600 text-[8px] text-white font-bold p-0.5 px-2 rounded"
                >
                  + Var
                </button>
              </div>
            </div>
          </div>

          {/* Render nesting children recursively */}
          {block.subEvents && block.subEvents.length > 0 && (
            <div className="relative">
              {renderEventsList(block.subEvents, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const selectedScFile = scripts.find(s => s.id === selectedScriptId);

  return (
    <div className="flex-1 flex overflow-hidden bg-[#1E1F26]" id="event_sheet_root" onContextMenu={(e) => { /* allow our custom menus */ }}>
      
      {/* LEFT SIDE PANEL: Config Tab Selectors and Variables */}
      <div className="w-64 bg-[#14151e] border-r border-[#262732] flex flex-col justify-stretch p-4 space-y-4 shrink-0">
        
        {/* Navigation Sidebar dispatcher between modular options */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-[#0c0d12] rounded-lg border border-[#262732]">
          <button
            onClick={() => setActiveTab('nocode')}
            className={`p-2 text-[9px] font-bold rounded-md flex flex-col items-center justify-center gap-1 border border-transparent cursor-pointer ${
              activeTab === 'nocode' ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/40 font-mono shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Braces className="w-3.5 h-3.5" />
            <span>Eventos</span>
          </button>
          <button
            onClick={() => setActiveTab('scripts')}
            className={`p-2 text-[9px] font-bold rounded-md flex flex-col items-center justify-center gap-1 border border-transparent cursor-pointer ${
              activeTab === 'scripts' ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/40 font-mono shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Scripts</span>
          </button>
          <button
            onClick={() => setActiveTab('plugins')}
            className={`p-2 text-[9px] font-bold rounded-md flex flex-col items-center justify-center gap-1 border border-transparent cursor-pointer ${
              activeTab === 'plugins' ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/40 font-mono shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Plugins</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {activeTab === 'nocode' && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-slate-400 tracking-wider flex items-center gap-1.5 font-mono">
                <FolderPlus className="w-4 h-4 text-indigo-400" /> VARIÁVEIS GLOBAIS
              </span>

              <p className="text-[10px] text-gray-400 leading-normal">
                Crie variáveis globais para gerenciar pontuação, vidas, nível ou estados globais sem código.
              </p>

              {/* Create new var panel */}
              <div className="bg-[#1b1c28] p-3 rounded-lg border border-slate-800 space-y-3">
                <div>
                  <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Nome da Variável:</label>
                  <input
                    type="text"
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono"
                    placeholder="e.g. Pontuacao"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Valor Inicial:</label>
                  <input
                    type="number"
                    value={newVarVal}
                    onChange={(e) => setNewVarVal(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono"
                  />
                </div>

                <button
                  onClick={handleCreateGlobalVar}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs py-1.5 font-bold transition-all cursor-pointer active:scale-95"
                >
                  Adicionar Variável
                </button>
              </div>

              {/* List active variables */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 block pb-1 border-b border-slate-800">Variáveis Ativas:</span>
                {Object.keys(globalVariables).length === 0 ? (
                  <span className="text-[10px] text-gray-500 italic block py-2">Nenhuma criada.</span>
                ) : (
                  Object.entries(globalVariables).map(([key, val]) => (
                    <div key={key} className="bg-[#1b1c28] p-2 rounded-lg border border-slate-850 flex justify-between items-center text-[11px]">
                      <div>
                        <span className="text-slate-300 block font-semibold">{key}</span>
                        <span className="text-emerald-400 font-mono font-bold text-[10px]">v: {val}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteGlobalVar(key)}
                        className="text-rose-400 p-1 hover:bg-rose-950/20 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'scripts' && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-slate-400 tracking-wider flex items-center gap-1.5 font-mono">
                <FileCode className="w-4 h-4 text-indigo-400" /> SCRIPTS JAVASCRIPT
              </span>
              <p className="text-[10px] text-gray-400 leading-normal">
                Escreva scripts puros executados a cada frame a nível de engine para total controle.
              </p>

              <div className="bg-[#1b1c28] p-3 rounded-lg border border-slate-800 space-y-2">
                <input
                  type="text"
                  value={newScriptName}
                  onChange={(e) => setNewScriptName(e.target.value)}
                  className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono"
                  placeholder="e.g. ia_boss.js"
                />
                <button
                  onClick={handleAddScript}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs py-1.5 font-bold cursor-pointer"
                >
                  Novo Arquivo Script
                </button>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block pb-1">Lista de scripts:</span>
                {scripts.length === 0 ? (
                  <span className="text-[10px] text-gray-505 italic block">Sem arquivos puros .js</span>
                ) : (
                  scripts.map(sc => (
                    <div 
                      key={sc.id}
                      onClick={() => setSelectedScriptId(sc.id)}
                      className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                        selectedScriptId === sc.id ? 'bg-indigo-950/10 border-indigo-505/65 text-indigo-300' : 'bg-[#181923] border-[#22232a] text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 pr-1">
                        <span className="text-[11px] font-mono block truncate font-bold">{sc.name}</span>
                        <span className={`text-[9px] px-1 rounded font-bold ${sc.active ? 'text-emerald-400 bg-emerald-950/20' : 'text-slate-500'}`}>
                          {sc.active ? 'Ativo' : 'Pausado'}
                        </span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleScriptActive(sc.id);
                          }}
                          className="p-1 hover:bg-slate-800 rounded font-bold text-[9px]"
                          title="Ligar/Desligar Script"
                        >
                          {sc.active ? '⏸' : '▶'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteScript(sc.id);
                          }}
                          className="p-1 text-rose-400 hover:bg-rose-950/20 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'plugins' && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-slate-400 tracking-wider flex items-center gap-1.5 font-mono">
                <Database className="w-4 h-4 text-emerald-400" /> CONSTRUCT PLUGINS
              </span>

              <p className="text-[10px] text-gray-400 leading-normal">
                Instale novos nós de estruturas de memória (Dictionary de chave-valor ou Array vetor).
              </p>

              <div className="bg-[#1b1c28] p-3 rounded-lg border border-slate-800 space-y-2.5">
                <input
                  type="text"
                  value={newPluginName}
                  onChange={(e) => setNewPluginName(e.target.value)}
                  className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono"
                  placeholder="Nome do Plugin Node"
                />
                
                <div className="flex gap-2">
                  <label className="flex items-center gap-1 text-[10px] text-slate-300 cursor-pointer">
                    <input 
                      type="radio" 
                      name="ptype" 
                      checked={newPluginType === 'dictionary'}
                      onChange={() => setNewPluginType('dictionary')}
                      className="accent-indigo-500" 
                    /> Dicionário
                  </label>
                  <label className="flex items-center gap-1 text-[10px] text-slate-300 cursor-pointer">
                    <input 
                      type="radio" 
                      name="ptype" 
                      checked={newPluginType === 'array'}
                      onChange={() => setNewPluginType('array')}
                      className="accent-indigo-500" 
                    /> Array
                  </label>
                </div>

                <button
                  onClick={handleAddPluginNode}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs py-1.5 font-bold cursor-pointer transition-all active:scale-95"
                >
                  Adicionar Plugin Node
                </button>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-bold text-slate-400 block pb-1 border-b border-slate-850">Dicionários Ativos:</span>
                {dictionaries.map(d => (
                  <div key={d.id} className="bg-[#181923] border border-slate-800 p-2.5 rounded-lg space-y-1.5">
                    <div className="flex justify-between items-center bg-[#0d0e14] p-1.5 rounded border border-slate-850">
                      <span className="text-xs font-bold text-[#818cf8] font-mono">📗 dict.{d.name}</span>
                      <button onClick={() => handleDeletePlugin(d.id, 'dict')} className="text-rose-400"><Trash2 className="w-3 h-3" /></button>
                    </div>

                    {/* Dictionary Key-Value Row setter */}
                    <div className="flex gap-1.5">
                      <input 
                        type="text" 
                        placeholder="Chave" 
                        id={`k_${d.id}`}
                        className="bg-slate-900 border border-slate-800 text-[9px] p-1 rounded font-mono text-slate-200 w-1/2" 
                      />
                      <input 
                        type="text" 
                        placeholder="Valor" 
                        id={`v_${d.id}`}
                        className="bg-slate-900 border border-slate-800 text-[9px] p-1 rounded font-mono text-slate-200 w-1/2" 
                      />
                      <button 
                        onClick={() => {
                          const kE = document.getElementById(`k_${d.id}`) as HTMLInputElement;
                          const vE = document.getElementById(`v_${d.id}`) as HTMLInputElement;
                          if (kE && vE && kE.value.trim()) {
                            setDictKey(kE.value);
                            setDictVal(vE.value);
                            // fire setter proxy
                            handleAddDictRow(d.id);
                            kE.value = '';
                            vE.value = '';
                          }
                        }}
                        className="bg-[#242533] hover:bg-slate-750 p-1 rounded text-[10px] text-[#818cf8] font-bold"
                      >
                        +
                      </button>
                    </div>

                    <div className="space-y-1">
                      {Object.entries(d.entries).map(([rk, rv]) => (
                        <div key={rk} className="flex justify-between items-center text-[9px] font-mono bg-slate-900/40 p-1 px-2 rounded border border-slate-850 text-slate-300">
                          <span>{rk}: {rv}</span>
                          <button onClick={() => handleDeleteDictRow(d.id, rk)} className="text-rose-500 font-bold ml-1">×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <span className="text-[10px] font-bold text-slate-400 block pb-1 border-b border-slate-850 pt-2">Arrays (Vetores):</span>
                {arrays.map(a => (
                  <div key={a.id} className="bg-[#181923] border border-slate-800 p-2.5 rounded-lg space-y-1.5">
                    <div className="flex justify-between items-center bg-[#0d0e14] p-1.5 rounded border border-slate-850">
                      <span className="text-xs font-bold text-emerald-400 font-mono">📘 array.{a.name}</span>
                      <button onClick={() => handleDeletePlugin(a.id, 'arr')} className="text-rose-400"><Trash2 className="w-3 h-3" /></button>
                    </div>

                    {/* Array value pusher */}
                    <div className="flex gap-1.5">
                      <input 
                        type="text" 
                        placeholder="Valor para Empilhar" 
                        id={`arr_in_${a.id}`}
                        className="flex-1 bg-slate-900 border border-slate-850 text-[9px] p-1 rounded font-mono text-slate-200" 
                      />
                      <button 
                        onClick={() => {
                          const iE = document.getElementById(`arr_in_${a.id}`) as HTMLInputElement;
                          if (iE && iE.value.trim()) {
                            setArrayVal(iE.value);
                            handlePushArrayVal(a.id);
                            iE.value = '';
                          }
                        }}
                        className="bg-[#242533] p-1 px-2.5 rounded text-[10px] text-emerald-400 font-bold"
                      >
                        Push
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1 text-[8px] font-mono">
                      {a.values.map((val, idx) => (
                        <span key={idx} className="bg-[#111218] border border-slate-800 px-1.5 py-0.5 rounded text-indigo-300">
                          [{idx}]: {val}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#181922] p-3 rounded-lg border border-slate-850">
          <span className="text-[10px] font-bold text-indigo-400 block mb-1">Construct Tip:</span>
          <p className="text-[9px] text-[#94a3b8] leading-relaxed">
            {activeTab === 'nocode' ? 'Ligue condições de "função chamada" com disparadores de métodos no-code!' : 'O seu runner compila e roda todos os scripts .js ativos paralelamente!'}
          </p>
        </div>
      </div>

      {/* CENTER STAGE: Event Sheet Visualizer or Code Editor Canvas */}
      <div className="flex-1 flex flex-col justify-stretch min-w-0">
        
        {activeTab === 'nocode' ? (
          <div className="flex-1 flex flex-col justify-stretch p-6 overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3.5 mb-6">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" /> Folha de Eventos No-Code (Event Sheet)
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Defina estímulos/condições de lógica baseada em fluxos e configure ações consecutivas.</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-[#12131a] border border-[#262732] p-1 rounded-lg">
                  <button
                    onClick={handleUndo}
                    className="p-1 px-2.5 bg-slate-800 hover:bg-slate-750 text-[10px] text-slate-300 font-bold rounded flex items-center gap-1 transition-all border border-slate-700/50 cursor-pointer"
                    title="Desfazer alteração"
                  >
                    <Undo2 className="w-3.5 h-3.5 text-indigo-400" /> Desfazer
                  </button>
                  <button
                    onClick={handleRedo}
                    className="p-1 px-2.5 bg-slate-800 hover:bg-slate-750 text-[10px] text-slate-300 font-bold rounded flex items-center gap-1 transition-all border border-slate-700/50 cursor-pointer"
                    title="Refazer alteração"
                  >
                    <Redo2 className="w-3.5 h-3.5 text-indigo-400" /> Refazer
                  </button>
                </div>

                <button
                  onClick={handleAddEventBlock}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2.5 text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Adicionar Bloco de Eventos
                </button>
              </div>
            </div>

            {/* List visualization */}
            <div className="space-y-4 flex-1">
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 bg-[#12131a] rounded-xl border border-[#272834]">
                  <span className="text-4xl mb-3">🧩</span>
                  <span className="text-sm text-slate-300 font-bold block">Folha de Eventos Vazia</span>
                  <p className="text-xs text-gray-500 max-w-sm text-center mt-1 leading-normal">
                    Adicione um bloco de evento. Ligue condições (Ex: Pressionar tecla) com ações (Ex: Mover herói) para desenhar sua mecânica!
                  </p>
                  <button
                    onClick={handleAddEventBlock}
                    className="mt-4 text-xs bg-indigo-650 hover:bg-indigo-600 outline-none text-[#d9e0fc] border border-slide-700 rounded-lg px-4.5 py-2 font-bold cursor-pointer"
                  >
                    Criar Primeiro Evento
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {renderEventsList(events, 0)}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'scripts' ? (
          selectedScFile ? (
            <div className="flex-1 flex flex-col justify-stretch overflow-hidden">
              <div className="bg-[#12131a] border-b border-slate-800 p-4 shrink-0 flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-bold font-mono text-indigo-305">Ativo Editando: {selectedScFile.name}</h4>
                  <span className="text-[10px] text-gray-400 leading-normal">Compilação instantânea integrada. Saliência para erros de sintaxe direto no console.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded font-bold">
                    ✔ JS RUNNER ATIVO
                  </span>
                </div>
              </div>

              <div className="flex-1 p-4 bg-[#0a0b10] flex flex-col">
                <textarea
                  className="w-full flex-1 bg-[#101116] border border-slate-850 p-4 text-xs text-emerald-300 font-mono focus:border-indigo-505 focus:ring-0 rounded-lg outline-none resize-none shadow-inner"
                  spellCheck={false}
                  value={selectedScFile.code}
                  onChange={(e) => handleUpdateScriptCode(selectedScFile.id, e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <span className="text-4xl mb-2">📁</span>
              <h4 className="text-xs font-bold text-slate-350">Selecione ou adicione um Script no painel lateral esquerdo</h4>
              <p className="text-[10px] text-slate-550 max-w-xs mt-1 leading-normal">Crie scripts .js extras para comandar colisões ou física de partículas customizadas por programação estrutural tradicional.</p>
            </div>
          )
        ) : (
          <div className="flex-1 p-8 overflow-y-auto">
            <h4 className="text-sm font-bold text-slate-205 mb-2 font-mono">🎓 Central de No-Code Plugins Nativos</h4>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed mb-6">
              Adicione e consulte instâncias de coleções de dados como se estivesse no painel Construct 3.
              Qualquer alteração em seus Dicionários ou Arrays é refletida na física de simulação e HUD live!
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#14151e] border border-slate-800 p-4 rounded-xl space-y-4">
                <h5 className="text-xs font-bold text-indigo-400 font-mono">📗 Plugin Dictionary (Chave: Valor)</h5>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Perfeito para manter dados não-sequenciais complexos como configurações globais de fases (e.g. BossHealth: 100).
                </p>
                {dictionaries.length === 0 ? (
                  <span className="text-[10px] text-gray-500 italic block">Nenhum dicionário inicializado.</span>
                ) : (
                  dictionaries.map(d => (
                    <div key={d.id} className="bg-slate-900 border border-slate-850 p-3 rounded-lg space-y-2">
                      <span className="text-xs text-slate-200 font-mono block font-bold">{d.name}</span>
                      <div className="space-y-1">
                        {Object.entries(d.entries).map(([rk, rv]) => (
                          <div key={rk} className="text-[10px] font-mono text-slate-400 bg-slate-950 p-1 px-2 rounded">
                            "{rk}": <span className="text-emerald-400">{JSON.stringify(rv)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="bg-[#14151e] border border-slate-800 p-4 rounded-xl space-y-4">
                <h5 className="text-xs font-bold text-emerald-450 font-mono">📘 Plugin Array (Pilhas e Vetores)</h5>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Perfeito para listas ligadas sequenciais, logs de inventários ativos ou filas de tarefas.
                </p>
                {arrays.length === 0 ? (
                  <span className="text-[10px] text-gray-500 italic block">Nenhum vetor inicializado.</span>
                ) : (
                  arrays.map(a => (
                    <div key={a.id} className="bg-slate-900 border border-slate-850 p-3 rounded-lg space-y-2">
                      <span className="text-xs text-slate-200 font-mono block font-bold">{a.name}</span>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {a.values.map((v, i) => (
                          <div key={i} className="text-[10px] font-mono bg-slate-950 px-2 py-0.5 rounded text-indigo-300">
                            {v}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 1. SE/CONDITIONS SELECTION MODAL */}
      {showConditionModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-55" id="cond_modal">
          <div className="bg-[#161720] border border-[#2c2d3c] rounded-xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in fade-in-50 duration-150">
            <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <span>➕</span> NOVA CONDICIONAL (SE...)
            </h4>

            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Tipo de Evento Gatilho:</label>
                <select
                  value={selectedCondType}
                  onChange={(e) => {
                    const val = e.target.value as ConditionType;
                    setSelectedCondType(val);
                    if (val === 'keyboard_keypress' || val === 'keyboard_keyholding' || val === 'keyboard_keyrelease') {
                      setCondParam1('Space');
                    } else if (val === 'object_collision' || val === 'object_distance' || val === 'pick_nearest' || val === 'pick_farthest') {
                      if (objects.length > 0) {
                        setCondParam1(objects[0].id);
                        setCondParam2(objects.length > 1 ? objects[1].id : objects[0].id);
                      }
                      if (val === 'object_distance') setCondParam3('100');
                    } else if (val === 'timer_elapsed') {
                      setCondParam1('2.0');
                    } else if (val === 'function_called') {
                      setCondParam1('AtacarInimigo');
                    } else if (val === 'every_x_seconds') {
                      setCondParam1('1.0');
                    } else if (val === 'every_x_ticks') {
                      setCondParam1('60');
                    } else if (val === 'object_count_compare') {
                      setCondParam1(objects[0]?.id || '');
                      setCondParam2('>=');
                      setCondParam3('1');
                    } else if (val === 'global_var_compare') {
                      setCondParam1(Object.keys(globalVariables)[0] || '');
                      setCondParam2('==');
                      setCondParam3('0');
                    } else if (val === 'instance_var_compare') {
                      setCondParam1(objects[0]?.id || '');
                      setCondParam2('HP');
                      setCondParam3('0');
                    } else if (val === 'compare_dictionary_value') {
                      setCondParam1(dictionaries[0]?.id || '');
                      setCondParam2('chave');
                      setCondParam3('==');
                    } else if (val === 'array_compare_at_index') {
                      setCondParam1(arrays[0]?.id || '');
                      setCondParam2('0');
                      setCondParam3('==');
                    } else if (val === 'object_click' || val === 'mouse_cursor_on_object' || val === 'pick_random_instance' || val === 'is_on_floor' || val === 'double_jump_available' || val === 'animation_finished') {
                      setCondParam1(objects[0]?.id || '');
                    }
                  }}
                  className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded focus:border-indigo-505 font-mono outline-none"
                >
                  <option value="system_onload">Início do Layout (On Start)</option>
                  <option value="system_tick">A cada quadro (Every Tick)</option>
                  <option value="every_x_seconds">A cada X segundos (Every X Seconds)</option>
                  <option value="every_x_ticks">A cada X ticks (Every X Ticks)</option>
                  <option value="trigger_once">Disparar uma única vez (Trigger Once)</option>
                  <option value="always">Sempre verdadeiro (Always)</option>
                  <option value="else_condition">Senão (Else)</option>
                  <option value="keyboard_keypress">Teclado: Ao pressionar tecla</option>
                  <option value="keyboard_keyholding">Teclado: Enquanto segura tecla</option>
                  <option value="keyboard_keyrelease">Teclado: Ao soltar tecla</option>
                  <option value="object_collision">Colisão: Objeto colide com outro</option>
                  <option value="object_click">Mouse: Clique em Objeto</option>
                  <option value="mouse_click">Mouse: Clique no Cenário</option>
                  <option value="mouse_cursor_on_object">Mouse: Cursor sobre Objeto</option>
                  <option value="object_distance">Distância: Comparar distância entre objetos</option>
                  <option value="object_count_compare">Contagem: Comparar nº de instâncias</option>
                  <option value="timer_elapsed">Timer: Ao esgotar relógio</option>
                  <option value="function_called">Função: Quando a função for executada</option>
                  <option value="gesture_touch">Touch: Gestos na tela</option>
                  <option value="global_var_compare">Variável Global: Comparar valor</option>
                  <option value="instance_var_compare">Variável de Instância: Comparar</option>
                  <option value="compare_dictionary_value">Dicionário: Comparar valor</option>
                  <option value="array_compare_at_index">Array: Comparar valor no índice</option>
                  <option value="pick_random_instance">Seleção: Instância aleatória</option>
                  <option value="pick_nearest">Seleção: Instância mais próxima</option>
                  <option value="pick_farthest">Seleção: Instância mais distante</option>
                  <option value="is_on_floor">Solo: Objeto está no chão?</option>
                  <option value="double_jump_available">Pulo Duplo: Disponível?</option>
                  <option value="animation_finished">Animação: Terminou de tocar?</option>
                </select>
              </div>

              {/* Dynamic Input render according to choose type */}
              {(selectedCondType === 'every_x_seconds' || selectedCondType === 'every_x_ticks') && (
                <div>
                  <label className="text-[10px] font-bold text-slate-405 block mb-1">Intervalo:</label>
                  <input
                    type="text"
                    value={condParam1}
                    onChange={(e) => setCondParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded focus:border-indigo-505 font-mono outline-none"
                    placeholder={selectedCondType === 'every_x_seconds' ? 'ex: 0.5' : 'ex: 60'}
                  />
                </div>
              )}

              {(selectedCondType === 'keyboard_keypress' || selectedCondType === 'keyboard_keyholding' || selectedCondType === 'keyboard_keyrelease') && (
                <div>
                  <label className="text-[10px] font-bold text-slate-405 block mb-1">Escolher Tecla:</label>
                  <select
                    value={condParam1}
                    onChange={(e) => setCondParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded focus:border-indigo-505 font-mono outline-none"
                  >
                    <option value=" ">Barra de Espaço</option>
                    <option value="ArrowLeft">Seta Esquerda</option>
                    <option value="ArrowRight">Seta Direita</option>
                    <option value="ArrowUp">Seta Cima</option>
                    <option value="ArrowDown">Seta Baixo</option>
                    <option value="a">Tecla A</option>
                    <option value="d">Tecla D</option>
                    <option value="w">Tecla W</option>
                    <option value="s">Tecla S</option>
                  </select>
                </div>
              )}

              {selectedCondType === 'object_collision' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-405 block mb-1">Objeto A:</label>
                    <select
                      value={condParam1}
                      onChange={(e) => setCondParam1(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded focus:border-indigo-505 outline-none font-bold"
                    >
                      {objects.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-405 block mb-1">Objeto B:</label>
                    <select
                      value={condParam2}
                      onChange={(e) => setCondParam2(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded focus:border-indigo-505 outline-none font-bold"
                    >
                      {objects.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {selectedCondType === 'object_click' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-405 block mb-1">Objeto Alvo:</label>
                  <select
                    value={condParam1}
                    onChange={(e) => setCondParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded focus:border-indigo-505 outline-none font-bold"
                  >
                    {objects.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedCondType === 'mouse_cursor_on_object' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-405 block mb-1">Objeto:</label>
                  <select value={condParam1} onChange={(e) => setCondParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-bold">
                    {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              )}

              {selectedCondType === 'object_distance' && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-405 block mb-1">De:</label>
                    <select value={condParam1} onChange={(e) => setCondParam1(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-bold">
                      {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-405 block mb-1">Até:</label>
                    <select value={condParam2} onChange={(e) => setCondParam2(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-bold">
                      {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-405 block mb-1">Dist. máx:</label>
                    <input type="text" value={condParam3} onChange={(e) => setCondParam3(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-mono" />
                  </div>
                </div>
              )}

              {selectedCondType === 'object_count_compare' && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-405 block mb-1">Objeto:</label>
                    <select value={condParam1} onChange={(e) => setCondParam1(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-bold">
                      {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-405 block mb-1">Comparação:</label>
                    <select value={condParam2} onChange={(e) => setCondParam2(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-mono">
                      <option value=">=">≥</option>
                      <option value="<=">≤</option>
                      <option value="==">=</option>
                      <option value=">">{'>'}</option>
                      <option value="<">{'<'}</option>
                      <option value="!=">≠</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-405 block mb-1">Valor:</label>
                    <input type="text" value={condParam3} onChange={(e) => setCondParam3(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-mono" />
                  </div>
                </div>
              )}

              {selectedCondType === 'global_var_compare' && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-405 block mb-1">Variável:</label>
                    <select value={condParam1} onChange={(e) => setCondParam1(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-bold">
                      {Object.keys(globalVariables).map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-405 block mb-1">Comparação:</label>
                    <select value={condParam2} onChange={(e) => setCondParam2(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-mono">
                      <option value="==">=</option>
                      <option value="!=">≠</option>
                      <option value=">">{'>'}</option>
                      <option value="<">{'<'}</option>
                      <option value=">=">≥</option>
                      <option value="<=">≤</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-405 block mb-1">Valor:</label>
                    <input type="text" value={condParam3} onChange={(e) => setCondParam3(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-mono" />
                  </div>
                </div>
              )}

              {selectedCondType === 'instance_var_compare' && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-405 block mb-1">Objeto:</label>
                    <select value={condParam1} onChange={(e) => setCondParam1(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-bold">
                      {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-405 block mb-1">Variável:</label>
                    <input type="text" value={condParam2} onChange={(e) => setCondParam2(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-mono" placeholder="ex: HP" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-405 block mb-1">Valor:</label>
                    <input type="text" value={condParam3} onChange={(e) => setCondParam3(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-mono" />
                  </div>
                </div>
              )}

              {selectedCondType === 'compare_dictionary_value' && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-405 block mb-1">Dicionário:</label>
                    <select value={condParam1} onChange={(e) => setCondParam1(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-bold">
                      {dictionaries.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-405 block mb-1">Chave:</label>
                    <input type="text" value={condParam2} onChange={(e) => setCondParam2(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-mono" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-405 block mb-1">Valor eq:</label>
                    <input type="text" value={condParam3} onChange={(e) => setCondParam3(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-mono" />
                  </div>
                </div>
              )}

              {selectedCondType === 'array_compare_at_index' && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-405 block mb-1">Array:</label>
                    <select value={condParam1} onChange={(e) => setCondParam1(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-bold">
                      {arrays.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-405 block mb-1">Índice:</label>
                    <input type="text" value={condParam2} onChange={(e) => setCondParam2(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-mono" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-405 block mb-1">Comparação:</label>
                    <input type="text" value={condParam3} onChange={(e) => setCondParam3(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-mono" placeholder="ex: == 10" />
                  </div>
                </div>
              )}

              {(selectedCondType === 'pick_random_instance' || selectedCondType === 'is_on_floor' || selectedCondType === 'double_jump_available' || selectedCondType === 'animation_finished' || selectedCondType === 'pick_nearest' || selectedCondType === 'pick_farthest') && (
                <div>
                  <label className="text-[10px] font-bold text-slate-405 block mb-1">Objeto:</label>
                  <select value={condParam1} onChange={(e) => setCondParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-bold">
                    {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  {selectedCondType === 'pick_nearest' && (
                    <div className="mt-2">
                      <label className="text-[10px] font-bold text-slate-405 block mb-1">Referência (ID da instância):</label>
                      <input type="text" value={condParam2} onChange={(e) => setCondParam2(e.target.value)}
                        className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-mono" placeholder="ID da instância" />
                    </div>
                  )}
                </div>
              )}

              {selectedCondType === 'timer_elapsed' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-404 block mb-1">Relógio em segundos:</label>
                  <input
                    type="text"
                    value={condParam1}
                    onChange={(e) => setCondParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-mono"
                    placeholder="e.g. 2.5"
                  />
                </div>
              )}

              {selectedCondType === 'function_called' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-404 block mb-1">Identificador da função:</label>
                  <input
                    type="text"
                    value={condParam1}
                    onChange={(e) => setCondParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-mono"
                    placeholder="e.g. BossMorreu"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2.5 justify-end pt-3">
              <button
                onClick={() => setShowConditionModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-gray-400 px-4 py-2.5 text-xs rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCondition}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs font-bold rounded-lg cursor-pointer"
              >
                Adicionar Condição
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ENTÃO/ACTIONS SELECTION MODAL */}
      {showActionModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-55" id="act_modal">
          <div className="bg-[#161720] border border-[#2c2d3c] rounded-xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in fade-in-50 duration-150">
            <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <span>➕</span> NOVA AÇÃO (ENTÃO...)
            </h4>

            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Alvo do Evento:</label>
                <select
                  value={actTargetObj}
                  onChange={(e) => setActTargetObj(e.target.value)}
                  className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded focus:border-indigo-505 outline-none font-bold"
                >
                  <option value="">Sistema (Geral / Lógica Interna)</option>
                  {objects.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Ação a Executar:</label>
                <select
                  value={selectedActType}
                  onChange={(e) => {
                    const v = e.target.value as ActionType;
                    setSelectedActType(v);
                    setActParam1('');
                    setActParam2('');
                    setActParam3('');
                    setActParam4('');
                    if (v === 'play_sound' && sounds.length > 0) {
                      setActParam1(sounds[0].name);
                    } else if (v === 'play_music' && music.length > 0) {
                      setActParam1(music[0].name);
                    } else if (v === 'object_set_filter') {
                      setActParam1('grayscale');
                    } else if (v === 'object_set_blend') {
                      setActParam1('add');
                    } else if (v === 'object_spawn') {
                      if (objects.length > 0) setActParam1(objects[0].id);
                    } else if (v === 'object_set_visible') {
                      setActParam1('true');
                    } else if (v === 'object_set_animation' && objects.length > 0) {
                      setActParam1(objects[0].id);
                      setActParam2('walk');
                    } else if (v === 'object_set_size') {
                      setActParam1('32');
                      setActParam2('32');
                    } else if (v === 'dictionary_set') {
                      setActParam1('Score');
                      setActParam2('10');
                    } else if (v === 'object_move_to') {
                      setActParam1('100');
                      setActParam2('100');
                      setActParam3('1');
                    } else if (v === 'object_pin') {
                      setActParam1(objects.length > 0 ? objects[0].id : '');
                    } else if (v === 'go_to_layout') {
                      setActParam1('layout2');
                    } else if (v === 'array_insert') {
                      setActParam1('valor');
                      setActParam2('0');
                    } else if (v === 'array_set') {
                      setActParam1('0');
                      setActParam2('valor');
                    } else if (v === 'set_velocity' || v === 'apply_force') {
                      setActParam1('0');
                      setActParam2('-300');
                    } else if (v === 'set_gravity') {
                      setActParam1('800');
                    } else if (v === 'set_camera_position') {
                      setActParam1('0');
                      setActParam2('0');
                    } else if (v === 'scroll_to_object') {
                      setActParam1(objects.length > 0 ? objects[0].id : '');
                    }
                  }}
                  className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded focus:border-indigo-505 font-mono outline-none"
                >
                  <option value="object_move">Objeto: Mover por deslocamento (X, Y)</option>
                  <option value="object_move_to">Objeto: Mover para posição (X, Y) com duração</option>
                  <option value="object_set_pos">Objeto: Definir posição exata (X, Y)</option>
                  <option value="object_spawn">Objeto: Spawn / Instanciar outro Objeto</option>
                  <option value="object_destroy">Objeto: Destruir instâncias</option>
                  <option value="object_set_angle">Objeto: Definir Ângulo de rotação</option>
                  <option value="object_set_scale">Objeto: Definir escala</option>
                  <option value="object_set_size">Objeto: Definir tamanho (Largura, Altura)</option>
                  <option value="object_set_opacity">Objeto: Modificar Opacidade</option>
                  <option value="object_set_filter">Objeto: Aplicar Filtro Visual</option>
                  <option value="object_set_blend">Objeto: Mudar Blend Mode</option>
                  <option value="object_set_visible">Objeto: Visível / Invisível</option>
                  <option value="object_set_animation">Objeto: Tocar animação</option>
                  <option value="object_set_frame">Objeto: Definir frame da animação</option>
                  <option value="object_flash">Objeto: Piscar (Flash)</option>
                  <option value="object_fade">Objeto: Desaparecer (Fade)</option>
                  <option value="object_pin">Objeto: Fixar a outro objeto</option>
                  <option value="object_unpin">Objeto: Soltar (unpin)</option>
                  <option value="timer_start">Timer: Iniciar relógio</option>
                  <option value="wait">Timer: Aguardar segundos</option>
                  <option value="play_sound">Som: Tocar efeito sonoro</option>
                  <option value="play_music">Música: Tocar trilha</option>
                  <option value="stop_music">Música: Parar</option>
                  <option value="system_add_variable">Variável Global: Somar valor</option>
                  <option value="system_sub_variable">Variável Global: Subtrair valor</option>
                  <option value="system_set_variable">Variável Global: Definir valor</option>
                  <option value="set_instance_variable">Variável de Instância: Definir</option>
                  <option value="call_function">Função: Chamar</option>
                  <option value="broadcast_function">Função: Transmitir para todos</option>
                  <option value="go_to_layout">Cena: Ir para layout</option>
                  <option value="restart_layout">Cena: Reiniciar</option>
                  <option value="next_layout">Cena: Próximo layout</option>
                  <option value="dictionary_set">Dicionário: Gravar valor</option>
                  <option value="array_push">Array: Push</option>
                  <option value="array_pop">Array: Pop</option>
                  <option value="array_insert">Array: Inserir na posição</option>
                  <option value="array_remove">Array: Remover índice</option>
                  <option value="array_set">Array: Definir no índice</option>
                  <option value="array_clear">Array: Limpar</option>
                  <option value="set_camera_position">Câmera: Posicionar</option>
                  <option value="scroll_to_object">Câmera: Rolar até objeto</option>
                  <option value="shake_camera">Câmera: Chacoalhar</option>
                  <option value="set_gravity">Física: Definir gravidade</option>
                  <option value="set_velocity">Física: Definir velocidade</option>
                  <option value="apply_force">Física: Aplicar força</option>
                  <option value="log_message">Depuração: Log mensagem</option>
                </select>
              </div>

              {selectedActType === 'object_move' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Somar X (px):</label>
                    <input
                      type="text"
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono focus:border-indigo-505 outline-none"
                      value={actParam1}
                      onChange={(e) => setActParam1(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Somar Y (px):</label>
                    <input
                      type="text"
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono focus:border-indigo-505 outline-none"
                      value={actParam2}
                      onChange={(e) => setActParam2(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {selectedActType === 'object_set_pos' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Posição X exata:</label>
                    <input
                      type="text"
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono focus:border-indigo-505 outline-none"
                      value={actParam1}
                      onChange={(e) => setActParam1(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Posição Y exata:</label>
                    <input
                      type="text"
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono focus:border-indigo-505 outline-none"
                      value={actParam2}
                      onChange={(e) => setActParam2(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {selectedActType === 'object_spawn' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Spawnar Objeto Tipo:</label>
                  <select
                    value={actParam1}
                    onChange={(e) => setActParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded focus:border-indigo-505 font-bold outline-none"
                  >
                    {objects.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedActType === 'object_set_angle' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Ângulo em graus:</label>
                  <input
                    type="text"
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono focus:border-indigo-505 outline-none"
                    value={actParam1}
                    onChange={(e) => setActParam1(e.target.value)}
                  />
                </div>
              )}

              {selectedActType === 'object_set_scale' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Multiplicador de Escala (default: 1):</label>
                  <input
                    type="text"
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono focus:border-indigo-505 outline-none"
                    value={actParam1}
                    onChange={(e) => setActParam1(e.target.value)}
                    placeholder="e.g. 1.5"
                  />
                </div>
              )}

              {selectedActType === 'object_set_opacity' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Fator de Transparência (0.0 até 1.0):</label>
                  <input
                    type="text"
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono focus:border-indigo-505 outline-none"
                    value={actParam1}
                    onChange={(e) => setActParam1(e.target.value)}
                  />
                </div>
              )}

              {selectedActType === 'object_set_filter' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Selecionar Shader:</label>
                  <select
                    value={actParam1}
                    onChange={(e) => setActParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-850 p-2 rounded text-xs text-slate-200 focus:border-indigo-550 font-bold"
                  >
                    <option value="none">Normal</option>
                    <option value="grayscale">Preto e Branco</option>
                    <option value="sepia">Sepia Retrô</option>
                    <option value="blur">Desfoque (Blur)</option>
                    <option value="glow">Brilho Intenso (Glow)</option>
                    <option value="water">WebGL Water Ripple</option>
                    <option value="warp">Distorção Warp</option>
                  </select>
                </div>
              )}

              {selectedActType === 'object_set_blend' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Fusão Blend Mode:</label>
                  <select
                    value={actParam1}
                    onChange={(e) => setActParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-850 p-2 rounded text-xs text-slate-200 focus:border-indigo-550 font-bold"
                  >
                    <option value="normal">Normal</option>
                    <option value="add">Adicionar (Add / Lighter)</option>
                    <option value="screen">Tela (Screen)</option>
                    <option value="multiply">Multiplicar (Multiply)</option>
                  </select>
                </div>
              )}

              {selectedActType === 'object_flash' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Duração do Efeito Flash (em segundos):</label>
                  <input
                    type="text"
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono focus:border-indigo-505 outline-none"
                    value={actParam1}
                    onChange={(e) => setActParam1(e.target.value)}
                  />
                </div>
              )}

              {selectedActType === 'object_fade' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Fator Sumiço Fade (segundos):</label>
                  <input
                    type="text"
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono focus:border-indigo-505 outline-none"
                    value={actParam1}
                    onChange={(e) => setActParam1(e.target.value)}
                  />
                </div>
              )}

              {selectedActType === 'timer_start' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Duração do relógio em segundos:</label>
                  <input
                    type="text"
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono focus:border-indigo-505 outline-none"
                    value={actParam1}
                    onChange={(e) => setActParam1(e.target.value)}
                  />
                </div>
              )}

              {selectedActType === 'play_sound' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-bold">Efeito de Som:</label>
                  <select
                    value={actParam1}
                    onChange={(e) => setActParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded focus:border-indigo-505 outline-none font-mono"
                  >
                    {sounds.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {(selectedActType === 'system_add_variable' || selectedActType === 'system_set_variable') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1 font-bold">Variável Alvo:</label>
                    <select
                      value={actParam1}
                      onChange={(e) => setActParam1(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded focus:border-indigo-505 font-mono outline-none"
                    >
                      {Object.keys(globalVariables).map(k => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1 font-bold">Valor:</label>
                    <input
                      type="text"
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono focus:border-indigo-505 outline-none"
                      value={actParam2}
                      onChange={(e) => setActParam2(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {selectedActType === 'call_function' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Nome da Função:</label>
                  <input
                    type="text"
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono focus:border-indigo-505 outline-none"
                    value={actParam1}
                    onChange={(e) => setActParam1(e.target.value)}
                    placeholder="e.g. SpawnBonus"
                  />
                </div>
              )}

              {selectedActType === 'dictionary_set' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-405 block mb-1">Chave Registro:</label>
                    <input
                      type="text"
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono"
                      value={actParam1}
                      onChange={(e) => setActParam1(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-405 block mb-1">Gravar Valor:</label>
                    <input
                      type="text"
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono"
                      value={actParam2}
                      onChange={(e) => setActParam2(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {selectedActType === 'object_move_to' && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">X:</label>
                    <input type="text" value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Y:</label>
                    <input type="text" value={actParam2} onChange={(e) => setActParam2(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Duração (s):</label>
                    <input type="text" value={actParam3} onChange={(e) => setActParam3(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" />
                  </div>
                </div>
              )}

              {selectedActType === 'object_set_size' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Largura:</label>
                    <input type="text" value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Altura:</label>
                    <input type="text" value={actParam2} onChange={(e) => setActParam2(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" />
                  </div>
                </div>
              )}

              {selectedActType === 'object_set_visible' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Visível:</label>
                  <select value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-bold">
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                </div>
              )}

              {selectedActType === 'object_set_animation' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Objeto:</label>
                    <select value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-bold">
                      {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Animação:</label>
                    <input type="text" value={actParam2} onChange={(e) => setActParam2(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none"
                      placeholder="ex: walk" />
                  </div>
                </div>
              )}

              {selectedActType === 'object_set_frame' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Nº do Frame:</label>
                  <input type="text" value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" />
                </div>
              )}

              {selectedActType === 'object_pin' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Fixar em qual objeto:</label>
                  <select value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-bold">
                    {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              )}

              {selectedActType === 'wait' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Segundos para aguardar:</label>
                  <input type="text" value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" placeholder="ex: 1.5" />
                </div>
              )}

              {selectedActType === 'play_music' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-bold">Música:</label>
                  <select value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-mono">
                    {music.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
              )}

              {selectedActType === 'system_sub_variable' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1 font-bold">Variável:</label>
                    <select value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-mono">
                      {Object.keys(globalVariables).map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1 font-bold">Valor:</label>
                    <input type="text" value={actParam2} onChange={(e) => setActParam2(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" />
                  </div>
                </div>
              )}

              {selectedActType === 'set_instance_variable' && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Objeto:</label>
                    <select value={actTargetObj} onChange={(e) => setActTargetObj(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-bold">
                      <option value="">Sistema</option>
                      {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Variável:</label>
                    <input type="text" value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" placeholder="ex: HP" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Valor:</label>
                    <input type="text" value={actParam2} onChange={(e) => setActParam2(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" />
                  </div>
                </div>
              )}

              {selectedActType === 'broadcast_function' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Nome da Função:</label>
                  <input type="text" value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none"
                    placeholder="e.g. BossMorreu" />
                </div>
              )}

              {selectedActType === 'go_to_layout' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Nome do Layout:</label>
                  <input type="text" value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none"
                    placeholder="e.g. fase2" />
                </div>
              )}

              {selectedActType === 'array_insert' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Valor:</label>
                    <input type="text" value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Posição:</label>
                    <input type="text" value={actParam2} onChange={(e) => setActParam2(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" />
                  </div>
                </div>
              )}

              {selectedActType === 'array_remove' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Índice:</label>
                  <input type="text" value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" />
                </div>
              )}

              {selectedActType === 'array_set' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Índice:</label>
                    <input type="text" value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Valor:</label>
                    <input type="text" value={actParam2} onChange={(e) => setActParam2(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" />
                  </div>
                </div>
              )}

              {selectedActType === 'array_clear' && (
                <p className="text-xs text-slate-500 italic">Todos os valores do array serão removidos.</p>
              )}

              {selectedActType === 'set_camera_position' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">X:</label>
                    <input type="text" value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Y:</label>
                    <input type="text" value={actParam2} onChange={(e) => setActParam2(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" />
                  </div>
                </div>
              )}

              {selectedActType === 'scroll_to_object' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Objeto:</label>
                  <select value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-slate-200 p-2 rounded outline-none font-bold">
                    {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              )}

              {selectedActType === 'shake_camera' && (
                <p className="text-xs text-slate-500 italic">A câmera irá tremer por 0.5 segundos.</p>
              )}

              {selectedActType === 'set_gravity' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Valor da Gravidade:</label>
                  <input type="text" value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" placeholder="ex: 800" />
                </div>
              )}

              {selectedActType === 'set_velocity' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Velocidade X:</label>
                    <input type="text" value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Velocidade Y:</label>
                    <input type="text" value={actParam2} onChange={(e) => setActParam2(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" />
                  </div>
                </div>
              )}

              {selectedActType === 'apply_force' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Força X:</label>
                    <input type="text" value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Força Y:</label>
                    <input type="text" value={actParam2} onChange={(e) => setActParam2(e.target.value)}
                      className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none" />
                  </div>
                </div>
              )}

              {selectedActType === 'log_message' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Mensagem de Log:</label>
                  <input type="text" value={actParam1} onChange={(e) => setActParam1(e.target.value)}
                    className="w-full bg-[#11121a] border border-slate-800 text-xs text-white rounded p-1.5 font-mono outline-none"
                    placeholder="ex: Jogador morreu!" />
                </div>
              )}
            </div>

            <div className="flex gap-2.5 justify-end pt-3">
              <button
                onClick={() => setShowActionModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-gray-400 px-4 py-2.5 text-xs rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAction}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs font-bold rounded-lg cursor-pointer"
              >
                Adicionar Ação
              </button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (() => {
        const items: ContextMenuItem[] = [];
        switch (contextMenu.type) {
          case 'eventBlock': {
            const ev = events.find(e => e.id === contextMenu.targetBlockId);
            items.push(
              { id: 'addSub', label: 'Adicionar Sub-Evento', icon: <Layers className="w-3.5 h-3.5" />, onClick: () => handleAddSubEvent(contextMenu.targetBlockId!) },
              { id: 'comment', label: ev?.comment ? 'Editar Comentário' : 'Adicionar Comentário', icon: <MessageSquare className="w-3.5 h-3.5" />, onClick: () => {
                const newComment = prompt('Comentário do bloco:', ev?.comment || '');
                if (newComment !== null) {
                  const updated = updateBlockInTree(events, contextMenu.targetBlockId!, (b) => ({ ...b, comment: newComment || undefined }));
                  pushState(updated);
                }
              }},
              { id: 'divider1', divider: true, label: '', onClick: () => {} },
              { id: 'delete', label: 'Apagar Bloco', icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => handleDeleteEventBlock(contextMenu.targetBlockId!) },
            );
            break;
          }
          case 'condition': {
            items.push(
              { id: 'deleteCond', label: 'Remover Condição', icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => {
                const updated = updateBlockInTree(events, contextMenu.targetBlockId!, (b) => ({
                  ...b,
                  conditions: b.conditions.filter(c => c.id !== contextMenu.targetCondId)
                }));
                pushState(updated);
              }},
            );
            break;
          }
          case 'action': {
            items.push(
              { id: 'deleteAct', label: 'Remover Ação', icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => {
                const updated = updateBlockInTree(events, contextMenu.targetBlockId!, (b) => ({
                  ...b,
                  actions: b.actions.filter(a => a.id !== contextMenu.targetActId)
                }));
                pushState(updated);
              }},
            );
            break;
          }
        }
        return (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={items}
            onClose={() => setContextMenu(null)}
          />
        );
      })()}
    </div>
  );
}
