import type { GameProject, Scene, EventBlock } from '../../types';
import type { LiveInstance, EngineOptions, EngineStats, BehaviorContext } from '../types';
import { Camera } from './Camera';
import { InputSystem } from '../systems/InputSystem';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { BehaviorSystem } from '../systems/BehaviorSystem';
import { EventSystem } from '../systems/EventSystem';
import { RenderSystem } from '../systems/RenderSystem';
import { ParticleSystem } from '../systems/ParticleSystem';
import { AnimationSystem } from '../systems/AnimationSystem';
import { SceneTransitionSystem } from '../systems/SceneTransitionSystem';

export class Engine {
  public input: InputSystem;
  public physics: PhysicsSystem;
  public audio: AudioSystem;
  public behaviors: BehaviorSystem;
  public events: EventSystem;
  public renderer: RenderSystem;
  public particles: ParticleSystem;
  public camera: Camera;
  public animations: AnimationSystem;
  public transitions: SceneTransitionSystem;

  private project: GameProject;
  private liveInstances: LiveInstance[] = [];
  private globalVars: Record<string, number> = {};
  private globalTime = 0;
  private animFrameId: number | null = null;
  private running = false;
  private onLog: (msg: string) => void;
  private debugMode: boolean;
  private showHUD: boolean;
  private restartRequested = false;

  // Stats
  private fps = 60;
  private frameCount = 0;
  private fpsAccum = 0;

  constructor(canvas: HTMLCanvasElement, project: GameProject, options: EngineOptions = {}) {
    this.project = project;
    this.onLog = options.onLog || (() => {});
    this.debugMode = options.debug ?? false;
    this.showHUD = options.showHUD ?? true;

    const scene = this.getCurrentScene();
    const w = scene?.width || canvas.width || 800;
    const h = scene?.height || canvas.height || 600;

    this.camera = new Camera(w, h);
    this.input = new InputSystem(canvas);
    this.physics = new PhysicsSystem(options);
    this.audio = new AudioSystem();
    this.renderer = new RenderSystem(canvas, this.camera);
    this.particles = new ParticleSystem();
    this.animations = new AnimationSystem();
    this.transitions = new SceneTransitionSystem();
    this.behaviors = new BehaviorSystem(this.physics, this.audio);
    this.events = new EventSystem(this.audio, this.onLog, this);

    this.globalVars = { ...project.globalVariables };
  }

  getProject(): GameProject {
    return this.project;
  }

  getCurrentScene(): Scene | undefined {
    return this.project.scenes.find(s => s.id === this.project.currentSceneId);
  }

  getLiveInstances(): LiveInstance[] {
    return this.liveInstances;
  }

  getGlobalVars(): Record<string, number> {
    return this.globalVars;
  }

  setCameraPosition(x: number, y: number) {
    const scene = this.getCurrentScene();
    if (scene) {
      this.camera.follow(x, y, scene.width, scene.height);
    }
  }

  shakeCamera() {
    const scene = this.getCurrentScene();
    if (!scene) return;
    const origX = this.camera.x;
    const origY = this.camera.y;
    let elapsed = 0;
    const duration = 0.3;
    const intensity = 10;

    const shakeLoop = () => {
      elapsed += 1 / 60;
      if (elapsed >= duration) {
        this.camera.x = origX;
        this.camera.y = origY;
        return;
      }
      this.camera.x = origX + (Math.random() - 0.5) * intensity * (1 - elapsed / duration);
      this.camera.y = origY + (Math.random() - 0.5) * intensity * (1 - elapsed / duration);
      requestAnimationFrame(shakeLoop);
    };
    shakeLoop();
  }

  destroyInstance(id: string) {
    const idx = this.liveInstances.findIndex(i => i.id === id);
    if (idx !== -1) {
      this.liveInstances.splice(idx, 1);
    }
  }

  fireTimerEvent(timerName: string) {
    this.onLog(`Temporizador "${timerName}" finalizado!`);
    for (const block of this.project.events) {
      const match = block.conditions.find(c => c.type === 'timer_elapsed' && c.param1 === timerName);
      if (match) {
        for (const act of block.actions) {
          this.events['executeAction'](act, this.project.events, this.liveInstances, this.globalVars,
            this.input.keysHeld, this.input.keysPressed);
        }
      }
    }
  }

  restartScene() {
    this.restartRequested = true;
  }

  move(inst: LiveInstance, dx: number, dy: number) {
    const scene = this.getCurrentScene();
    if (!scene) return;

    inst.x += dx;
    if (dx !== 0) {
      this.physics.resolveCollisions(inst, 'horizontal', scene, this.liveInstances);
    }

    inst.y += dy;
    if (dy !== 0) {
      this.physics.resolveCollisions(inst, 'vertical', scene, this.liveInstances);
    }
  }

