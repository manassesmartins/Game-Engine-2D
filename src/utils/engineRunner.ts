/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameProject, ProjectObject, ObjectInstance, EventBlock, ConditionType, ActionType, EventAction, SceneLayer } from '../types';

interface LiveInstance extends ObjectInstance {
  vx: number;
  vy: number;
  onGround: boolean;
  timer: number;
  health: number;
  sineAccumulator: number;
  initialX: number;
  initialY: number;
  
  // Construct 3 Behavior states
  flashTimer?: number;
  flashVisible?: boolean;
  fadeTimer?: number;
  isFading?: boolean;
  timerValue?: Record<string, number>;
  pinParentId?: string;
  pinOffsetX?: number;
  pinOffsetY?: number;
  pinOffsetAngle?: number;
  doubleJumpAvailable?: boolean;
  carVelocity?: number;

  // Pathfinding targets
  targetX?: number;
  targetY?: number;
}

export class EngineRunner {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private project: GameProject;
  private animationFrameId: number | null = null;
  private keysHeld: Record<string, boolean> = {};
  private keysPressedThisFrame: Record<string, boolean> = {};
  private liveInstances: LiveInstance[] = [];
  private globalVars: Record<string, number> = {};
  private hasStarted = false;
  private onDebugLog: (msg: string) => void;
  private audioCtx: AudioContext | null = null;

  // Camera variables
  private cameraX = 400;
  private cameraY = 300;
  
  // Periodic time variables for effects
  private globalTime = 0;

