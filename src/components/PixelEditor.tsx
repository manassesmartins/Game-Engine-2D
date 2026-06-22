/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ProjectObject, SpriteFrame } from '../types';
import { 
  Paintbrush, 
  Eraser, 
  Trash2, 
  Plus, 
  Play, 
  Pause, 
  Eye, 
  Undo2, 
  Redo2, 
  Move, 
  Pipette, 
  Scissors, 
  Sparkles, 
  ZoomIn, 
  ZoomOut, 
  Hand,
  Combine,
  MousePointer,
  Sparkle,
  Type,
  Square,
  Circle,
  TrendingUp,
  Sliders,
  Maximize2,
  Copy,
  Crop,
  Grid
} from 'lucide-react';

interface PixelEditorProps {
  selectedObject: ProjectObject | null;
  onUpdateObject: (updatedObj: ProjectObject) => void;
}

const PALETTE_COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', 
  '#1e1b4b', '#1c1917', '#14532d', '#1e3a8a', '#581c87', '#312e81', '#450a0a', '#701a75', '#0f172a', '#64748b'
];

type PixelTool = 
  | 'pencil' 
  | 'eraser' 
  | 'bucket' 
  | 'gradient' 
  | 'line' 
  | 'curve' 
  | 'rect' 
  | 'filled_rect' 
  | 'ellipse' 
  | 'filled_ellipse' 
  | 'polygon'
  | 'marquee' 
  | 'wand' 
  | 'move' 
  | 'eyedropper' 
  | 'shading' 
  | 'blur' 
  | 'jumble' 
  | 'hand';

interface FrameThumbnailProps {
  pixels: string[];
  gridWidth: number;
  gridHeight: number;
}

function FrameThumbnail({ pixels, gridWidth, gridHeight }: FrameThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use a fixed thumb resolution (56x56) for crisp pixel art preview
    const thumbW = 56;
    const thumbH = 56;
    
    if (canvas.width !== thumbW || canvas.height !== thumbH) {
      canvas.width = thumbW;
      canvas.height = thumbH;
    }

    ctx.clearRect(0, 0, thumbW, thumbH);

    // Draw checkerboard transparent background
    const checkerSize = 4;
    for (let y = 0; y < thumbH; y += checkerSize) {
      for (let x = 0; x < thumbW; x += checkerSize) {
        ctx.fillStyle = ((Math.floor(x / checkerSize) + Math.floor(y / checkerSize)) % 2 === 0) ? '#1c1d27' : '#14151b';
        ctx.fillRect(x, y, checkerSize, checkerSize);
      }
    }

    const cellW = thumbW / gridWidth;
    const cellH = thumbH / gridHeight;

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const color = pixels[y * gridWidth + x];
        if (color) {
          ctx.fillStyle = color;
          // Use Math.ceil to make sure there are no sub-pixel gaps in the thumbnail
          ctx.fillRect(
            Math.floor(x * cellW), 
            Math.floor(y * cellH), 
            Math.ceil(cellW), 
            Math.ceil(cellH)
          );
        }
      }
    }
  }, [pixels, gridWidth, gridHeight]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full block rounded object-contain select-none" 
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

