/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Scene, ProjectObject, ObjectInstance, TileDef, SceneLayer, TileMapLayer } from '../types';
import { Move, GripHorizontal, LayoutGrid, Trash2, Plus, Sliders, Layers, Eye, EyeOff, Settings, Sparkles, PlusCircle, PaintBucket, Eraser, Square, MousePointer2 } from 'lucide-react';

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
  const [activeTilemapSource, setActiveTilemapSource] = useState<string>('default');
  const [tileTool, setTileTool] = useState<'brush' | 'fill' | 'rect' | 'eraser'>('brush');
  const [rectStart, setRectStart] = useState<{ col: number, row: number } | null>(null);
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

  const getOrCreateTilemap = useCallback((layerId: string): TileMapLayer => {
    const existing = (scene.tilemaps || []).find(tm => tm.id === layerId);
    if (existing) return existing;
    const newTm: TileMapLayer = {
      id: layerId,
      name: activeLayers.find(l => l.id === layerId)?.name || 'Tilemap',
      grid: {}
    };
    onUpdateScene({
      ...scene,
      tilemaps: [...(scene.tilemaps || []), newTm]
    });
    return newTm;
  }, [scene, onUpdateScene, activeLayers]);

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

    // Construct 3-style layout background
    ctx.fillStyle = '#23242B';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gSize = scene.gridSize * zoomScale;

    // Raster background parallax layers first
    activeLayers.forEach(lay => {
      if (!lay.visible) return;

      ctx.save();
      ctx.globalAlpha = lay.opacity;

      // Draw Grid helper lines
      if (lay.parallaxX === 1.0) {
        ctx.strokeStyle = '#2E2F38';
        ctx.lineWidth = 0.5;
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

      // Draw all tilemaps (each layer can have its own tilemap)
      const drawTileGrid = (grid: Record<string, number | string>) => {
        Object.entries(grid).forEach(([coords, tileId]) => {
          const [col, row] = coords.split(',').map(Number);
          if (typeof tileId === 'number' || (typeof tileId === 'string' && !tileId.includes(':'))) {
            const tid = typeof tileId === 'string' ? parseInt(tileId) : tileId;
            const td = TILE_DEFINITIONS.find(t => t.id === tid);
            if (td) {
              ctx.fillStyle = td.color;
              ctx.fillRect(col * gSize, row * gSize, gSize, gSize);
              if (td.solid) {
                ctx.strokeStyle = 'rgba(255,255,255,0.12)';
                ctx.lineWidth = 0.5;
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
      };

      // Draw all tilemaps for this layer (associate by layer ID)
      const layerTilemaps = (scene.tilemaps || []).filter(tm => tm.id === lay.id);
      layerTilemaps.forEach(tm => { if (tm.grid) drawTileGrid(tm.grid); });
      // Also draw the legacy single tilemap on main layers
      if ((lay.id === 'main_layer' || lay.id === 'default_lay') && scene.tilemap && scene.tilemap.grid) {
        drawTileGrid(scene.tilemap.grid);
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
          ctx.strokeStyle = isSelected ? '#FFA000' : '#FFB300';
          ctx.lineWidth = 2;
          ctx.strokeRect(inst.x * zoomScale - 2, inst.y * zoomScale - 2, instWidthZoom + 4, instHeightZoom + 4);
          
          // Little interactive pivot visualizer
          ctx.fillStyle = isSelected ? '#FFA000' : '#FFB300';
          ctx.beginPath();
          ctx.arc((inst.x + inst.width * ox) * zoomScale, (inst.y + inst.height * oy) * zoomScale, 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,0.06)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(inst.x * zoomScale, inst.y * zoomScale, instWidthZoom, instHeightZoom);
        }
      });

      // Draw the beautiful dashed translucent selection box overlay if box selecting
      if (editorMode === 'instances' && isSelectingBox && selectionStart && selectionEnd) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 160, 0, 0.12)';
        ctx.strokeStyle = '#FFA000';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        
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

  const paintTile = (col: number, row: number) => {
    const tm = getOrCreateTilemap(activeLayerId);
    const updatedGrid = { ...tm.grid };
    const key = `${col},${row}`;
    updatedGrid[key] = activeTileId;
    const updatedTilemaps = (scene.tilemaps || []).map(t => t.id === tm.id ? { ...tm, grid: updatedGrid } : t);
    if (!updatedTilemaps.find(t => t.id === tm.id)) {
      updatedTilemaps.push({ ...tm, grid: updatedGrid });
    }
    onUpdateScene({ ...scene, tilemaps: updatedTilemaps });
  };

  const eraseTile = (col: number, row: number) => {
    const tm = getOrCreateTilemap(activeLayerId);
    const updatedGrid = { ...tm.grid };
    const key = `${col},${row}`;
    delete updatedGrid[key];
    const updatedTilemaps = (scene.tilemaps || []).map(t => t.id === tm.id ? { ...tm, grid: updatedGrid } : t);
    onUpdateScene({ ...scene, tilemaps: updatedTilemaps });
  };

  const floodFill = (col: number, row: number, fillId: number | string) => {
    const tm = getOrCreateTilemap(activeLayerId);
    const grid = { ...tm.grid };
    const gs = scene.gridSize;
    const cols = Math.ceil(scene.width / gs);
    const rows = Math.ceil(scene.height / gs);
    const target = grid[`${col},${row}`];
    if (target === fillId) return;

    const visited = new Set<string>();
    const stack = [`${col},${row}`];
    while (stack.length > 0) {
      const key = stack.pop()!;
      if (visited.has(key)) continue;
      visited.add(key);
      const [cx, cy] = key.split(',').map(Number);
      const existing = grid[key];
      if (existing === undefined || existing !== target) continue;
      grid[key] = fillId;
      if (cx > 0) stack.push(`${cx - 1},${cy}`);
      if (cx < cols - 1) stack.push(`${cx + 1},${cy}`);
      if (cy > 0) stack.push(`${cx},${cy - 1}`);
      if (cy < rows - 1) stack.push(`${cx},${cy + 1}`);
    }
    const updatedTilemaps = (scene.tilemaps || []).map(t => t.id === tm.id ? { ...tm, grid } : t);
    onUpdateScene({ ...scene, tilemaps: updatedTilemaps });
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

      if (tileTool === 'brush') {
        if (e.buttons === 1) paintTile(col, row);
      } else if (tileTool === 'eraser') {
        if (e.buttons === 1) eraseTile(col, row);
      } else if (tileTool === 'fill') {
        if (e.buttons === 1) floodFill(col, row, activeTileId);
      } else if (tileTool === 'rect') {
        setRectStart({ col, row });
      }
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
    lastMousePos.current = { x: mouseX, y: mouseY };

    // 1. TILEMAP MODE
    if (editorMode === 'tiles') {
      if (tileTool === 'brush' && e.buttons === 1) {
        const gs = scene.gridSize;
        const col = Math.floor(mouseX / gs);
        const row = Math.floor(mouseY / gs);
        paintTile(col, row);
      } else if (tileTool === 'eraser' && e.buttons === 1) {
        const gs = scene.gridSize;
        const col = Math.floor(mouseX / gs);
        const row = Math.floor(mouseY / gs);
        eraseTile(col, row);
      }
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

  const lastMousePos = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

  const handleCanvasMouseUp = () => {
    if (editorMode === 'tiles' && tileTool === 'rect' && rectStart) {
      const tm = getOrCreateTilemap(activeLayerId);
      const gs = scene.gridSize;
      const mouseX = lastMousePos.current.x;
      const mouseY = lastMousePos.current.y;
      const endCol = Math.floor(mouseX / gs);
      const endRow = Math.floor(mouseY / gs);
      const minCol = Math.min(rectStart.col, endCol);
      const maxCol = Math.max(rectStart.col, endCol);
      const minRow = Math.min(rectStart.row, endRow);
      const maxRow = Math.max(rectStart.row, endRow);
      const updatedGrid = { ...tm.grid };
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          updatedGrid[`${c},${r}`] = activeTileId;
        }
      }
      const updatedTilemaps = (scene.tilemaps || []).map(t => t.id === tm.id ? { ...tm, grid: updatedGrid } : t);
      onUpdateScene({ ...scene, tilemaps: updatedTilemaps });
      setRectStart(null);
    }

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
    <div className="flex-1 flex overflow-hidden bg-[#1E1F26]" id="scene_editor_root">
      
      {/* LEFT SIDE PANEL: Barra de Propriedades (Inspector) */}
      <div className="w-64 bg-[#26272E] border-r border-[#3A3B44] flex flex-col justify-stretch overflow-y-auto">
        <div className="p-2.5 border-b border-[#3A3B44] bg-[#2B2C33]">
          <span className="text-[11px] font-bold text-[#E0E0E0] tracking-wider flex items-center gap-1.5 uppercase">
            <Sliders className="w-3.5 h-3.5 text-[#FFA000]" /> Propriedades
          </span>
        </div>
        
        <div className="p-3 space-y-3">
          {editorMode === 'tiles' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#E0E0E0] tracking-wider flex items-center gap-2 uppercase">
                  <GripHorizontal className="w-3.5 h-3.5 text-[#FFA000]" /> Paleta de Tiles
                </span>
              </div>

              {/* Tile paint tools */}
              <div className="flex gap-1 bg-[#1E1F26] p-1 rounded border border-[#3A3B44]">
                {[
                  { id: 'brush' as const, icon: MousePointer2, label: 'Pincel' },
                  { id: 'fill' as const, icon: PaintBucket, label: 'Preencher' },
                  { id: 'rect' as const, icon: Square, label: 'Retângulo' },
                  { id: 'eraser' as const, icon: Eraser, label: 'Borracha' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTileTool(t.id)}
                    className={`flex-1 text-[9px] py-1 rounded flex items-center justify-center gap-1 font-bold transition-all ${
                      tileTool === t.id ? 'bg-[#FFA000] text-white' : 'text-[#888] hover:text-white'
                    }`}
                  >
                    <t.icon className="w-3 h-3" />
                  </button>
                ))}
              </div>

              {/* Tilemap layer selector */}
              <div className="text-[10px] text-[#888]">
                Camada ativa: <span className="text-[#FFA000] font-bold">{activeLayers.find(l => l.id === activeLayerId)?.name || 'N/A'}</span>
              </div>
              
              <select
                value={activeTilemapSource}
                onChange={(e) => setActiveTilemapSource(e.target.value)}
                className="w-full bg-[#1E1F26] border border-[#3A3B44] text-xs text-[#E0E0E0] font-medium rounded p-1.5 outline-none focus:border-[#FFA000] transition-colors"
              >
                <option value="default">Paleta Padrão (Cores)</option>
                {objects.filter(o => o.type === 'sprite' || o.type === 'tilemap').map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>

              {activeTilemapSource === 'default' ? (
                <div className="grid grid-cols-1 gap-1.5">
                  {TILE_DEFINITIONS.map(td => (
                    <div
                      key={td.id}
                      onClick={() => setActiveTileId(td.id)}
                      className={`p-2 rounded cursor-pointer flex items-center gap-2.5 border transition-all ${
                        activeTileId === td.id
                          ? 'bg-[#3A3B44] border-[#FFA000]'
                          : 'bg-[#2B2C33] border-[#3A3B44] hover:border-[#5A5B64]'
                      }`}
                    >
                      <div className="w-8 h-8 rounded border border-[#4A4B54] shrink-0" style={{ backgroundColor: td.color }}></div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-[#E0E0E0] block truncate">{td.name}</span>
                        <span className="text-[9px] text-[#888] block mt-0.5">
                          {td.solid ? 'Sólido' : 'Atravessável'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {objects.find(o => o.id === activeTilemapSource)?.frames?.map((frame) => {
                    const tileStrId = `${activeTilemapSource}:${frame.id}`;
                    const isSelected = activeTileId === tileStrId;
                    return (
                      <div
                        key={frame.id}
                        onClick={() => setActiveTileId(tileStrId)}
                        className={`aspect-square rounded flex items-center justify-center p-0.5 cursor-pointer overflow-hidden border transition-all relative ${
                          isSelected ? 'bg-[#3A3B44] border-[#FFA000]' : 'bg-[#2B2C33] border-[#3A3B44] hover:border-[#5A5B64]'
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : selectedInst && selectedInstObjDef ? (
                <div className="space-y-3" id="properties_inspector_fields">
                  <div className="bg-[#2B2C33] p-2.5 rounded border border-[#FFA000]/30">
                    <span className="text-[8px] text-[#FFA000] block">INSTÂNCIA: {selectedInst.id}</span>
                    <span className="text-xs font-bold text-[#E0E0E0] mt-0.5 block">{selectedInstObjDef.name} ({selectedInstObjDef.type})</span>
                  </div>

                  <div className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-medium text-[#888] uppercase tracking-wide block mb-1">X (px)</label>
                          <input
                            type="number"
                            value={selectedInst.x}
                            onChange={(e) => handleUpdateInstanceProperty('x', parseInt(e.target.value) || 0)}
                            className="w-full bg-[#1E1F26] border border-[#3A3B44] focus:border-[#FFA000] text-xs text-[#E0E0E0] rounded p-1.5"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-medium text-[#888] uppercase tracking-wide block mb-1">Y (px)</label>
                          <input
                            type="number"
                            value={selectedInst.y}
                            onChange={(e) => handleUpdateInstanceProperty('y', parseInt(e.target.value) || 0)}
                            className="w-full bg-[#1E1F26] border border-[#3A3B44] focus:border-[#FFA000] text-xs text-[#E0E0E0] rounded p-1.5"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-medium text-[#888] uppercase tracking-wide block mb-1">Largura</label>
                          <input
                            type="number"
                            value={selectedInst.width}
                            onChange={(e) => handleUpdateInstanceProperty('width', parseInt(e.target.value) || 32)}
                            className="w-full bg-[#1E1F26] border border-[#3A3B44] focus:border-[#FFA000] text-xs text-[#E0E0E0] rounded p-1.5"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-medium text-[#888] uppercase tracking-wide block mb-1">Altura</label>
                          <input
                            type="number"
                            value={selectedInst.height}
                            onChange={(e) => handleUpdateInstanceProperty('height', parseInt(e.target.value) || 32)}
                            className="w-full bg-[#1E1F26] border border-[#3A3B44] focus:border-[#FFA000] text-xs text-[#E0E0E0] rounded p-1.5"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-medium text-[#888] uppercase tracking-wide block mb-1">Origem X</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0" max="1"
                            value={selectedInst.originX ?? 0.5}
                            onChange={(e) => handleUpdateInstanceProperty('originX', parseFloat(e.target.value) ?? 0.5)}
                            className="w-full bg-[#1E1F26] border border-[#3A3B44] focus:border-[#FFA000] text-xs text-[#E0E0E0] rounded p-1.5"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-medium text-[#888] uppercase tracking-wide block mb-1">Origem Y</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0" max="1"
                            value={selectedInst.originY ?? 0.5}
                            onChange={(e) => handleUpdateInstanceProperty('originY', parseFloat(e.target.value) ?? 0.5)}
                            className="w-full bg-[#1E1F26] border border-[#3A3B44] focus:border-[#FFA000] text-xs text-[#E0E0E0] rounded p-1.5"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <label className="text-[9px] font-medium text-[#888] uppercase tracking-wide block mb-1">Ângulo (º)</label>
                          <input
                            type="number"
                            value={selectedInst.angle}
                            onChange={(e) => handleUpdateInstanceProperty('angle', parseInt(e.target.value) || 0)}
                            className="w-full bg-[#1E1F26] border border-[#3A3B44] focus:border-[#FFA000] text-xs text-[#E0E0E0] rounded p-1.5"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-medium text-[#888] uppercase tracking-wide block mb-1">Opacidade (0 a 1)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0" max="1"
                            value={selectedInst.opacity}
                            onChange={(e) => handleUpdateInstanceProperty('opacity', parseFloat(e.target.value) || 1)}
                            className="w-full bg-[#1E1F26] border border-[#3A3B44] focus:border-[#FFA000] text-xs text-[#E0E0E0] rounded p-1.5"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[9px] font-medium text-[#888] uppercase tracking-wide block mb-1">Efeitos Visuais</label>
                        <select
                          value={selectedInst.effectFilter || 'none'}
                          onChange={(e) => handleUpdateInstanceProperty('effectFilter', e.target.value)}
                          className="w-full bg-[#1E1F26] border border-[#3A3B44] text-xs text-[#E0E0E0] rounded p-1.5 outline-none focus:border-[#FFA000]"
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
                        <label className="text-[9px] font-medium text-[#888] uppercase tracking-wide block mb-1">Blend Mode (Fusão)</label>
                        <select
                          value={selectedInst.blendMode || 'normal'}
                          onChange={(e) => handleUpdateInstanceProperty('blendMode', e.target.value)}
                          className="w-full bg-[#1E1F26] border border-[#3A3B44] text-xs text-[#E0E0E0] rounded p-1.5 outline-none focus:border-[#FFA000]"
                        >
                          <option value="normal">Normal</option>
                          <option value="add">Adicionar (Add)</option>
                          <option value="screen">Screen (Iluminação)</option>
                          <option value="multiply">Multiplicar (Multiply)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] font-medium text-[#888] uppercase tracking-wide block mb-1">Camada</label>
                        <select
                          value={selectedInst.layerId || 'main_layer'}
                          onChange={(e) => handleUpdateInstanceProperty('layerId', e.target.value)}
                          className="w-full bg-[#1E1F26] border border-[#3A3B44] text-xs text-[#E0E0E0] rounded p-1.5 outline-none focus:border-[#FFA000]"
                        >
                          {activeLayers.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* INSTANCE VARIABLES EDITOR */}
                    <div className="border-t border-[#3A3B44] pt-3 space-y-2">
                      <span className="text-[10px] font-bold text-[#FFA000] uppercase tracking-wider block">Variáveis de Instância</span>
                      
                      <div className="space-y-1">
                        {Object.entries(selectedInst.variables || {}).length === 0 ? (
                          <span className="text-[9px] text-[#666] italic block py-1">Nenhuma variável.</span>
                        ) : (
                          Object.entries(selectedInst.variables || {}).map(([vName, vVal]) => (
                            <div key={vName} className="flex items-center gap-1 bg-[#1E1F26] border border-[#3A3B44] p-1 rounded text-[10px]">
                              <span className="text-[#888] truncate flex-1">{vName}: {vVal}</span>
                              <button 
                                onClick={() => handleDeleteInstanceVariable(vName)}
                                className="text-[#FF6B6B] hover:text-[#FF4444] p-0.5"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Add new local variable */}
                      <div className="p-1.5 bg-[#2B2C33] rounded border border-[#3A3B44] space-y-1.5">
                        <input
                          type="text"
                          placeholder="Nome"
                          value={newVarName}
                          onChange={(e) => setNewVarName(e.target.value)}
                          className="w-full bg-[#1E1F26] border border-[#3A3B44] text-[10px] text-[#E0E0E0] rounded p-1"
                        />
                        <div className="flex gap-1">
                          <input
                            type="text"
                            placeholder="Valor"
                            value={newVarValue}
                            onChange={(e) => setNewVarValue(e.target.value)}
                            className="flex-1 bg-[#1E1F26] border border-[#3A3B44] text-[10px] text-[#E0E0E0] rounded p-1"
                          />
                          <button
                            onClick={handleAddInstanceVariable}
                            className="p-1 px-1.5 text-[10px] bg-[#FFA000] hover:bg-[#FFB300] text-white rounded font-medium transition-all active:scale-95 cursor-pointer"
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
                      className="w-full flex items-center justify-center gap-1.5 text-xs bg-[#3A1A1A] hover:bg-[#5A2A2A] text-[#FF6B6B] border border-[#5A2A2A] py-2 rounded transition-all font-medium cursor-pointer mt-3"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Deletar
                    </button>
                    
                    {/* INJECT BEHAVIORS CONFIG HERE */}
                      <div className="pt-3 border-t border-[#3A3B44] mt-3">
                      <h4 className="text-[10px] font-bold text-[#E0E0E0] mb-2 uppercase">Comportamentos</h4>
                      <div className="grid grid-cols-2 gap-1">
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
                              className={`p-1.5 rounded border transition-all cursor-pointer flex items-center gap-1.5 ${
                                enabled 
                                  ? 'bg-[#3A3B44] border-[#FFA000] text-white' 
                                  : 'bg-[#2B2C33] border-[#3A3B44] text-[#888]'
                              }`}
                            >
                              <input type="checkbox" checked={enabled} readOnly className="rounded accent-[#FFA000]" />
                              <span className="text-[9px] font-medium block">{bh.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* END BEHAVIORS */}
                    
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-[#3A3B44] rounded p-4 text-center">
                    <span className="text-xs font-medium text-[#888] mt-2 block">Nenhuma Instância</span>
                    <p className="text-[10px] text-[#666] mt-1">Selecione ou adicione uma instância no mapa.</p>
                  </div>
                )}
        </div>
      </div>

      {/* CENTER: Main Layout Grid */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#1E1F26]">
        
        {/* Workspace Toolbar */}
        <div className="h-9 bg-[#2B2C33] border-b border-[#3A3B44] px-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1 select-none">
            <button
              onClick={() => setEditorMode('instances')}
              className={`text-[10px] px-2 py-1 rounded flex items-center gap-1.5 font-medium transition-all ${
                editorMode === 'instances' ? 'bg-[#FFA000] text-white' : 'text-[#888] hover:text-white hover:bg-[#3A3B44]'
              }`}
            >
              <Move className="w-3 h-3" /> Instâncias
            </button>
            
            {editorMode === 'instances' && (
              <div className="flex bg-[#1E1F26] p-0.5 rounded border border-[#3A3B44] gap-0.5 ml-2">
                <button
                  onClick={() => setSceneTool('select')}
                  className={`text-[9px] px-1.5 py-0.5 rounded font-medium uppercase transition-all ${
                    sceneTool === 'select' ? 'bg-[#3A3B44] text-white' : 'text-[#888]'
                  }`}
                >Sel</button>
                <button
                  onClick={() => setSceneTool('add')}
                  className={`text-[9px] px-1.5 py-0.5 rounded font-medium uppercase transition-all ${
                    sceneTool === 'add' ? 'bg-[#3A3B44] text-white' : 'text-[#888]'
                  }`}
                >Add</button>
                <button
                  onClick={() => setSceneTool('move')}
                  className={`text-[9px] px-1.5 py-0.5 rounded font-medium uppercase transition-all ${
                    sceneTool === 'move' ? 'bg-[#3A3B44] text-white' : 'text-[#888]'
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
                className="ml-2 bg-[#3A1A1A] hover:bg-[#5A2A2A] text-[#FF6B6B] text-[9px] font-medium py-0.5 px-1.5 rounded transition-all flex items-center gap-1 uppercase"
              >
                <Trash2 className="w-2.5 h-2.5" /> ({selectedInstanceIds.length})
              </button>
            )}

            <button
              onClick={() => setEditorMode('tiles')}
              className={`ml-2 text-[10px] px-2 py-1 rounded flex items-center gap-1.5 font-medium transition-all ${
                editorMode === 'tiles' ? 'bg-[#FFA000] text-white' : 'text-[#888] hover:text-white hover:bg-[#3A3B44]'
              }`}
            >
              <LayoutGrid className="w-3 h-3" /> Tilemap
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] text-[#888] cursor-pointer font-medium uppercase">
              <input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} className="rounded accent-[#FFA000] w-2.5 h-2.5" />
              Snap
            </label>
            <div className="flex items-center gap-1">
              <button onClick={() => setZoomScale(Math.max(0.5, zoomScale - 0.25))} className="p-0.5 px-1.5 text-[10px] bg-[#3A3B44] text-[#E0E0E0] rounded font-medium hover:bg-[#4A4B54]">-</button>
              <span className="text-[10px] text-[#FFA000] w-8 text-center font-medium">{(zoomScale * 100).toFixed(0)}%</span>
              <button onClick={() => setZoomScale(Math.min(2, zoomScale + 0.25))} className="p-0.5 px-1.5 text-[10px] bg-[#3A3B44] text-[#E0E0E0] rounded font-medium hover:bg-[#4A4B54]">+</button>
            </div>
          </div>
        </div>

        {/* Canvas Frame Wrapper */}
        <div className="flex-1 overflow-auto p-8 flex items-center justify-center relative">
          <div className="relative border border-[#3A3B44] bg-[#23242B]/90 rounded shadow-lg p-0.5">
            <div className="absolute -top-5 left-0 text-[9px] text-[#666] select-none font-medium">{scene.width}x{scene.height}px</div>
            <canvas
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              className="cursor-crosshair block rounded bg-cover"
              id="layout_drawing_stage"
            />
          </div>
        </div>
      </div>

      {/* RIGHT SIDE PANEL: Project Browser & Layers */}
      <div className="w-64 bg-[#26272E] border-l border-[#3A3B44] flex flex-col justify-stretch">
        
        {/* TOP HALF: Project Browser */}
        <div className="h-1/2 flex flex-col border-b border-[#3A3B44]">
          <div className="flex h-7 bg-[#2B2C33] border-b border-[#3A3B44] shrink-0 px-3 items-center">
             <span className="text-[10px] uppercase font-bold tracking-wider text-[#E0E0E0]">Object Types</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="flex justify-end mb-1.5">
              <button onClick={onAddObject} className="text-[9px] bg-[#FFA000] text-white p-0.5 px-1.5 rounded hover:bg-[#FFB300] font-medium uppercase flex items-center gap-1">+ Novo</button>
            </div>
            {objects.length === 0 ? (
              <p className="text-[10px] text-[#666] italic text-center py-4">Nenhum objeto.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {objects.map(obj => (
                  <div
                    key={obj.id}
                    onClick={() => onSelectObject(obj)}
                    className={`flex flex-col items-center justify-center p-1 rounded cursor-pointer transition-all border ${
                      selectedObject?.id === obj.id
                        ? 'bg-[#3A3B44] border-[#FFA000] text-white'
                        : 'bg-[#2B2C33] border-[#3A3B44] text-[#888] hover:bg-[#3A3B44]'
                    }`}
                  >
                    <div className="w-5 h-5 rounded flex items-center justify-center text-xs" style={{ backgroundColor: obj.primaryColor + '30', color: obj.primaryColor }}>
                      S
                    </div>
                    <span className="text-[7px] mt-0.5 text-center font-medium truncate w-full">{obj.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM HALF: Layers */}
        <div className="flex-1 flex flex-col">
          <div className="flex h-7 bg-[#2B2C33] border-b border-[#3A3B44] shrink-0 px-3 items-center justify-between">
            <span className="text-[9px] uppercase font-bold tracking-wider text-[#E0E0E0] flex items-center gap-1"><Layers className="w-2.5 h-2.5" /> Layers</span>
            <button onClick={handleAddSceneLayer} className="text-[9px] text-[#888] hover:text-white flex items-center gap-0.5 bg-[#3A3B44] px-1 py-0.5 rounded"><PlusCircle className="w-2 h-2"/> Add</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {[...activeLayers].reverse().map((lay) => (
              <div key={lay.id} className={`p-1.5 rounded border flex flex-col gap-1 ${
                activeLayerId === lay.id ? 'bg-[#3A3B44] border-[#FFA000]' : 'bg-[#2B2C33] border-[#3A3B44]'
              }`}>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <button onClick={() => handleUpdateLayer(lay.id, { visible: !lay.visible })} className="text-[#888] hover:text-[#FFA000]">
                      {lay.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-[#FF6B6B]" />}
                    </button>
                    <input 
                      type="text" 
                      value={lay.name} 
                      onChange={(e) => handleUpdateLayer(lay.id, { name: e.target.value })}
                      className="bg-transparent border-none text-[10px] font-medium text-[#E0E0E0] outline-none w-16"
                    />
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => setActiveLayerId(lay.id)} className={`text-[7px] px-1 py-0.5 rounded font-bold uppercase ${
                      activeLayerId === lay.id ? 'bg-[#FFA000] text-white' : 'bg-[#3A3B44] text-[#888] hover:bg-[#4A4B54]'
                    }`}>Sel</button>
                    <button onClick={() => handleDeleteLayer(lay.id)} className="p-0.5 rounded text-[#FF6B6B] hover:bg-[#3A1A1A]">
                      <Trash2 className="w-2.5 h-2.5" />
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
