import type { Scene, TileDef } from '../../types';
import type { LiveInstance, UITextElement } from '../types';
import { Camera } from '../core/Camera';
import { AnimationSystem } from './AnimationSystem';

const TILE_DEFS: TileDef[] = [
  { id: 1, color: '#10b981', solid: true, name: 'Grama' },
  { id: 2, color: '#0ea5e9', solid: false, name: 'Água (Fluída)' },
  { id: 3, color: '#d97706', solid: true, name: 'Tijolo Sólido' },
  { id: 4, color: '#ef4444', solid: true, name: 'Lava Aquecida' },
];

export class RenderSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  private globalTime = 0;
  private backgroundColor = '#0f1015';
  private uiElements: UITextElement[] = [];

  constructor(canvas: HTMLCanvasElement, camera: Camera) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
    this.camera = camera;
  }

  setBackgroundColor(color: string) {
    this.backgroundColor = color;
  }

  setGlobalTime(time: number) {
    this.globalTime = time;
  }

  addUIElement(el: UITextElement) {
    this.uiElements.push(el);
  }

  removeUIElement(id: string) {
    const idx = this.uiElements.findIndex(el => el.id === id);
    if (idx !== -1) this.uiElements.splice(idx, 1);
  }

  clearUI() {
    this.uiElements = [];
  }

  clear() {
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  render(
    scene: Scene,
    instances: LiveInstance[],
    projectObjects: any[],
    scrollTarget: LiveInstance | null,
    animationSystem?: AnimationSystem,
  ) {
    this.clear();
    this.currentAnimationSystem = animationSystem || null;

    if (!scene) return;

    // Update camera target
    if (scrollTarget) {
      this.camera.follow(
        scrollTarget.x + scrollTarget.width / 2,
        scrollTarget.y + scrollTarget.height / 2,
        scene.width,
        scene.height
      );
    }

    const layers = scene.layers?.length > 0 ? scene.layers : [
      { id: 'default_lay', name: 'Camada Principal', parallaxX: 1, parallaxY: 1, opacity: 1, visible: true }
    ];

    const cam = this.camera;

    // Sort instances by zIndex for proper depth ordering
    const sortedInstances = [...instances].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

    for (const lay of layers) {
      if (!lay.visible) continue;

      this.ctx.save();
      const translateX = cam.getTransformX(lay.parallaxX);
      const translateY = cam.getTransformY(lay.parallaxY);
      this.ctx.translate(translateX, translateY);
      this.ctx.globalAlpha = lay.opacity;

      // Draw grid on main layer
      if (lay.parallaxX === 1.0) {
        this.drawGrid(scene.gridSize, scene.width, scene.height);
      }

      // Draw tiles
      this.drawTilemaps(scene);

      // Draw instances
      for (const inst of sortedInstances) {
        const instLayer = inst.layerId || 'default_lay';
        const isDefault = (lay.id === 'default_lay' || lay.id === 'main_layer');
        if (instLayer !== lay.id && !(instLayer === 'default_lay' && isDefault)) continue;

        if (inst.flashVisible === false) continue;

        const projectObj = projectObjects.find((o: any) => o.id === inst.objectTypeId);
        if (!projectObj) continue;

        this.drawInstance(inst, projectObj);
      }

      this.ctx.restore();
    }

    this.currentAnimationSystem = null;

    // Draw HUD
    this.drawHUD(instances, projectObjects);
  }

  private drawGrid(gs: number, sceneWidth: number, sceneHeight: number) {
    this.ctx.strokeStyle = '#22232e';
    this.ctx.lineWidth = 1;
    for (let x = 0; x <= sceneWidth; x += gs) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, sceneHeight);
      this.ctx.stroke();
    }
    for (let y = 0; y <= sceneHeight; y += gs) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(sceneWidth, y);
      this.ctx.stroke();
    }
  }

  private drawTilemaps(scene: Scene) {
    const drawTileGrid = (grid: Record<string, number | string>) => {
      if (!grid) return;
      const gs = scene.gridSize;

      for (const [coords, tileType] of Object.entries(grid)) {
        const [col, row] = coords.split(',').map(Number);
        const x = col * gs;
        const y = row * gs;
        const tid = typeof tileType === 'string' ? parseInt(tileType) : (tileType as number);
        const def = TILE_DEFS.find(t => t.id === tid);
        if (!def) continue;

        if (def.id === 2) {
          const waveOff = Math.sin(this.globalTime * 6 + col) * 3;
          this.ctx.fillStyle = def.color;
          this.ctx.fillRect(x, y + waveOff / 3, gs, gs);
        } else if (def.id === 4) {
          const lavaPulse = 10 + Math.sin(this.globalTime * 8) * 4;
          this.ctx.fillStyle = `rgb(${220 + lavaPulse}, 38, 38)`;
          this.ctx.fillRect(x, y, gs, gs);
        } else {
          this.ctx.fillStyle = def.color;
          this.ctx.fillRect(x, y, gs, gs);
        }

        if (def.solid) {
          this.ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          this.ctx.lineWidth = 0.5;
          this.ctx.strokeRect(x, y, gs, gs);
        }
      }
    };

    if (scene.tilemap?.grid) drawTileGrid(scene.tilemap.grid);
    if (scene.tilemaps) {
      for (const tm of scene.tilemaps) {
        drawTileGrid(tm.grid);
      }
    }
  }

  private currentAnimationSystem: AnimationSystem | null = null;

  private drawInstance(inst: LiveInstance, obj: any) {
    this.ctx.save();
    this.ctx.translate(inst.x + inst.width / 2, inst.y + inst.height / 2);
    this.ctx.rotate((inst.angle * Math.PI) / 180);
    this.ctx.globalAlpha = inst.opacity;

    // Visual effects
    if (inst.effectFilter === 'water') {
      const ripple = Math.sin(this.globalTime * 10) * 0.15;
      this.ctx.scale(1 + ripple, 1 - ripple);
    } else if (inst.effectFilter === 'warp') {
      const twist = Math.cos(this.globalTime * 8) * 0.25;
      this.ctx.transform(1, twist, 0, 1, 0, 0);
    }

    // Blend modes
    if (inst.blendMode === 'add') this.ctx.globalCompositeOperation = 'lighter';
    else if (inst.blendMode === 'multiply') this.ctx.globalCompositeOperation = 'multiply';
    else if (inst.blendMode === 'screen') this.ctx.globalCompositeOperation = 'screen';
    else this.ctx.globalCompositeOperation = 'source-over';

    const ox = inst.originX ?? 0.5;
    const oy = inst.originY ?? 0.5;
    const renderX = -inst.width * ox;
    const renderY = -inst.height * oy;

    // Use animation system to get current frame
    let frame = obj.frames?.[0];
    if (this.currentAnimationSystem) {
      const animFrameId = this.currentAnimationSystem.getCurrentFrameId(inst, obj);
      if (animFrameId) {
        const animFrame = obj.frames?.find((f: any) => f.id === animFrameId);
        if (animFrame) frame = animFrame;
      }
    }
    if (frame?.pixels?.length > 0) {
      const pxW = inst.width / frame.width;
      const pxH = inst.height / frame.height;
      for (let r = 0; r < frame.height; r++) {
        for (let c = 0; c < frame.width; c++) {
          const color = frame.pixels[r * frame.width + c];
          if (color) {
            this.ctx.fillStyle = color;
            this.ctx.fillRect(renderX + c * pxW, renderY + r * pxH, pxW + 0.3, pxH + 0.3);
          }
        }
      }
    } else {
      this.ctx.fillStyle = obj.primaryColor || '#ec4899';
      this.ctx.fillRect(renderX, renderY, inst.width, inst.height);
    }

    // Collision polygon debug
    if (inst.collisionPolygon?.length > 0) {
      this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      for (let i = 0; i < inst.collisionPolygon.length; i++) {
        const [vx, vy] = inst.collisionPolygon[i];
        const px = renderX + vx * inst.width;
        const py = renderY + vy * inst.height;
        if (i === 0) this.ctx.moveTo(px, py);
        else this.ctx.lineTo(px, py);
      }
      this.ctx.closePath();
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  drawHUD(instances: LiveInstance[], projectObjects: any[]) {
    // Draw UI text elements
    for (const el of this.uiElements) {
      if (!el.visible) continue;
      this.ctx.save();
      this.ctx.font = `${el.fontSize}px ${el.fontFamily}`;
      this.ctx.fillStyle = el.color;
      this.ctx.textAlign = el.align;
      this.ctx.textBaseline = el.baseline;
      this.ctx.fillText(el.text, el.x, el.y);
      this.ctx.restore();
    }
  }

  renderHUD(
    globalVars: Record<string, number>,
    dictionaries: any[],
    arrays: any[],
  ) {
    const hudHeight = 35 + Object.keys(globalVars).length * 15 +
      (dictionaries?.length ? 30 : 0) +
      (arrays?.length ? 30 : 0);

    this.ctx.fillStyle = 'rgba(10, 11, 16, 0.9)';
    this.ctx.fillRect(15, 15, 230, hudHeight);
    this.ctx.strokeStyle = '#2d2e38';
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeRect(15, 15, 230, hudHeight);

    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = 'bold 9px "JetBrains Mono", monospace';
    this.ctx.fillText('[PAINEL DE DADOS - HUD]', 24, 28);

    let offset = 42;
    for (const [key, val] of Object.entries(globalVars)) {
      this.ctx.font = '8px "JetBrains Mono", monospace';
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.fillText(`${key}:`, 24, offset);
      this.ctx.fillStyle = '#10b981';
      this.ctx.fillText(`${val}`, 140, offset);
      offset += 14;
    }

    if (dictionaries?.length > 0) {
      const d = dictionaries[0];
      this.ctx.fillStyle = '#e2e8f0';
      this.ctx.fillText(`Dicionário (${d.name}):`, 24, offset);
      this.ctx.fillStyle = '#6366f1';
      this.ctx.fillText(`${Object.keys(d.entries).length} chaves`, 140, offset);
      offset += 14;
    }

    if (arrays?.length > 0) {
      const a = arrays[0];
      this.ctx.fillStyle = '#e2e8f0';
      this.ctx.fillText(`Array (${a.name}):`, 24, offset);
      this.ctx.fillStyle = '#a855f7';
      const preview = a.values.slice(-3).join(', ');
      this.ctx.fillText(
        `[${preview}${a.values.length > 3 ? '...' : ''}] (${a.values.length})`,
        140, offset
      );
      offset += 14;
    }

    this.ctx.fillStyle = 'rgba(15, 16, 22, 0.7)';
    this.ctx.fillRect(15, this.canvas.height - 35, this.canvas.width - 30, 22);
    this.ctx.font = '8px "Inter", sans-serif';
    this.ctx.fillStyle = '#cbd5e1';
    this.ctx.fillText(
      'Engine 2D Modular - Event Sheets ativos. Câmera segue objeto com ScrollTo.',
      25, this.canvas.height - 21
    );
  }

  renderDebug(stats: { fps: number; instanceCount: number; particleCount: number }) {
    this.ctx.font = '10px monospace';
    this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
    this.ctx.fillRect(this.canvas.width - 180, 10, 170, 55);
    this.ctx.fillStyle = '#00ff88';
    this.ctx.fillText(`FPS: ${stats.fps}`, this.canvas.width - 170, 25);
    this.ctx.fillText(`Instâncias: ${stats.instanceCount}`, this.canvas.width - 170, 40);
    this.ctx.fillText(`Partículas: ${stats.particleCount}`, this.canvas.width - 170, 55);
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  destroy() {
    this.uiElements = [];
  }
}
