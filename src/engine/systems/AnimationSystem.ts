import type { ProjectObject, SpriteAnimation } from '../../types';
import type { LiveInstance, AnimationState } from '../types';

export class AnimationSystem {
  initAnimationState(inst: LiveInstance, obj: ProjectObject): AnimationState {
    const animId = obj.currentAnimation || obj.animations?.[0]?.id;
    return {
      currentAnimation: animId || '',
      currentFrame: 0,
      frameTimer: 0,
      frameIndex: 0,
      finished: false,
      animationSpeed: 1,
    };
  }

  setAnimation(inst: LiveInstance, obj: ProjectObject, animName: string) {
    if (!inst.animState) {
      inst.animState = this.initAnimationState(inst, obj);
    }
    if (inst.animState.currentAnimation !== animName) {
      inst.animState.currentAnimation = animName;
      inst.animState.frameIndex = 0;
      inst.animState.frameTimer = 0;
      inst.animState.finished = false;
    }
  }

  update(dt: number, inst: LiveInstance, obj: ProjectObject) {
    if (!inst.animState) {
      inst.animState = this.initAnimationState(inst, obj);
    }

    const state = inst.animState;
    const anim = this.getAnimation(obj, state.currentAnimation);
    if (!anim || anim.frames.length <= 1) return;

    const speed = anim.speed * state.animationSpeed;
    if (speed <= 0) return;

    state.frameTimer += dt;
    const frameDuration = 1 / speed;

    if (state.frameTimer >= frameDuration) {
      state.frameTimer -= frameDuration;
      state.frameIndex++;

      if (state.frameIndex >= anim.frames.length) {
        if (anim.loop) {
          state.frameIndex = 0;
        } else {
          state.frameIndex = anim.frames.length - 1;
          state.finished = true;
        }
      }
    }
  }

  getCurrentFrameId(inst: LiveInstance, obj: ProjectObject): string | null {
    if (!inst.animState) return obj.frames?.[0]?.id || null;
    const anim = this.getAnimation(obj, inst.animState.currentAnimation);
    if (!anim) return obj.frames?.[0]?.id || null;
    const frameId = anim.frames[inst.animState.frameIndex];
    return frameId || obj.frames?.[0]?.id || null;
  }

  getAnimation(obj: ProjectObject, animName?: string): SpriteAnimation | undefined {
    return obj.animations?.find(a => a.id === (animName || obj.currentAnimation));
  }

  hasAnimationFinished(inst: LiveInstance): boolean {
    return inst.animState?.finished ?? false;
  }

  getAnimationProgress(inst: LiveInstance, obj: ProjectObject): number {
    if (!inst.animState) return 0;
    const anim = this.getAnimation(obj, inst.animState.currentAnimation);
    if (!anim || anim.frames.length <= 1) return 0;
    return inst.animState.frameIndex / (anim.frames.length - 1);
  }

  destroy() {
    // cleanup
  }
}
