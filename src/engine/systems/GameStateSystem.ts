import type { GameProject } from '../../types';

export interface SaveSlot {
  name: string;
  timestamp: number;
  projectState: string;
  screenshot?: string;
}

export class GameStateSystem {
  private storageKey = 'lume_save_';
  private currentSlotIndex = -1;
  private autoSaveEnabled = true;
  private autoSaveInterval = 60000;
  private lastAutoSave = 0;

  setAutoSave(enabled: boolean, intervalMs = 60000) {
    this.autoSaveEnabled = enabled;
    this.autoSaveInterval = intervalMs;
  }

  getSlotCount(): number {
    let count = 0;
    try {
      for (let i = 0; i < 10; i++) {
        const data = localStorage.getItem(`${this.storageKey}${i}`);
        if (data) count++;
      }
    } catch {
      // localStorage not available
    }
    return count;
  }

  save(slotIndex: number, project: GameProject, slotName?: string): boolean {
    try {
      const saveData: SaveSlot = {
        name: slotName || `Save ${slotIndex + 1}`,
        timestamp: Date.now(),
        projectState: JSON.stringify(project),
      };
      localStorage.setItem(`${this.storageKey}${slotIndex}`, JSON.stringify(saveData));
      this.currentSlotIndex = slotIndex;
      return true;
    } catch (e) {
      console.error('Failed to save game:', e);
      return false;
    }
  }

  load(slotIndex: number): GameProject | null {
    try {
      const raw = localStorage.getItem(`${this.storageKey}${slotIndex}`);
      if (!raw) return null;
      const saveData: SaveSlot = JSON.parse(raw);
      const project = JSON.parse(saveData.projectState);
      this.currentSlotIndex = slotIndex;
      return project;
    } catch (e) {
      console.error('Failed to load game:', e);
      return null;
    }
  }

  delete(slotIndex: number): boolean {
    try {
      localStorage.removeItem(`${this.storageKey}${slotIndex}`);
      if (this.currentSlotIndex === slotIndex) {
        this.currentSlotIndex = -1;
      }
      return true;
    } catch {
      return false;
    }
  }

  getSlotInfo(slotIndex: number): SaveSlot | null {
    try {
      const raw = localStorage.getItem(`${this.storageKey}${slotIndex}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  getAllSlots(): SaveSlot[] {
    const slots: SaveSlot[] = [];
    for (let i = 0; i < 10; i++) {
      const info = this.getSlotInfo(i);
      if (info) {
        slots.push({ ...info, projectState: '' });
      }
    }
    return slots;
  }

  autoSave(project: GameProject): boolean {
    if (!this.autoSaveEnabled) return false;
    const now = Date.now();
    if (now - this.lastAutoSave < this.autoSaveInterval) return false;
    this.lastAutoSave = now;
    return this.save(0, project, 'AutoSave');
  }

  exportToFile(project: GameProject): string {
    const dataStr = "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify({ version: 2, project, exportedAt: new Date().toISOString() }, null, 2));
    return dataStr;
  }

  importFromFile(jsonData: string): GameProject | null {
    try {
      const parsed = JSON.parse(jsonData);
      if (parsed.version === 2 && parsed.project) {
        return parsed.project;
      }
      if (parsed.objects && parsed.scenes) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  clearAll() {
    for (let i = 0; i < 10; i++) {
      try {
        localStorage.removeItem(`${this.storageKey}${i}`);
      } catch {
        // ignore
      }
    }
    this.currentSlotIndex = -1;
  }
}