export default function PixelEditor({ selectedObject, onUpdateObject }: PixelEditorProps) {
  const [activeColor, setActiveColor] = useState<string>('#ec4899');
  const [secondaryColor, setSecondaryColor] = useState<string>('#1e3a8a');
  const [activeTool, setActiveTool] = useState<PixelTool>('pencil');
  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [onionSkin, setOnionSkin] = useState<boolean>(true);
  const [gridSize, setGridSize] = useState<number>(8);

  const [gridWidth, setGridWidth] = useState<number>(8);
  const [gridHeight, setGridHeight] = useState<number>(8);
  const [customWInput, setCustomWInput] = useState<string>('8');
  const [customHInput, setCustomHInput] = useState<string>('8');
  const [mirrorHorizontal, setMirrorHorizontal] = useState<boolean>(false);
  const [mirrorVertical, setMirrorVertical] = useState<boolean>(false);

  // Tool settings
  const [showGridLines, setShowGridLines] = useState<boolean>(true);
  const [pixelPerfect, setPixelPerfect] = useState<boolean>(false);
  const [brushSize, setBrushSize] = useState<number>(1);
  const [brushOpacity, setBrushOpacity] = useState<number>(100);
  const [eraserSize, setEraserSize] = useState<number>(1);
  const [eraserOpacity, setEraserOpacity] = useState<number>(100);
  const [eraserShape, setEraserShape] = useState<'square' | 'round'>('square');
  const [contiguousFill, setContiguousFill] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1); // Zoom multipliers: 1, 1.5, 2, 3
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [fps, setFps] = useState<number>(5);
  const [draggedFrameIdx, setDraggedFrameIdx] = useState<number | null>(null);

  // Undo / Redo stacks
  const [undoStack, setUndoStack] = useState<string[][]>([]);
  const [redoStack, setRedoStack] = useState<string[][]>([]);

  // Selection states
  const [selectedCells, setSelectedCells] = useState<number[]>([]); // indexes of pixels selected
  const [marchingAntsActive, setMarchingAntsActive] = useState<boolean>(false);

  // Drag state for Line, Rect, Ellipse, Gradient, Move
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number, y: number } | null>(null);
  const [dragPixelsSnapshot, setDragPixelsSnapshot] = useState<string[]>([]);

  // Polygon creator accumulation
  const [polygonPoints, setPolygonPoints] = useState<{ x: number; y: number }[]>([]);

  const frames = selectedObject?.frames || [];
  const currentFrame = frames[currentFrameIdx] || frames[0] || { id: 'default', width: gridSize, height: gridSize, pixels: Array(gridSize * gridSize).fill('') };

  // Sync grid dimension states with active current frame
  useEffect(() => {
    if (selectedObject && currentFrame) {
      const w = currentFrame.width || gridSize || 8;
      const h = currentFrame.height || gridSize || 8;
      setGridWidth(w);
      setGridHeight(h);
      setCustomWInput(w.toString());
      setCustomHInput(h.toString());
    }
  }, [currentFrameIdx, selectedObject]);

  // HTML5 Interactive Canvas rendering engine for low memory & ultra stable high performance
  const editorCanvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const drawEditorCanvas = () => {
    const canvas = editorCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = Math.max(4, Math.min(48, Math.floor(400 / Math.max(gridWidth, gridHeight))));
    const width = gridWidth * cellSize;
    const height = gridHeight * cellSize;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    // Get Onion Skin
    const onionFrame = frames[currentFrameIdx - 1];

    // 1. Draw Onion Skin (if active)
    if (onionSkin && onionFrame && onionFrame.pixels) {
      ctx.globalAlpha = 0.25;
      for (let idx = 0; idx < gridWidth * gridHeight; idx++) {
        const color = currentFrame.pixels[idx] || '';
        if (!color) {
          const onionColor = onionFrame.pixels[idx];
          if (onionColor) {
            const x = idx % gridWidth;
            const y = Math.floor(idx / gridWidth);
            ctx.fillStyle = onionColor;
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        }
      }
      ctx.globalAlpha = 1.0;
    }

    // 2. Draw Frame Pixels
    for (let idx = 0; idx < gridWidth * gridHeight; idx++) {
      const color = currentFrame.pixels[idx];
      if (color) {
        const x = idx % gridWidth;
        const y = Math.floor(idx / gridWidth);
        ctx.fillStyle = color;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }

    // 3. Draw Grid Lines (if cell size is reasonable AND active)
    if (cellSize > 4 && showGridLines) {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let x = 0; x <= gridWidth; x++) {
        ctx.moveTo(x * cellSize, 0);
        ctx.lineTo(x * cellSize, height);
      }
      for (let y = 0; y <= gridHeight; y++) {
        ctx.moveTo(0, y * cellSize);
        ctx.lineTo(width, y * cellSize);
      }
      ctx.stroke();
    }

    // 4. Draw Selected Cells (Marching Ants / Selection borders)
    if (marchingAntsActive && selectedCells.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      selectedCells.forEach(idx => {
        const x = idx % gridWidth;
        const y = Math.floor(idx / gridWidth);
        ctx.strokeRect(x * cellSize + 0.5, y * cellSize + 0.5, cellSize - 1, cellSize - 1);
        ctx.fillStyle = 'rgba(251, 191, 36, 0.1)';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      });
      ctx.restore();
    }

    // 5. Draw Hover/Brush Preview Overlay
    if (hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < gridWidth * gridHeight) {
      const hx = hoveredIdx % gridWidth;
      const hy = Math.floor(hoveredIdx / gridWidth);
      ctx.save();
      
      if (activeTool === 'eraser') {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.lineWidth = 1.5;
        const rad = eraserSize;
        if (eraserShape === 'round') {
          ctx.beginPath();
          ctx.arc((hx + 0.5) * cellSize, (hy + 0.5) * cellSize, (rad - 0.5) * cellSize, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
          ctx.beginPath();
          ctx.arc((hx + 0.5) * cellSize, (hy + 0.5) * cellSize, (rad - 0.5) * cellSize, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const px = (hx - rad + 1) * cellSize;
          const py = (hy - rad + 1) * cellSize;
          const size = (rad * 2 - 1) * cellSize;
          ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
          ctx.fillRect(px, py, size, size);
        }
      } else if (activeTool === 'eyedropper') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(hx * cellSize + 0.5, hy * cellSize + 0.5, cellSize - 1, cellSize - 1);
      } else if (['pencil', 'shading', 'blur', 'jumble'].includes(activeTool)) {
        ctx.fillStyle = activeColor || 'rgba(255,255,255,0.4)';
        ctx.globalAlpha = 0.4;
        ctx.fillRect(hx * cellSize, hy * cellSize, cellSize, cellSize);
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(hx * cellSize + 0.5, hy * cellSize + 0.5, cellSize - 1, cellSize - 1);
      }
      ctx.restore();
    }
  };

  useEffect(() => {
    drawEditorCanvas();
  }, [
    currentFrame.pixels,
    onionSkin,
    frames,
    currentFrameIdx,
    gridWidth,
    gridHeight,
    selectedCells,
    marchingAntsActive,
    activeTool,
    activeColor,
    eraserSize,
    eraserShape,
    hoveredIdx
  ]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const canvas = editorCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const cellSize = canvas.width / gridWidth;
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);
    
    if (cellX >= 0 && cellX < gridWidth && cellY >= 0 && cellY < gridHeight) {
      const idx = cellY * gridWidth + cellX;
      handleCellInteraction(idx, true);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = editorCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const cellSize = canvas.width / gridWidth;
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);
    
    if (cellX >= 0 && cellX < gridWidth && cellY >= 0 && cellY < gridHeight) {
      const idx = cellY * gridWidth + cellX;
      if (idx !== hoveredIdx) {
        setHoveredIdx(idx);
      }
      
      if (e.buttons === 1 && isDrawing) {
        if (['line', 'curve', 'rect', 'filled_rect', 'ellipse', 'filled_ellipse', 'gradient', 'move', 'marquee'].includes(activeTool)) {
          handleMouseDragMove(idx);
        } else {
          handleCellInteraction(idx, false);
        }
      }
    } else {
      if (hoveredIdx !== null) {
        setHoveredIdx(null);
      }
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoveredIdx(null);
    if (isDrawing) {
      handleMouseDragEnd();
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) {
      handleMouseDragEnd();
    }
  };

  // Real-time animation playback loop
  useEffect(() => {
    if (!isPlaying || !selectedObject || selectedObject.frames.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentFrameIdx(prev => (prev + 1) % selectedObject.frames.length);
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [isPlaying, selectedObject, fps]);

  const handleFrameDragStart = (e: React.DragEvent<HTMLDivElement>, idx: number) => {
    setDraggedFrameIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFrameDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleFrameDrop = (e: React.DragEvent<HTMLDivElement>, targetIdx: number) => {
    e.preventDefault();
    if (draggedFrameIdx === null || draggedFrameIdx === targetIdx || !selectedObject) return;
    
    const updatedFrames = [...frames];
    const item = updatedFrames.splice(draggedFrameIdx, 1)[0];
    updatedFrames.splice(targetIdx, 0, item);
    
    onUpdateObject({
      ...selectedObject,
      frames: updatedFrames
    });
    
    if (currentFrameIdx === draggedFrameIdx) {
      setCurrentFrameIdx(targetIdx);
    } else if (draggedFrameIdx < currentFrameIdx && targetIdx >= currentFrameIdx) {
      setCurrentFrameIdx(currentFrameIdx - 1);
    } else if (draggedFrameIdx > currentFrameIdx && targetIdx <= currentFrameIdx) {
      setCurrentFrameIdx(currentFrameIdx + 1);
    }
    
    setDraggedFrameIdx(null);
  };

  if (!selectedObject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#090a0f] text-center p-6" id="pixel_no_selection">
        <span className="text-4xl animate-bounce">🎨</span>
        <h3 className="text-md font-bold text-white mt-3">Nenhum Ator Selecionado</h3>
        <p className="text-xs text-gray-500 max-w-xs mt-1">
          Por favor, crie ou selecione um Ator no menu lateral do Layout para desenhar pixel arts.
        </p>
      </div>
    );
  }

  // Setup initial undo state if empty
  const initializeUndoOnce = () => {
    if (undoStack.length === 0 && currentFrame.pixels) {
      setUndoStack([[...currentFrame.pixels]]);
    }
  };

  // Push present state into Undo Stack and purge Redo
  const saveActionToUndo = (pixelsState: string[]) => {
    setUndoStack(prev => [...prev, [...pixelsState]].slice(-50)); // Keep max 50 actions
    setRedoStack([]); // Clear Redo
  };

  const handleUndo = () => {
    if (undoStack.length <= 1) return; // Need at least 1 historical step
    const current = undoStack[undoStack.length - 1];
    const previous = undoStack[undoStack.length - 2];

    const updatedFrames = [...frames];
    const frameToEdit = { ...currentFrame };
    frameToEdit.pixels = [...previous];
    updatedFrames[currentFrameIdx] = frameToEdit;

    // Pop the current state from undo slot, move to redo stack
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, [...current]]);

    onUpdateObject({
      ...selectedObject,
      frames: updatedFrames
    });
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];

    const updatedFrames = [...frames];
    const frameToEdit = { ...currentFrame };
    frameToEdit.pixels = [...nextState];
    updatedFrames[currentFrameIdx] = frameToEdit;

    // Push back to undo, pop from redo
    setUndoStack(prev => [...prev, [...nextState]]);
    setRedoStack(prev => prev.slice(0, -1));

    onUpdateObject({
      ...selectedObject,
      frames: updatedFrames
    });
  };

  const commitPixelChanges = (newPixels: string[]) => {
    const updatedFrames = [...frames];
    const frameToEdit = { ...updatedFrames[currentFrameIdx] };
    frameToEdit.pixels = newPixels;
    updatedFrames[currentFrameIdx] = frameToEdit;

    saveActionToUndo(newPixels);

    onUpdateObject({
      ...selectedObject,
      frames: updatedFrames
    });
  };

  const updateFramePixelsLive = (newPixels: string[]) => {
    const updatedFrames = [...frames];
    const frameToEdit = { ...updatedFrames[currentFrameIdx] };
    frameToEdit.pixels = newPixels;
    updatedFrames[currentFrameIdx] = frameToEdit;

    onUpdateObject({
      ...selectedObject,
      frames: updatedFrames
    });
  };

  const getColorWithOpacity = (hex: string, opacityPercent: number) => {
    if (opacityPercent === 100) return hex;
    const alphaHex = Math.round((opacityPercent / 100) * 255).toString(16).padStart(2, '0');
    if (hex.startsWith('#')) {
      return hex.substring(0, 7) + alphaHex;
    }
    return hex;
  };

  // Mathematical helpers for raster geometry
  const indexToCoords = (idx: number) => {
    return {
      x: idx % gridWidth,
      y: Math.floor(idx / gridWidth)
    };
  };

  const coordsToIndex = (x: number, y: number) => {
    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return -1;
    return y * gridWidth + x;
  };

  // Bresenham's algorithms
  const getLinePoints = (x0: number, y0: number, x1: number, y1: number) => {
    const points = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    while (true) {
      points.push({ x, y });
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
    return points;
  };

  // Beautiful quadratic curve with a bended midpoint
  const getCurvePoints = (x0: number, y0: number, x1: number, y1: number) => {
    const points = [];
    // Midpoint bended slightly vertically to form a neat quadratic curve profile
    const cx = Math.floor((x0 + x1) / 2);
    const cy = Math.floor((y0 + y1) / 2) - Math.floor(Math.abs(x1 - x0) / 4 || 3);
    
    // De Casteljau subdivision mapping
    for (let t = 0; t <= 1; t += 0.05) {
      const qx = Math.round((1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1);
      const qy = Math.round((1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1);
      points.push({ x: qx, y: qy });
    }
    return points;
  };

  const getRectPoints = (x0: number, y0: number, x1: number, y1: number, filled: boolean) => {
    const points = [];
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (filled || y === minY || y === maxY || x === minX || x === maxX) {
          points.push({ x, y });
        }
      }
    }
    return points;
  };

  const getEllipsePoints = (x0: number, y0: number, x1: number, y1: number, filled: boolean) => {
    const points = [];
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);

    const rx = (maxX - minX) / 2;
    const ry = (maxY - minY) / 2;
    const cx = minX + rx;
    const cy = minY + ry;

    if (rx <= 0 || ry <= 0) {
      return getLinePoints(x0, y0, x1, y1);
    }

    if (filled) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x - cx;
          const dy = y - cy;
          if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1.05) {
            points.push({ x, y });
          }
        }
      }
    } else {
      // Outline circle equations
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const val = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
          if (val >= 0.70 && val <= 1.25) {
            points.push({ x, y });
          }
        }
      }
    }
    return points;
  };

  // Eyedropper shortcut: hold Alt to quickly peek color
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        setActiveTool('eyedropper');
      }
      // Ctrl+Z & Ctrl+Y hooks
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, currentFrame]);

  // Contiguous flood fill algorithm representation
  const applyFloodFill = (startX: number, startY: number, targetCol: string, replaceCol: string, contiguousOnly: boolean) => {
    if (targetCol === replaceCol) return currentFrame.pixels;
    let temp = [...currentFrame.pixels];

    if (!contiguousOnly) {
      // replace all occurrences
      return temp.map(p => p === targetCol ? replaceCol : p);
    }

    // Classic BFS queue container
    const queue: [number, number][] = [[startX, startY]];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) continue;
      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const cellIdx = coordsToIndex(x, y);
      if (cellIdx !== -1 && temp[cellIdx] === targetCol) {
        // Selection mask support
        if (selectedCells.length === 0 || selectedCells.includes(cellIdx)) {
          temp[cellIdx] = replaceCol;
        }
        queue.push([x + 1, y]);
        queue.push([x - 1, y]);
        queue.push([x, y + 1]);
        queue.push([x, y - 1]);
      }
    }
    return temp;
  };

  // Interpolate hex colors to paint smooth gradients
  const interpolateColor = (color1: string, color2: string, factor: number) => {
    // Basic fallback if empty
    const c1 = color1 || '#ffffff';
    const c2 = color2 || '#000000';

    const parseHex = (hex: string) => {
      const clean = hex.replace('#', '');
      const r = parseInt(clean.substring(0, 2), 16) || 0;
      const g = parseInt(clean.substring(2, 4), 16) || 0;
      const b = parseInt(clean.substring(4, 6), 16) || 0;
      return [r, g, b];
    };

    const [r1, g1, b1] = parseHex(c1);
    const [r2, g2, b2] = parseHex(c2);

    const r = Math.round(r1 + factor * (r2 - r1));
    const g = Math.round(g1 + factor * (g2 - g1));
    const b = Math.round(b1 + factor * (b2 - b1));

    const toHex = (val: number) => {
      const hex = Math.max(0, Math.min(255, val)).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // Paint gradient transition across the frame bounding box
  const applyGradient = (x0: number, y0: number, x1: number, y1: number) => {
    const temp = [...dragPixelsSnapshot];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const distanceSq = dx * dx + dy * dy;

    if (distanceSq === 0) return temp;

    for (let r = 0; r < gridHeight; r++) {
      for (let c = 0; c < gridWidth; c++) {
        const cellIdx = coordsToIndex(c, r);
        if (cellIdx === -1) continue;
        if (selectedCells.length > 0 && !selectedCells.includes(cellIdx)) continue;

        // Project vector (c - x0, r - y0) onto dragging vector (dx, dy)
        const dot = (c - x0) * dx + (r - y0) * dy;
        let factor = dot / distanceSq;
        factor = Math.max(0, Math.min(1, factor)); // clamp 0..1

        temp[cellIdx] = interpolateColor(activeColor, secondaryColor, factor);
      }
    }
    return temp;
  };

  // Modify active color index in palette (Shading Mode: lighten/darken)
  const applyShading = (cellIdx: number, type: 'lighten' | 'darken') => {
    const currentColor = currentFrame.pixels[cellIdx] || '#ffffff';
    
    const parse = (hex: string) => {
      const clean = hex.replace('#', '');
      const r = parseInt(clean.substring(0, 2), 16) || 255;
      const g = parseInt(clean.substring(2, 4), 16) || 255;
      const b = parseInt(clean.substring(4, 6), 16) || 255;
      return [r, g, b];
    };

    const [r, g, b] = parse(currentColor);
    const amount = type === 'lighten' ? 1.15 : 0.85;

    const limit = (v: number) => Math.max(0, Math.min(255, Math.round(v * amount)));

    const format = (v: number) => {
      const hex = v.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${format(limit(r))}${format(limit(g))}${format(limit(b))}`;
  };

  // Blur/Average neighbors
  const applyBlur = (cellIdx: number) => {
    const { x, y } = indexToCoords(cellIdx);
    const neighbors = [
      { x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }, { x, y }
    ];

    let rSum = 0, gSum = 0, bSum = 0, count = 0;

    neighbors.forEach(n => {
      const idx = coordsToIndex(n.x, n.y);
      if (idx !== -1) {
        const hex = currentFrame.pixels[idx] || '#14151b';
        const clean = hex.replace('#', '');
        rSum += parseInt(clean.substring(0, 2), 16) || 20;
        gSum += parseInt(clean.substring(2, 4), 16) || 21;
        bSum += parseInt(clean.substring(4, 6), 16) || 27;
        count++;
      }
    });

    const toHexVal = (val: number) => {
      const v = Math.round(val);
      const h = v.toString(16);
      return h.length === 1 ? '0' + h : h;
    };

    return `#${toHexVal(rSum / count)}${toHexVal(gSum / count)}${toHexVal(bSum / count)}`;
  };

  // Jumble/Dither randomized noise
  const applyJumble = (cellIdx: number) => {
    // Introduce light random pixel scatter from custom color
    return Math.random() > 0.4 ? activeColor : '';
  };

  // Triggered when a cell in the grid is clicked/dragged
  const handleCellInteraction = (idx: number, isStarting: boolean) => {
    initializeUndoOnce();
    const { x, y } = indexToCoords(idx);

    // Selection mask block checks
    if (selectedCells.length > 0 && !selectedCells.includes(idx)) {
      if (activeTool !== 'marquee' && activeTool !== 'wand' && activeTool !== 'hand') {
        return; // Clicked outside active selection mask
      }
    }

    if (activeTool === 'eyedropper') {
      const pickedColor = currentFrame.pixels[idx] || '#ffffff';
      setActiveColor(pickedColor);
      return;
    }

    if (activeTool === 'bucket') {
      const targetCol = currentFrame.pixels[idx] || '';
      const result = applyFloodFill(x, y, targetCol, activeColor, contiguousFill);
      commitPixelChanges(result);
      return;
    }

    if (activeTool === 'wand') {
      const targetCol = currentFrame.pixels[idx] || '';
      const wandPixels: number[] = [];
      const queue: [number, number][] = [[x, y]];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const [cx, cy] = queue.shift()!;
        if (cx < 0 || cx >= gridWidth || cy < 0 || cy >= gridHeight) continue;
        const key = `${cx},${cy}`;
        if (visited.has(key)) continue;
        visited.add(key);

        const currentIdx = coordsToIndex(cx, cy);
        if (currentIdx !== -1 && (currentFrame.pixels[currentIdx] || '') === targetCol) {
          wandPixels.push(currentIdx);
          queue.push([cx + 1, cy]);
          queue.push([cx - 1, cy]);
          queue.push([cx, cy + 1]);
          queue.push([cx, cy - 1]);
        }
      }
      setSelectedCells(wandPixels);
      setMarchingAntsActive(true);
      return;
    }

    // Drag-based tools: Line, Rectangle, Ellipse, Gradient, Move, Marquee Selection drag
    if (['line', 'curve', 'rect', 'filled_rect', 'ellipse', 'filled_ellipse', 'gradient', 'move', 'marquee'].includes(activeTool)) {
      if (isStarting) {
        setIsDrawing(true);
        setDragStart({ x, y });
        setDragCurrent({ x, y });
        setDragPixelsSnapshot([...currentFrame.pixels]);

        // Draw 1-pixel initial preview for pixel-drawing shape tools
        if (!['marquee', 'gradient', 'move'].includes(activeTool)) {
          const temp = [...currentFrame.pixels];
          const cIdx = coordsToIndex(x, y);
          if (cIdx !== -1) {
            temp[cIdx] = activeColor;
            updateFramePixelsLive(temp);
          }
        }
      }
      return;
    }

    // Polygon custom click tool
    if (activeTool === 'polygon') {
      const newPoints = [...polygonPoints, { x, y }];
      setPolygonPoints(newPoints);

      // Stroke immediate polygon edges
      if (newPoints.length > 1) {
        const temp = [...currentFrame.pixels];
        for (let i = 0; i < newPoints.length - 1; i++) {
          const lps = getLinePoints(newPoints[i].x, newPoints[i].y, newPoints[i + 1].x, newPoints[i + 1].y);
          lps.forEach(p2 => {
            const idxCell = coordsToIndex(p2.x, p2.y);
            if (idxCell !== -1) temp[idxCell] = activeColor;
          });
        }
        commitPixelChanges(temp);
      }
      return;
    }

    // Direct drawing with Mirror check support & path interpolation for smooth fast drawing
    const strokePoints: { x: number; y: number }[] = [];
    if (!isStarting && dragStart) {
      strokePoints.push(...getLinePoints(dragStart.x, dragStart.y, x, y));
    } else {
      strokePoints.push({ x, y });
    }

    const targetCoords: { x: number; y: number }[] = [];
    strokePoints.forEach(pt => {
      if (pt.x < 0 || pt.x >= gridWidth || pt.y < 0 || pt.y >= gridHeight) return;
      targetCoords.push({ x: pt.x, y: pt.y });
      if (mirrorHorizontal) {
        targetCoords.push({ x: gridWidth - 1 - pt.x, y: pt.y });
      }
      if (mirrorVertical) {
        targetCoords.push({ x: pt.x, y: gridHeight - 1 - pt.y });
      }
      if (mirrorHorizontal && mirrorVertical) {
        targetCoords.push({ x: gridWidth - 1 - pt.x, y: gridHeight - 1 - pt.y });
      }
    });

    // Deduplicate target coordinates to avoid double-processing overlapping mirrors or segments
    const uniqueCoords: { x: number; y: number }[] = [];
    const seenCoords = new Set<string>();
    targetCoords.forEach(c => {
      const key = `${c.x},${c.y}`;
      if (!seenCoords.has(key)) {
        seenCoords.add(key);
        uniqueCoords.push(c);
      }
    });

    let tempPixels = [...currentFrame.pixels];

    if (activeTool === 'pencil') {
      const rad = brushSize;
      uniqueCoords.forEach(coord => {
        for (let ey = -rad + 1; ey < rad; ey++) {
          for (let ex = -rad + 1; ex < rad; ex++) {
            const px = coord.x + ex;
            const py = coord.y + ey;
            
            const curIdx = coordsToIndex(px, py);
            if (curIdx === -1) continue;

            // Pixel perfect filter logic
            if (pixelPerfect && !isStarting && dragStart && rad === 1) {
              const xDiff = Math.abs(coord.x - dragStart.x);
              const yDiff = Math.abs(coord.y - dragStart.y);
              if (xDiff === 1 && yDiff === 1) {
                const neighborA = coordsToIndex(coord.x, dragStart.y);
                const neighborB = coordsToIndex(dragStart.x, coord.y);
                const drawColor = getColorWithOpacity(activeColor, brushOpacity);
                if (tempPixels[neighborA] === drawColor || tempPixels[neighborB] === drawColor) {
                  continue;
                }
              }
            }
            tempPixels[curIdx] = getColorWithOpacity(activeColor, brushOpacity);
          }
        }
      });
      setDragStart({ x, y });
    } else if (activeTool === 'eraser') {
      const rad = eraserSize;
      uniqueCoords.forEach(coord => {
        for (let ey = -rad + 1; ey < rad; ey++) {
          for (let ex = -rad + 1; ex < rad; ex++) {
            const px = coord.x + ex;
            const py = coord.y + ey;
            if (eraserShape === 'round' && (ex * ex + ey * ey >= rad * rad)) continue;

            const eidx = coordsToIndex(px, py);
            if (eidx !== -1) {
              if (selectedCells.length === 0 || selectedCells.includes(eidx)) {
                // If opacity is 100, full erase, else we could blend, but simple clear is standard for now unless we do complex color math
                tempPixels[eidx] = '';
              }
            }
          }
        }
      });
      setDragStart({ x, y });
    } else if (activeTool === 'shading') {
      uniqueCoords.forEach(coord => {
        const curIdx = coordsToIndex(coord.x, coord.y);
        if (curIdx !== -1) tempPixels[curIdx] = applyShading(curIdx, 'lighten');
      });
      setDragStart({ x, y });
    } else if (activeTool === 'blur') {
      uniqueCoords.forEach(coord => {
        const curIdx = coordsToIndex(coord.x, coord.y);
        if (curIdx !== -1) tempPixels[curIdx] = applyBlur(curIdx);
      });
      setDragStart({ x, y });
    } else if (activeTool === 'jumble') {
      uniqueCoords.forEach(coord => {
        const curIdx = coordsToIndex(coord.x, coord.y);
        if (curIdx !== -1) tempPixels[curIdx] = applyJumble(curIdx);
      });
      setDragStart({ x, y });
    }

    if (isStarting) {
      setIsDrawing(true);
      setDragStart({ x, y });
      setDragPixelsSnapshot([...currentFrame.pixels]);
      commitPixelChanges(tempPixels);
    } else {
      updateFramePixelsLive(tempPixels);
    }
  };

  // Drag moving / updating handler
  const handleMouseDragMove = (idx: number) => {
    if (!isDrawing || !dragStart) return;
    const { x, y } = indexToCoords(idx);
    setDragCurrent({ x, y });

    let temp = [...dragPixelsSnapshot];

    if (activeTool === 'line') {
      const linePts = getLinePoints(dragStart.x, dragStart.y, x, y);
      linePts.forEach(p => {
        const cIdx = coordsToIndex(p.x, p.y);
        if (cIdx !== -1) temp[cIdx] = activeColor;
      });
    } else if (activeTool === 'curve') {
      const curvePts = getCurvePoints(dragStart.x, dragStart.y, x, y);
      curvePts.forEach(p => {
        const cIdx = coordsToIndex(p.x, p.y);
        if (cIdx !== -1) temp[cIdx] = activeColor;
      });
    } else if (activeTool === 'rect') {
      const rectPts = getRectPoints(dragStart.x, dragStart.y, x, y, false);
      rectPts.forEach(p => {
        const cIdx = coordsToIndex(p.x, p.y);
        if (cIdx !== -1) temp[cIdx] = activeColor;
      });
    } else if (activeTool === 'filled_rect') {
      const rectPts = getRectPoints(dragStart.x, dragStart.y, x, y, true);
      rectPts.forEach(p => {
        const cIdx = coordsToIndex(p.x, p.y);
        if (cIdx !== -1) temp[cIdx] = activeColor;
      });
    } else if (activeTool === 'ellipse') {
      const ellPts = getEllipsePoints(dragStart.x, dragStart.y, x, y, false);
      ellPts.forEach(p => {
        const cIdx = coordsToIndex(p.x, p.y);
        if (cIdx !== -1) temp[cIdx] = activeColor;
      });
    } else if (activeTool === 'filled_ellipse') {
      const ellPts = getEllipsePoints(dragStart.x, dragStart.y, x, y, true);
      ellPts.forEach(p => {
        const cIdx = coordsToIndex(p.x, p.y);
        if (cIdx !== -1) temp[cIdx] = activeColor;
      });
    } else if (activeTool === 'gradient') {
      temp = applyGradient(dragStart.x, dragStart.y, x, y);
    } else if (activeTool === 'move') {
      // Moves matching frame offset
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;
      temp = Array(gridWidth * gridHeight).fill('');

      for (let r = 0; r < gridHeight; r++) {
        for (let c = 0; c < gridWidth; c++) {
          const oldIdx = r * gridWidth + c;
          const newIdx = coordsToIndex(c + dx, r + dy);
          if (newIdx !== -1 && oldIdx >= 0 && oldIdx < dragPixelsSnapshot.length) {
            temp[newIdx] = dragPixelsSnapshot[oldIdx];
          }
        }
      }
    } else if (activeTool === 'marquee') {
      // Just visually selects range
      const minX = Math.min(dragStart.x, x);
      const maxX = Math.max(dragStart.x, x);
      const minY = Math.min(dragStart.y, y);
      const maxY = Math.max(dragStart.y, y);

      const mCells: number[] = [];
      for (let r = minY; r <= maxY; r++) {
        for (let c = minX; c <= maxX; c++) {
          const selectIdx = coordsToIndex(c, r);
          if (selectIdx !== -1) mCells.push(selectIdx);
        }
      }
      setSelectedCells(mCells);
      setMarchingAntsActive(true);
      return;
    }

    // Preview cell colors live on top of grid
    const updatedFrames = [...frames];
    const frameToEdit = { ...currentFrame };
    frameToEdit.pixels = temp;
    updatedFrames[currentFrameIdx] = frameToEdit;

    onUpdateObject({
      ...selectedObject,
      frames: updatedFrames
    });
  };

  // Releasing mouse button commits drawn vectors
  const handleMouseDragEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setDragStart(null);
    setDragCurrent(null);

    // Save drawn stroke step directly into Undo list
    saveActionToUndo(currentFrame.pixels);

    // Force commit to parent state
    const updatedFrames = [...frames];
    const frameToEdit = { ...currentFrame };
    frameToEdit.pixels = [...currentFrame.pixels];
    updatedFrames[currentFrameIdx] = frameToEdit;

    onUpdateObject({
      ...selectedObject,
      frames: updatedFrames
    });
  };

  const handleFinishPolygon = () => {
    if (polygonPoints.length < 3) {
      alert("Adicione ao menos 3 pontos clicando para fechar o polígono.");
      return;
    }
    // Draw closing edge line
    const temp = [...currentFrame.pixels];
    const lps = getLinePoints(polygonPoints[polygonPoints.length - 1].x, polygonPoints[polygonPoints.length - 1].y, polygonPoints[0].x, polygonPoints[0].y);
    lps.forEach(p => {
      const idxCell = coordsToIndex(p.x, p.y);
      if (idxCell !== -1) temp[idxCell] = activeColor;
    });

    setPolygonPoints([]);
    commitPixelChanges(temp);
  };

  const clearSelection = () => {
    setSelectedCells([]);
    setMarchingAntsActive(false);
  };

  const handleCropCanvas = () => {
    initializeUndoOnce();
    
    // Choose which indices define the crop bounds
    let targetIdxs: number[] = [];
    if (selectedCells.length > 0) {
      targetIdxs = [...selectedCells];
    } else {
      // Find all colored pixel indices in the current frame
      currentFrame.pixels.forEach((color, idx) => {
        if (color) targetIdxs.push(idx);
      });
    }

    if (targetIdxs.length === 0) {
      alert("Não há pixels coloridos ou seleção ativa para recortar!");
      return;
    }

    // Find min/max X and Y of target indices
    let minX = gridWidth;
    let maxX = -1;
    let minY = gridHeight;
    let maxY = -1;

    targetIdxs.forEach(idx => {
      const { x, y } = indexToCoords(idx);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    const newWidth = maxX - minX + 1;
    const newHeight = maxY - minY + 1;

    if (newWidth <= 0 || newHeight <= 0) return;

    // Create a new pixels array with the cropped dimensions
    const croppedPixels = Array(newWidth * newHeight).fill('');
    for (let ny = 0; ny < newHeight; ny++) {
      for (let nx = 0; nx < newWidth; nx++) {
        const oldX = minX + nx;
        const oldY = minY + ny;
        const oldIdx = coordsToIndex(oldX, oldY);
        const newIdx = ny * newWidth + nx;
        if (oldIdx !== -1) {
          croppedPixels[newIdx] = currentFrame.pixels[oldIdx] || '';
        }
      }
    }

    // Update dimensions and pixel arrays on all frames
    const updatedFrames = frames.map((f, fIdx) => {
      if (fIdx === currentFrameIdx) {
        return {
          ...f,
          width: newWidth,
          height: newHeight,
          pixels: croppedPixels
        };
      }
      const otherCrop = Array(newWidth * newHeight).fill('');
      for (let ny = 0; ny < newHeight; ny++) {
        for (let nx = 0; nx < newWidth; nx++) {
          const oldX = minX + nx;
          const oldY = minY + ny;
          const oldIdx = oldY * gridWidth + oldX;
          const newIdx = ny * newWidth + nx;
          if (oldX >= 0 && oldX < gridWidth && oldY >= 0 && oldY < gridHeight) {
            otherCrop[newIdx] = f.pixels[oldIdx] || '';
          }
        }
      }
      return {
        ...f,
        width: newWidth,
        height: newHeight,
        pixels: otherCrop
      };
    });

    setGridWidth(newWidth);
    setGridHeight(newHeight);
    setCustomWInput(newWidth.toString());
    setCustomHInput(newHeight.toString());
    setSelectedCells([]);
    setUndoStack([[...croppedPixels]]);
    setRedoStack([]);

    onUpdateObject({
      ...selectedObject,
      frames: updatedFrames
    });

    alert(`Recortado com sucesso para ${newWidth}x${newHeight} pixels!`);
  };

  // Canvas utility controls
  const handleAddFrame = () => {
    const newFrameId = 'frame_' + Math.random().toString(36).substr(2, 9);
    const newFrame: SpriteFrame = {
      id: newFrameId,
      width: gridSize,
      height: gridSize,
      pixels: Array(gridSize * gridSize).fill('')
    };

    onUpdateObject({
      ...selectedObject,
      frames: [...frames, newFrame]
    });
    setCurrentFrameIdx(frames.length);
  };

  const handleDuplicateFrame = (indexToDuplicate: number) => {
    const frameToDuplicate = frames[indexToDuplicate];
    if (!frameToDuplicate) return;
    const newFrameId = 'frame_' + Math.random().toString(36).substr(2, 9);
    const newFrame: SpriteFrame = {
      id: newFrameId,
      width: frameToDuplicate.width || gridSize,
      height: frameToDuplicate.height || gridSize,
      pixels: [...frameToDuplicate.pixels]
    };

    const newFrames = [...frames];
    newFrames.splice(indexToDuplicate + 1, 0, newFrame);

    onUpdateObject({
      ...selectedObject,
      frames: newFrames
    });
    setCurrentFrameIdx(indexToDuplicate + 1);
  };

  const handleDeleteFrame = (idxToDelete: number) => {
    if (frames.length <= 1) return;
    const remaining = frames.filter((_, idx) => idx !== idxToDelete);
    onUpdateObject({
      ...selectedObject,
      frames: remaining
    });
    setCurrentFrameIdx(Math.max(0, idxToDelete - 1));
  };

  const handleClearFrame = () => {
    const emptyPixels = Array(gridSize * gridSize).fill('');
    commitPixelChanges(emptyPixels);
  };

  const handleResizeGrid = (newSize: number) => {
    setGridSize(newSize);
    const emptyPixels = Array(newSize * newSize).fill('');
    
    // Rescale all frames and register
    const updatedFrames = frames.map(f => ({
      ...f,
      width: newSize,
      height: newSize,
      pixels: emptyPixels
    }));

    onUpdateObject({
      ...selectedObject,
      frames: updatedFrames
    });

    setUndoStack([emptyPixels]);
    setRedoStack([]);
  };

  const onionFrame = currentFrameIdx > 0 ? frames[currentFrameIdx - 1] : null;

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0c0d12] relative select-none" id="pixel_editor_root" onMouseUp={handleMouseDragEnd}>
      
      {/* 1. LEFT TOOLBAR: EXHILARATING SELECTION OF GRAPHIC ENGINES */}
      <div className="w-16 bg-[#161720] border-r border-[#262732] flex flex-col items-center py-3 space-y-2 overflow-y-auto shrink-0 select-none">
        
        {/* Draw tools */}
        <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">Pintar</span>

        <button
          onClick={() => { setActiveTool('pencil'); clearSelection(); }}
          className={`p-2 rounded-lg transition-colors relative ${
            activeTool === 'pencil' ? 'bg-indigo-600 text-white shadow-md font-bold' : 'text-gray-400 hover:bg-slate-800'
          }`}
          title="Lápis (Pinta de forma livre)"
        >
          <Paintbrush className="w-4.5 h-4.5" />
          {activeTool === 'pencil' && <span className="absolute left-0 top-1 w-1 h-6 bg-indigo-400 rounded-full" />}
        </button>

        <button
          onClick={() => { setActiveTool('shading'); clearSelection(); }}
          className={`p-2 rounded-lg transition-colors relative ${
            activeTool === 'shading' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-slate-800'
          }`}
          title="Modo Sombreamento (Luminância gradativa)"
        >
          <Sparkle className="w-4.5 h-4.5 text-yellow-400" />
        </button>

        <button
          onClick={() => { setActiveTool('eraser'); clearSelection(); }}
          className={`p-2 rounded-lg transition-colors ${
            activeTool === 'eraser' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-slate-800'
          }`}
          title="Borracha (Apaga pixels)"
        >
          <Eraser className="w-4.5 h-4.5" />
        </button>

        <button
          onClick={() => { setActiveTool('bucket'); clearSelection(); }}
          className={`p-2 rounded-lg transition-colors ${
            activeTool === 'bucket' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-slate-800'
          }`}
          title="Balde de Tinta (Preenche adjacentes)"
        >
          <Combine className="w-4.5 h-4.5" />
        </button>

        <button
          onClick={() => { setActiveTool('gradient'); clearSelection(); }}
          className={`p-2 rounded-lg transition-colors ${
            activeTool === 'gradient' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-slate-800'
          }`}
          title="Gradiente (Arraste do pixel A ao B no canvas)"
        >
          <TrendingUp className="w-4.5 h-4.5 text-sky-400" />
        </button>

        <button
          onClick={() => { setActiveTool('blur'); clearSelection(); }}
          className={`p-2 rounded-lg transition-colors ${
            activeTool === 'blur' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-slate-800'
          }`}
          title="Desfoque (Suaviza cores vizinhas)"
        >
          <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
        </button>

        <button
          onClick={() => { setActiveTool('jumble'); clearSelection(); }}
          className={`p-2 rounded-lg transition-colors ${
            activeTool === 'jumble' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-slate-800'
          }`}
          title="Mistura (Textura pontilhada de dither)"
        >
          <Sliders className="w-4.5 h-4.5 text-emerald-400" />
        </button>

        <div className="h-[1px] w-8 bg-slate-800"></div>

        {/* Geometry tools */}
        <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">Formas</span>

        <button
          onClick={() => { setActiveTool('line'); clearSelection(); }}
          className={`p-2 rounded-lg transition-colors ${
            activeTool === 'line' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-slate-800'
          }`}
          title="Linha Reta"
        >
          <span className="text-xs font-bold font-mono">/</span>
        </button>

        <button
          onClick={() => { setActiveTool('curve'); clearSelection(); }}
          className={`p-2 rounded-lg transition-colors ${
            activeTool === 'curve' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-slate-800'
          }`}
          title="Curva (Arraste para traçar curvas)"
        >
          <span className="text-xs font-bold font-mono">~</span>
        </button>

        <button
          onClick={() => { setActiveTool('rect'); clearSelection(); }}
          className={`p-2 rounded-lg transition-colors ${
            activeTool === 'rect' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-slate-805'
          }`}
          title="Retângulo Vazado"
        >
          <Square className="w-4 h-4" />
        </button>

        <button
          onClick={() => { setActiveTool('filled_rect'); clearSelection(); }}
          className={`p-2 bg-slate-850 rounded-lg transition-colors border ${
            activeTool === 'filled_rect' ? 'border-indigo-500 text-white bg-indigo-600/30' : 'border-transparent text-gray-400'
          }`}
          title="Retângulo Preenchido"
        >
          <div className="w-3.5 h-3.5 bg-slate-400 rounded-sm" />
        </button>

        <button
          onClick={() => { setActiveTool('ellipse'); clearSelection(); }}
          className={`p-2 rounded-lg transition-colors ${
            activeTool === 'ellipse' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400'
          }`}
          title="Elipse Vazada"
        >
          <Circle className="w-4 h-4" />
        </button>

        <button
          onClick={() => { setActiveTool('filled_ellipse'); clearSelection(); }}
          className={`p-2 bg-slate-850 rounded-lg transition-colors border ${
            activeTool === 'filled_ellipse' ? 'border-indigo-500 text-white bg-indigo-600/30' : 'border-transparent text-gray-400'
          }`}
          title="Elipse Preenchida"
        >
          <div className="w-3.5 h-3.5 bg-slate-400 rounded-full" />
        </button>

        <button
          onClick={() => { setActiveTool('polygon'); clearSelection(); }}
          className={`p-2 text-[10px] uppercase font-mono font-bold rounded-lg transition-colors ${
            activeTool === 'polygon' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-slate-800'
          }`}
          title="Polígono (Clique nos vértices consecutivamente)"
        >
          Poli
        </button>

        <div className="h-[1px] w-8 bg-slate-800"></div>

        {/* Selection tools */}
        <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">Seleção</span>

        <button
          onClick={() => setActiveTool('marquee')}
          className={`p-2 rounded-lg transition-colors ${
            activeTool === 'marquee' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-slate-800'
          }`}
          title="Seleção Retangular"
        >
          <Scissors className="w-4 h-4" />
        </button>

        <button
          onClick={() => setActiveTool('wand')}
          className={`p-2 rounded-lg transition-colors ${
            activeTool === 'wand' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-slate-800'
          }`}
          title="Varinha Mágica (Seleciona cores contíguas)"
        >
          <Sparkle className="w-4 h-4 text-purple-400" />
        </button>

        <button
          onClick={() => { setActiveTool('move'); }}
          className={`p-2 rounded-lg transition-colors ${
            activeTool === 'move' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-slate-800'
          }`}
          title="Mover (Arraste para deslocar pixels. Segure Ctrl para duplicar)"
        >
          <Move className="w-4.5 h-4.5" />
        </button>

        <div className="h-[1px] w-8 bg-slate-800"></div>

        {/* Navigation tools */}
        <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">Apoio</span>

        <button
          onClick={() => setActiveTool('eyedropper')}
          className={`p-2 rounded-lg transition-colors ${
            activeTool === 'eyedropper' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-slate-800'
          }`}
          title="Conta-gotas (Extrai cor do canvas)"
        >
          <Pipette className="w-4.5 h-4.5 text-pink-400" />
        </button>

        <button
          onClick={() => setActiveTool('hand')}
          className={`p-2 rounded-lg transition-colors ${
            activeTool === 'hand' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-slate-800'
          }`}
          title="Panorâmica / Mão"
        >
          <Hand className="w-4.5 h-4.5" />
        </button>

      </div>

      {/* DRAWING ZONE & HEADER OPTIONS CONTEXT */}
      <div className="flex-1 flex flex-col justify-stretch min-w-0">
        
        {/* TOP LEVEL ACTION OPTIONS BAR */}
        <div className="h-14 bg-[#12131a] border-b border-[#262732] px-4 flex items-center justify-between shrink-0 select-none">
          
          <div className="flex items-center gap-3">
            {/* UNDO / REDO CONTROLS */}
            <button
              onClick={handleUndo}
              disabled={undoStack.length <= 1}
              className="p-1.5 px-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300 rounded border border-slate-700/60 shadow-inner flex items-center gap-1 font-semibold text-[10px]"
              title="Desfazer Ação (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" /> Desfazer
            </button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="p-1.5 px-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300 rounded border border-slate-700/60 shadow-inner flex items-center gap-1 font-semibold text-[10px]"
              title="Refazer Ação (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" /> Refazer
            </button>

            <div className="h-5 w-[1px] bg-slate-800 mx-1"></div>

            {/* Selection Info Indicator */}
            {selectedCells.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-amber-950 border border-amber-800 font-mono text-amber-400 px-2 py-0.5 rounded">
                  {selectedCells.length} pixels selecionados
                </span>
                <button
                  onClick={clearSelection}
                  className="text-[9px] text-[#ec4899] hover:underline"
                >
                  Deselecionar
                </button>
              </div>
            )}

            {/* Polygon creator helper */}
            {activeTool === 'polygon' && polygonPoints.length > 0 && (
              <button
                onClick={handleFinishPolygon}
                className="bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded text-[10px] text-white font-bold"
              >
                Concluir Polígono ({polygonPoints.length} vértices)
              </button>
            )}
          </div>
          
          {/* Resize controller sizes */}
          <div className="flex items-center gap-3">
            {/* Toggle Grid Lines */}
            <button
              onClick={() => setShowGridLines(!showGridLines)}
              className={`p-1 px-2 rounded text-[9px] font-bold flex items-center gap-1 transition-all border ${
                showGridLines ? 'bg-indigo-600/90 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-gray-400 hover:text-white'
              }`}
              title="Mostrar Linhas da Grade"
            >
              <Grid className="w-3 h-3" /> Grade
            </button>

            {/* Mirror options */}
            <div className="flex bg-[#090a0f] rounded p-1 border border-slate-800 gap-1.5 items-center">
              <span className="text-[9px] text-indigo-400 font-semibold px-1">Espelho:</span>
              <button
                onClick={() => setMirrorHorizontal(prev => !prev)}
                className={`text-[9px] px-2 py-0.5 rounded font-semibold transition-all ${
                  mirrorHorizontal ? 'bg-indigo-600/90 text-white font-bold' : 'bg-slate-900 border border-slate-800 text-gray-400 hover:text-white'
                }`}
                title="Espelhamento Horizontal"
              >
                H
              </button>
              <button
                onClick={() => setMirrorVertical(prev => !prev)}
                className={`text-[9px] px-2 py-0.5 rounded font-semibold transition-all ${
                  mirrorVertical ? 'bg-indigo-600/90 text-white font-bold' : 'bg-slate-900 border border-slate-800 text-gray-400 hover:text-white'
                }`}
                title="Espelhamento Vertical"
              >
                V
              </button>
            </div>

            {/* Custom dimensions and crop */}
            <div className="flex items-center gap-1.5 bg-[#090a0f]/95 p-1 rounded border border-slate-800 shrink-0">
              <span className="text-[9px] text-indigo-400 font-semibold px-2">Dimensões:</span>
              <input
                type="number"
                value={customWInput}
                onChange={(e) => setCustomWInput(e.target.value)}
                className="w-10 bg-slate-900 border border-slate-800 text-[10px] text-center text-white rounded p-0.5 font-mono"
                placeholder="W"
                title="Largura Personalizada"
              />
              <span className="text-[9px] text-gray-400 font-bold font-mono">x</span>
              <input
                type="number"
                value={customHInput}
                onChange={(e) => setCustomHInput(e.target.value)}
                className="w-10 bg-slate-900 border border-slate-800 text-[10px] text-center text-white rounded p-0.5 font-mono"
                placeholder="H"
                title="Altura Personalizada"
              />
              <button
                onClick={() => {
                  const w = parseInt(customWInput);
                  const h = parseInt(customHInput);
                  if (w > 0 && h > 0) {
                    setGridWidth(w);
                    setGridHeight(h);
                    const emptyPixels = Array(w * h).fill('');
                    const updatedFrames = frames.map(f => ({
                      ...f,
                      width: w,
                      height: h,
                      pixels: emptyPixels
                    }));
                    onUpdateObject({
                      ...selectedObject,
                      frames: updatedFrames
                    });
                    setUndoStack([emptyPixels]);
                    setRedoStack([]);
                    alert(`Canvas redimensionado com sucesso para ${w}x${h}!`);
                  }
                }}
                className="p-1 px-1.5 bg-indigo-600 hover:bg-indigo-700 text-[9px] text-white rounded font-bold transition-all"
                title="Aplicar novo tamanho vazio"
              >
                Novo
              </button>

              <button
                onClick={handleCropCanvas}
                className="p-1 px-2 bg-[#ec4899] hover:bg-pink-600 text-[9px] text-white rounded font-bold transition-all flex items-center gap-0.5 border border-pink-500 cursor-pointer"
                title="Recorta o canvas para a seleção (ou limites de pixels desenhados)"
              >
                <Crop className="w-3 h-3 text-white" /> Recortar
              </button>
            </div>

            <span className="text-[10px] text-slate-400 font-bold font-mono bg-[#090a0f] p-1 px-2 border border-slate-800 rounded">
              Atual: {gridWidth}x{gridHeight}
            </span>

            <span className="text-[10px] text-gray-400 font-semibold ml-2">Presets:</span>
            <div className="flex bg-[#090a0f] rounded p-0.5 border border-slate-850">
              {[8, 16, 32].map(sz => (
                <button
                  key={sz}
                  onClick={() => handleResizeGrid(sz)}
                  className={`text-[10px] px-2.5 py-1 rounded font-mono transition-all ${
                    gridSize === sz ? 'bg-indigo-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {sz}x{sz}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CONTEXT-SENSITIVE TOOL SUB-BAR (DYN OPTIONS) */}
        <div className="h-10 bg-[#161720]/80 border-b border-[#262732]/80 px-4 flex items-center gap-4 text-xs font-mono text-slate-300">
          
          {activeTool === 'pencil' && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={pixelPerfect}
                onChange={(e) => setPixelPerfect(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-600 bg-slate-900 border-slate-800"
              />
              <span className="text-[10px] text-gray-300">Pixel Perfect (Evita quinas duplas)</span>
            </label>
          )}

          {activeTool === 'pencil' && (
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-gray-400">Tamanho do Lápis:</span>
              <input
                type="range"
                min="1"
                max="4"
                step="1"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-16 accent-indigo-500"
              />
              <span className="text-indigo-400">{brushSize}px</span>

              <div className="w-[1px] h-4 bg-slate-800 mx-1"></div>

              <span className="text-gray-400">Opacidade:</span>
              <input
                type="range"
                min="10"
                max="100"
                step="10"
                value={brushOpacity}
                onChange={(e) => setBrushOpacity(parseInt(e.target.value))}
                className="w-16 accent-indigo-500"
              />
              <span className="text-indigo-400">{brushOpacity}%</span>
            </div>
          )}

          {activeTool === 'eraser' && (
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-gray-400">Pincel da Borracha:</span>
              <button
                onClick={() => setEraserShape('square')}
                className={`px-2 py-0.5 rounded border ${eraserShape === 'square' ? 'bg-indigo-600 border-indigo-700 text-white font-bold' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
              >
                Quadrado ⬜
              </button>
              <button
                onClick={() => setEraserShape('round')}
                className={`px-2 py-0.5 rounded border ${eraserShape === 'round' ? 'bg-indigo-600 border-indigo-700 text-white font-bold' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
              >
                Redondo ⚪
              </button>

              <span className="text-gray-400 ml-1">Tamanho:</span>
              <input
                type="range"
                min="1"
                max="4"
                step="1"
                value={eraserSize}
                onChange={(e) => setEraserSize(parseInt(e.target.value))}
                className="w-16 accent-indigo-500"
              />
              <span className="text-indigo-400">{eraserSize}px</span>
            </div>
          )}

          {activeTool === 'bucket' && (
            <label className="flex items-center gap-1.5 cursor-pointer text-[10px]">
              <input
                type="checkbox"
                checked={contiguousFill}
                onChange={(e) => setContiguousFill(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-0 bg-slate-900 border-slate-800"
              />
              <span>Apenas adjacentes contíguos (Flood Fill)</span>
            </label>
          )}

          {activeTool === 'gradient' && (
            <div className="text-[10px] text-gray-300 flex items-center gap-2">
              <span>Modo Degradê Ativo. Arraste do pixel inicial ao pixel final para interpolar.</span>
            </div>
          )}

          {['line', 'curve', 'rect', 'ellipse', 'filled_rect', 'filled_ellipse'].includes(activeTool) && (
            <span className="text-[10px] text-[#818cf8]">Clique e arraste sobre o grid para traçar a forma geométrica.</span>
          )}

          {activeTool === 'polygon' && (
            <span className="text-[10px] text-orange-400 animate-pulse">Cada clique adiciona uma reta na forma. Conclua no botão acima.</span>
          )}

          {activeTool === 'marquee' && (
            <span className="text-[10px] text-amber-400">Determine a área livre no grid arrastando o mouse.</span>
          )}

          {activeTool === 'move' && (
            <span className="text-[10px] text-slate-400">Clique e arraste para projetar pixels deslocadamente.</span>
          )}

          {activeTool === 'hand' && (
            <span className="text-[10px] text-slate-400">Arraste para rotacionar/deslocar a câmera do canvas.</span>
          )}
        </div>

        {/* CENTRAL CANVAS GRID DRAWING CONTAINER */}
        <div className="flex-1 flex items-center justify-center p-6 bg-[#090a0f] relative overflow-hidden" id="pixel_stage_viewport">
          
          {/* Zoom & navigation widgets */}
          <div className="absolute right-4 bottom-4 bg-[#12131a] border border-slate-800 rounded-lg p-1.5 flex flex-col gap-1.5 shadow-xl shrink-0 z-10 select-none">
            <button
              onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.5))}
              className="p-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-xs text-white rounded font-bold flex items-center gap-1"
              title="Aproximar visualização"
            >
              <ZoomIn className="w-3.5 h-3.5 text-indigo-400" /> +
            </button>
            <button
              onClick={() => { setZoomLevel(prev => Math.max(1, prev - 0.5)); setPanX(0); setPanY(0); }}
              className="p-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-xs text-white rounded font-bold flex items-center gap-1"
              title="Afastar"
            >
              <ZoomOut className="w-3.5 h-3.5 text-indigo-400" /> -
            </button>
            <button
              onClick={() => { setZoomLevel(1); setPanX(0); setPanY(0); }}
              className="p-1 text-[8px] bg-slate-800 hover:bg-slate-700 text-gray-400 rounded text-center"
            >
              Focar
            </button>
          </div>

          <div 
            className="transition-transform duration-100 ease-out p-3 bg-[#161720] border-2 border-slate-800 rounded-xl shadow-2xl relative select-none"
            style={{
              transform: `scale(${zoomLevel}) translate(${panX}px, ${panY}px)`,
            }}
          >
            {/* Grid layout */}
            {(() => {
              const cellSize = Math.max(4, Math.min(48, Math.floor(400 / Math.max(gridWidth, gridHeight))));
              const width = gridWidth * cellSize;
              const height = gridHeight * cellSize;
              return (
                <canvas
                  ref={editorCanvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseLeave}
                  style={{ 
                    width: `${width}px`,
                    height: `${height}px`,
                    backgroundImage: 'linear-gradient(45deg, #181921 25%, transparent 25%), linear-gradient(-45deg, #181921 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #181921 75%), linear-gradient(-45deg, transparent 75%, #181921 75%)',
                    backgroundSize: '12px 12px',
                    backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
                    backgroundColor: '#14151b'
                  }}
                  className="block cursor-crosshair select-none bg-slate-900 shadow-inner rounded-md"
                />
              );
            })()}
          </div>
        </div>

        {/* ANIMATION FRAME TIMELINE BAR */}
        <div className="h-20 bg-[#12131a] border-t border-[#262732] px-4 flex items-center gap-3 shrink-0">
          <div className="flex flex-col justify-center gap-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-1 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg active:scale-95 transition-all text-xs flex items-center gap-1 font-bold"
              >
                {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {isPlaying ? 'Pausar' : 'Animar'}
              </button>
              <button
                onClick={handleAddFrame}
                className="p-1 px-2 bg-[#1b1c28] border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg text-xs flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3 h-3" /> Novo
              </button>
            </div>
            <div className="flex items-center gap-2 mt-0.5" title="Velocidade de Animação / Frames Por Segundo">
              <span className="text-[9px] text-gray-500 font-bold uppercase">VELOCIDADE DE ANIMAÇÃO (FPS)</span>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={fps}
                onChange={(e) => setFps(parseInt(e.target.value))}
                className="w-16 accent-indigo-500 cursor-pointer"
              />
              <span className="text-[9px] text-indigo-400 font-mono font-bold w-4">{fps}</span>
            </div>
          </div>

          <div className="h-10 w-[1px] bg-slate-850 mx-2"></div>

          {/* Timeline frames block scroll */}
          <div className="flex-1 overflow-x-auto flex items-center gap-2 py-2 select-none">
            {frames.map((frame, index) => {
              const isSelected = index === currentFrameIdx;
              const isDragging = index === draggedFrameIdx;
              return (
                <div
                  key={frame.id}
                  draggable
                  onDragStart={(e) => handleFrameDragStart(e, index)}
                  onDragOver={handleFrameDragOver}
                  onDrop={(e) => handleFrameDrop(e, index)}
                  onClick={() => setCurrentFrameIdx(index)}
                  className={`flex-none w-14 h-14 rounded-lg bg-[#212330] p-1 border cursor-move relative group transition-transform ${
                    isSelected ? 'border-indigo-500 ring-2 ring-indigo-950 shadow-md scale-102' : 'border-slate-800 hover:border-slate-700'
                  } ${isDragging ? 'opacity-30' : 'opacity-100'}`}
                >
                  {/* Miniature canvas */}
                  <div className="w-full h-full bg-[#1c1d27] rounded overflow-hidden flex items-center justify-center p-0.5 relative select-none">
                    <FrameThumbnail 
                      pixels={frame.pixels}
                      gridWidth={frame.width || gridSize || 8}
                      gridHeight={frame.height || gridSize || 8}
                    />
                  </div>

                  <span className="absolute bottom-0 right-0 bg-indigo-805 text-[7px] text-gray-300 px-1 font-mono rounded-tl-md">
                    #{index + 1}
                  </span>

                  {/* Duplicate Frame Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateFrame(index);
                    }}
                    className="absolute -top-1 -left-1 bg-indigo-600 hover:bg-indigo-500 p-0.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity active:scale-90 shadow"
                    title="Duplicar Frame"
                  >
                    <Copy className="w-3 h-3" />
                  </button>

                  {/* Quick delete frame overlay */}
                  {frames.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFrame(index);
                      }}
                      className="absolute -top-1 -right-1 bg-rose-600 hover:bg-rose-700 p-0.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity active:scale-90"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. RIGHT PANEL: SWATCH PALETTE SELECTION & DEGRADÊ CONTROLLER */}
      <div className="w-60 bg-[#161720] border-l border-[#262732] p-4 flex flex-col justify-between shrink-0 select-none overflow-y-auto">
        <div className="space-y-4">
          <span className="text-xs font-bold text-slate-400 tracking-wider block">PALETA DE CORES</span>
          
          <div className="grid grid-cols-4 gap-2">
            {PALETTE_COLORS.map((c, i) => (
              <div
                key={i}
                onClick={() => {
                  setActiveColor(c);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSecondaryColor(c);
                }}
                className={`w-10 h-10 rounded-md cursor-pointer border-2 transition-all relative ${
                  activeColor === c ? 'border-white scale-105 shadow-md' : 'border-slate-800 hover:border-gray-500'
                }`}
                style={{ backgroundColor: c }}
                title="Clique esquerdo: Cor Principal | Clique direito: Cor Secundária"
              >
                {secondaryColor === c && (
                  <div className="absolute left-1 top-1 w-2 h-2 rounded bg-indigo-400 border border-slate-900" title="Secundária" />
                )}
                {activeColor === c && (
                  <div className="absolute right-0.5 bottom-0.5 w-2.5 h-2.5 rounded-full bg-white flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Color previews slot */}
          <div className="bg-[#1b1c28] p-3 rounded-lg border border-slate-800 space-y-2">
            <span className="text-[10px] font-bold text-gray-400 block uppercase">Amostras Ativas</span>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center">
                <span className="text-[8px] text-yellow-500 font-bold">Principal</span>
                <div className="w-10 h-10 rounded-md border border-slate-700" style={{ backgroundColor: activeColor }} />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[8px] text-indigo-400 font-bold">Secundária</span>
                <div className="w-10 h-10 rounded-md border border-slate-700" style={{ backgroundColor: secondaryColor }} />
              </div>
              <button 
                onClick={() => {
                  const temp = activeColor;
                  setActiveColor(secondaryColor);
                  setSecondaryColor(temp);
                }}
                className="p-1 bg-slate-800 hover:bg-slate-750 rounded text-[9px] text-[#818cf8] border border-slate-700/60 font-semibold"
                title="Inverter cores"
              >
                Inverter ⇅
              </button>
            </div>
            <p className="text-[9px] text-gray-505 leading-normal mt-1">
              * Clique esquerdo para definir Principal. Clique direito em uma cor da paleta para definir a Secundária.
            </p>
          </div>
        </div>

        <div className="bg-indigo-950/20 border border-indigo-900/40 rounded p-2.5 mt-2">
          <span className="text-[10px] font-bold text-indigo-400 block mb-1">Dica de Sombreamento:</span>
          <p className="text-[9px] text-gray-400 leading-normal">
            No <strong>Modo Sombra</strong>, ao pintar, a cor do pixel adjacente aumentará dinamicamente de brilho, perfeito para polimento rápido de 8-Bit!
          </p>
        </div>
      </div>
    </div>
  );
}
