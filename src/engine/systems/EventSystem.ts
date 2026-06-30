import type { GameProject, EventBlock, ActionType, EventAction } from '../../types';
import type { LiveInstance } from '../types';
import { AudioSystem } from './AudioSystem';

export class EventSystem {
  private audio: AudioSystem;
  private onLog: (msg: string) => void;
  private engine: any;

  constructor(audio: AudioSystem, onLog: (msg: string) => void, engine: any) {
    this.audio = audio;
    this.onLog = onLog;
    this.engine = engine;
  }

  setEngine(engine: any) {
    this.engine = engine;
  }

  evaluateFrameEvents(events: EventBlock[], isStartup: boolean, liveInstances: LiveInstance[], globalVars: Record<string, number>, keysHeld: Record<string, boolean>, keysPressed: Record<string, boolean>) {
    for (const block of events) {
      this.evaluateEventBlock(block, isStartup, events, liveInstances, globalVars, keysHeld, keysPressed);
    }
  }

  private evaluateEventBlock(
    block: EventBlock,
    isStartup: boolean,
    events: EventBlock[],
    liveInstances: LiveInstance[],
    globalVars: Record<string, number>,
    keysHeld: Record<string, boolean>,
    keysPressed: Record<string, boolean>
  ) {
    if (block.conditions.length === 0) {
      for (const act of block.actions) {
        this.executeAction(act, events, liveInstances, globalVars, keysHeld, keysPressed);
      }
      if (block.subEvents) {
        for (const sub of block.subEvents) {
          this.evaluateEventBlock(sub, isStartup, events, liveInstances, globalVars, keysHeld, keysPressed);
        }
      }
      return;
    }

    let conditionsMet = true;

    for (const cond of block.conditions) {
      if (!conditionsMet) break;

      if (isStartup) {
        if (cond.type !== 'system_onload') {
          conditionsMet = false;
        }
        continue;
      }

      switch (cond.type) {
        case 'system_onload':
          conditionsMet = false;
          break;
        case 'system_tick':
          conditionsMet = true;
          break;
        case 'system_once': {
          const onceKey = `_once_${block.id}`;
          if ((globalVars as any)[onceKey]) {
            conditionsMet = false;
          } else {
            (globalVars as any)[onceKey] = 1;
            conditionsMet = true;
          }
          break;
        }
        case 'keyboard_keypress':
          conditionsMet = !!keysPressed[cond.param1 || ''];
          break;
        case 'keyboard_keyholding':
          conditionsMet = !!keysHeld[cond.param1 || ''];
          break;
        case 'keyboard_keyrelease': {
          conditionsMet = !!keysPressed[`_release_${cond.param1}`];
          break;
        }
        case 'mouse_click':
          conditionsMet = false;
          break;
        case 'object_click':
          conditionsMet = false;
          break;
        case 'function_called':
          conditionsMet = false;
          break;
        case 'gesture_touch':
          conditionsMet = false;
          break;
        case 'timer_elapsed':
          conditionsMet = false;
          break;
        case 'every_x_seconds': {
          const interval = parseFloat(cond.param1 || '1');
          if (interval > 0) {
            const key = `_timer_${block.id}`;
            if ((globalVars as any)[key] === undefined) (globalVars as any)[key] = 0;
            (globalVars as any)[key] += 1 / 60;
            conditionsMet = (globalVars as any)[key] >= interval;
            if (conditionsMet) (globalVars as any)[key] = 0;
          }
          break;
        }
        case 'every_x_ticks': {
          const tickInterval = parseInt(cond.param1 || '60');
          if (tickInterval > 0) {
            const key = `_tick_counter_${block.id}`;
            if ((globalVars as any)[key] === undefined) (globalVars as any)[key] = 0;
            (globalVars as any)[key] = ((globalVars as any)[key] + 1) % tickInterval;
            conditionsMet = (globalVars as any)[key] === 0;
          }
          break;
        }
        case 'object_collision': {
          const selfObj = cond.param1;
          const targetObj = cond.param2;
          let collisionOccurred = false;

          liveInstances.filter(a => a.objectTypeId === selfObj).forEach(instA => {
            liveInstances.filter(b => b.objectTypeId === targetObj).forEach(instB => {
              if (
                instA.x + instA.width > instB.x &&
                instA.x < instB.x + instB.width &&
                instA.y + instA.height > instB.y &&
                instA.y < instB.y + instB.height
              ) {
                collisionOccurred = true;
              }
            });
          });
          conditionsMet = collisionOccurred;
          break;
        }
        case 'object_distance': {
          const objA = cond.param1;
          const objB = cond.param2;
          const maxDist = parseFloat(cond.param3 || '100');
          let withinRange = false;
          liveInstances.filter(a => a.objectTypeId === objA).forEach(instA => {
            liveInstances.filter(b => b.objectTypeId === objB).forEach(instB => {
              const dx = (instA.x + instA.width / 2) - (instB.x + instB.width / 2);
              const dy = (instA.y + instA.height / 2) - (instB.y + instB.height / 2);
              if (Math.sqrt(dx * dx + dy * dy) <= maxDist) withinRange = true;
            });
          });
          conditionsMet = withinRange;
          break;
        }
        case 'object_count': {
          const objTypeId = cond.param1;
          const opCount = cond.param2 || '>';
          const countVal = parseInt(cond.param3 || '0');
          const count = liveInstances.filter(i => i.objectTypeId === objTypeId).length;
          switch (opCount) {
            case '==': conditionsMet = count === countVal; break;
            case '!=': conditionsMet = count !== countVal; break;
            case '>': conditionsMet = count > countVal; break;
            case '<': conditionsMet = count < countVal; break;
            case '>=': conditionsMet = count >= countVal; break;
            case '<=': conditionsMet = count <= countVal; break;
            default: conditionsMet = false;
          }
          break;
        }
        case 'instance_exists':
          conditionsMet = liveInstances.some(i => i.objectTypeId === cond.param1);
          break;
        case 'is_on_floor':
          conditionsMet = liveInstances.some(i => {
            if (cond.param1 && i.objectTypeId !== cond.param1) return false;
            return i.onGround;
          });
          break;
        case 'animation_finished':
          conditionsMet = liveInstances.some(i => {
            if (cond.param1 && i.objectTypeId !== cond.param1) return false;
            return i.animState?.finished ?? false;
          });
          break;
        case 'animation_current': {
          const targetAnimName = cond.param2 || '';
          conditionsMet = liveInstances.some(i => {
            if (cond.param1 && i.objectTypeId !== cond.param1) return false;
            return i.animState?.currentAnimation === targetAnimName;
          });
          break;
        }
        case 'health_compare': {
          const healthOp = cond.param2 || '==';
          const healthVal = parseFloat(cond.param3 || '0');
          conditionsMet = liveInstances.some(i => {
            if (cond.param1 && i.objectTypeId !== cond.param1) return false;
            const val = i.health;
            switch (healthOp) {
              case '==': return val === healthVal;
              case '!=': return val !== healthVal;
              case '>': return val > healthVal;
              case '<': return val < healthVal;
              case '>=': return val >= healthVal;
              case '<=': return val <= healthVal;
              default: return false;
            }
          });
          break;
        }
        case 'timer_elapsed_global': {
          const tName = cond.param1 || '';
          const tKey = `_instance_timer_${tName}`;
          conditionsMet = liveInstances.some(i => {
            if (!i.timerValue) return false;
            const remaining = i.timerValue[tName];
            return remaining !== undefined && remaining <= 0;
          });
          if (conditionsMet) {
            liveInstances.forEach(i => {
              if (i.timerValue) delete i.timerValue[tName];
            });
          }
          break;
        }
        default:
          break;
      }
    }

    if (conditionsMet && block.conditions.length > 0) {
      for (const act of block.actions) {
        this.executeAction(act, events, liveInstances, globalVars, keysHeld, keysPressed);
      }

      if (block.subEvents) {
        for (const sub of block.subEvents) {
          this.evaluateEventBlock(sub, isStartup, events, liveInstances, globalVars, keysHeld, keysPressed);
        }
      }
    }
  }

