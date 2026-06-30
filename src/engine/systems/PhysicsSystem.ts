import type { Scene, TileDef } from '../../types';
import type { LiveInstance, CollisionLayer, CollisionMask, EngineOptions } from '../types';

const TILE_DEFS: TileDef[] = [
  { id: 1, color: '#10b981', solid: true, name: 'Grama' },
  { id: 2, color: '#0ea5e9', solid: false, name: 'Água (Fluída)' },
  { id: 3, color: '#d97706', solid: true, name: 'Tijolo Sólido' },
  { id: 4, color: '#ef4444', solid: true, name: 'Lava Aquecida' },
];

interface SpatialCell {
  instances: LiveInstance[];
}

export class PhysicsSystem {
  private cellSize = 128;
  private grid: Map<string, SpatialCell> = new Map();
  private onLog: (msg: string) => void;

  constructor(options: EngineOptions = {}) {
    this.onLog = options.onLog || (() => {});
  }

  getTileDefs(): TileDef[] {
    return TILE_DEFS;
  }

  getTileDef(id: number): TileDef | undefined {
    return TILE_DEFS.find(t => t.id === id);
  }

  private cellKey(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
  }

  rebuildSpatialGrid(instances: LiveInstance[]) {
    this.grid.clear();
    for (const inst of instances) {
      const key = this.cellKey(inst.x, inst.y);
      let cell = this.grid.get(key);
      if (!cell) {
        cell = { instances: [] };
        this.grid.set(key, cell);
      }
      cell.instances.push(inst);
    }
  }