  constructor(canvas: HTMLCanvasElement, project: GameProject, onDebugLog: (msg: string) => void) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not acquire 2D canvas context');
    }
    this.ctx = context;
    this.project = project;
    this.onDebugLog = onDebugLog;
    this.globalVars = { ...project.globalVariables };
  }

  public start() {
    this.hasStarted = false;
    this.liveInstances = [];
    this.globalTime = 0;
    
    // Instantiate all objects from current scene
    const scene = this.project.scenes.find(s => s.id === this.project.currentSceneId);
    if (scene) {
      scene.instances.forEach(inst => {
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
          carVelocity: 0
        });
      });
    }

    // Initialize native lists and dicts inside runtime if empty
    if (!this.project.dictionaries) this.project.dictionaries = [];
    if (!this.project.arrays) this.project.arrays = [];

    this.setupListeners();
    this.onDebugLog('Jogo Iniciado. Carregando e executando gatilhos OnLoad...');
    
    // Evaluate System OnLoad Conditions on Start
    this.evaluateFrameEvents(true);
    this.hasStarted = true;

    // Loop
    this.loop();
  }

  public stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.removeListeners();
    this.onDebugLog('Jogo Pausado.');
  }

  private setupListeners() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('touchstart', this.handleTouchStart);
  }

  private removeListeners() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.handleMouseDown);
      this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const key = e.key;
    if (!this.keysHeld[key]) {
      this.keysPressedThisFrame[key] = true;
    }
    this.keysHeld[key] = true;
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keysHeld[e.key] = false;
    this.keysPressedThisFrame[e.key] = false;
  };

  private handleMouseDown = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + (this.cameraX - this.canvas.width / 2);
    const y = e.clientY - rect.top + (this.cameraY - this.canvas.height / 2);

    // Evaluate object clicks
    this.liveInstances.forEach(inst => {
      if (
        x >= inst.x &&
        x <= inst.x + inst.width &&
        y >= inst.y &&
        y <= inst.y + inst.height
      ) {
        this.triggerClickEvent(inst.objectTypeId);
      }
    });

    this.evaluateMouseClickEvents();
  };

  private handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left + (this.cameraX - this.canvas.width / 2);
      const y = touch.clientY - rect.top + (this.cameraY - this.canvas.height / 2);

      this.onDebugLog(`Toque detectado na posição global (${Math.round(x)}, ${Math.round(y)})`);
      this.project.events.forEach(block => {
        const match = block.conditions.find(c => c.type === 'gesture_touch');
        if (match) {
          block.actions.forEach(act => this.executeAction(act));
        }
      });
    }
  };

  private loop = () => {
    this.update();
    this.render();
    this.keysPressedThisFrame = {}; // clear single frame clicks
    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private update() {
    const dt = 1 / 60; // Fixed timestep
    this.globalTime += dt;

    // Execute Custom JS files integration on every frame context!
    this.runCustomScripts(dt);

    // Update timelines keyframes positions
    this.updateTimelines(dt);

    const scene = this.project.scenes.find(s => s.id === this.project.currentSceneId);
    const layoutW = scene?.width || 800;
    const layoutH = scene?.height || 600;

    // Resolve Behaviors: Platformer, 8Direction, Bullet, Sine, Car, Flash, Fade, Pin, Timer, Pathfinding
    this.liveInstances.forEach(inst => {
      const obj = this.project.objects.find(o => o.id === inst.objectTypeId);
      if (!obj) return;

      const behaviors = obj.behaviors || [];

      // 1. Sine Behavior
      if (behaviors.includes('Sine') || behaviors.includes('Sine')) {
        inst.sineAccumulator += dt;
        const amp = obj.properties.sineAmplitude || 50;
        const period = obj.properties.sinePeriod || 2;
        inst.x = inst.initialX + Math.sin((inst.sineAccumulator * Math.PI * 2) / period) * amp;
      }

      // 2. Bullet Behavior
      if (behaviors.includes('Bullet')) {
        const speed = obj.properties.bulletSpeed || 200;
        const gravityFactor = obj.properties.bulletGravity || 0;
        const angleRad = (inst.angle * Math.PI) / 180;
        
        inst.vx = Math.cos(angleRad) * speed;
        inst.vy += gravityFactor * 200 * dt;
        
        inst.x += inst.vx * dt;
        inst.y += inst.vy * dt;
      }

      // 3. 8Direction Behavior (Enhanced diagonal management and custom controls)
      if (behaviors.includes('8Direction')) {
        const speed = obj.properties.speed || 150;
        let dx = 0;
        let dy = 0;
        if (this.keysHeld['ArrowLeft'] || this.keysHeld['a'] || this.keysHeld['A']) dx = -1;
        if (this.keysHeld['ArrowRight'] || this.keysHeld['d'] || this.keysHeld['D']) dx = 1;
        if (this.keysHeld['ArrowUp'] || this.keysHeld['w'] || this.keysHeld['W']) dy = -1;
        if (this.keysHeld['ArrowDown'] || this.keysHeld['s'] || this.keysHeld['S']) dy = 1;

        if (dx !== 0 && dy !== 0) {
          dx *= 0.7071;
          dy *= 0.7071;
        }

        inst.x += dx * speed * dt;
        inst.y += dy * speed * dt;
        if (dx !== 0 || dy !== 0) {
          inst.angle = Math.atan2(dy, dx) * (180 / Math.PI);
        }
      }

      // 4. Car Behavior (Steering physics, traction delay drift, forward momentum)
      if (behaviors.includes('Car')) {
        const maxSpeed = obj.properties.carSpeed || 200;
        const acceleration = obj.properties.carAcceleration || 150;
        const deceleration = obj.properties.carDeceleration || 100;
        const turnSpeed = obj.properties.carTurnSpeed || 120; // deg/sec
        const driftFactor = obj.properties.carDriftFactor || 0.8; // higher = slide more

        let drive = 0;
        if (this.keysHeld['ArrowUp'] || this.keysHeld['w'] || this.keysHeld['W']) drive = 1;
        if (this.keysHeld['ArrowDown'] || this.keysHeld['s'] || this.keysHeld['S']) drive = -1;

        // Accelerate or brake
        if (drive !== 0) {
          inst.carVelocity = (inst.carVelocity || 0) + drive * acceleration * dt;
        } else {
          // Coast decay
          const v = inst.carVelocity || 0;
          if (v > 0) inst.carVelocity = Math.max(0, v - deceleration * dt);
          else if (v < 0) inst.carVelocity = Math.min(0, v + deceleration * dt);
        }

        // Clamp speed
        inst.carVelocity = Math.max(-maxSpeed * 0.4, Math.min(maxSpeed, inst.carVelocity || 0));

        // Steer
        if (Math.abs(inst.carVelocity || 0) > 5) {
          const steerDirection = (inst.carVelocity || 0) > 0 ? 1 : -1;
          if (this.keysHeld['ArrowLeft'] || this.keysHeld['a'] || this.keysHeld['A']) {
            inst.angle -= turnSpeed * steerDirection * dt;
          }
          if (this.keysHeld['ArrowRight'] || this.keysHeld['d'] || this.keysHeld['D']) {
            inst.angle += turnSpeed * steerDirection * dt;
          }
        }

        // Move with drift drag
        const angleRad = (inst.angle * Math.PI) / 180;
        const fwdX = Math.cos(angleRad) * (inst.carVelocity || 0);
        const fwdY = Math.sin(angleRad) * (inst.carVelocity || 0);

        // Interpolate velocity for drift sliding inertia
        inst.vx = inst.vx * driftFactor + fwdX * (1 - driftFactor);
        inst.vy = inst.vy * driftFactor + fwdY * (1 - driftFactor);

        inst.x += inst.vx * dt;
        inst.y += inst.vy * dt;
      }

      // 5. Platform Behavior (Gravity, speed, acceleration, Jump-thru checks, Double Jumps)
      if (behaviors.includes('Platform')) {
        const maxSpeed = obj.properties.speed || 150;
        const accel = obj.properties.acceleration || 600;
        const decel = obj.properties.deceleration || 850;
        const gravity = obj.properties.gravity || 800;
        const jumpStrength = obj.properties.jumpStrength || 380;
        const doubleJumpEnabled = obj.properties.doubleJump ?? true;

        // Apply horizontal controls (smooth speed lerp)
        let targetVx = 0;
        if (this.keysHeld['ArrowLeft'] || this.keysHeld['a'] || this.keysHeld['A']) targetVx = -maxSpeed;
        if (this.keysHeld['ArrowRight'] || this.keysHeld['d'] || this.keysHeld['D']) targetVx = maxSpeed;

        if (targetVx !== 0) {
          // accelerate
          if (targetVx > inst.vx) inst.vx = Math.min(targetVx, inst.vx + accel * dt);
          else inst.vx = Math.max(targetVx, inst.vx - accel * dt);
        } else {
          // decelerate
          if (inst.vx > 0) inst.vx = Math.max(0, inst.vx - decel * dt);
          else if (inst.vx < 0) inst.vx = Math.min(0, inst.vx + decel * dt);
        }

        // Apply gravity
        inst.vy += gravity * dt;

        // Jump triggers on key press frame
        const wantJump = this.keysPressedThisFrame['ArrowUp'] || 
                         this.keysPressedThisFrame['w'] || 
                         this.keysPressedThisFrame['W'] || 
                         this.keysPressedThisFrame[' '] || 
                         this.keysPressedThisFrame['space'];

        if (wantJump) {
          if (inst.onGround) {
            inst.vy = -jumpStrength;
            inst.onGround = false;
            inst.doubleJumpAvailable = true;
            this.playSynthSound('square', 330, 0.12, 0.02, 0.08); // micro retro jumped
          } else if (doubleJumpEnabled && inst.doubleJumpAvailable) {
            inst.vy = -jumpStrength * 0.9;
            inst.doubleJumpAvailable = false;
            this.playSynthSound('sine', 520, 0.15, 0.04, 0.1); // high double jump sfx
            this.onDebugLog('Pulo duplo executado!');
          }
        }

        // Apply Movement & Collision with Solids and JumpThru
        inst.x += inst.vx * dt;
        this.resolveSolidCollisions(inst, 'horizontal');

        inst.y += inst.vy * dt;
        this.resolveSolidCollisions(inst, 'vertical');
      }

      // 6. Bound to Layout Behavior can't exit screen limits
      if (behaviors.includes('BoundToLayout')) {
        inst.x = Math.max(0, Math.min(layoutW - inst.width, inst.x));
        inst.y = Math.max(0, Math.min(layoutH - inst.height, inst.y));
      }

      // 7. Flash Behavior (render alternating cycles)
      if (behaviors.includes('Flash')) {
        if (inst.flashTimer && inst.flashTimer > 0) {
          inst.flashTimer -= dt;
          if (Math.floor(inst.flashTimer * 12) % 2 === 0) {
            inst.flashVisible = false;
          } else {
            inst.flashVisible = true;
          }
          if (inst.flashTimer <= 0) {
            inst.flashVisible = true;
          }
        }
      }

      // 8. Fade Behavior (decay opacities + automatic destroy)
      if (behaviors.includes('Fade')) {
        if (inst.isFading) {
          const fadeDur = obj.properties.fadeDuration || 1.5;
          inst.opacity = Math.max(0, inst.opacity - (1 / fadeDur) * dt);
          if (inst.opacity <= 0) {
            // Destroy automatic
            this.liveInstances = this.liveInstances.filter(v => v.id !== inst.id);
            this.onDebugLog(`Instância de ${obj.name} destruída por comportamento Fade`);
          }
        }
      }

      // 9. Timer behavior ticks
      if (behaviors.includes('Timer')) {
        if (inst.timerValue) {
          Object.keys(inst.timerValue).forEach(tName => {
            if (inst.timerValue![tName] > 0) {
              inst.timerValue![tName] -= dt;
              if (inst.timerValue![tName] <= 0) {
                // Fire Event Trigger timer_elapsed!
                this.onDebugLog(`Temporizador "${tName}" finalizado em ${obj.name}!`);
                this.project.events.forEach(block => {
                  const match = block.conditions.find(c => c.type === 'timer_elapsed' && c.param1 === tName);
                  if (match) {
                    block.actions.forEach(act => this.executeAction(act));
                  }
                });
              }
            }
          });
        }
      }

      // 10. Pathfinding IA (Coordinates steps solver with obstacles deviation preview)
      if (behaviors.includes('Pathfinding')) {
        if (inst.targetX !== undefined && inst.targetY !== undefined) {
          const dx = inst.targetX - (inst.x + inst.width/2);
          const dy = inst.targetY - (inst.y + inst.height/2);
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          if (dist > 5) {
            const speed = obj.properties.speed || 100;
            const angleToTarget = Math.atan2(dy, dx);
            
            // Try straight step
            let stepX = Math.cos(angleToTarget) * speed * dt;
            let stepY = Math.sin(angleToTarget) * speed * dt;

            // Simple collision preview avoidance
            let collides = this.previewSolidCollisionAt(inst.x + stepX, inst.y + stepY, inst.width, inst.height);
            if (collides) {
              // Try alternate angled paths (deviation)
              const deviations = [Math.PI/4, -Math.PI/4, Math.PI/2, -Math.PI/2];
              let solved = false;
              for (const dev of deviations) {
                const tryAngle = angleToTarget + dev;
                stepX = Math.cos(tryAngle) * speed * dt;
                stepY = Math.sin(tryAngle) * speed * dt;
                if (!this.previewSolidCollisionAt(inst.x + stepX, inst.y + stepY, inst.width, inst.height)) {
                  solved = true;
                  break;
                }
              }
              if (!solved) {
                stepX = 0;
                stepY = 0;
              }
            }

            inst.x += stepX;
            inst.y += stepY;
            if (stepX !== 0 || stepY !== 0) {
              inst.angle = Math.atan2(stepY, stepX) * (180 / Math.PI);
            }
          } else {
            // Target coordinates reached
            delete inst.targetX;
            delete inst.targetY;
            this.onDebugLog(`IA Pathfinding: Destino alcançado por ${obj.name}`);
          }
        }
      }

      // 11. Physics Simulation (torque, weight gravity simulation)
      if (behaviors.includes('Physics')) {
        const mass = 1.0;
        const grav = obj.properties.gravity || 800;
        inst.vy += grav * dt;
        
        // simple friction drag decay
        inst.vx *= 0.98;
        inst.vy *= 0.98;

        inst.x += inst.vx * dt;
        this.resolveSolidCollisions(inst, 'horizontal');
        inst.y += inst.vy * dt;
        this.resolveSolidCollisions(inst, 'vertical');

        if (inst.onGround && Math.abs(inst.vx) > 10) {
          inst.angle += inst.vx * dt * 0.2; // spin
        }
      }

      // 12. Pin Behavior (Follow custom bound attachment targets)
      if (behaviors.includes('Pin')) {
        if (inst.pinParentId) {
          const parent = this.liveInstances.find(i => i.id === inst.pinParentId);
          if (parent) {
            const rad = (parent.angle * Math.PI) / 180;
            // rotation offset mapping formulas and follow
            const offX = inst.pinOffsetX || 0;
            const offY = inst.pinOffsetY || 0;
            
            const rotatedX = offX * Math.cos(rad) - offY * Math.sin(rad);
            const rotatedY = offX * Math.sin(rad) + offY * Math.cos(rad);
            
            inst.x = parent.x + parent.width / 2 + rotatedX - inst.width / 2;
            inst.y = parent.y + parent.height / 2 + rotatedY - inst.height / 2;
            inst.angle = parent.angle + (inst.pinOffsetAngle || 0);
          }
        }
      }
    });

    // Destroy items going way far outside of layout bounds natively
    this.liveInstances.forEach(inst => {
      if (inst.x < -1000 || inst.x > layoutW + 1000 || inst.y < -1000 || inst.y > layoutH + 1000) {
        this.liveInstances = this.liveInstances.filter(i => i.id !== inst.id);
        this.onDebugLog(`Instância caiu fora dos limites do mapa e foi destruída`);
      }
    });

    // Check custom trigger-based event sheet logic on current update ticked frame context
    this.evaluateFrameEvents(false);
  }

  private previewSolidCollisionAt(x: number, y: number, w: number, h: number): boolean {
    const scene = this.project.scenes.find(s => s.id === this.project.currentSceneId);
    if (!scene) return false;

    // test other solid instances
    for (const other of this.liveInstances) {
      const otherObj = this.project.objects.find(o => o.id === other.objectTypeId);
      if (otherObj?.behaviors.includes('Solid')) {
        if (x + w > other.x && x < other.x + other.width && y + h > other.y && y < other.y + other.height) {
          return true;
        }
      }
    }

    // test tile solids
    const gs = scene.gridSize;
    if (scene.tilemap && scene.tilemap.grid) {
      const minCol = Math.floor(x / gs);
      const maxCol = Math.ceil((x + w) / gs);
      const minRow = Math.floor(y / gs);
      const maxRow = Math.ceil((y + h) / gs);

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const val = scene.tilemap.grid[`${c},${r}`];
          if (val && val !== 2) { // solid grass/tiles
            const tLeft = c * gs;
            const tRight = (c+1) * gs;
            const tTop = r * gs;
            const tBottom = (r+1) * gs;

            if (x + w > tLeft && x < tRight && y + h > tTop && y < tBottom) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  private resolveSolidCollisions(inst: LiveInstance, direction: 'horizontal' | 'vertical') {
    const scene = this.project.scenes.find(s => s.id === this.project.currentSceneId);
    if (!scene) return;

    const gs = scene.gridSize;
    const tilemap = scene.tilemap;
    
    // Bounds check
    const instLeft = inst.x;
    const instRight = inst.x + inst.width;
    const instTop = inst.y;
    const instBottom = inst.y + inst.height;

    // Check other instances with 'Solid' or 'JumpThru' behavior
    this.liveInstances.forEach(other => {
      if (other.id === inst.id) return;
      const otherObj = this.project.objects.find(o => o.id === other.objectTypeId);
      if (!otherObj) return;

      const isSolid = otherObj.behaviors.includes('Solid');
      const isJumpThru = otherObj.behaviors.includes('JumpThru');

      if (!isSolid && !isJumpThru) return;

      if (
        instRight > other.x &&
        instLeft < other.x + other.width &&
        instBottom > other.y &&
        instTop < other.y + other.height
      ) {
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
        } else if (isJumpThru) {
          // JumpThru restricts collisions only strictly downwards when falling
          if (direction === 'vertical' && inst.vy >= 0) {
            const priorBottom = inst.y - inst.vy * (1/60) + inst.height;
            if (priorBottom <= other.y + 4) {
              inst.y = other.y - inst.height;
              inst.onGround = true;
              inst.vy = 0;
            }
          }
        }
      }
    });

    // Check tilemap layer solids
    if (tilemap && tilemap.grid) {
      const minCol = Math.floor(instLeft / gs);
      const maxCol = Math.ceil(instRight / gs);
      const minRow = Math.floor(instTop / gs);
      const maxRow = Math.ceil(instBottom / gs);

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const tileVal = tilemap.grid[`${c},${r}`];
          // Tile types: 1=Grass (Solid), 3=Tijolo (Solid), 4=Lava
          // Paint 2=Water (not solid)
          const isTileSolid = tileVal === 1 || tileVal === 3;
          
          if (tileVal !== undefined && isTileSolid) {
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
      }
    }
  }

  private evaluateFrameEvents(isStartup: boolean) {
    this.project.events.forEach(block => {
      this.evaluateEventBlock(block, isStartup);
    });
  }

  private evaluateEventBlock(block: EventBlock, isStartup: boolean) {
    let conditionsMet = true;

    block.conditions.forEach(cond => {
      if (!conditionsMet) return;

      if (isStartup) {
        if (cond.type !== 'system_onload') {
          conditionsMet = false;
        }
        return;
      }

      switch (cond.type) {
        case 'system_onload':
          conditionsMet = false; // already ran
          break;
        case 'system_tick':
          conditionsMet = true;
          break;
        case 'keyboard_keypress':
          conditionsMet = !!this.keysPressedThisFrame[cond.param1 || ''];
          break;
        case 'keyboard_keyholding':
          conditionsMet = !!this.keysHeld[cond.param1 || ''];
          break;
        case 'object_collision': {
          const selfObj = cond.param1;
          const targetObj = cond.param2;
          let collisionOccured = false;

          this.liveInstances.filter(a => a.objectTypeId === selfObj).forEach(instA => {
            this.liveInstances.filter(b => b.objectTypeId === targetObj).forEach(instB => {
              if (
                instA.x + instA.width > instB.x &&
                instA.x < instB.x + instB.width &&
                instA.y + instA.height > instB.y &&
                instA.y < instB.y + instB.height
              ) {
                collisionOccured = true;
              }
            });
          });
          conditionsMet = collisionOccured;
          break;
        }
      }
    });

    if (conditionsMet && block.conditions.length > 0) {
      block.actions.forEach(act => {
        this.executeAction(act);
      });

      // Execute Nested sub-events recursively (System Logic Filters)
      if (block.subEvents && block.subEvents.length > 0) {
        block.subEvents.forEach(sub => {
          this.evaluateEventBlock(sub, isStartup);
        });
      }
    }
  }

  private triggerClickEvent(objectTypeId: string) {
    this.project.events.forEach(block => {
      const match = block.conditions.find(c => c.type === 'object_click' && c.param1 === objectTypeId);
      if (match) {
        this.onDebugLog(`Instância do Ator "${objectTypeId}" clicada. Executando folha de ações...`);
        block.actions.forEach(act => this.executeAction(act));
        
        if (block.subEvents) {
          block.subEvents.forEach(sub => this.evaluateEventBlock(sub, false));
        }
      }
    });
  }

  private evaluateMouseClickEvents() {
    this.project.events.forEach(block => {
      const match = block.conditions.find(c => c.type === 'mouse_click');
      if (match) {
        block.actions.forEach(act => this.executeAction(act));
      }
    });
  }

  private executeAction(act: EventAction) {
    const targetId = act.targetObjectId;
    const type = act.type;

    const targets = this.liveInstances.filter(i => i.objectTypeId === targetId);

    switch (type) {
      case 'object_move': {
        const amtX = parseFloat(act.param1 || '0');
        const amtY = parseFloat(act.param2 || '0');
        targets.forEach(t => {
          t.x += amtX;
          t.y += amtY;
        });
        break;
      }
      case 'object_set_pos': {
        const xVal = parseFloat(act.param1 || '0');
        const yVal = parseFloat(act.param2 || '0');
        targets.forEach(t => {
          t.x = xVal;
          t.y = yVal;
        });
        break;
      }
      case 'object_destroy': {
        this.liveInstances = this.liveInstances.filter(i => i.objectTypeId !== targetId);
        this.onDebugLog(`Objeto do ID tipo "${targetId}" destruído em lote.`);
        break;
      }
      case 'object_spawn': {
        const spawnObjectTypeId = act.param1;
        const targetHost = targets[0];
        if (targetHost && spawnObjectTypeId) {
          const newId = 'spawned_' + Math.random().toString(36).substr(2, 9);
          const projectObj = this.project.objects.find(o => o.id === spawnObjectTypeId);
          
          this.liveInstances.push({
            id: newId,
            objectTypeId: spawnObjectTypeId,
            x: targetHost.x + targetHost.width / 2,
            y: targetHost.y + targetHost.height / 2,
            width: projectObj?.type === 'tilemap' ? 32 : 32,
            height: projectObj?.type === 'tilemap' ? 32 : 32,
            angle: targetHost.angle, // inherit direction
            opacity: 1,
            vx: 0,
            vy: 0,
            onGround: false,
            timer: 0,
            health: 100,
            sineAccumulator: 0,
            initialX: targetHost.x,
            initialY: targetHost.y,
            variables: {},
            flashTimer: 0,
            flashVisible: true,
            isFading: false,
            timerValue: {}
          });
          this.onDebugLog(`Criado clone spawnado de: ${projectObj?.name || spawnObjectTypeId}`);
        }
        break;
      }
      case 'object_set_angle': {
        const deg = parseFloat(act.param1 || '0');
        targets.forEach(t => {
          t.angle = deg;
        });
        break;
      }
      case 'object_set_scale': {
        const scl = parseFloat(act.param1 || '1');
        targets.forEach(t => {
          t.width = (this.project.objects.find(o => o.id === t.objectTypeId)?.properties.speed || 32) * scl;
          t.height = 32 * scl;
        });
        break;
      }
      case 'object_set_opacity': {
        const op = parseFloat(act.param1 || '1');
        targets.forEach(t => {
          t.opacity = op;
        });
        break;
      }
      case 'object_set_filter': {
        const fVal = act.param1 as any; // e.g. grayscale | sepia | water | warp
        targets.forEach(t => {
          t.effectFilter = fVal;
        });
        break;
      }
      case 'object_set_blend': {
        const bm = act.param1 as any; // screen | add | multiply
        targets.forEach(t => {
          t.blendMode = bm;
        });
        break;
      }
      case 'object_flash': {
        const dur = parseFloat(act.param1 || '1');
        targets.forEach(t => {
          t.flashTimer = dur;
        });
        break;
      }
      case 'object_fade': {
        targets.forEach(t => {
          t.isFading = true;
        });
        break;
      }
      case 'play_sound': {
        const soundName = act.param1;
        const sound = this.project.sounds.find(s => s.name === soundName);
        if (sound) {
          this.playSynthSound(sound.type, sound.frequency, sound.duration, sound.attack, sound.decay);
          this.onDebugLog(`Sintetizador executando: ${soundName}`);
        }
        break;
      }
      case 'system_set_variable': {
        const varName = act.param1 || '';
        const amt = parseFloat(act.param2 || '0');
        this.globalVars[varName] = amt;
        this.onDebugLog(`Variável Global ${varName} definida para ${amt}`);
        break;
      }
      case 'system_add_variable': {
        const varName = act.param1 || '';
        const amt = parseFloat(act.param2 || '1');
        if (this.globalVars[varName] !== undefined) {
          this.globalVars[varName] += amt;
        } else {
          this.globalVars[varName] = amt;
        }
        this.onDebugLog(`Variável ${varName} agora é: ${this.globalVars[varName]}`);
        break;
      }
      case 'call_function': {
        const fName = act.param1 || '';
        this.onDebugLog(`Chamando Função reutilizável: "${fName}"`);
        // Find custom function blocks in Event Sheet
        this.project.events.forEach(block => {
          if (block.isFunction && block.funcName === fName) {
            block.actions.forEach(funcAct => this.executeAction(funcAct));
          }
        });
        break;
      }
      case 'dictionary_set': {
        const key = act.param1 || 'Chave';
        const val = act.param2 || '';
        // Insert key in a standard mock system dictionary
        const targetDict = this.project.dictionaries?.[0] || { id: 'dict_inst', name: 'GlobalDict', entries: {} };
        if (!this.project.dictionaries) this.project.dictionaries = [];
        if (this.project.dictionaries.length === 0) {
          this.project.dictionaries.push(targetDict);
        }
        targetDict.entries[key] = isNaN(parseFloat(val)) ? val : parseFloat(val);
        this.onDebugLog(`Dicionário Nativo: Alterado "${key}" para "${val}"`);
        break;
      }
      case 'array_push': {
        const val = act.param1 || '';
        const targetArr = this.project.arrays?.[0] || { id: 'arr_inst', name: 'GlobalArray', values: [] };
        if (!this.project.arrays) this.project.arrays = [];
        if (this.project.arrays.length === 0) {
          this.project.arrays.push(targetArr);
        }
        targetArr.values.push(isNaN(parseFloat(val)) ? val : parseFloat(val));
        this.onDebugLog(`Lista Array Nativo: Inserido "${val}" (Tamanho total: ${targetArr.values.length})`);
        break;
      }
      case 'timer_start': {
        const tName = act.param1 || 'MinhasPortPort';
        const secs = parseFloat(act.param2 || '2');
        targets.forEach(t => {
          if (!t.timerValue) t.timerValue = {};
          t.timerValue[tName] = secs;
        });
        this.onDebugLog(`Temporizador "${tName}" fixado para expirar em ${secs}s`);
        break;
      }
    }
  }

  private updateTimelines(dt: number) {
    if (!this.project.timelines) return;
    this.project.timelines.forEach(seq => {
      if (!seq.playing) return;
      
      const targetInst = this.liveInstances.find(i => i.id === seq.targetInstanceId);
      if (!targetInst) return;

      // Increment clock
      if (!targetInst.timer) targetInst.timer = 0;
      targetInst.timer += dt;
      if (targetInst.timer > seq.duration) {
        if (seq.loop) {
          targetInst.timer = 0;
        } else {
          seq.playing = false;
          return;
        }
      }

      // Interpolate keyframes properties
      const keys = [...seq.keyframes].sort((a,b) => a.time - b.time);
      if (keys.length === 0) return;

      const currentTime = targetInst.timer;
      
      // Find bounding keyframes
      let prevK = keys[0];
      let nextK = keys[keys.length - 1];
      for (let i = 0; i < keys.length; i++) {
        if (keys[i].time <= currentTime) prevK = keys[i];
        if (keys[i].time >= currentTime) {
          nextK = keys[i];
          break;
        }
      }

      const segmentDuration = nextK.time - prevK.time;
      const t = segmentDuration === 0 ? 0 : (currentTime - prevK.time) / segmentDuration;

      // Apply coordinates layout
      if (prevK.x !== undefined && nextK.x !== undefined) targetInst.x = prevK.x + (nextK.x - prevK.x) * t;
      if (prevK.y !== undefined && nextK.y !== undefined) targetInst.y = prevK.y + (nextK.y - prevK.y) * t;
      if (prevK.angle !== undefined && nextK.angle !== undefined) targetInst.angle = prevK.angle + (nextK.angle - prevK.angle) * t;
      if (prevK.opacity !== undefined && nextK.opacity !== undefined) targetInst.opacity = prevK.opacity + (nextK.opacity - prevK.opacity) * t;
    });
  }

  private runCustomScripts(dt: number) {
    if (!this.project.scripts) return;
    this.project.scripts.forEach(script => {
      if (!script.active || !script.code.trim()) return;
      try {
        const context = {
          instances: this.liveInstances,
          globalVariables: this.globalVars,
          keys: this.keysHeld,
          dt: dt,
          log: (msg: string) => this.onDebugLog(`[ScriptJS] ${msg}`),
          setTarget: (instId: string, tx: number, ty: number) => {
            const inst = this.liveInstances.find(i => i.id === instId);
            if (inst) {
              inst.targetX = tx;
              inst.targetY = ty;
            }
          },
          spawn: (typeId: string, x: number, y: number) => {
            const newId = 'js_spawn_' + Math.random().toString(36).substr(2, 5);
            this.liveInstances.push({
              id: newId,
              objectTypeId: typeId,
              x, y,
              width: 32, height: 32,
              angle: 0, opacity: 1,
              vx: 0, vy: 0, onGround: false,
              timer: 0, health: 100, sineAccumulator: 0,
              initialX: x, initialY: y, variables: {}
            });
          }
        };
        const func = new Function('ctx', script.code);
        func(context);
      } catch (err: any) {
        if (Math.random() < 0.005) {
          this.onDebugLog(`Falha de processamento no script "${script.name}": ${err.message}`);
        }
      }
    });
  }

  private playSynthSound(type: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise', freq: number, duration: number, attack: number, decay: number) {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = type === 'noise' ? 'square' : type; // noise retro approx
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + attack);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + attack + decay + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + attack + decay + duration + 0.3);
    } catch (e) {
      console.warn('Synth playback audio failed', e);
    }
  }

  private render() {
    this.ctx.fillStyle = '#0f1015'; // pitch-dark void background
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const scene = this.project.scenes.find(s => s.id === this.project.currentSceneId);
    if (!scene) return;

    // 1. Establish Scrolling Camera from ScrollTo Followers
    let camX = scene.width / 2;
    let camY = scene.height / 2;
    const scrollTarget = this.liveInstances.find(inst => {
      const obj = this.project.objects.find(o => o.id === inst.objectTypeId);
      return obj?.behaviors.includes('ScrollTo');
    });

    if (scrollTarget) {
      camX = scrollTarget.x + scrollTarget.width / 2;
      camY = scrollTarget.y + scrollTarget.height / 2;
    }

    // Clamp camera within layout boundaries
    const halfW = this.canvas.width / 2;
    const halfH = this.canvas.height / 2;
    camX = Math.max(halfW, Math.min(scene.width - halfW, camX));
    camY = Math.max(halfH, Math.min(scene.height - halfH, camY));

    // Save camera center coordinates
    this.cameraX = camX;
    this.cameraY = camY;

    // Draw Parallax Layers
    const layers = scene.layers && scene.layers.length > 0 ? scene.layers : [
      { id: 'default_lay', name: 'Camada Principal', parallaxX: 1, parallaxY: 1, opacity: 1, visible: true }
    ];

    layers.forEach(lay => {
      if (!lay.visible) return;

      this.ctx.save();
      
      // Implement parallax calculations offsets using translation
      const translateX = halfW - camX * lay.parallaxX;
      const translateY = halfH - camY * lay.parallaxY;
      this.ctx.translate(translateX, translateY);
      this.ctx.globalAlpha = lay.opacity;

      // Draw Grid helper on main interactive layers only
      const gs = scene.gridSize;
      if (lay.parallaxX === 1.0) {
        this.ctx.strokeStyle = '#22232e';
        this.ctx.lineWidth = 1;
        for (let x = 0; x <= scene.width; x += gs) {
          this.ctx.beginPath();
          this.ctx.moveTo(x, 0);
          this.ctx.lineTo(x, scene.height);
          this.ctx.stroke();
        }
        for (let y = 0; y <= scene.height; y += gs) {
          this.ctx.beginPath();
          this.ctx.moveTo(0, y);
          this.ctx.lineTo(scene.width, y);
          this.ctx.stroke();
        }
      }

      // Draw Tiles (for interactive ground maps)
      if (lay.id === 'default_lay' || lay.name.toLowerCase().includes('main') || lay.name.toLowerCase().includes('principal')) {
        const tilemap = scene.tilemap;
        if (tilemap && tilemap.grid) {
          Object.entries(tilemap.grid).forEach(([coords, tileType]) => {
            const [col, row] = coords.split(',').map(Number);
            const x = col * gs;
            const y = row * gs;

            // Custom tile types rendering
            if (tileType === 1) { // Grass
              this.ctx.fillStyle = '#10b981';
              this.ctx.fillRect(x, y, gs, gs);
              this.ctx.fillStyle = '#059669';
              this.ctx.fillRect(x, y, gs, 6);
            } else if (tileType === 2) { // Water (Water Distort simulation)
              const waveOff = Math.sin(this.globalTime * 6 + col) * 3;
              this.ctx.fillStyle = '#0ea5e9';
              this.ctx.fillRect(x, y + waveOff / 3, gs, gs);
            } else if (tileType === 3) { // Brick/Obstacle
              this.ctx.fillStyle = '#d97706';
              this.ctx.fillRect(x, y, gs, gs);
              this.ctx.strokeStyle = '#92400e';
              this.ctx.lineWidth = 1;
              this.ctx.strokeRect(x, y, gs, gs);
            } else if (tileType === 4) { // Lava
              const lavaPulse = 10 + Math.sin(this.globalTime * 8) * 4;
              this.ctx.fillStyle = `rgb(${220 + lavaPulse}, 38, 38)`;
              this.ctx.fillRect(x, y, gs, gs);
            }
          });
        }
      }

      // Draw active Sprite instances for this layer
      this.liveInstances.forEach(inst => {
        // layer filter association check (fits fallback layer if none is designated)
        const isDefault = (lay.id === 'default_lay' || lay.id === 'main_layer');
        const instLayer = inst.layerId || 'default_lay';
        if (instLayer !== lay.id && !(instLayer === 'default_lay' && isDefault)) {
          return;
        }

        if (inst.flashVisible === false) return; // Flash behavior bypass

        const obj = this.project.objects.find(o => o.id === inst.objectTypeId);
        if (!obj) return;

        this.ctx.save();
        this.ctx.translate(inst.x + inst.width / 2, inst.y + inst.height / 2);
        this.ctx.rotate((inst.angle * Math.PI) / 180);
        this.ctx.globalAlpha = inst.opacity;

        // Custom Shaders & Filters support
        let filterStr = 'none';
        if (inst.effectFilter === 'grayscale') filterStr = 'grayscale(100%)';
        else if (inst.effectFilter === 'sepia') filterStr = 'sepia(100%)';
        else if (inst.effectFilter === 'blur') filterStr = 'blur(4px)';
        else if (inst.effectFilter === 'glow') filterStr = 'brightness(1.5) drop-shadow(0 0 8px rgba(253,224,71,0.8))';
        else if (inst.effectFilter === 'water') {
          // wave ripple offset
          const ripple = Math.sin(this.globalTime * 10) * 0.15;
          this.ctx.scale(1 + ripple, 1 - ripple);
        } else if (inst.effectFilter === 'warp') {
          const twist = Math.cos(this.globalTime * 8) * 0.25;
          this.ctx.transform(1, twist, 0, 1, 0, 0);
        }
        
        this.ctx.filter = filterStr;

        // Blend modes support
        if (inst.blendMode === 'add') this.ctx.globalCompositeOperation = 'lighter';
        else if (inst.blendMode === 'multiply') this.ctx.globalCompositeOperation = 'multiply';
        else if (inst.blendMode === 'screen') this.ctx.globalCompositeOperation = 'screen';
        else this.ctx.globalCompositeOperation = 'source-over';

        // Custom origin calculations
        const ox = inst.originX ?? 0.5;
        const oy = inst.originY ?? 0.5;

        const renderX = -inst.width * ox;
        const renderY = -inst.height * oy;

        const frame = obj.frames?.[0]; // draw active pixel art
        if (frame && frame.pixels && frame.pixels.length > 0) {
          const pxW = inst.width / frame.width;
          const pxH = inst.height / frame.height;
          for (let r = 0; r < frame.height; r++) {
            for (let c = 0; c < frame.width; c++) {
              const color = frame.pixels[r * frame.width + c];
              if (color) {
                this.ctx.fillStyle = color;
                this.ctx.fillRect(
                  renderX + c * pxW,
                  renderY + r * pxH,
                  pxW + 0.3,
                  pxH + 0.3
                );
              }
            }
          }
        } else {
          // Fallback solid rectangular box
          this.ctx.fillStyle = obj.primaryColor || '#ec4899';
          this.ctx.fillRect(renderX, renderY, inst.width, inst.height);
        }

        // Draw custom collision polygon lines for visual clarity if editor is in focus
        if (inst.collisionPolygon && inst.collisionPolygon.length > 0) {
          this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
          this.ctx.lineWidth = 1.5;
          this.ctx.beginPath();
          inst.collisionPolygon.forEach((vertexArr, ptIdx) => {
            const vxX = renderX + vertexArr[0] * inst.width;
            const vxY = renderY + vertexArr[1] * inst.height;
            if (ptIdx === 0) this.ctx.moveTo(vxX, vxY);
            else this.ctx.lineTo(vxX, vxY);
          });
          this.ctx.closePath();
          this.ctx.stroke();
        }

        this.ctx.restore();
      });

      this.ctx.restore();
    });

    // 4. Render HUD Panel (Variables, list assets counters, native Dictionary & List logs)
    this.ctx.fillStyle = 'rgba(10, 11, 16, 0.9)';
    const hudHeight = 35 + Object.keys(this.globalVars).length * 15 + 
      ((this.project.dictionaries?.length || 0) > 0 ? 30 : 0) + 
      ((this.project.arrays?.length || 0) > 0 ? 30 : 0);

    this.ctx.fillRect(15, 15, 230, hudHeight);
    this.ctx.strokeStyle = '#2d2e38';
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeRect(15, 15, 230, hudHeight);

    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = 'bold 9px "JetBrains Mono", monospace';
    this.ctx.fillText('[PAINEL DE DADOS - HUD]', 24, 28);

    let offset = 42;
    Object.entries(this.globalVars).forEach(([key, val]) => {
      this.ctx.font = '8px "JetBrains Mono", monospace';
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.fillText(`${key}:`, 24, offset);
      this.ctx.fillStyle = '#10b981';
      this.ctx.fillText(`${val}`, 140, offset);
      offset += 14;
    });

    // Native Dictionary logs
    if (this.project.dictionaries && this.project.dictionaries.length > 0) {
      const d = this.project.dictionaries[0];
      const entryCount = Object.keys(d.entries).length;
      this.ctx.fillStyle = '#e2e8f0';
      this.ctx.fillText(`Dicionário (${d.name}):`, 24, offset);
      this.ctx.fillStyle = '#6366f1';
      this.ctx.fillText(`${entryCount} chaves salvas`, 140, offset);
      offset += 14;
    }

    // Native Array logs
    if (this.project.arrays && this.project.arrays.length > 0) {
      const a = this.project.arrays[0];
      this.ctx.fillStyle = '#e2e8f0';
      this.ctx.fillText(`Array Lista (${a.name}):`, 24, offset);
      this.ctx.fillStyle = '#a855f7';
      this.ctx.fillText(`[${a.values.slice(-3).join(', ')}${a.values.length > 3 ? '...' : ''}] (${a.values.length})`, 140, offset);
      offset += 14;
    }

    // Interactive indicators
    this.ctx.fillStyle = 'rgba(15, 16, 22, 0.7)';
    this.ctx.fillRect(15, this.canvas.height - 35, this.canvas.width - 30, 22);
    this.ctx.font = '8px "Inter", sans-serif';
    this.ctx.fillStyle = '#cbd5e1';
    this.ctx.fillText('⚡ LÓGICA NO-CODE CONSTRUCT 3: Event Sheets ativos. Câmera acompanha o objeto com comportamento Scroll To.', 25, this.canvas.height - 21);
  }
}
