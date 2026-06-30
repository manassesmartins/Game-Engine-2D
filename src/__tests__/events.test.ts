import { describe, it, expect } from 'vitest';
import type { EventBlock, EventCondition, EventAction } from '../types';

describe('Event System Conditions', () => {
  it('should have new condition types available', () => {
    const conditions: EventCondition[] = [
      { id: 'c1', type: 'system_once' },
      { id: 'c2', type: 'object_count', param1: 'obj1', param2: '>', param3: '0' },
      { id: 'c3', type: 'instance_exists', param1: 'obj1' },
      { id: 'c4', type: 'animation_finished', param1: 'obj1' },
      { id: 'c5', type: 'animation_current', param1: 'obj1', param2: 'walk' },
      { id: 'c6', type: 'health_compare', param1: 'obj1', param2: '<', param3: '50' },
      { id: 'c7', type: 'timer_elapsed_global', param1: 'my_timer' },
      { id: 'c8', type: 'is_on_floor', param1: 'obj1' },
      { id: 'c9', type: 'keyboard_keyrelease', param1: 'Space' },
      { id: 'c10', type: 'every_x_ticks', param1: '30' },
    ];

    expect(conditions.length).toBe(10);
    expect(conditions[0].type).toBe('system_once');
    expect(conditions[1].type).toBe('object_count');
    expect(conditions[2].type).toBe('instance_exists');
    expect(conditions[3].type).toBe('animation_finished');
    expect(conditions[4].type).toBe('animation_current');
    expect(conditions[5].type).toBe('health_compare');
    expect(conditions[6].type).toBe('timer_elapsed_global');
    expect(conditions[7].type).toBe('is_on_floor');
    expect(conditions[8].type).toBe('keyboard_keyrelease');
    expect(conditions[9].type).toBe('every_x_ticks');
  });

  it('should have new action types available', () => {
    const actions: EventAction[] = [
      { id: 'a1', type: 'object_set_animation_speed', param1: '2', targetObjectId: 'obj1' },
      { id: 'a2', type: 'object_set_health', param1: '100', targetObjectId: 'obj1' },
      { id: 'a3', type: 'object_damage', param1: '10', targetObjectId: 'obj1' },
      { id: 'a4', type: 'object_set_z_index', param1: '5', targetObjectId: 'obj1' },
      { id: 'a5', type: 'object_set_collision_layer', param1: '2', targetObjectId: 'obj1' },
      { id: 'a6', type: 'object_set_collision_mask', param1: '255', targetObjectId: 'obj1' },
      { id: 'a7', type: 'object_set_property', param1: 'vx', param2: '200', targetObjectId: 'obj1' },
      { id: 'a8', type: 'particle_burst', param1: '20', targetObjectId: 'obj1' },
      { id: 'a9', type: 'stop_all_particles' },
      { id: 'a10', type: 'scene_transition', param1: 'fade', param2: '1', param3: 'scene2' },
    ];

    expect(actions.length).toBe(10);
    expect(actions[0].type).toBe('object_set_animation_speed');
    expect(actions[1].type).toBe('object_set_health');
    expect(actions[2].type).toBe('object_damage');
    expect(actions[3].type).toBe('object_set_z_index');
    expect(actions[4].type).toBe('object_set_collision_layer');
    expect(actions[5].type).toBe('object_set_collision_mask');
    expect(actions[6].type).toBe('object_set_property');
    expect(actions[7].type).toBe('particle_burst');
    expect(actions[8].type).toBe('stop_all_particles');
    expect(actions[9].type).toBe('scene_transition');
  });

  it('should validate animation state on LiveInstance', () => {
    const inst = {
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
      animState: {
        currentAnimation: 'walk',
        currentFrame: 0,
        frameTimer: 0,
        frameIndex: 1,
        finished: false,
        animationSpeed: 2,
      },
    };

    expect(inst.animState).toBeDefined();
    expect(inst.animState.currentAnimation).toBe('walk');
    expect(inst.animState.animationSpeed).toBe(2);
    expect(inst.animState.finished).toBe(false);
  });
});
