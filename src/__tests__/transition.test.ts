import { describe, it, expect } from 'vitest';

describe('SceneTransitionSystem', () => {
  it('should start and complete a fade transition', async () => {
    const { SceneTransitionSystem } = await import('../engine/systems/SceneTransitionSystem');
    const sys = new SceneTransitionSystem();

    expect(sys.isActive()).toBe(false);

    let callbackFired = false;
    sys.start('fade', 1, () => { callbackFired = true; });

    expect(sys.isActive()).toBe(true);
    expect(sys.getType()).toBe('fade');
    expect(sys.getDuration()).toBe(1);
    expect(sys.getProgress()).toBe(0);

    // Halfway
    sys.update(0.5);
    expect(sys.getProgress()).toBeCloseTo(0.5, 2);
    expect(sys.getAlpha()).toBeGreaterThan(0);

    // Complete
    sys.update(0.5);
    expect(sys.isActive()).toBe(false);
    expect(callbackFired).toBe(true);
  });

  it('should provide correct offsets for slide transitions', async () => {
    const { SceneTransitionSystem } = await import('../engine/systems/SceneTransitionSystem');
    const sys = new SceneTransitionSystem();

    sys.start('slide_left', 1);
    expect(sys.getOffsetX()).toBe(0);

    sys.update(0.25);
    expect(sys.getOffsetX()).toBeLessThan(0);
    expect(sys.getOffsetX()).toBeGreaterThan(-1);

    sys.update(0.5);
    expect(sys.getOffsetX()).toBeGreaterThan(0);
    expect(sys.getOffsetX()).toBeLessThan(1);

    sys.update(0.25);
    expect(sys.isActive()).toBe(false);
    expect(sys.getOffsetX()).toBe(0);
  });

  it('should provide correct scale for zoom transitions', async () => {
    const { SceneTransitionSystem } = await import('../engine/systems/SceneTransitionSystem');
    const sys = new SceneTransitionSystem();

    sys.start('zoom_in', 1);
    // At start, scale should be 1
    expect(sys.getScale()).toBe(1);

    // A tiny step forward to get past the t <= 0 guard
    sys.update(0.01);
    const nearStartScale = sys.getScale();
    expect(nearStartScale).toBeGreaterThan(1);
    expect(nearStartScale).toBeLessThan(1.3);

    sys.update(0.49);
    const midScale = sys.getScale();
    expect(midScale).toBeGreaterThan(1);
    expect(midScale).toBeLessThan(1.3);

    sys.update(0.5);
    expect(sys.getScale()).toBe(1);
  });

  it('should detect halfway point', async () => {
    const { SceneTransitionSystem } = await import('../engine/systems/SceneTransitionSystem');
    const sys = new SceneTransitionSystem();

    sys.start('fade', 1);
    expect(sys.isHalfway()).toBe(false);

    sys.update(0.5);
    expect(sys.isHalfway()).toBe(true);
  });

  it('should clear transition', async () => {
    const { SceneTransitionSystem } = await import('../engine/systems/SceneTransitionSystem');
    const sys = new SceneTransitionSystem();

    sys.start('fade', 2);
    expect(sys.isActive()).toBe(true);

    sys.clear();
    expect(sys.isActive()).toBe(false);
  });

  it('should handle none transition type', async () => {
    const { SceneTransitionSystem } = await import('../engine/systems/SceneTransitionSystem');
    const sys = new SceneTransitionSystem();

    sys.start('none', 1);
    expect(sys.getAlpha()).toBe(0);
    expect(sys.getOffsetX()).toBe(0);
    expect(sys.getOffsetY()).toBe(0);
    expect(sys.getScale()).toBe(1);
  });

  it('should provide alpha for slide transitions during transition', async () => {
    const { SceneTransitionSystem } = await import('../engine/systems/SceneTransitionSystem');
    const sys = new SceneTransitionSystem();

    sys.start('slide_right', 1);
    expect(sys.getAlpha()).toBe(0);

    sys.update(0.15);
    expect(sys.getAlpha()).toBeCloseTo(0.5, 1);

    sys.update(0.3);
    expect(sys.getAlpha()).toBe(1);
  });
});
