import type { GameProject, ProjectObject, EventBlock } from '../../types';
import type { LiveInstance, BehaviorHandler, BehaviorContext } from '../types';
import { PhysicsSystem } from './PhysicsSystem';
import { AudioSystem } from './AudioSystem';

export class BehaviorSystem {
  private handlers: Map<string, BehaviorHandler> = new Map();
  private physics: PhysicsSystem;
  private audio: AudioSystem;

  constructor(physics: PhysicsSystem, audio: AudioSystem) {
    this.physics = physics;
    this.audio = audio;
    this.registerDefaults();
  }

  private registerDefaults() {
    this.register({
      name: 'Platform',
      update: (ctx) => {
        const { inst, obj, dt, keysHeld, keysPressed } = ctx;
        const maxSpeed = obj.properties.speed || 150;
        const accel = obj.properties.acceleration || 600;
        const decel = obj.properties.deceleration || 850;
        const gravity = obj.properties.gravity || 800;
        const jumpStrength = obj.properties.jumpStrength || 380;
        const doubleJumpEnabled = obj.properties.doubleJump ?? true;

        let targetVx = 0;
        if (keysHeld['ArrowLeft'] || keysHeld['a'] || keysHeld['A']) targetVx = -maxSpeed;
        if (keysHeld['ArrowRight'] || keysHeld['d'] || keysHeld['D']) targetVx = maxSpeed;

        if (targetVx !== 0) {
          if (targetVx > inst.vx) inst.vx = Math.min(targetVx, inst.vx + accel * dt);
          else inst.vx = Math.max(targetVx, inst.vx - accel * dt);
        } else {
          if (inst.vx > 0) inst.vx = Math.max(0, inst.vx - decel * dt);
          else if (inst.vx < 0) inst.vx = Math.min(0, inst.vx + decel * dt);
        }

        inst.vy += gravity * dt;

        const wantJump = keysPressed['ArrowUp'] || keysPressed['w'] || keysPressed['W'] ||
                         keysPressed[' '] || keysPressed['space'];
        if (wantJump) {
          if (inst.onGround) {
            inst.vy = -jumpStrength;
            inst.onGround = false;
            inst.doubleJumpAvailable = true;
            this.audio.playTone('square', 330, 0.12, 0.02, 0.08);
          } else if (doubleJumpEnabled && inst.doubleJumpAvailable) {
            inst.vy = -jumpStrength * 0.9;
            inst.doubleJumpAvailable = false;
            this.audio.playTone('sine', 520, 0.15, 0.04, 0.1);
          }
        }

        ctx.engine.move(inst, inst.vx * dt, inst.vy * dt);

        if (inst.vy > 0 && inst.onGround) {
          inst.onGround = false;
        }
      },
    });

    this.register({
      name: '8Direction',
      update: (ctx) => {
        const { inst, obj, dt, keysHeld } = ctx;
        const speed = obj.properties.speed || 150;
        let dx = 0;
        let dy = 0;
        if (keysHeld['ArrowLeft'] || keysHeld['a'] || keysHeld['A']) dx = -1;
        if (keysHeld['ArrowRight'] || keysHeld['d'] || keysHeld['D']) dx = 1;
        if (keysHeld['ArrowUp'] || keysHeld['w'] || keysHeld['W']) dy = -1;
        if (keysHeld['ArrowDown'] || keysHeld['s'] || keysHeld['S']) dy = 1;

        if (dx !== 0 && dy !== 0) {
          dx *= 0.7071;
          dy *= 0.7071;
        }

        inst.x += dx * speed * dt;
        inst.y += dy * speed * dt;
        if (dx !== 0 || dy !== 0) {
          inst.angle = Math.atan2(dy, dx) * (180 / Math.PI);
        }
      },
    });

    this.register({
      name: 'Bullet',
      update: (ctx) => {
        const { inst, obj, dt } = ctx;
        const speed = obj.properties.bulletSpeed || 200;
        const gravityFactor = obj.properties.bulletGravity || 0;
        const angleRad = (inst.angle * Math.PI) / 180;

        inst.vx = Math.cos(angleRad) * speed;
        inst.vy += gravityFactor * 200 * dt;

        inst.x += inst.vx * dt;
        inst.y += inst.vy * dt;

        const scene = ctx.engine.getCurrentScene();
        if (scene && ctx.liveInstances) {
          if (this.physics.checkSolidCollision(inst, scene, ctx.liveInstances)) {
            ctx.engine.destroyInstance(inst.id);
          }
        }
      },
    });

    this.register({
      name: 'Sine',
      update: (ctx) => {
        const { inst, obj, dt } = ctx;
        inst.sineAccumulator += dt;
        const amp = obj.properties.sineAmplitude || 50;
        const period = obj.properties.sinePeriod || 2;
        inst.x = inst.initialX + Math.sin((inst.sineAccumulator * Math.PI * 2) / period) * amp;
      },
    });

    this.register({
      name: 'Car',
      update: (ctx) => {
        const { inst, obj, dt, keysHeld } = ctx;
        const maxSpeed = obj.properties.carSpeed || 200;
        const acceleration = obj.properties.carAcceleration || 150;
        const deceleration = obj.properties.carDeceleration || 100;
        const turnSpeed = obj.properties.carTurnSpeed || 120;
        const driftFactor = obj.properties.carDriftFactor || 0.8;

        let drive = 0;
        if (keysHeld['ArrowUp'] || keysHeld['w'] || keysHeld['W']) drive = 1;
        if (keysHeld['ArrowDown'] || keysHeld['s'] || keysHeld['S']) drive = -1;

        if (drive !== 0) {
          inst.carVelocity = (inst.carVelocity || 0) + drive * acceleration * dt;
        } else {
          const v = inst.carVelocity || 0;
          if (v > 0) inst.carVelocity = Math.max(0, v - deceleration * dt);
          else if (v < 0) inst.carVelocity = Math.min(0, v + deceleration * dt);
        }

        inst.carVelocity = Math.max(-maxSpeed * 0.4, Math.min(maxSpeed, inst.carVelocity || 0));

        if (Math.abs(inst.carVelocity || 0) > 5) {
          const steerDirection = (inst.carVelocity || 0) > 0 ? 1 : -1;
          if (keysHeld['ArrowLeft'] || keysHeld['a'] || keysHeld['A']) inst.angle -= turnSpeed * steerDirection * dt;
          if (keysHeld['ArrowRight'] || keysHeld['d'] || keysHeld['D']) inst.angle += turnSpeed * steerDirection * dt;
        }

        const angleRad = (inst.angle * Math.PI) / 180;
        const fwdX = Math.cos(angleRad) * (inst.carVelocity || 0);
        const fwdY = Math.sin(angleRad) * (inst.carVelocity || 0);

        inst.vx = inst.vx * driftFactor + fwdX * (1 - driftFactor);
        inst.vy = inst.vy * driftFactor + fwdY * (1 - driftFactor);

        inst.x += inst.vx * dt;
        inst.y += inst.vy * dt;
      },
    });

    this.register({
      name: 'BoundToLayout',
      update: (ctx) => {
        const { inst } = ctx;
        const scene = ctx.engine.getCurrentScene();
        if (!scene) return;
        inst.x = Math.max(0, Math.min(scene.width - inst.width, inst.x));
        inst.y = Math.max(0, Math.min(scene.height - inst.height, inst.y));
      },
    });

    this.register({
      name: 'Flash',
      update: (ctx) => {
        const { inst, dt } = ctx;
        if (inst.flashTimer && inst.flashTimer > 0) {
          inst.flashTimer -= dt;
          inst.flashVisible = Math.floor(inst.flashTimer * 12) % 2 === 0;
          if (inst.flashTimer <= 0) {
            inst.flashVisible = true;
          }
        }
      },
    });

    this.register({
      name: 'Fade',
      update: (ctx) => {
        const { inst, obj, dt } = ctx;
        if (inst.isFading) {
          const fadeDur = obj.properties.fadeDuration || 1.5;
          inst.opacity = Math.max(0, inst.opacity - (1 / fadeDur) * dt);
          if (inst.opacity <= 0) {
            ctx.engine.destroyInstance(inst.id);
          }
        }
      },
    });

    this.register({
      name: 'Timer',
      update: (ctx) => {
        const { inst, dt } = ctx;
        if (inst.timerValue) {
          Object.keys(inst.timerValue).forEach(tName => {
            if (inst.timerValue![tName] > 0) {
              inst.timerValue![tName] -= dt;
              if (inst.timerValue![tName] <= 0) {
                ctx.engine.fireTimerEvent(tName);
              }
            }
          });
        }
      },
    });

    this.register({
      name: 'Pathfinding',
      update: (ctx) => {
        const { inst, obj, dt } = ctx;
        if (inst.targetX === undefined || inst.targetY === undefined) return;

        const dx = inst.targetX - (inst.x + inst.width / 2);
        const dy = inst.targetY - (inst.y + inst.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 5) {
          const speed = obj.properties.speed || 100;
          const angleToTarget = Math.atan2(dy, dx);
          let stepX = Math.cos(angleToTarget) * speed * dt;
          let stepY = Math.sin(angleToTarget) * speed * dt;

          const scene = ctx.engine.getCurrentScene();
          if (scene) {
            let collides = this.physics.previewSolidCollisionAt(
              inst.x + stepX, inst.y + stepY, inst.width, inst.height,
              scene, ctx.liveInstances
            );
            if (collides) {
              const deviations = [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2];
              let solved = false;
              for (const dev of deviations) {
                const tryAngle = angleToTarget + dev;
                stepX = Math.cos(tryAngle) * speed * dt;
                stepY = Math.sin(tryAngle) * speed * dt;
                if (!this.physics.previewSolidCollisionAt(
                  inst.x + stepX, inst.y + stepY, inst.width, inst.height,
                  scene, ctx.liveInstances
                )) {
                  solved = true;
                  break;
                }
              }
              if (!solved) { stepX = 0; stepY = 0; }
            }
          }

          inst.x += stepX;
          inst.y += stepY;
          if (stepX !== 0 || stepY !== 0) {
            inst.angle = Math.atan2(stepY, stepX) * (180 / Math.PI);
          }
        } else {
          delete inst.targetX;
          delete inst.targetY;
        }
      },
    });

    this.register({
      name: 'Physics',
      update: (ctx) => {
        const { inst, obj, dt } = ctx;
        const grav = obj.properties.gravity || 800;
        inst.vy += grav * dt;
        inst.vx *= 0.98;
        inst.vy *= 0.98;

        ctx.engine.move(inst, inst.vx * dt, inst.vy * dt);

        if (inst.onGround && Math.abs(inst.vx) > 10) {
          inst.angle += inst.vx * dt * 0.2;
        }
      },
    });

    this.register({
      name: 'Pin',
      update: (ctx) => {
        const { inst } = ctx;
        if (!inst.pinParentId) return;
        const parent = ctx.liveInstances.find(i => i.id === inst.pinParentId);
        if (!parent) return;

        const rad = (parent.angle * Math.PI) / 180;
        const offX = inst.pinOffsetX || 0;
        const offY = inst.pinOffsetY || 0;
        const rotatedX = offX * Math.cos(rad) - offY * Math.sin(rad);
        const rotatedY = offX * Math.sin(rad) + offY * Math.cos(rad);

        inst.x = parent.x + parent.width / 2 + rotatedX - inst.width / 2;
        inst.y = parent.y + parent.height / 2 + rotatedY - inst.height / 2;
        inst.angle = parent.angle + (inst.pinOffsetAngle || 0);
      },
    });
  }

  register(handler: BehaviorHandler) {
    this.handlers.set(handler.name, handler);
  }

  unregister(name: string) {
    this.handlers.delete(name);
  }

  updateBehaviors(ctx: BehaviorContext) {
    const { obj } = ctx;
    const behaviors = obj.behaviors || [];

    for (const behaviorName of behaviors) {
      const handler = this.handlers.get(behaviorName);
      if (handler) {
        handler.update(ctx);
      }
    }
  }

  destroy() {
    this.handlers.clear();
  }
}