  start() {
    this.running = true;
    this.globalTime = 0;
    this.liveInstances = [];
    this.restartRequested = false;
    this.transitions.clear();

    const scene = this.getCurrentScene();
    if (scene) {
      for (const inst of scene.instances) {
        const objType = this.project.objects.find(o => o.id === inst.objectTypeId);
        this.liveInstances.push({
          ...inst,
          vx: 0,
          vy: 0,
          onGround: false,
          timer: 0,
          health: 100,
          sineAccumulator: 0,
          initialX: inst.x,
          initialY: inst.y,
          variables: { ...inst.variables },
          flashTimer: 0,
          flashVisible: true,
          fadeTimer: 0,
          isFading: false,
          timerValue: {},
          doubleJumpAvailable: true,
          carVelocity: 0,
          collisionLayer: 1 << 0,
          collisionMask: 0xFFFF,
          zIndex: 0,
          animState: objType ? this.animations.initAnimationState(
            { ...inst, vx: 0, vy: 0, onGround: false, timer: 0, health: 100, sineAccumulator: 0, initialX: inst.x, initialY: inst.y, variables: {} },
            objType
          ) : undefined,
        });
      }
    }

    if (!this.project.dictionaries) this.project.dictionaries = [];
    if (!this.project.arrays) this.project.arrays = [];

    if (scene) {
      this.camera.reset(scene.width, scene.height);
    }

    const logFn = this.onLog;
    logFn('Engine 2D Modular Iniciada. Executando gatilhos OnLoad...');

    this.events.evaluateFrameEvents(this.project.events, true, this.liveInstances, this.globalVars,
      this.input.keysHeld, this.input.keysPressed);

    this.loop();
  }

  stop() {
    this.running = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.onLog('Engine Pausada.');
  }

  destroy() {
    this.stop();
    this.input.destroy();
    this.audio.destroy();
    this.behaviors.destroy();
    this.events.destroy();
    this.renderer.destroy();
    this.particles.destroy();
    this.physics.destroy();
    this.animations.destroy();
    this.transitions.destroy();
  }

  private loop = () => {
    if (!this.running) return;

    if (this.restartRequested) {
      this.stop();
      this.start();
      return;
    }

    const dt = 1 / 60;
    this.globalTime += dt;

    this.input.updateGamepads();
    this.update(dt);
    this.render();

    // FPS calculation
    this.frameCount++;
    this.fpsAccum += dt;
    if (this.fpsAccum >= 1) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsAccum = 0;
    }

    this.input.endFrame();
    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    const scene = this.getCurrentScene();
    if (!scene) return;

    // Update scene transition
    this.transitions.update(dt);

    // Update animations
    for (const inst of this.liveInstances) {
      const obj = this.project.objects.find(o => o.id === inst.objectTypeId);
      if (obj) {
        this.animations.update(dt, inst, obj);
      }
    }

    // Update particles
    this.particles.update(dt);

    // Update instance timers
    for (const inst of this.liveInstances) {
      if (inst.timerValue) {
        for (const key of Object.keys(inst.timerValue)) {
          if (inst.timerValue[key] > 0) {
            inst.timerValue[key] -= dt;
          }
        }
      }
    }

    // Run custom scripts
    this.runCustomScripts(dt);

    // Rebuild spatial grid for optimized collision
    this.physics.rebuildSpatialGrid(this.liveInstances);

    // Update behaviors for each instance
    for (const inst of this.liveInstances) {
      const obj = this.project.objects.find(o => o.id === inst.objectTypeId);
      if (!obj) continue;

      const ctx: BehaviorContext = {
        inst,
        obj,
        dt,
        keysHeld: this.input.keysHeld,
        keysPressed: this.input.keysPressed,
        globalTime: this.globalTime,
        liveInstances: this.liveInstances,
        engine: this,
      };

      this.behaviors.updateBehaviors(ctx);
    }

    // Destroy instances that go out of bounds or have no health
    this.liveInstances = this.liveInstances.filter(inst => {
      if (inst.health <= 0) {
        this.onLog(`Instância morreu e foi destruída`);
        return false;
      }
      if (inst.x < -2000 || inst.x > (scene.width || 800) + 2000 ||
          inst.y < -2000 || inst.y > (scene.height || 600) + 2000) {
        this.onLog(`Instância caiu fora dos limites e foi destruída`);
        return false;
      }
      return true;
    });

