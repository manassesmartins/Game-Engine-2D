/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Scene, ProjectObject, ObjectInstance, TileDef, SceneLayer } from '../types';
import { Move, GripHorizontal, LayoutGrid, Trash2, Plus, Sliders, Layers, Eye, EyeOff, Settings, Sparkles, PlusCircle } from 'lucide-react';

interface SceneEditorProps {
  scene: Scene;
  objects: ProjectObject[];
  onUpdateScene: (updatedScene: Scene) => void;
  onSelectObject: (obj: ProjectObject) => void;
  selectedObject: ProjectObject | null;
  onAddObject: () => void;
  onUpdateObject?: (obj: ProjectObject) => void;
}

const TILE_DEFINITIONS: TileDef[] = [
  { id: 1, color: '#10b981', solid: true, name: 'Grama' },
  { id: 2, color: '#0ea5e9', solid: false, name: 'Água (Fluída)' },
  { id: 3, color: '#d97706', solid: true, name: 'Tijolo Sólido' },
  { id: 4, color: '#ef4444', solid: true, name: 'Lava Aquecida' }
];

export default function SceneEditor({
  scene,
  objects,
  onUpdateScene,
  onSelectObject,
  selectedObject,
  onAddObject,
  onUpdateObject = () => {}
}: SceneEditorProps) {
  const [editorMode, setEditorMode] = useState<'instances' | 'tiles'>('instances');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  
  // Multi-selection states
  const [sceneTool, setSceneTool] = useState<'select' | 'add' | 'move'>('select');
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  
  // Box selection marquee
  const [isSelectingBox, setIsSelectingBox] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number, y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number, y: number } | null>(null);

  // Moving multiple selected instances
  const [isMovingInstances, setIsMovingInstances] = useState(false);
  const [dragStartCoords, setDragStartCoords] = useState<{ x: number, y: number } | null>(null);
  const [initialInstancesPositions, setInitialInstancesPositions] = useState<Record<string, { x: number, y: number }>>({});

  const [activeTileId, setActiveTileId] = useState<number | string>(1);
  const [activeTilemapSource, setActiveTilemapSource] = useState<string>('default'); // 'default' or objectId
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [rightPanelTab, setRightPanelTab] = useState<'props' | 'layers' | 'behaviors'>('props');

  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Safeguard layers list
  const activeLayers = scene.layers && scene.layers.length > 0 ? scene.layers : [
    { id: 'main_layer', name: 'Main', parallaxX: 1, parallaxY: 1, opacity: 1, visible: true }
  ];

  const [activeLayerId, setActiveLayerId] = useState<string>(activeLayers[0].id);

  useEffect(() => {
    // If scene layers is not set, initialize it gracefully
    if (!scene.layers || scene.layers.length === 0) {
      onUpdateScene({
        ...scene,
        layers: [
          { id: 'main_layer', name: 'Main (Jogo)', parallaxX: 1, parallaxY: 1, opacity: 1, visible: true },
          { id: 'bg_layer', name: 'Background (Parallax)', parallaxX: 0.4, parallaxY: 0.4, opacity: 0.9, visible: true },
          { id: 'ui_layer', name: 'UI / HUD', parallaxX: 0, parallaxY: 0, opacity: 1, visible: true }
        ]
      });
    }
  }, [scene.id]);

  const updateSelectedInstances = (ids: string[]) => {
    setSelectedInstanceIds(ids);
    setSelectedInstanceId(ids.length > 0 ? ids[0] : null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeTagName = document.activeElement?.tagName.toLowerCase();
        if (activeTagName === 'input' || activeTagName === 'textarea' || activeTagName === 'select') {
          return;
        }

        if (selectedInstanceIds.length > 0) {
          const remaining = scene.instances.filter(inst => !selectedInstanceIds.includes(inst.id));
          onUpdateScene({ ...scene, instances: remaining });
          updateSelectedInstances([]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedInstanceIds, scene, onUpdateScene]);

  useEffect(() => {
    drawLayout();
  }, [
    scene,
    objects,
    editorMode,
    selectedInstanceId,
    selectedInstanceIds,
    activeTileId,
    snapToGrid,
    zoomScale,
    activeLayerId,
    isSelectingBox,
    selectionStart,
    selectionEnd,
    isMovingInstances
  ]);

  const drawLayout = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = scene.width * zoomScale;
    canvas.height = scene.height * zoomScale;

    // Pitch-dark workspace board background
    ctx.fillStyle = '#0f1015';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gSize = scene.gridSize * zoomScale;

    // Raster background parallax layers first
    activeLayers.forEach(lay => {
      if (!lay.visible) return;

      ctx.save();
      ctx.globalAlpha = lay.opacity;

      // Draw Grid helper lines
      if (lay.parallaxX === 1.0) {
        ctx.strokeStyle = '#1e1f2b';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += gSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }
      }

      // Draw static tilemap bricks onto interactive layers only
      if (lay.id === 'main_layer' || lay.name.toLowerCase().includes('main') || lay.name.toLowerCase().includes('jogo')) {
        const tilemap = scene.tilemap;
        if (tilemap && tilemap.grid) {
          Object.entries(tilemap.grid).forEach(([coords, tileId]) => {
            const [col, row] = coords.split(',').map(Number);
            if (typeof tileId === 'number' || (typeof tileId === 'string' && !tileId.includes(':'))) {
              const tid = typeof tileId === 'string' ? parseInt(tileId) : tileId;
              const td = TILE_DEFINITIONS.find(t => t.id === tid);
              if (td) {
                ctx.fillStyle = td.color;
                ctx.fillRect(col * gSize, row * gSize, gSize, gSize);
                
                if (td.solid) {
                  ctx.strokeStyle = 'rgba(217, 119, 6, 0.45)';
                  ctx.lineWidth = 1;
                  ctx.strokeRect(col * gSize, row * gSize, gSize, gSize);
                }
              }
            } else if (typeof tileId === 'string' && tileId.includes(':')) {
              const [objId, frameId] = tileId.split(':');
              const obj = objects.find(o => o.id === objId);
              if (obj) {
                const frame = obj.frames?.find(f => f.id === frameId) || obj.frames?.[0];
                if (frame && frame.pixels.length > 0) {
                  const pxW = gSize / frame.width;
                  const pxH = gSize / frame.height;
                  for (let r = 0; r < frame.height; r++) {
                    for (let c = 0; c < frame.width; c++) {
                      const color = frame.pixels[r * frame.width + c];
                      if (color) {
                        ctx.fillStyle = color;
                        ctx.fillRect(col * gSize + c * pxW, row * gSize + r * pxH, pxW + 0.5, pxH + 0.5);
                      }
                    }
                  }
                }
              }
            }
          });
        }
      }

      // Draw active instances associated to this level layer depth
      scene.instances.forEach(inst => {
        // filter lay associations
        const instLay = inst.layerId || 'main_layer';
        if (instLay !== lay.id && !(instLay === 'default_lay' && lay.id === 'main_layer')) {
          return;
        }

        const obj = objects.find(o => o.id === inst.objectTypeId);
        if (!obj) return;

        const isSelected = inst.id === selectedInstanceId;

        ctx.save();
        
        // Pivot/Origin calculations
        const ox = inst.originX ?? 0.5;
        const oy = inst.originY ?? 0.5;

        // Custom canvas translation to origin pivot center
        ctx.translate((inst.x + inst.width * ox) * zoomScale, (inst.y + inst.height * oy) * zoomScale);
        ctx.rotate((inst.angle * Math.PI) / 180);

        const instWidthZoom = inst.width * zoomScale;
        const instHeightZoom = inst.height * zoomScale;

        // Visual effects filters previews on editor
        let filterStr = 'none';
        if (inst.effectFilter === 'grayscale') filterStr = 'grayscale(100%)';
        else if (inst.effectFilter === 'sepia') filterStr = 'sepia(100%)';
        else if (inst.effectFilter === 'blur') filterStr = 'blur(2px)';
        else if (inst.effectFilter === 'glow') filterStr = 'brightness(1.4) drop-shadow(0 0 4px #eab308)';
        ctx.filter = filterStr;

        if (inst.blendMode === 'add') ctx.globalCompositeOperation = 'lighter';
        else if (inst.blendMode === 'multiply') ctx.globalCompositeOperation = 'multiply';
        else if (inst.blendMode === 'screen') ctx.globalCompositeOperation = 'screen';

        const frame = obj.frames?.[0];
        if (frame && frame.pixels.length > 0) {
          const pxW = instWidthZoom / frame.width;
          const pxH = instHeightZoom / frame.height;
          for (let r = 0; r < frame.height; r++) {
            for (let c = 0; c < frame.width; c++) {
              const color = frame.pixels[r * frame.width + c];
              if (color) {
                ctx.fillStyle = color;
                ctx.fillRect(-instWidthZoom * ox + c * pxW, -instHeightZoom * oy + r * pxH, pxW + 0.2, pxH + 0.2);
              }
            }
          }
        } else {
          ctx.fillStyle = obj.primaryColor || '#ec4899';
          ctx.fillRect(-instWidthZoom * ox, -instHeightZoom * oy, instWidthZoom, instHeightZoom);
        }

        ctx.restore();

        // Overlay selection borders
        const isMultiSelected = selectedInstanceIds.includes(inst.id);
        if (isSelected || isMultiSelected) {
          ctx.strokeStyle = isSelected ? '#6366f1' : '#ec4899'; // Indigo for primary focus, pink for secondary additions
          ctx.lineWidth = 2;
          ctx.strokeRect(inst.x * zoomScale - 2, inst.y * zoomScale - 2, instWidthZoom + 4, instHeightZoom + 4);
          
          // Little interactive pivot visualizer
          ctx.fillStyle = isSelected ? '#6366f1' : '#ec4899';
          ctx.beginPath();
          ctx.arc((inst.x + inst.width * ox) * zoomScale, (inst.y + inst.height * oy) * zoomScale, 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.lineWidth = 0.8;
          ctx.strokeRect(inst.x * zoomScale, inst.y * zoomScale, instWidthZoom, instHeightZoom);
        }
      });

      // Draw the beautiful dashed translucent selection box overlay if box selecting
      if (editorMode === 'instances' && isSelectingBox && selectionStart && selectionEnd) {
        ctx.save();
        ctx.fillStyle = 'rgba(99, 102, 241, 0.15)'; // translucent blue-indigo
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]); // dashed lines
        
        const boxX = Math.min(selectionStart.x, selectionEnd.x) * zoomScale;
        const boxY = Math.min(selectionStart.y, selectionEnd.y) * zoomScale;
        const boxW = Math.abs(selectionStart.x - selectionEnd.x) * zoomScale;
        const boxH = Math.abs(selectionStart.y - selectionEnd.y) * zoomScale;
        
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeRect(boxX, boxY, boxW, boxH);
        ctx.restore();
      }

      ctx.restore();
    });
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    const mouseX = (e.clientX - rect.left) / zoomScale;
    const mouseY = (e.clientY - rect.top) / zoomScale;

    // 1. TILEMAP PAINTING MODE
    if (editorMode === 'tiles') {
      const gs = scene.gridSize;
      const col = Math.floor(mouseX / gs);
      const row = Math.floor(mouseY / gs);
      const key = `${col},${row}`;

      const updatedGrid = { ...scene.tilemap.grid };
      if (e.buttons === 1) { // Left-click: paint
        updatedGrid[key] = activeTileId;
      } else if (e.buttons === 2 || (e.buttons === 1 && e.shiftKey)) { // Erase
        delete updatedGrid[key];
      }
      onUpdateScene({
        ...scene,
        tilemap: { ...scene.tilemap, grid: updatedGrid }
      });
      return;
    }

    // 2. INSTANCE MODE
    const clicked = [...scene.instances].reverse().find(inst => {
      // Allow selecting items on active layer, or generally on layout
      return (
        mouseX >= inst.x &&
        mouseX <= inst.x + inst.width &&
        mouseY >= inst.y &&
        mouseY <= inst.y + inst.height
      );
    });

    if (sceneTool === 'add') {
      // Add mode places the selected template object instantly
      if (selectedObject) {
        let finalX = mouseX - 16;
        let finalY = mouseY - 16;
        if (snapToGrid) {
          const gs = scene.gridSize;
          finalX = Math.round(finalX / gs) * gs;
          finalY = Math.round(finalY / gs) * gs;
        }

        const newInstance: ObjectInstance = {
          id: 'inst_' + Math.random().toString(36).substr(2, 6),
          objectTypeId: selectedObject.id,
          x: finalX,
          y: finalY,
          width: 32,
          height: 32,
          angle: 0,
          opacity: 1,
          variables: {},
          layerId: activeLayerId,
          blendMode: 'normal',
          effectFilter: 'none',
          originX: 0.5,
          originY: 0.5
        };

        onUpdateScene({
          ...scene,
          instances: [...scene.instances, newInstance]
        });
        updateSelectedInstances([newInstance.id]);
      }
    } else {
      // Select or Move tool
      if (clicked) {
        const isAlreadySelected = selectedInstanceIds.includes(clicked.id);
        let newSelection = [...selectedInstanceIds];

        if (e.shiftKey || e.ctrlKey) {
          if (isAlreadySelected) {
            newSelection = newSelection.filter(id => id !== clicked.id);
          } else {
            newSelection.push(clicked.id);
          }
        } else {
          if (!isAlreadySelected) {
            newSelection = [clicked.id];
          }
        }

        updateSelectedInstances(newSelection);

        // Start dragging
        setIsMovingInstances(true);
        setDragStartCoords({ x: mouseX, y: mouseY });

        const positions: Record<string, { x: number, y: number }> = {};
        scene.instances.forEach(inst => {
          if (newSelection.includes(inst.id)) {
            positions[inst.id] = { x: inst.x, y: inst.y };
          }
        });
        setInitialInstancesPositions(positions);

      } else {
        // Start marquee marquee box selection
        if (!e.shiftKey && !e.ctrlKey) {
          updateSelectedInstances([]);
        }
        setIsSelectingBox(true);
        setSelectionStart({ x: mouseX, y: mouseY });
        setSelectionEnd({ x: mouseX, y: mouseY });
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    const mouseX = (e.clientX - rect.left) / zoomScale;
    const mouseY = (e.clientY - rect.top) / zoomScale;

    // 1. TILEMAP MODE
    if (editorMode === 'tiles' && e.buttons === 1) {
      const gs = scene.gridSize;
      const col = Math.floor(mouseX / gs);
      const row = Math.floor(mouseY / gs);
      const key = `${col},${row}`;
      const updatedGrid = { ...scene.tilemap.grid };
      updatedGrid[key] = activeTileId;
      onUpdateScene({
        ...scene,
        tilemap: { ...scene.tilemap, grid: updatedGrid }
      });
      return;
    }

    // 2. BOX SELECTION MARQUEE MODE
    if (isSelectingBox && selectionStart) {
      setSelectionEnd({ x: mouseX, y: mouseY });
      
      const boxLeft = Math.min(selectionStart.x, mouseX);
      const boxRight = Math.max(selectionStart.x, mouseX);
      const boxTop = Math.min(selectionStart.y, mouseY);
      const boxBottom = Math.max(selectionStart.y, mouseY);

      const overlappingIds: string[] = [];
      scene.instances.forEach(inst => {
        const instLeft = inst.x;
        const instRight = inst.x + inst.width;
        const instTop = inst.y;
        const instBottom = inst.y + inst.height;

        const intersects = !(
          instRight < boxLeft ||
          instLeft > boxRight ||
          instBottom < boxTop ||
          instTop > boxBottom
        );

        if (intersects) {
          overlappingIds.push(inst.id);
        }
      });

      if (e.shiftKey || e.ctrlKey) {
        const combined = Array.from(new Set([...selectedInstanceIds, ...overlappingIds]));
        updateSelectedInstances(combined);
      } else {
        updateSelectedInstances(overlappingIds);
      }
      return;
    }

    // 3. MOVING SELECTED MOTOR INSTANCES MODE
    if (isMovingInstances && dragStartCoords) {
      const deltaX = mouseX - dragStartCoords.x;
      const deltaY = mouseY - dragStartCoords.y;

      const updatedInstances = scene.instances.map(inst => {
        const initial = initialInstancesPositions[inst.id];
        if (initial) {
          let newX = initial.x + deltaX;
          let newY = initial.y + deltaY;

          if (snapToGrid) {
            const gs = scene.gridSize;
            newX = Math.round(newX / gs) * gs;
            newY = Math.round(newY / gs) * gs;
          }

          return { ...inst, x: newX, y: newY };
        }
        return inst;
      });

      onUpdateScene({
        ...scene,
        instances: updatedInstances
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsSelectingBox(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    setIsMovingInstances(false);
    setDragStartCoords(null);
    setInitialInstancesPositions({});
  };

  const handleUpdateInstanceProperty = (key: string, value: any) => {
    if (!selectedInstanceId) return;
    const updatedInstances = scene.instances.map(inst => {
      if (inst.id === selectedInstanceId) {
        return {
          ...inst,
          [key]: value
        };
      }
      return inst;
    });
    onUpdateScene({ ...scene, instances: updatedInstances });
  };

  const handleAddInstanceVariable = () => {
    if (!selectedInstanceId || !newVarName.trim()) return;
    const val = isNaN(parseFloat(newVarValue)) ? newVarValue : parseFloat(newVarValue);
    
    const updatedInstances = scene.instances.map(inst => {
      if (inst.id === selectedInstanceId) {
        return {
          ...inst,
          variables: {
            ...inst.variables,
            [newVarName.trim()]: val
          }
        };
      }
      return inst;
    });

    onUpdateScene({ ...scene, instances: updatedInstances });
    setNewVarName('');
    setNewVarValue('');
  };

  const handleDeleteInstanceVariable = (vName: string) => {
    if (!selectedInstanceId) return;
    const updatedInstances = scene.instances.map(inst => {
      if (inst.id === selectedInstanceId) {
        const copy = { ...inst.variables };
        delete copy[vName];
        return {
          ...inst,
          variables: copy
        };
      }
      return inst;
    });
    onUpdateScene({ ...scene, instances: updatedInstances });
  };

  const handleAddSceneLayer = () => {
    const newLName = prompt('Nome da Nova Camada:', `Camada_${activeLayers.length + 1}`);
    if (!newLName) return;

    const newL: SceneLayer = {
      id: 'lay_' + Math.random().toString(36).substr(2, 5),
      name: newLName,
      parallaxX: 1,
      parallaxY: 1,
      opacity: 1,
      visible: true
    };

    onUpdateScene({
      ...scene,
      layers: [...activeLayers, newL]
    });
  };

  const handleUpdateLayer = (layId: string, updatedLay: Partial<SceneLayer>) => {
    const nextLayers = activeLayers.map(l => l.id === layId ? { ...l, ...updatedLay } : l);
    onUpdateScene({
      ...scene,
      layers: nextLayers
    });
  };

  const handleDeleteLayer = (layId: string) => {
    if (activeLayers.length <= 1) {
      alert('Impossível remover a única camada restante!');
      return;
    }
    onUpdateScene({
      ...scene,
      layers: activeLayers.filter(l => l.id !== layId),
      instances: scene.instances.map(i => i.layerId === layId ? { ...i, layerId: activeLayers[0].id } : i)
    });
  };

  const handleToggleBehavior = (targetObj: ProjectObject, bName: string) => {
    const active = targetObj.behaviors.includes(bName);
    const nextBehaviors = active 
      ? targetObj.behaviors.filter(b => b !== bName)
      : [...targetObj.behaviors, bName];

    // Propagate properties structural configs
    const nextProperties = { ...targetObj.properties };
    if (!active) {
      // populate defaults
      if (bName === 'Platform') {
        nextProperties.speed = 160;
        nextProperties.gravity = 850;
        nextProperties.jumpStrength = 400;
        nextProperties.acceleration = 600;
        nextProperties.deceleration = 850;
        nextProperties.doubleJump = true;
      } else if (bName === '8Direction') {
        nextProperties.speed = 150;
      } else if (bName === 'Car') {
        nextProperties.carSpeed = 220;
        nextProperties.carAcceleration = 180;
        nextProperties.carDeceleration = 100;
        nextProperties.carTurnSpeed = 130;
        nextProperties.carDriftFactor = 0.75;
      } else if (bName === 'Bullet') {
        nextProperties.bulletSpeed = 300;
        nextProperties.bulletGravity = 0;
      } else if (bName === 'Sine') {
        nextProperties.sineAmplitude = 60;
        nextProperties.sinePeriod = 2.5;
      } else if (bName === 'Flash') {
        nextProperties.flashDuration = 1;
      } else if (bName === 'Fade') {
        nextProperties.fadeDuration = 1.5;
      } else if (bName === 'Timer') {
        nextProperties.timerValue = 2;
      } else if (bName === 'Physics') {
        nextProperties.gravity = 800;
      } else if (bName === 'Pathfinding') {
        nextProperties.speed = 100;
      }
    }

    // Update Project Object archetype
    const changed = {
      ...targetObj,
      behaviors: nextBehaviors,
      properties: nextProperties
    };

    onUpdateObject(changed);
    onSelectObject(changed);
  };

  const selectedInst = scene.instances.find(i => i.id === selectedInstanceId);
  const selectedInstObjDef = selectedInst ? objects.find(o => o.id === selectedInst.objectTypeId) : null;

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0c0d12]" id="scene_editor_root">
      
      {/* LEFT SIDE PANEL: Barra de Propriedades (Inspector) */}
      <div className="w-64 bg-[#14151e] border-r border-[#262732] flex flex-col justify-stretch overflow-y-auto">
        <div className="p-3 border-b border-slate-800 bg-[#1a1b26]">
          <span className="text-xs font-bold text-slate-300 tracking-wider flex items-center gap-1.5 uppercase font-mono">
            <Sliders className="w-4 h-4 text-[#818cf8]" /> Propriedades
          </span>
        </div>
        
        <div className="p-4 space-y-4">
          {editorMode === 'tiles' ? (
            <div className="space-y-4">
              <span className="text-xs font-bold text-slate-400 tracking-wider flex items-center gap-2 uppercase font-mono">
                <GripHorizontal className="w-4 h-4 text-emerald-400" /> Paleta de Tiles
              </span>
              <p className="text-[10px] text-gray-400 leading-normal">Escolha a fonte do Tilemap e as texturas para desenhar na grade:</p>
              
              <select
                value={activeTilemapSource}
                onChange={(e) => setActiveTilemapSource(e.target.value)}
                className="w-full bg-[#0c0d12] border border-slate-800 text-xs text-indigo-300 font-bold rounded-lg p-2 font-mono outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="default">Paleta Padrão (Cores)</option>
                {objects.filter(o => o.type === 'sprite' || o.type === 'tilemap').map(o => (
                  <option key={o.id} value={o.id}>🎨 Sprite: {o.name}</option>
                ))}
              </select>

              {activeTilemapSource === 'default' ? (
                <div className="grid grid-cols-1 gap-2.5">
                  {TILE_DEFINITIONS.map(td => (
                    <div
                      key={td.id}
                      onClick={() => setActiveTileId(td.id)}
                      className={`p-2.5 rounded-xl cursor-pointer flex items-center gap-3 border transition-all ${
                        activeTileId === td.id
                          ? 'bg-indigo-950/10 border-indigo-600/60 text-indigo-300'
                          : 'bg-[#181923] border-[#22232a] hover:border-slate-800'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg border border-gray-700/60 shrink-0 shadow-md" style={{ backgroundColor: td.color }}></div>
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">{td.name}</span>
                        <span className="text-[9px] text-[#94a3b8] block mt-0.5">{td.solid ? '🔒 Comportamento Sólido' : '🌊 Atravessável'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {objects.find(o => o.id === activeTilemapSource)?.frames?.map((frame, idx) => {
                    const tileStrId = `${activeTilemapSource}:${frame.id}`;
                    const isSelected = activeTileId === tileStrId;
                    return (
                      <div
                        key={frame.id}
                        onClick={() => setActiveTileId(tileStrId)}
                        className={`aspect-square rounded-lg flex items-center justify-center p-1 cursor-pointer overflow-hidden border transition-all relative ${
                          isSelected ? 'bg-indigo-900 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-[#181923] border-slate-700 hover:border-slate-500 hover:bg-[#1a1b26]'
                        }`}
                      >
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${frame.width}, 1fr)`,
                            width: '100%',
                            height: '100%'
                          }}
                        >
                          {frame.pixels.map((color, i) => (
                            <div key={i} style={{ backgroundColor: color || 'transparent' }}></div>
                          ))}
                        </div>
                        {isSelected && (
                          <div className="absolute inset-0 ring-2 ring-indigo-400 rounded-lg pointer-events-none"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : selectedInst && selectedInstObjDef ? (
                <div className="space-y-4" id="properties_inspector_fields">
                  <div className="bg-[#1c1d29] p-3 rounded-xl border border-indigo-500/30 shadow-md">
                    <span className="text-[9px] text-[#818cf8] font-mono block">INSTÂNCIA: {selectedInst.id}</span>
                    <span className="text-xs font-bold text-slate-200 mt-0.5 block">{selectedInstObjDef.name} ({selectedInstObjDef.type})</span>
                  </div>

                  <div className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block mb-1">X (px)</label>
                          <input
                            type="number"
                            value={selectedInst.x}
                            onChange={(e) => handleUpdateInstanceProperty('x', parseInt(e.target.value) || 0)}
                            className="w-full bg-[#0c0d12] border border-slate-800 focus:border-indigo-500 text-xs text-white rounded p-1.5 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Y (px)</label>
                          <input
                            type="number"
                            value={selectedInst.y}
                            onChange={(e) => handleUpdateInstanceProperty('y', parseInt(e.target.value) || 0)}
                            className="w-full bg-[#0c0d12] border border-slate-800 focus:border-indigo-500 text-xs text-white rounded p-1.5 font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block mb-1">L (Largura)</label>
                          <input
                            type="number"
                            value={selectedInst.width}
                            onChange={(e) => handleUpdateInstanceProperty('width', parseInt(e.target.value) || 32)}
                            className="w-full bg-[#0c0d12] border border-slate-800 focus:border-indigo-500 text-xs text-white rounded p-1.5 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block mb-1">H (Altura)</label>
                          <input
                            type="number"
                            value={selectedInst.height}
                            onChange={(e) => handleUpdateInstanceProperty('height', parseInt(e.target.value) || 32)}
                            className="w-full bg-[#0c0d12] border border-slate-800 focus:border-indigo-500 text-xs text-white rounded p-1.5 font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Origem X</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0" max="1"
                            value={selectedInst.originX ?? 0.5}
                            onChange={(e) => handleUpdateInstanceProperty('originX', parseFloat(e.target.value) ?? 0.5)}
                            className="w-full bg-[#0c0d12] border border-slate-800 focus:border-indigo-500 text-xs text-white rounded p-1.5 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Origem Y</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0" max="1"
                            value={selectedInst.originY ?? 0.5}
                            onChange={(e) => handleUpdateInstanceProperty('originY', parseFloat(e.target.value) ?? 0.5)}
                            className="w-full bg-[#0c0d12] border border-slate-800 focus:border-indigo-500 text-xs text-white rounded p-1.5 font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Ângulo (º)</label>
                          <input
                            type="number"
                            value={selectedInst.angle}
                            onChange={(e) => handleUpdateInstanceProperty('angle', parseInt(e.target.value) || 0)}
                            className="w-full bg-[#0c0d12] border border-slate-800 focus:border-indigo-500 text-xs text-white rounded p-1.5 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Opacidade (0 a 1)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0" max="1"
                            value={selectedInst.opacity}
                            onChange={(e) => handleUpdateInstanceProperty('opacity', parseFloat(e.target.value) || 1)}
                            className="w-full bg-[#0c0d12] border border-slate-800 focus:border-indigo-500 text-xs text-white rounded p-1.5 font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Efeitos Visuais Shader</label>
                        <select
                          value={selectedInst.effectFilter || 'none'}
                          onChange={(e) => handleUpdateInstanceProperty('effectFilter', e.target.value)}
                          className="w-full bg-[#0c0d12] border border-slate-800 text-xs text-slate-100 rounded p-1.5 font-bold outline-none"
                        >
                          <option value="none">Nenhum Filtro</option>
                          <option value="grayscale">Preto e Branco</option>
                          <option value="sepia">Sepia Retrô</option>
                          <option value="blur">Desfoque (Blur)</option>
                          <option value="glow">Brilho Intenso (Glow)</option>
                          <option value="water">Distorção de Água (WebGL)</option>
                          <option value="warp">Torção / Warp</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Blend Mode (Fusão)</label>
                        <select
                          value={selectedInst.blendMode || 'normal'}
                          onChange={(e) => handleUpdateInstanceProperty('blendMode', e.target.value)}
                          className="w-full bg-[#0c0d12] border border-slate-800 text-xs text-slate-100 rounded p-1.5 font-bold outline-none"
                        >
                          <option value="normal">Normal</option>
                          <option value="add">Adicionar (Add)</option>
                          <option value="screen">Screen (Iluminação)</option>
                          <option value="multiply">Multiplicar (Multiply)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Associa Camada</label>
                        <select
                          value={selectedInst.layerId || 'main_layer'}
                          onChange={(e) => handleUpdateInstanceProperty('layerId', e.target.value)}
                          className="w-full bg-[#0c0d12] border border-slate-800 text-xs text-slate-100 rounded p-1.5 font-bold outline-none"
                        >
                          {activeLayers.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* INSTANCE VARIABLES EDITOR */}
                    <div className="border-t border-[#252632] pt-3.5 space-y-2">
                      <span className="text-[10px] font-bold text-[#818cf8] uppercase tracking-wider block">Variáveis de Instância (Locais)</span>
                      
                      <div className="space-y-1.5">
                        {Object.entries(selectedInst.variables || {}).length === 0 ? (
                          <span className="text-[9px] text-gray-500 italic block py-1.5">Nenhuma variável criada nesta instância.</span>
                        ) : (
                          Object.entries(selectedInst.variables || {}).map(([vName, vVal]) => (
                            <div key={vName} className="flex items-center gap-1 bg-[#0c0d12] border border-slate-800 p-1.5 rounded-lg text-[10px] font-mono">
                              <span className="text-gray-400 truncate flex-1 font-semibold">{vName}: {vVal}</span>
                              <button 
                                onClick={() => handleDeleteInstanceVariable(vName)}
                                className="text-rose-400 hover:text-rose-300 p-0.5 hover:bg-slate-900 rounded"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Add new local variable */}
                      <div className="p-2 bg-[#1b1c27] rounded-lg border border-slate-800 space-y-2 mt-2">
                        <input
                          type="text"
                          placeholder="Nome da Variável"
                          value={newVarName}
                          onChange={(e) => setNewVarName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-[10px] text-slate-200 rounded p-1 font-mono"
                        />
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Valor"
                            value={newVarValue}
                            onChange={(e) => setNewVarValue(e.target.value)}
                            className="flex-1 bg-slate-950 border border-slate-800 text-[10px] text-slate-200 rounded p-1 font-mono"
                          />
                          <button
                            onClick={handleAddInstanceVariable}
                            className="p-1 px-2 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold transition-all active:scale-95 cursor-pointer flex items-center"
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const remaining = scene.instances.filter(i => i.id !== selectedInst.id);
                        onUpdateScene({ ...scene, instances: remaining });
                        setSelectedInstanceId(null);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 text-xs bg-rose-950/20 hover:bg-rose-900/40 text-rose-400 border border-rose-900/30 py-2.5 rounded-xl transition-all font-bold cursor-pointer mt-4"
                    >
                      <Trash2 className="w-4 h-4" /> Deletar Instância
                    </button>
                    
                    {/* INJECT BEHAVIORS CONFIG HERE */}
                      <div className="pt-3 border-t border-[#2d2e3d] mt-4">
                      <h4 className="text-[10px] font-bold text-slate-300 font-mono mb-2 uppercase">Comportamentos</h4>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { name: 'Platform' },
                          { name: '8Direction' },
                          { name: 'Solid' },
                          { name: 'JumpThru' },
                          { name: 'BoundToLayout' },
                          { name: 'ScrollTo' },
                          { name: 'Bullet' },
                          { name: 'Sine' },
                          { name: 'Car' },
                          { name: 'Flash' },
                          { name: 'Fade' },
                          { name: 'Timer' },
                          { name: 'Pin' },
                          { name: 'Physics' },
                          { name: 'Pathfinding' }
                        ].map(bh => {
                          const enabled = selectedInstObjDef.behaviors?.includes(bh.name);
                          return (
                            <div 
                              key={bh.name} 
                              onClick={() => handleToggleBehavior(selectedInstObjDef, bh.name)}
                              className={`p-2 rounded border transition-all cursor-pointer flex items-center gap-2 ${
                                enabled 
                                  ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-300' 
                                  : 'bg-[#181922] border-slate-800'
                              }`}
                            >
                              <input type="checkbox" checked={enabled} readOnly className="rounded accent-indigo-500 bg-slate-900" />
                              <span className="text-[10px] font-bold block">{bh.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* END BEHAVIORS */}
                    
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-[#242533] rounded-xl p-4 text-center">
                    <span className="text-2xl">👉</span>
                    <span className="text-xs font-bold text-slate-400 mt-2 block">Nenhuma Instância Selecionada</span>
                    <p className="text-[10px] text-gray-500 mt-1 leading-normal">Pegue um ator no painel lateral direito (Object Types) ou selecione uma instância no mapa para configurá-la.</p>
                  </div>
                )}
        </div>
      </div>

      {/* CENTER: Main Layout Grid */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#090a0e]">
        
        {/* Workspace Toolbar */}
        <div className="h-10 bg-[#12131a] border-b border-[#252632] px-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1 select-none">
            <button
              onClick={() => setEditorMode('instances')}
              className={`text-[10px] px-2 py-1.5 rounded flex items-center gap-1.5 font-bold transition-all ${
                editorMode === 'instances' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-900/30'
              }`}
            >
              <Move className="w-3 h-3" /> Instâncias
            </button>
            
            {editorMode === 'instances' && (
              <div className="flex bg-[#0a0a0f] p-0.5 rounded border border-[#232431]/75 gap-0.5 ml-2">
                <button
                  onClick={() => setSceneTool('select')}
                  className={`text-[9px] px-2 py-1 rounded font-bold uppercase transition-all ${
                    sceneTool === 'select' ? 'bg-indigo-600/30 text-indigo-300' : 'text-slate-400'
                  }`}
                >Selecionar</button>
                <button
                  onClick={() => setSceneTool('add')}
                  className={`text-[9px] px-2 py-1 rounded font-bold uppercase transition-all ${
                    sceneTool === 'add' ? 'bg-indigo-600/30 text-indigo-300' : 'text-slate-400'
                  }`}
                >Adicionar</button>
                <button
                  onClick={() => setSceneTool('move')}
                  className={`text-[9px] px-2 py-1 rounded font-bold uppercase transition-all ${
                    sceneTool === 'move' ? 'bg-indigo-600/30 text-indigo-300' : 'text-slate-400'
                  }`}
                >Mover</button>
              </div>
            )}

            {selectedInstanceIds.length > 0 && (
              <button
                onClick={() => {
                  const remaining = scene.instances.filter(inst => !selectedInstanceIds.includes(inst.id));
                  onUpdateScene({ ...scene, instances: remaining });
                  updateSelectedInstances([]);
                }}
                className="ml-2 bg-rose-950/50 hover:bg-rose-600 text-rose-300 hover:text-white text-[9px] font-bold py-1 px-2 rounded transition-all flex items-center gap-1 uppercase"
              >
                <Trash2 className="w-3 h-3" /> Excluir ({selectedInstanceIds.length})
              </button>
            )}

            <button
              onClick={() => setEditorMode('tiles')}
              className={`ml-2 text-[10px] px-2 py-1.5 rounded flex items-center gap-1.5 font-bold transition-all ${
                editorMode === 'tiles' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-900/30'
              }`}
            >
              <LayoutGrid className="w-3 h-3" /> Tilemap
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer font-bold uppercase">
              <input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} className="rounded accent-indigo-505 w-3 h-3" />
              Snap ({scene.gridSize}px)
            </label>
            <div className="flex items-center gap-1">
              <button onClick={() => setZoomScale(Math.max(0.5, zoomScale - 0.25))} className="p-1 px-2 text-[10px] bg-slate-800 text-white rounded font-bold hover:bg-slate-700">-</button>
              <span className="text-[10px] text-indigo-400 w-8 text-center font-bold">{(zoomScale * 100).toFixed(0)}%</span>
              <button onClick={() => setZoomScale(Math.min(2, zoomScale + 0.25))} className="p-1 px-2 text-[10px] bg-slate-800 text-white rounded font-bold hover:bg-slate-700">+</button>
            </div>
          </div>
        </div>

        {/* Canvas Frame Wrapper */}
        <div className="flex-1 overflow-auto p-12 flex items-center justify-center relative shadow-inner">
          <div className="relative border border-dashed border-slate-700 bg-[#111218]/90 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] p-0.5">
            <div className="absolute -top-6 left-0 text-[10px] text-[#4f536e] font-mono select-none font-bold">DIMENSÕES: {scene.width}x{scene.height}px</div>
            <canvas
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              className="cursor-crosshair block rounded-lg bg-cover"
              id="layout_drawing_stage"
            />
          </div>
        </div>
      </div>

      {/* RIGHT SIDE PANEL: Project Browser & Layers */}
      <div className="w-64 bg-[#14151e] border-l border-[#262732] flex flex-col justify-stretch">
        
        {/* TOP HALF: Project Browser (Fake object Types list) */}
        <div className="h-1/2 flex flex-col border-b border-[#262732]">
          <div className="flex h-8 bg-[#1a1b26] border-b border-slate-800 shrink-0 px-3 items-center">
             <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">Object Types</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="flex justify-end mb-2">
              <button onClick={onAddObject} className="text-[9px] bg-indigo-600 text-white p-1 px-2 rounded hover:bg-indigo-500 font-bold uppercase flex items-center gap-1">+ Novo Tipo</button>
            </div>
            {objects.length === 0 ? (
              <p className="text-[10px] text-gray-500 italic text-center py-4">Nenhum objeto criado.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {objects.map(obj => (
                  <div
                    key={obj.id}
                    onClick={() => onSelectObject(obj)}
                    className={`flex flex-col items-center justify-center p-2 rounded cursor-pointer transition-all border ${
                      selectedObject?.id === obj.id
                        ? 'bg-indigo-900/30 border-indigo-500 text-white'
                        : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="w-6 h-6 rounded flex items-center justify-center text-xs" style={{ backgroundColor: obj.primaryColor + '20', color: obj.primaryColor }}>
                      {obj.type === 'tilemap' ? '🧱' : '👾'}
                    </div>
                    <span className="text-[8px] mt-1 text-center font-bold truncate w-full">{obj.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM HALF: Layers */}
        <div className="flex-1 flex flex-col">
          <div className="flex h-8 bg-[#1a1b26] border-b border-slate-800 shrink-0 px-3 items-center justify-between">
            <span className="text-[9px] uppercase font-bold tracking-wider text-indigo-400 flex items-center gap-1.5"><Layers className="w-3 h-3" /> Layers</span>
            <button onClick={handleAddSceneLayer} className="text-[9px] text-slate-300 hover:text-white flex items-center gap-1 bg-slate-800 px-1.5 py-0.5 rounded"><PlusCircle className="w-2 h-2"/> Add</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {[...activeLayers].reverse().map((lay) => (
              <div key={lay.id} className={`p-2 rounded border text-left flex flex-col gap-1.5 ${
                activeLayerId === lay.id ? 'bg-indigo-900/20 border-indigo-600/50 shadow-sm' : 'bg-slate-800/30 border-slate-800'
              }`}>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 text-[10px]">
                    <button onClick={() => handleUpdateLayer(lay.id, { visible: !lay.visible })} className="text-slate-400 hover:text-indigo-300">
                      {lay.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-rose-400" />}
                    </button>
                    <input 
                      type="text" 
                      value={lay.name} 
                      onChange={(e) => handleUpdateLayer(lay.id, { name: e.target.value })}
                      className="bg-transparent border-none text-[10px] font-bold text-slate-200 outline-none w-20"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setActiveLayerId(lay.id)} className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      activeLayerId === lay.id ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}>Sel</button>
                    <button onClick={() => handleDeleteLayer(lay.id)} className="p-0.5 bg-rose-950/20 rounded text-rose-400 hover:bg-rose-900/30">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
