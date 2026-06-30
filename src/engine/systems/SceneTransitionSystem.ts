import type { SceneTransition, TransitionType } from '../types';

export class SceneTransitionSystem {
  private currentTransition: SceneTransition | null = null;

  start(type: TransitionType, duration: number, callback?: () => void) {
    this.currentTransition = {
      type,
      duration,
      elapsed: 0,
      active: true,
      callback,
    };
  }

  update(dt: number): boolean {
    if (!this.currentTransition?.active) return false;

    this.currentTransition.elapsed += dt;

    if (this.currentTransition.elapsed >= this.currentTransition.duration) {
      this.currentTransition.active = false;
      if (this.currentTransition.callback) {
        this.currentTransition.callback();
        this.currentTransition.callback = undefined;
      }
      return true;
    }

    return false;
  }

  getProgress(): number {
    if (!this.currentTransition || this.currentTransition.duration <= 0) return 1;
    return Math.min(1, this.currentTransition.elapsed / this.currentTransition.duration);
  }

  getAlpha(): number {
    if (!this.currentTransition?.active) return 0;
    const t = this.getProgress();
    if (t <= 0) return 0;
    switch (this.currentTransition.type) {
      case 'fade':
        return t < 0.5 ? t * 2 : (1 - t) * 2;
      case 'slide_left':
      case 'slide_right':
      case 'slide_up':
      case 'slide_down':
        return t < 0.3 ? t / 0.3 : (t > 0.7 ? (1 - t) / 0.3 : 1);
      case 'zoom_in':
        return 1 - t;
      case 'zoom_out':
        return t;
      default:
        return 0;
    }
  }

  getOffsetX(): number {
    if (!this.currentTransition?.active) return 0;
    const t = this.getProgress();
    if (t <= 0) return 0;
    switch (this.currentTransition.type) {
      case 'slide_left':
        return t < 0.5 ? -(1 - t * 2) : (t - 0.5) * 2;
      case 'slide_right':
        return t < 0.5 ? (1 - t * 2) : -(t - 0.5) * 2;
      default:
        return 0;
    }
  }

  getOffsetY(): number {
    if (!this.currentTransition?.active) return 0;
    const t = this.getProgress();
    if (t <= 0) return 0;
    switch (this.currentTransition.type) {
      case 'slide_up':
        return t < 0.5 ? -(1 - t * 2) : (t - 0.5) * 2;
      case 'slide_down':
        return t < 0.5 ? (1 - t * 2) : -(t - 0.5) * 2;
      default:
        return 0;
    }
  }

  getScale(): number {
    if (!this.currentTransition?.active) return 1;
    const t = this.getProgress();
    if (t <= 0) return 1;
    switch (this.currentTransition.type) {
      case 'zoom_in':
        return 1 + (1 - t) * 0.3;
      case 'zoom_out':
        return 0.7 + t * 0.3;
      default:
        return 1;
    }
  }

  isActive(): boolean {
    return this.currentTransition?.active ?? false;
  }

  getType(): TransitionType {
    return this.currentTransition?.type ?? 'none';
  }

  getDuration(): number {
    return this.currentTransition?.duration ?? 0;
  }

  isHalfway(): boolean {
    return this.getProgress() >= 0.5;
  }

  clear() {
    this.currentTransition = null;
  }

  destroy() {
    this.clear();
  }
}