    // Evaluate event sheet
    this.events.evaluateFrameEvents(this.project.events, false, this.liveInstances, this.globalVars,
      this.input.keysHeld, this.input.keysPressed);
  }

  private render() {
    const scene = this.getCurrentScene();
    if (!scene) return;

    // Find scroll target
    const scrollTarget = this.liveInstances.find(inst => {
      const obj = this.project.objects.find(o => o.id === inst.objectTypeId);
      return obj?.behaviors.includes('ScrollTo');
    });

    // Update renderer time
    this.renderer.setGlobalTime(this.globalTime);
    this.renderer.setBackgroundColor(this.project.settings.backgroundColor || '#0f1015');

    // Render scene
    this.renderer.render(scene, this.liveInstances, this.project.objects, scrollTarget, this.animations);

    // Render transition overlay
    if (this.transitions.isActive()) {
      const ctx = this.renderer.getContext();
      ctx.save();

      const alpha = this.transitions.getAlpha();
      const scale = this.transitions.getScale();
      const offsetX = this.transitions.getOffsetX() * (scene.width || 800);
      const offsetY = this.transitions.getOffsetY() * (scene.height || 600);

      if (scale !== 1) {
        const cx = (scene.width || 800) / 2;
        const cy = (scene.height || 600) / 2;
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);
      }

      if (offsetX !== 0 || offsetY !== 0) {
        ctx.translate(offsetX, offsetY);
      }

      // Draw transition overlay
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.fillRect(0, 0, scene.width || 800, scene.height || 600);

      ctx.restore();
    }

    // Render particles
    this.renderer.getContext().save();
    this.renderer.getContext().translate(
      this.camera.halfWidth - this.camera.x,
      this.camera.halfHeight - this.camera.y
    );
    this.particles.render(
      this.renderer.getContext(),
      this.camera.x, this.camera.y,
      this.camera.halfWidth, this.camera.halfHeight
    );
    this.renderer.getContext().restore();

    // Render HUD
    if (this.showHUD) {
      this.renderer.renderHUD(
        this.globalVars,
        this.project.dictionaries || [],
        this.project.arrays || []
      );
    }

    // Debug overlay
    if (this.debugMode) {
      this.renderer.renderDebug({
        fps: this.fps,
        instanceCount: this.liveInstances.length,
        particleCount: this.particles.count,
      });
    }
  }

  private runCustomScripts(dt: number) {
    if (!this.project.scripts) return;

    for (const script of this.project.scripts) {
      if (!script.active || !script.code.trim()) continue;

      try {
        const context = {
          instances: this.liveInstances,
          globalVariables: this.globalVars,
          keys: this.input.keysHeld,
          dt,
          log: (msg: string) => this.onLog(`[ScriptJS] ${msg}`),
          setTarget: (instId: string, tx: number, ty: number) => {
            const inst = this.liveInstances.find(i => i.id === instId);
            if (inst) {
              inst.targetX = tx;
              inst.targetY = ty;
            }
          },
          spawn: (typeId: string, x: number, y: number) => {
            const newId = 'js_spawn_' + Math.random().toString(36).substr(2, 5);
            const projectObj = this.project.objects.find(o => o.id === typeId);
            this.liveInstances.push({
              id: newId,
              objectTypeId: typeId,
              x, y,
              width: 32, height: 32,
              angle: 0, opacity: 1,
              vx: 0, vy: 0, onGround: false,
              timer: 0, health: 100, sineAccumulator: 0,
              initialX: x, initialY: y, variables: {},
              flashTimer: 0, flashVisible: true,
              isFading: false, timerValue: {},
              collisionLayer: 1 << 0,
              collisionMask: 0xFFFF,
              zIndex: 0,
              animState: projectObj ? this.animations.initAnimationState(
                { id: newId, objectTypeId: typeId, x, y, width: 32, height: 32, angle: 0, opacity: 1, vx: 0, vy: 0, onGround: false, timer: 0, health: 100, sineAccumulator: 0, initialX: x, initialY: y, variables: {} },
                projectObj
              ) : undefined,
            });
          },
          getObject: (name: string) => {
            return this.liveInstances.filter(i => {
              const o = this.project.objects.find(obj => obj.id === i.objectTypeId);
              return o?.name === name;
            });
          },
        };

        const func = new Function('ctx', script.code);
        func(context);
      } catch {
        // Script error silently
      }
    }
  }

  getStats(): EngineStats {
    return {
      fps: this.fps,
      dt: 1 / 60,
      instanceCount: this.liveInstances.length,
      particleCount: this.particles.count,
    };
  }
}