  triggerClickEvent(objectTypeId: string, events: EventBlock[], liveInstances: LiveInstance[], globalVars: Record<string, number>, keysHeld: Record<string, boolean>, keysPressed: Record<string, boolean>) {
    for (const block of events) {
      const match = block.conditions.find(c => c.type === 'object_click' && c.param1 === objectTypeId);
      if (match) {
        this.onLog(`Instância do Ator "${objectTypeId}" clicada. Executando folha de ações...`);
        for (const act of block.actions) {
          this.executeAction(act, events, liveInstances, globalVars, keysHeld, keysPressed);
        }
        if (block.subEvents) {
          for (const sub of block.subEvents) {
            this.evaluateEventBlock(sub, false, events, liveInstances, globalVars, keysHeld, keysPressed);
          }
        }
      }
    }
  }

  evaluateMouseClickEvents(events: EventBlock[], liveInstances: LiveInstance[], globalVars: Record<string, number>, keysHeld: Record<string, boolean>, keysPressed: Record<string, boolean>) {
    for (const block of events) {
      const match = block.conditions.find(c => c.type === 'mouse_click');
      if (match) {
        for (const act of block.actions) {
          this.executeAction(act, events, liveInstances, globalVars, keysHeld, keysPressed);
        }
      }
    }
  }