  getNearbyInstances(inst: LiveInstance): LiveInstance[] {
    const nearby: Set<LiveInstance> = new Set();
    const cx = Math.floor(inst.x / this.cellSize);
    const cy = Math.floor(inst.y / this.cellSize);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cell = this.grid.get(`${cx + dx},${cy + dy}`);
        if (cell) {
          for (const other of cell.instances) {
            if (other.id !== inst.id) {
              nearby.add(other);
            }
          }
        }
      }
    }
    return Array.from(nearby);
  }

  checkAABB(a: LiveInstance, b: LiveInstance): boolean {
    return (
      a.x + a.width > b.x &&
      a.x < b.x + b.width &&
      a.y + a.height > b.y &&
      a.y < b.y + b.height
    );
  }

  checkSolidCollision(inst: LiveInstance, scene: Scene, instances: LiveInstance[]): boolean {
    for (const other of instances) {
      if (other.id === inst.id) continue;
      if (!this.checkAABB(inst, other)) continue;
      if (other.collisionLayer !== undefined && inst.collisionMask !== undefined) {
        if (!(other.collisionLayer & inst.collisionMask)) continue;
      }
      return true;
    }

    const gs = scene.gridSize;
    const checkGrid = (grid: Record<string, number | string>): boolean => {
      const minCol = Math.floor(inst.x / gs);
      const maxCol = Math.ceil((inst.x + inst.width) / gs);
      const minRow = Math.floor(inst.y / gs);
      const maxRow = Math.ceil((inst.y + inst.height) / gs);

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const val = grid[`${c},${r}`];
          if (val == null) continue;
          const tid = typeof val === 'string' ? parseInt(val) : (val as number);
          const def = TILE_DEFS.find(t => t.id === tid);
          if (def?.solid) {
            const tLeft = c * gs;
            const tRight = (c + 1) * gs;
            const tTop = r * gs;
            const tBottom = (r + 1) * gs;
            if (
              inst.x + inst.width > tLeft &&
              inst.x < tRight &&
              inst.y + inst.height > tTop &&
              inst.y < tBottom
            ) {
              return true;
            }
          }
        }
      }
      return false;
    };

    if (scene.tilemap?.grid && checkGrid(scene.tilemap.grid)) return true;
    if (scene.tilemaps) {
      for (const tm of scene.tilemaps) {
        if (checkGrid(tm.grid)) return true;
      }
    }
    return false;
  }

  previewSolidCollisionAt(
    x: number, y: number, w: number, h: number,
    scene: Scene, instances: LiveInstance[]
  ): boolean {
    for (const other of instances) {
      if (x + w > other.x && x < other.x + other.width &&
          y + h > other.y && y < other.y + other.height) {
        return true;
      }
    }

    const gs = scene.gridSize;
    const checkGrid = (grid: Record<string, number | string>): boolean => {
      const minCol = Math.floor(x / gs);
      const maxCol = Math.ceil((x + w) / gs);
      const minRow = Math.floor(y / gs);
      const maxRow = Math.ceil((y + h) / gs);

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const val = grid[`${c},${r}`];
          if (val == null) continue;
          const tid = typeof val === 'string' ? parseInt(val) : (val as number);
          const def = TILE_DEFS.find(t => t.id === tid);
          if (def?.solid) {
            const tLeft = c * gs;
            const tRight = (c + 1) * gs;
            const tTop = r * gs;
            const tBottom = (r + 1) * gs;
            if (x + w > tLeft && x < tRight && y + h > tTop && y < tBottom) return true;
          }
        }
      }
      return false;
    };

    if (scene.tilemap?.grid && checkGrid(scene.tilemap.grid)) return true;
    if (scene.tilemaps) {
      for (const tm of scene.tilemaps) {
        if (checkGrid(tm.grid)) return true;
      }
    }
    return false;
  }

  resolveCollisions(inst: LiveInstance, direction: 'horizontal' | 'vertical', scene: Scene, instances: LiveInstance[]) {
    const gs = scene.gridSize;

    for (const other of instances) {
      if (other.id === inst.id) continue;
      if (!this.checkAABB(inst, other)) continue;

      if (other.collisionLayer !== undefined && inst.collisionMask !== undefined) {
        if (!(other.collisionLayer & inst.collisionMask)) continue;
      }

      const isSolid = true;
      const isJumpThru = false;

      if (isSolid) {
        if (direction === 'horizontal') {
          if (inst.vx > 0) inst.x = other.x - inst.width;
          else if (inst.vx < 0) inst.x = other.x + other.width;
          inst.vx = 0;
        } else {
          if (inst.vy > 0) {
            inst.y = other.y - inst.height;
            inst.onGround = true;
          } else if (inst.vy < 0) {
            inst.y = other.y + other.height;
          }
          inst.vy = 0;
        }
      }
    }

    const resolveGrid = (grid: Record<string, number | string>) => {
      const instLeft = inst.x;
      const instRight = inst.x + inst.width;
      const instTop = inst.y;
      const instBottom = inst.y + inst.height;

      const minCol = Math.floor(instLeft / gs);
      const maxCol = Math.ceil(instRight / gs);
      const minRow = Math.floor(instTop / gs);
      const maxRow = Math.ceil(instBottom / gs);

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const tileVal = grid[`${c},${r}`];
          if (tileVal == null) continue;
          const tid = typeof tileVal === 'string' ? parseInt(tileVal) : (tileVal as number);
          const def = TILE_DEFS.find(t => t.id === tid);
          if (!def?.solid) continue;

          const tileLeft = c * gs;
          const tileRight = (c + 1) * gs;
          const tileTop = r * gs;
          const tileBottom = (r + 1) * gs;

          if (
            instRight > tileLeft &&
            instLeft < tileRight &&
            instBottom > tileTop &&
            instTop < tileBottom
          ) {
            if (direction === 'horizontal') {
              if (inst.vx > 0) inst.x = tileLeft - inst.width;
              else if (inst.vx < 0) inst.x = tileRight;
              inst.vx = 0;
            } else {
              if (inst.vy > 0) {
                inst.y = tileTop - inst.height;
                inst.onGround = true;
              } else if (inst.vy < 0) {
                inst.y = tileBottom;
              }
              inst.vy = 0;
            }
          }
        }
      }
    };

    if (scene.tilemap?.grid) resolveGrid(scene.tilemap.grid);
    if (scene.tilemaps) {
      for (const tm of scene.tilemaps) {
        resolveGrid(tm.grid);
      }
    }
  }

  checkTileAt(scene: Scene, col: number, row: number): number | null {
    const gs = scene.gridSize;
    const key = `${col},${row}`;
    if (scene.tilemap?.grid && scene.tilemap.grid[key] !== undefined) {
      const val = scene.tilemap.grid[key];
      return typeof val === 'string' ? parseInt(val) : (val as number);
    }
    if (scene.tilemaps) {
      for (const tm of scene.tilemaps) {
        if (tm.grid[key] !== undefined) {
          const val = tm.grid[key];
          return typeof val === 'string' ? parseInt(val) : (val as number);
        }
      }
    }
    return null;
  }

  isSolidTile(scene: Scene, col: number, row: number): boolean {
    const tid = this.checkTileAt(scene, col, row);
    if (tid === null) return false;
    const def = TILE_DEFS.find(t => t.id === tid);
    return def?.solid ?? false;
  }

  destroy() {
    this.grid.clear();
  }
}
