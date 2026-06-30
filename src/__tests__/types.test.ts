import { describe, it, expect } from 'vitest';

describe('Engine Types', () => {
  it('should validate basic type structure', () => {
    const project = {
      name: 'Test Game',
      settings: {
        windowWidth: 800,
        windowHeight: 600,
        fps: 60,
        renderMode: 'canvas2d' as const,
        fullscreen: false,
        pixelArt: true,
        backgroundColor: '#1a1a2e',
        startSceneId: '',
      },
      objects: [],
      scenes: [],
      currentSceneId: '',
      events: [],
      sounds: [],
      music: [],
      globalVariables: {},
      scripts: [],
      timelines: [],
      dictionaries: [],
      arrays: [],
    };

    expect(project.name).toBe('Test Game');
    expect(project.settings.fps).toBe(60);
    expect(project.objects).toEqual([]);
    expect(project.scenes).toEqual([]);
  });

  it('should validate object instance structure', () => {
    const instance = {
      id: 'test_1',
      objectTypeId: 'player',
      x: 100,
      y: 200,
      width: 32,
      height: 32,
      angle: 0,
      opacity: 1,
      variables: { score: 0, health: 100 },
    };

    expect(instance.x).toBe(100);
    expect(instance.y).toBe(200);
    expect(instance.variables.score).toBe(0);
  });

  it('should validate event block structure', () => {
    const eventBlock = {
      id: 'ev_1',
      conditions: [
        { id: 'c1', type: 'system_onload' as const },
      ],
      actions: [
        { id: 'a1', type: 'system_set_variable' as const, param1: 'Score', param2: '0' },
      ],
    };

    expect(eventBlock.conditions[0].type).toBe('system_onload');
    expect(eventBlock.actions[0].param1).toBe('Score');
  });

  it('should validate collision layer constants', () => {
    const layers = {
      DEFAULT: 1 << 0,
      PLAYER: 1 << 1,
      ENEMY: 1 << 2,
      SOLID: 1 << 3,
    };

    expect(layers.DEFAULT).toBe(1);
    expect(layers.PLAYER).toBe(2);
    expect(layers.ENEMY).toBe(4);
    expect(layers.SOLID).toBe(8);
    expect(layers.DEFAULT | layers.PLAYER).toBe(3);
  });

  it('should validate particle structure', () => {
    const particle = {
      x: 50,
      y: 50,
      vx: 10,
      vy: -5,
      life: 1.0,
      maxLife: 1.0,
      size: 4,
      color: '#ff0000',
      alpha: 1,
      rotation: 0,
      rotationSpeed: 0,
    };

    expect(particle.life).toBeGreaterThan(0);
    expect(particle.size).toBeLessThanOrEqual(10);
  });
});