  private executeAction(
    act: EventAction,
    events: EventBlock[],
    liveInstances: LiveInstance[],
    globalVars: Record<string, number>,
    keysHeld: Record<string, boolean>,
    keysPressed: Record<string, boolean>
  ) {
    const targetId = act.targetObjectId;
    const type = act.type;
    const targets = targetId ? liveInstances.filter(i => i.objectTypeId === targetId) : [];

    switch (type) {
      case 'object_move': {
        const amtX = parseFloat(act.param1 || '0');
        const amtY = parseFloat(act.param2 || '0');
        targets.forEach(t => { t.x += amtX; t.y += amtY; });
        break;
      }
      case 'object_move_to': {
        const xVal = parseFloat(act.param1 || '0');
        const yVal = parseFloat(act.param2 || '0');
        targets.forEach(t => { t.targetX = xVal; t.targetY = yVal; });
        break;
      }
      case 'object_set_pos': {
        const xVal = parseFloat(act.param1 || '0');
        const yVal = parseFloat(act.param2 || '0');
        targets.forEach(t => { t.x = xVal; t.y = yVal; });
        break;
      }
      case 'object_destroy': {
        const idsToRemove = liveInstances.filter(i => i.objectTypeId === targetId).map(i => i.id);
        for (const id of idsToRemove) {
          const idx = liveInstances.findIndex(i => i.id === id);
          if (idx !== -1) liveInstances.splice(idx, 1);
        }
        this.onLog(`Objeto do tipo "${targetId}" destruído em lote.`);
        break;
      }
      case 'object_spawn': {
        const spawnObjectTypeId = act.param1;
        const targetHost = targets[0];
        if (targetHost && spawnObjectTypeId) {
          const newId = 'spawned_' + Math.random().toString(36).substr(2, 9);
          const project = this.engine.getProject();
          const projectObj = project?.objects.find((o: any) => o.id === spawnObjectTypeId);

          liveInstances.push({
            id: newId,
            objectTypeId: spawnObjectTypeId,
            x: targetHost.x + targetHost.width / 2,
            y: targetHost.y + targetHost.height / 2,
            width: 32,
            height: 32,
            angle: targetHost.angle,
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
            timerValue: {},
          });
          this.onLog(`Criado clone spawnado de: ${projectObj?.name || spawnObjectTypeId}`);
        }
        break;
      }
      case 'object_set_angle': {
        const deg = parseFloat(act.param1 || '0');
        targets.forEach(t => { t.angle = deg; });
        break;
      }
      case 'object_set_scale': {
        const scl = parseFloat(act.param1 || '1');
        targets.forEach(t => { t.width *= scl; t.height *= scl; });
        break;
      }
      case 'object_set_opacity': {
        const op = parseFloat(act.param1 || '1');
        targets.forEach(t => { t.opacity = op; });
        break;
      }
      case 'object_set_visible': {
        const visible = act.param1 !== 'false';
        if (!visible) {
          targets.forEach(t => { t.opacity = 0; });
        } else {
          targets.forEach(t => { t.opacity = 1; });
        }
        break;
      }
      case 'object_set_animation': {
        const animName = act.param1 || '';
        targets.forEach(t => {
          if (!t.animState) {
            t.animState = { currentAnimation: '', currentFrame: 0, frameTimer: 0, frameIndex: 0, finished: false, animationSpeed: 1 };
          }
          if (t.animState.currentAnimation !== animName) {
            t.animState.currentAnimation = animName;
            t.animState.frameIndex = 0;
            t.animState.frameTimer = 0;
            t.animState.finished = false;
          }
        });
        break;
      }
      case 'object_set_animation_speed': {
        const speedMult = parseFloat(act.param1 || '1');
        targets.forEach(t => {
          if (!t.animState) {
            t.animState = { currentAnimation: '', currentFrame: 0, frameTimer: 0, frameIndex: 0, finished: false, animationSpeed: 1 };
          }
          t.animState.animationSpeed = speedMult;
        });
        break;
      }
      case 'object_set_health': {
        const hp = parseFloat(act.param1 || '100');
        targets.forEach(t => { t.health = hp; });
        break;
      }
      case 'object_damage': {
        const dmg = parseFloat(act.param1 || '10');
        targets.forEach(t => { t.health = Math.max(0, t.health - dmg); });
        break;
      }
      case 'object_set_z_index': {
        const z = parseInt(act.param1 || '0');
        targets.forEach(t => { t.zIndex = z; });
        break;
      }
      case 'object_set_collision_layer': {
        const layerVal = parseInt(act.param1 || '1');
        targets.forEach(t => { t.collisionLayer = layerVal; });
        break;
      }
      case 'object_set_collision_mask': {
        const maskVal = parseInt(act.param1 || '65535');
        targets.forEach(t => { t.collisionMask = maskVal; });
        break;
      }
      case 'object_set_property': {
        const propName = act.param1 || '';
        const propVal = parseFloat(act.param2 || '0');
        targets.forEach(t => {
          if (propName === 'width') t.width = propVal;
          else if (propName === 'height') t.height = propVal;
          else if (propName === 'vx') t.vx = propVal;
          else if (propName === 'vy') t.vy = propVal;
          else if (propName === 'onGround') t.onGround = !!propVal;
        });
        break;
      }
      case 'particle_burst': {
        const burstCount = parseInt(act.param1 || '10');
        targets.forEach(t => {
          const engineParticles = this.engine.particles;
          if (engineParticles) {
            for (let i = 0; i < burstCount; i++) {
              engineParticles.emit({
                x: t.x + t.width / 2,
                y: t.y + t.height / 2,
                vx: (Math.random() - 0.5) * 200,
                vy: (Math.random() - 0.5) * 200,
                life: 0.3 + Math.random() * 0.7,
                maxLife: 1,
                size: 2 + Math.random() * 4,
                color: '#ffffff',
                alpha: 1,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 10,
              });
            }
          }
        });
        break;
      }
      case 'scene_transition': {
        const transType = act.param1 || 'fade';
        const transDuration = parseFloat(act.param2 || '1');
        const transTargetScene = act.param3 || '';
        const engine = this.engine;

        if (engine.transitions) {
          engine.transitions.start(transType, transDuration, () => {
            if (transTargetScene && engine.getProject()) {
              engine.getProject().currentSceneId = transTargetScene;
              engine.restartScene();
            }
          });
        }
        break;
      }
      case 'stop_all_particles': {
        const engineParticles = this.engine.particles;
        if (engineParticles) {
          engineParticles.clear();
        }
        break;
      }
      case 'object_flash': {
        const dur = parseFloat(act.param1 || '1');
        targets.forEach(t => { t.flashTimer = dur; });
        break;
      }
      case 'object_fade': {
        targets.forEach(t => { t.isFading = true; });
        break;
      }
      case 'play_sound': {
        const soundName = act.param1;
        const project = this.engine.getProject();
        const sound = project?.sounds.find((s: any) => s.name === soundName);
        if (sound) {
          this.audio.playSound(sound);
          this.onLog(`Sintetizador executando: ${soundName}`);
        }
        break;
      }
      case 'play_music': {
        const musicName = act.param1;
        const project = this.engine.getProject();
        const track = project?.music.find((m: any) => m.name === musicName);
        if (track) {
          this.audio.playMusic(track.bpm, track.notes, track.tempoLimit);
        }
        break;
      }
      case 'stop_music': {
        this.audio.stopMusic();
        break;
      }
      case 'system_set_variable': {
        const varName = act.param1 || '';
        const amt = parseFloat(act.param2 || '0');
        globalVars[varName] = amt;
        this.onLog(`Variável Global ${varName} definida para ${amt}`);
        break;
      }
      case 'system_add_variable': {
        const varName = act.param1 || '';
        const amt = parseFloat(act.param2 || '1');
        globalVars[varName] = (globalVars[varName] || 0) + amt;
        this.onLog(`Variável ${varName} agora é: ${globalVars[varName]}`);
        break;
      }
      case 'system_sub_variable': {
        const varName = act.param1 || '';
        const amt = parseFloat(act.param2 || '1');
        globalVars[varName] = (globalVars[varName] || 0) - amt;
        break;
      }
      case 'set_instance_variable': {
        const iVarName = act.param1 || '';
        const iVarVal = act.param2 || '0';
        const parsed = isNaN(parseFloat(iVarVal)) ? iVarVal : parseFloat(iVarVal);
        targets.forEach(t => { t.variables = { ...t.variables, [iVarName]: parsed }; });
        break;
      }
      case 'call_function': {
        const fName = act.param1 || '';
        this.onLog(`Chamando Função reutilizável: "${fName}"`);
        for (const block of events) {
          if (block.isFunction && block.funcName === fName) {
            for (const funcAct of block.actions) {
              this.executeAction(funcAct, events, liveInstances, globalVars, keysHeld, keysPressed);
            }
          }
        }
        break;
      }
      case 'dictionary_set': {
        const key = act.param1 || 'Chave';
        const val = act.param2 || '';
        const project = this.engine.getProject();
        if (project) {
          if (!project.dictionaries) project.dictionaries = [];
          if (project.dictionaries.length === 0) {
            project.dictionaries.push({ id: 'dict_inst', name: 'GlobalDict', entries: {} });
          }
          project.dictionaries[0].entries[key] = isNaN(parseFloat(val)) ? val : parseFloat(val);
        }
        this.onLog(`Dicionário Nativo: Alterado "${key}" para "${val}"`);
        break;
      }
      case 'array_push': {
        const val = act.param1 || '';
        const project = this.engine.getProject();
        if (project) {
          if (!project.arrays) project.arrays = [];
          if (project.arrays.length === 0) {
            project.arrays.push({ id: 'arr_inst', name: 'GlobalArray', values: [] });
          }
          project.arrays[0].values.push(isNaN(parseFloat(val)) ? val : parseFloat(val));
        }
        break;
      }
      case 'array_pop': {
        const project = this.engine.getProject();
        if (project?.arrays?.[0]) {
          project.arrays[0].values.pop();
        }
        break;
      }
      case 'array_clear': {
        const project = this.engine.getProject();
        if (project?.arrays?.[0]) {
          project.arrays[0].values = [];
        }
        break;
      }
      case 'timer_start': {
        const tName = act.param1 || 'timer';
        const secs = parseFloat(act.param2 || '2');
        targets.forEach(t => {
          if (!t.timerValue) t.timerValue = {};
          t.timerValue[tName] = secs;
        });
        this.onLog(`Temporizador "${tName}" fixado para expirar em ${secs}s`);
        break;
      }
      case 'wait': {
        break;
      }
      case 'go_to_layout': {
        const sceneId = act.param1 || '';
        const project = this.engine.getProject();
        if (project) {
          project.currentSceneId = sceneId;
          this.engine.restartScene();
        }
        break;
      }
      case 'restart_layout': {
        this.engine.restartScene();
        break;
      }
      case 'next_layout': {
        const project = this.engine.getProject();
        if (project) {
          const scenes = project.scenes;
          const currentIdx = scenes.findIndex(s => s.id === project.currentSceneId);
          if (currentIdx >= 0 && currentIdx < scenes.length - 1) {
            project.currentSceneId = scenes[currentIdx + 1].id;
            this.engine.restartScene();
          }
        }
        break;
      }
      case 'set_camera_position': {
        const cx = parseFloat(act.param1 || '0');
        const cy = parseFloat(act.param2 || '0');
        this.engine.setCameraPosition(cx, cy);
        break;
      }
      case 'scroll_to_object': {
        const objTypeId = act.param1 || '';
        const targets = liveInstances.filter(i => i.objectTypeId === objTypeId);
        if (targets.length > 0) {
          const t = targets[0];
          this.engine.setCameraPosition(t.x + t.width / 2, t.y + t.height / 2);
        }
        break;
      }
      case 'shake_camera': {
        this.engine.shakeCamera();
        break;
      }
      case 'log_message': {
        this.onLog(`[LOG] ${act.param1 || ''}`);
        break;
      }
      case 'broadcast_function': {
        const funcName = act.param1 || '';
        for (const block of events) {
          if (block.isFunction && block.funcName === funcName) {
            for (const funcAct of block.actions) {
              this.executeAction(funcAct, events, liveInstances, globalVars, keysHeld, keysPressed);
            }
          }
        }
        break;
      }
      case 'set_gravity': {
        const grav = parseFloat(act.param1 || '800');
        targets.forEach(t => {
          const obj = this.engine.getProject()?.objects.find((o: any) => o.id === t.objectTypeId);
          if (obj) obj.properties.gravity = grav;
        });
        break;
      }
      case 'set_velocity': {
        const vx = parseFloat(act.param1 || '0');
        const vy = parseFloat(act.param2 || '0');
        targets.forEach(t => { t.vx = vx; t.vy = vy; });
        break;
      }
      case 'apply_force': {
        const fx = parseFloat(act.param1 || '0');
        const fy = parseFloat(act.param2 || '0');
        targets.forEach(t => { t.vx += fx; t.vy += fy; });
        break;
      }
      default:
        break;
    }
  }

  destroy() {
    // cleanup
  }
}
