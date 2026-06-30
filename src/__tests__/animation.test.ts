import { describe, it, expect } from 'vitest';
import type { ProjectObject, SpriteAnimation } from '../types';
import type { LiveInstance } from '../engine/types';

describe('AnimationSystem', () => {
  function makeObj(overrides?: Partial<ProjectObject>): ProjectObject {
    return {
      id: 'obj1',
      name: 'Test',
      type: 'sprite',
      primaryColor: '#ff0000',
      frames: [],
      animations: [],
      currentAnimation: '',
      behaviors: [],
      properties: {},
      ...overrides,
    };
  }

  function makeInst(overrides?: Partial<LiveInstance>): LiveInstance {
    return {
      id: 'inst1',
      objectTypeId: 'obj1',
      x: 0, y: 0,
      width: 32, height: 32,
      angle: 0, opacity: 1,
      vx: 0, vy: 0, onGround: false,
      timer: 0, health: 100,
      sineAccumulator: 0,
      initialX: 0, initialY: 0,
      variables: {},
      ...overrides,
    };
  }

  it('should initialize animation state from object', async () => {
    const { AnimationSystem } = await import('../engine/systems/AnimationSystem');
    const sys = new AnimationSystem();
    const obj = makeObj();
    const inst = makeInst();

    const state = sys.initAnimationState(inst, obj);
    expect(state.currentAnimation).toBe('');
    expect(state.frameIndex).toBe(0);
    expect(state.frameTimer).toBe(0);
    expect(state.finished).toBe(false);
    expect(state.animationSpeed).toBe(1);
  });

  it('should cycle through animation frames', async () => {
    const { AnimationSystem } = await import('../engine/systems/AnimationSystem');
    const sys = new AnimationSystem();

    const anim: SpriteAnimation = {
      id: 'walk',
      name: 'Walk',
      speed: 60,
      loop: true,
      frames: ['f1', 'f2', 'f3'],
    };

    const obj = makeObj({
      animations: [anim],
      currentAnimation: 'walk',
      frames: [{ id: 'f1', width: 32, height: 32, pixels: [] }],
    });

    const inst = makeInst();
    inst.animState = sys.initAnimationState(inst, obj);
    expect(inst.animState.frameIndex).toBe(0);

    sys.update(1 / 60, inst, obj);
    expect(inst.animState.frameIndex).toBe(1);

    sys.update(1 / 60, inst, obj);
    expect(inst.animState.frameIndex).toBe(2);

    sys.update(1 / 60, inst, obj);
    expect(inst.animState.frameIndex).toBe(0);
    expect(inst.animState.finished).toBe(false);
  });

  it('should not loop non-looping animations', async () => {
    const { AnimationSystem } = await import('../engine/systems/AnimationSystem');
    const sys = new AnimationSystem();

    const anim: SpriteAnimation = {
      id: 'die',
      name: 'Death',
      speed: 60,
      loop: false,
      frames: ['f1', 'f2'],
    };

    const obj = makeObj({
      animations: [anim],
      currentAnimation: 'die',
      frames: [{ id: 'f1', width: 32, height: 32, pixels: [] }],
    });

    const inst = makeInst();
    inst.animState = sys.initAnimationState(inst, obj);
    sys.update(1 / 60, inst, obj);
    expect(inst.animState.frameIndex).toBe(1);

    sys.update(1 / 60, inst, obj);
    expect(inst.animState.frameIndex).toBe(1);
    expect(inst.animState.finished).toBe(true);
  });

  it('should switch animations and reset frame', async () => {
    const { AnimationSystem } = await import('../engine/systems/AnimationSystem');
    const sys = new AnimationSystem();

    const walk: SpriteAnimation = {
      id: 'walk', name: 'Walk', speed: 60, loop: true, frames: ['f1', 'f2'],
    };
    const run: SpriteAnimation = {
      id: 'run', name: 'Run', speed: 120, loop: true, frames: ['f3', 'f4'],
    };

    const obj = makeObj({
      animations: [walk, run],
      currentAnimation: 'walk',
      frames: [{ id: 'f1', width: 32, height: 32, pixels: [] }],
    });

    const inst = makeInst();
    inst.animState = sys.initAnimationState(inst, obj);

    sys.update(1 / 60, inst, obj);
    expect(inst.animState.frameIndex).toBe(1);

    sys.setAnimation(inst, obj, 'run');
    expect(inst.animState.currentAnimation).toBe('run');
    expect(inst.animState.frameIndex).toBe(0);
  });

  it('should get current frame ID', async () => {
    const { AnimationSystem } = await import('../engine/systems/AnimationSystem');
    const sys = new AnimationSystem();

    const anim: SpriteAnimation = {
      id: 'walk', name: 'Walk', speed: 60, loop: true, frames: ['f1', 'f2'],
    };

    const obj = makeObj({
      animations: [anim],
      currentAnimation: 'walk',
      frames: [{ id: 'f1', width: 32, height: 32, pixels: [] }],
    });

    const inst = makeInst();
    inst.animState = sys.initAnimationState(inst, obj);
    expect(sys.getCurrentFrameId(inst, obj)).toBe('f1');

    sys.update(1 / 60, inst, obj);
    expect(sys.getCurrentFrameId(inst, obj)).toBe('f2');
  });

  it('should report animation progress', async () => {
    const { AnimationSystem } = await import('../engine/systems/AnimationSystem');
    const sys = new AnimationSystem();

    const anim: SpriteAnimation = {
      id: 'walk', name: 'Walk', speed: 60, loop: true, frames: ['f1', 'f2', 'f3'],
    };

    const obj = makeObj({
      animations: [anim],
      currentAnimation: 'walk',
      frames: [{ id: 'f1', width: 32, height: 32, pixels: [] }],
    });

    const inst = makeInst();
    inst.animState = sys.initAnimationState(inst, obj);
    expect(sys.getAnimationProgress(inst, obj)).toBe(0);

    sys.update(1 / 60, inst, obj);
    expect(sys.getAnimationProgress(inst, obj)).toBeCloseTo(0.5, 1);
  });
});
