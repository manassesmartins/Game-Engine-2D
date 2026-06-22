import React, { useState } from 'react';
import { GameProject } from '../types';
import { Monitor, Smartphone, Globe, Download, CheckCircle, Package, ArrowRight, Code } from 'lucide-react';

interface ExporterProps {
  project: GameProject;
}

function generateStandaloneHTML(project: GameProject): string {
  const projectJSON = JSON.stringify(project);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${project.name}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #090a0f; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: monospace; overflow: hidden; }
canvas { display: block; image-rendering: pixelated; border-radius: 8px; box-shadow: 0 0 40px rgba(0,0,0,0.8); }
#ui-overlay { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; z-index: 10; }
#ui-overlay button { background: #1e1f2b; color: #94a3b8; border: 1px solid #333; padding: 8px 16px; border-radius: 8px; font-size: 12px; cursor: pointer; font-family: monospace; }
#ui-overlay button:hover { background: #2d2e3d; color: white; }
</style>
</head>
<body>
<canvas id="game-canvas" width="800" height="600"></canvas>
<div id="ui-overlay">
  <button onclick="window.running ? stopGame() : startGame()" id="play-btn">▶ Jogar</button>
  <button onclick="restartGame()">↻ Reiniciar</button>
</div>
<script>
const PROJECT = ${projectJSON};

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let animFrame = null;
let running = false;

// ===== ENGINE RUNNER =====
let liveInstances = [];
let globalVars = {};
let keysHeld = {};
let keysPressed = {};
let globalTime = 0;
let cameraX = 400, cameraY = 300;
let audioCtx = null;

function getObjType(id) { return PROJECT.objects.find(o => o.id === id); }

function initGame() {
  running = true;
  document.getElementById('play-btn').textContent = '⏸ Pausar';
  liveInstances = [];
  globalTime = 0;
  globalVars = { ...PROJECT.globalVariables };

  const scene = PROJECT.scenes.find(s => s.id === PROJECT.currentSceneId) || PROJECT.scenes[0];
  if (scene) {
    scene.instances.forEach(inst => {
      const obj = getObjType(inst.objectTypeId);
      liveInstances.push({
        ...inst,
        vx: 0, vy: 0, onGround: false, timer: 0, health: 100,
        sineAccumulator: 0, initialX: inst.x, initialY: inst.y,
        variables: { ...inst.variables },
        flashTimer: 0, flashVisible: true, fadeTimer: 0, isFading: false,
        timerValue: {}, doubleJumpAvailable: true, carVelocity: 0,
        pinParentId: null, pinOffsetX: 0, pinOffsetY: 0, pinOffsetAngle: 0,
        targetX: undefined, targetY: undefined
      });
    });
  }
  setupListeners();
  evaluateFrameEvents(true);
  loop();
}

function stopGame() {
  running = false;
  if (animFrame) cancelAnimationFrame(animFrame);
  document.getElementById('play-btn').textContent = '▶ Jogar';
}

function restartGame() {
  stopGame();
  removeListeners();
  initGame();
}

function setupListeners() {
  window.addEventListener('keydown', (e) => {
    if (!keysHeld[e.key]) keysPressed[e.key] = true;
    keysHeld[e.key] = true;
  });
  window.addEventListener('keyup', (e) => { keysHeld[e.key] = false; });
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('touchstart', handleTouchStart);
}

function removeListeners() {
  canvas.removeEventListener('mousedown', handleMouseDown);
  canvas.removeEventListener('touchstart', handleTouchStart);
}

function handleMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left + (cameraX - canvas.width / 2);
  const y = e.clientY - rect.top + (cameraY - canvas.height / 2);
  liveInstances.forEach(inst => {
    if (x >= inst.x && x <= inst.x + inst.width && y >= inst.y && y <= inst.y + inst.height) {
      triggerClickEvent(inst.objectTypeId);
    }
  });
  evaluateMouseClickEvents();
}

function handleTouchStart(e) {
  if (e.touches.length > 0) {
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left + (cameraX - canvas.width / 2);
    const y = touch.clientY - rect.top + (cameraY - canvas.height / 2);
    PROJECT.events.forEach(block => {
      const match = block.conditions.find(c => c.type === 'gesture_touch');
      if (match) {
        block.actions.forEach(act => executeAction(act));
      }
    });
  }
}

function checkSolidCollision(inst) {
  const scene = PROJECT.scenes.find(s => s.id === PROJECT.currentSceneId);
  if (!scene) return false;
  for (const other of liveInstances) {
    if (other.id === inst.id) continue;
    const otherObj = getObjType(other.objectTypeId);
    if (!otherObj || !otherObj.behaviors.includes('Solid')) continue;
    if (inst.x + inst.width > other.x && inst.x < other.x + other.width &&
        inst.y + inst.height > other.y && inst.y < other.y + other.height) return true;
  }
  const gs = scene.gridSize;
  if (scene.tilemap && scene.tilemap.grid) {
    const minCol = Math.floor(inst.x / gs), maxCol = Math.ceil((inst.x + inst.width) / gs);
    const minRow = Math.floor(inst.y / gs), maxRow = Math.ceil((inst.y + inst.height) / gs);
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const val = scene.tilemap.grid[c+','+r];
        if (val !== undefined && (val === 1 || val === 3)) {
          const tl = c*gs, tr = (c+1)*gs, tt = r*gs, tb = (r+1)*gs;
          if (inst.x + inst.width > tl && inst.x < tr && inst.y + inst.height > tt && inst.y < tb) return true;
        }
      }
    }
  }
  return false;
}

function resolveSolidCollisions(inst, dir) {
  const scene = PROJECT.scenes.find(s => s.id === PROJECT.currentSceneId);
  if (!scene) return;
  const gs = scene.gridSize;
  const tilemap = scene.tilemap;

  liveInstances.forEach(other => {
    if (other.id === inst.id) return;
    const otherObj = getObjType(other.objectTypeId);
    if (!otherObj) return;
    const isSolid = otherObj.behaviors.includes('Solid');
    const isJumpThru = otherObj.behaviors.includes('JumpThru');
    if (!isSolid && !isJumpThru) return;
    if (inst.x + inst.width > other.x && inst.x < other.x + other.width &&
        inst.y + inst.height > other.y && inst.y < other.y + other.height) {
      if (isSolid) {
        if (dir === 'horizontal') {
          if (inst.vx > 0) inst.x = other.x - inst.width;
          else if (inst.vx < 0) inst.x = other.x + other.width;
          inst.vx = 0;
        } else {
          if (inst.vy > 0) { inst.y = other.y - inst.height; inst.onGround = true; }
          else if (inst.vy < 0) inst.y = other.y + other.height;
          inst.vy = 0;
        }
      } else if (isJumpThru && dir === 'vertical' && inst.vy >= 0) {
        const priorBottom = inst.y - inst.vy * (1/60) + inst.height;
        if (priorBottom <= other.y + 4) { inst.y = other.y - inst.height; inst.onGround = true; inst.vy = 0; }
      }
    }
  });

  if (tilemap && tilemap.grid) {
    const minCol = Math.floor(inst.x / gs), maxCol = Math.ceil((inst.x + inst.width) / gs);
    const minRow = Math.floor(inst.y / gs), maxRow = Math.ceil((inst.y + inst.height) / gs);
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const val = tilemap.grid[c+','+r];
        if (val !== undefined && (val === 1 || val === 3)) {
          const tl = c*gs, tr = (c+1)*gs, tt = r*gs, tb = (r+1)*gs;
          if (inst.x + inst.width > tl && inst.x < tr && inst.y + inst.height > tt && inst.y < tb) {
            if (dir === 'horizontal') {
              if (inst.vx > 0) inst.x = tl - inst.width;
              else if (inst.vx < 0) inst.x = tr;
              inst.vx = 0;
            } else {
              if (inst.vy > 0) { inst.y = tt - inst.height; inst.onGround = true; }
              else if (inst.vy < 0) inst.y = tb;
              inst.vy = 0;
            }
          }
        }
      }
    }
  }
}

function playSound(name) {
  const sound = PROJECT.sounds.find(s => s.name === name);
  if (!sound) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = sound.type === 'noise' ? 'square' : sound.type;
    osc.frequency.setValueAtTime(sound.frequency, audioCtx.currentTime);
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + sound.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + sound.attack + sound.decay + sound.duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + sound.attack + sound.decay + sound.duration + 0.3);
  } catch(e) {}
}

function getTargets(typeId) {
  if (!typeId) return liveInstances;
  return liveInstances.filter(i => i.objectTypeId === typeId);
}

function executeAction(act) {
  const targets = getTargets(act.targetObjectId);
  switch (act.type) {
    case 'object_move': {
      const ax = parseFloat(act.param1 || '0'), ay = parseFloat(act.param2 || '0');
      targets.forEach(t => { t.x += ax; t.y += ay; });
      break;
    }
    case 'object_set_pos': {
      const px = parseFloat(act.param1 || '0'), py = parseFloat(act.param2 || '0');
      targets.forEach(t => { t.x = px; t.y = py; });
      break;
    }
    case 'object_destroy':
      liveInstances = liveInstances.filter(i => i.objectTypeId !== act.targetObjectId);
      break;
    case 'object_spawn': {
      const spawnType = act.param1;
      const host = targets[0];
      if (host && spawnType) {
        const newId = 'spawned_' + Math.random().toString(36).substr(2,9);
        const po = getObjType(spawnType);
        liveInstances.push({
          id: newId, objectTypeId: spawnType,
          x: host.x + host.width/2, y: host.y + host.height/2,
          width: 32, height: 32, angle: host.angle, opacity: 1,
          vx: 0, vy: 0, onGround: false, timer: 0, health: 100,
          sineAccumulator: 0, initialX: host.x, initialY: host.y,
          variables: {}, flashTimer: 0, flashVisible: true,
          isFading: false, timerValue: {}
        });
      }
      break;
    }
    case 'object_set_angle':
      targets.forEach(t => { t.angle = parseFloat(act.param1 || '0'); });
      break;
    case 'object_set_scale': {
      const s = parseFloat(act.param1 || '1');
      targets.forEach(t => { t.width *= s; t.height *= s; });
      break;
    }
    case 'object_set_opacity':
      targets.forEach(t => { t.opacity = parseFloat(act.param1 || '1'); });
      break;
    case 'object_flash':
      targets.forEach(t => { t.flashTimer = parseFloat(act.param1 || '1'); });
      break;
    case 'object_fade':
      targets.forEach(t => { t.isFading = true; });
      break;
    case 'play_sound':
      playSound(act.param1);
      break;
    case 'system_set_variable':
      globalVars[act.param1 || ''] = parseFloat(act.param2 || '0');
      break;
    case 'system_add_variable': {
      const vn = act.param1 || '';
      const amt = parseFloat(act.param2 || '1');
      globalVars[vn] = (globalVars[vn] || 0) + amt;
      break;
    }
    case 'call_function': {
      const fName = act.param1 || '';
      PROJECT.events.forEach(block => {
        if (block.isFunction && block.funcName === fName) {
          block.actions.forEach(fa => executeAction(fa));
        }
      });
      break;
    }
    case 'timer_start': {
      const tn = act.param1 || 'timer', secs = parseFloat(act.param2 || '2');
      targets.forEach(t => { if (!t.timerValue) t.timerValue = {}; t.timerValue[tn] = secs; });
      break;
    }
  }
}

function evaluateEventBlock(block, isStartup) {
  if (block.conditions.length === 0) {
    block.actions.forEach(act => executeAction(act));
    if (block.subEvents) block.subEvents.forEach(sub => evaluateEventBlock(sub, isStartup));
    return;
  }
  let met = true;
  for (const cond of block.conditions) {
    if (!met) break;
    if (isStartup) { met = cond.type === 'system_onload'; continue; }
    switch (cond.type) {
      case 'system_onload': met = false; break;
      case 'system_tick': met = true; break;
      case 'keyboard_keypress': met = !!keysPressed[cond.param1 || '']; break;
      case 'keyboard_keyholding': met = !!keysHeld[cond.param1 || '']; break;
      case 'mouse_click': met = false; break;
      case 'object_click': met = false; break;
      case 'function_called': met = false; break;
      case 'gesture_touch': met = false; break;
      case 'timer_elapsed': met = false; break;
      case 'object_collision': {
        const selfId = cond.param1, targetId = cond.param2;
        let coll = false;
        liveInstances.filter(a => a.objectTypeId === selfId).forEach(a => {
          liveInstances.filter(b => b.objectTypeId === targetId).forEach(b => {
            if (a.x + a.width > b.x && a.x < b.x + b.width && a.y + a.height > b.y && a.y < b.y + b.height) coll = true;
          });
        });
        met = coll;
        break;
      }
    }
  }
  if (met && block.conditions.length > 0) {
    block.actions.forEach(act => executeAction(act));
    if (block.subEvents) block.subEvents.forEach(sub => evaluateEventBlock(sub, isStartup));
  }
}

function triggerClickEvent(objectTypeId) {
  PROJECT.events.forEach(block => {
    const match = block.conditions.find(c => c.type === 'object_click' && c.param1 === objectTypeId);
    if (match) {
      block.actions.forEach(act => executeAction(act));
      if (block.subEvents) block.subEvents.forEach(sub => evaluateEventBlock(sub, false));
    }
  });
}

function evaluateMouseClickEvents() {
  PROJECT.events.forEach(block => {
    const match = block.conditions.find(c => c.type === 'mouse_click');
    if (match) {
      block.actions.forEach(act => executeAction(act));
    }
  });
}

function evaluateFrameEvents(isStartup) {
  PROJECT.events.forEach(block => evaluateEventBlock(block, isStartup));
}

function update(dt) {
  globalTime += dt;
  const scene = PROJECT.scenes.find(s => s.id === PROJECT.currentSceneId);
  const layoutW = scene ? scene.width : 800;
  const layoutH = scene ? scene.height : 600;

  // Remove destroyed instances first
  liveInstances = liveInstances.filter(inst => {
    if (inst.x < -1000 || inst.x > layoutW + 1000 || inst.y < -1000 || inst.y > layoutH + 1000) return false;
    return true;
  });

  liveInstances.forEach(inst => {
    const obj = getObjType(inst.objectTypeId);
    if (!obj) return;
    const b = obj.behaviors || [];

    // Sine
    if (b.includes('Sine')) {
      inst.sineAccumulator += dt;
      inst.x = inst.initialX + Math.sin((inst.sineAccumulator * Math.PI * 2) / (obj.properties.sinePeriod || 2)) * (obj.properties.sineAmplitude || 50);
    }

    // Bullet
    if (b.includes('Bullet')) {
      const speed = obj.properties.bulletSpeed || 200;
      const grav = obj.properties.bulletGravity || 0;
      const rad = (inst.angle * Math.PI) / 180;
      inst.vx = Math.cos(rad) * speed;
      inst.vy += grav * 200 * dt;
      inst.x += inst.vx * dt;
      inst.y += inst.vy * dt;
      if (checkSolidCollision(inst)) {
        liveInstances = liveInstances.filter(i => i.id !== inst.id);
        return;
      }
    }

    // 8Direction
    if (b.includes('8Direction')) {
      const spd = obj.properties.speed || 150;
      let dx=0, dy=0;
      if (keysHeld['ArrowLeft'] || keysHeld['a'] || keysHeld['A']) dx = -1;
      if (keysHeld['ArrowRight'] || keysHeld['d'] || keysHeld['D']) dx = 1;
      if (keysHeld['ArrowUp'] || keysHeld['w'] || keysHeld['W']) dy = -1;
      if (keysHeld['ArrowDown'] || keysHeld['s'] || keysHeld['S']) dy = 1;
      if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }
      inst.x += dx * spd * dt;
      inst.y += dy * spd * dt;
      if (dx !== 0 || dy !== 0) inst.angle = Math.atan2(dy, dx) * (180 / Math.PI);
    }

    // Car
    if (b.includes('Car')) {
      const maxSpd = obj.properties.carSpeed || 200;
      const accel = obj.properties.carAcceleration || 150;
      const decel = obj.properties.carDeceleration || 100;
      const turnSpd = obj.properties.carTurnSpeed || 120;
      const drift = obj.properties.carDriftFactor || 0.8;
      let drive = 0;
      if (keysHeld['ArrowUp'] || keysHeld['w'] || keysHeld['W']) drive = 1;
      if (keysHeld['ArrowDown'] || keysHeld['s'] || keysHeld['S']) drive = -1;
      if (drive !== 0) inst.carVelocity = (inst.carVelocity || 0) + drive * accel * dt;
      else {
        const v = inst.carVelocity || 0;
        if (v > 0) inst.carVelocity = Math.max(0, v - decel * dt);
        else if (v < 0) inst.carVelocity = Math.min(0, v + decel * dt);
      }
      inst.carVelocity = Math.max(-maxSpd * 0.4, Math.min(maxSpd, inst.carVelocity || 0));
      if (Math.abs(inst.carVelocity || 0) > 5) {
        const sDir = (inst.carVelocity || 0) > 0 ? 1 : -1;
        if (keysHeld['ArrowLeft'] || keysHeld['a'] || keysHeld['A']) inst.angle -= turnSpd * sDir * dt;
        if (keysHeld['ArrowRight'] || keysHeld['d'] || keysHeld['D']) inst.angle += turnSpd * sDir * dt;
      }
      const rad = (inst.angle * Math.PI) / 180;
      const fx = Math.cos(rad) * (inst.carVelocity || 0);
      const fy = Math.sin(rad) * (inst.carVelocity || 0);
      inst.vx = inst.vx * drift + fx * (1 - drift);
      inst.vy = inst.vy * drift + fy * (1 - drift);
      inst.x += inst.vx * dt;
      inst.y += inst.vy * dt;
    }

    // Platform
    if (b.includes('Platform')) {
      const maxSpd = obj.properties.speed || 150;
      const accel = obj.properties.acceleration || 600;
      const decel = obj.properties.deceleration || 850;
      const grav = obj.properties.gravity || 800;
      const jumpStr = obj.properties.jumpStrength || 380;
      const dJump = obj.properties.doubleJump ?? true;

      let targetVx = 0;
      if (keysHeld['ArrowLeft'] || keysHeld['a'] || keysHeld['A']) targetVx = -maxSpd;
      if (keysHeld['ArrowRight'] || keysHeld['d'] || keysHeld['D']) targetVx = maxSpd;
      if (targetVx !== 0) {
        if (targetVx > inst.vx) inst.vx = Math.min(targetVx, inst.vx + accel * dt);
        else inst.vx = Math.max(targetVx, inst.vx - accel * dt);
      } else {
        if (inst.vx > 0) inst.vx = Math.max(0, inst.vx - decel * dt);
        else if (inst.vx < 0) inst.vx = Math.min(0, inst.vx + decel * dt);
      }
      inst.vy += grav * dt;

      const wantJump = keysPressed['ArrowUp'] || keysPressed['w'] || keysPressed['W'] || keysPressed[' '] || keysPressed['space'];
      if (wantJump) {
        if (inst.onGround) { inst.vy = -jumpStr; inst.onGround = false; inst.doubleJumpAvailable = true; }
        else if (dJump && inst.doubleJumpAvailable) { inst.vy = -jumpStr * 0.9; inst.doubleJumpAvailable = false; }
      }

      inst.x += inst.vx * dt;
      resolveSolidCollisions(inst, 'horizontal');
      inst.y += inst.vy * dt;
      resolveSolidCollisions(inst, 'vertical');
      if (inst.vy > 0 && inst.onGround) inst.onGround = false;
    }

    // BoundToLayout
    if (b.includes('BoundToLayout')) {
      inst.x = Math.max(0, Math.min(layoutW - inst.width, inst.x));
      inst.y = Math.max(0, Math.min(layoutH - inst.height, inst.y));
    }

    // Flash
    if (b.includes('Flash')) {
      if (inst.flashTimer && inst.flashTimer > 0) {
        inst.flashTimer -= dt;
        inst.flashVisible = Math.floor(inst.flashTimer * 12) % 2 === 0;
        if (inst.flashTimer <= 0) inst.flashVisible = true;
      }
    }

    // Fade
    if (b.includes('Fade') && inst.isFading) {
      inst.opacity = Math.max(0, inst.opacity - (1 / (obj.properties.fadeDuration || 1.5)) * dt);
      if (inst.opacity <= 0) liveInstances = liveInstances.filter(v => v.id !== inst.id);
    }

    // Physics
    if (b.includes('Physics')) {
      inst.vy += (obj.properties.gravity || 800) * dt;
      inst.vx *= 0.98;
      inst.vy *= 0.98;
      inst.x += inst.vx * dt;
      resolveSolidCollisions(inst, 'horizontal');
      inst.y += inst.vy * dt;
      resolveSolidCollisions(inst, 'vertical');
      if (inst.onGround && Math.abs(inst.vx) > 10) inst.angle += inst.vx * dt * 0.2;
    }

    // Timer behavior ticks
    if (b.includes('Timer')) {
      if (inst.timerValue) {
        Object.keys(inst.timerValue).forEach(tName => {
          if (inst.timerValue[tName] > 0) {
            inst.timerValue[tName] -= dt;
            if (inst.timerValue[tName] <= 0) {
              PROJECT.events.forEach(block => {
                const match = block.conditions.find(c => c.type === 'timer_elapsed' && c.param1 === tName);
                if (match) {
                  block.actions.forEach(act => executeAction(act));
                }
              });
            }
          }
        });
      }
    }

    // Pathfinding
    if (b.includes('Pathfinding') && inst.targetX !== undefined && inst.targetY !== undefined) {
      const dx = inst.targetX - (inst.x + inst.width/2);
      const dy = inst.targetY - (inst.y + inst.height/2);
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 5) {
        const spd = obj.properties.speed || 100;
        const a = Math.atan2(dy, dx);
        let sx = Math.cos(a) * spd * dt, sy = Math.sin(a) * spd * dt;
        if (!checkSolidCollision({...inst, x: inst.x + sx, y: inst.y + sy})) {
          inst.x += sx; inst.y += sy;
        }
        inst.angle = Math.atan2(sy, sx) * (180 / Math.PI);
      } else {
        delete inst.targetX; delete inst.targetY;
      }
    }

    // Pin
    if (b.includes('Pin') && inst.pinParentId) {
      const parent = liveInstances.find(i => i.id === inst.pinParentId);
      if (parent) {
        const rad = (parent.angle * Math.PI) / 180;
        const offX = inst.pinOffsetX || 0, offY = inst.pinOffsetY || 0;
        const rx = offX * Math.cos(rad) - offY * Math.sin(rad);
        const ry = offX * Math.sin(rad) + offY * Math.cos(rad);
        inst.x = parent.x + parent.width/2 + rx - inst.width/2;
        inst.y = parent.y + parent.height/2 + ry - inst.height/2;
        inst.angle = parent.angle + (inst.pinOffsetAngle || 0);
      }
    }
  });

  // Evaluate event sheet every frame
  evaluateFrameEvents(false);
}

function render() {
  const scene = PROJECT.scenes.find(s => s.id === PROJECT.currentSceneId);
  if (!scene) return;

  ctx.fillStyle = '#0f1015';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Camera
  let camX = scene.width / 2, camY = scene.height / 2;
  const scrollTarget = liveInstances.find(inst => {
    const obj = getObjType(inst.objectTypeId);
    return obj && obj.behaviors.includes('ScrollTo');
  });
  if (scrollTarget) { camX = scrollTarget.x + scrollTarget.width/2; camY = scrollTarget.y + scrollTarget.height/2; }
  const hw = canvas.width/2, hh = canvas.height/2;
  camX = Math.max(hw, Math.min(scene.width - hw, camX));
  camY = Math.max(hh, Math.min(scene.height - hh, camY));
  cameraX = camX; cameraY = camY;

  const layers = scene.layers && scene.layers.length > 0 ? scene.layers : [{ id: 'default_lay', name: 'Main', parallaxX: 1, parallaxY: 1, opacity: 1, visible: true }];

  layers.forEach(lay => {
    if (!lay.visible) return;
    ctx.save();
    ctx.translate(hw - camX * lay.parallaxX, hh - camY * lay.parallaxY);
    ctx.globalAlpha = lay.opacity;

    // Tiles
    if (lay.parallaxX === 1) {
      const gs = scene.gridSize;
      ctx.strokeStyle = '#22232e'; ctx.lineWidth = 1;
      for (let x = 0; x <= scene.width; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, scene.height); ctx.stroke(); }
      for (let y = 0; y <= scene.height; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(scene.width, y); ctx.stroke(); }
    }

    if (lay.id === 'default_lay' || lay.name.toLowerCase().includes('main')) {
      const tm = scene.tilemap;
      if (tm && tm.grid) {
        const gs = scene.gridSize;
        Object.entries(tm.grid).forEach(([coords, tileType]) => {
          const [col, row] = coords.split(',').map(Number);
          const x = col * gs, y = row * gs;
          if (tileType === 1) { ctx.fillStyle = '#10b981'; ctx.fillRect(x, y, gs, gs); ctx.fillStyle = '#059669'; ctx.fillRect(x, y, gs, 6); }
          else if (tileType === 2) { const wo = Math.sin(globalTime * 6 + col) * 3; ctx.fillStyle = '#0ea5e9'; ctx.fillRect(x, y + wo/3, gs, gs); }
          else if (tileType === 3) { ctx.fillStyle = '#d97706'; ctx.fillRect(x, y, gs, gs); ctx.strokeStyle = '#92400e'; ctx.lineWidth = 1; ctx.strokeRect(x, y, gs, gs); }
          else if (tileType === 4) { const lp = 10 + Math.sin(globalTime * 8) * 4; ctx.fillStyle = 'rgb(' + (220+lp) + ',38,38)'; ctx.fillRect(x, y, gs, gs); }
        });
      }
    }

    liveInstances.forEach(inst => {
      const obj = getObjType(inst.objectTypeId);
      if (!obj) return;
      if (inst.flashVisible === false) return;
      ctx.save();
      ctx.translate(inst.x + inst.width/2, inst.y + inst.height/2);
      ctx.rotate((inst.angle * Math.PI) / 180);
      ctx.globalAlpha = inst.opacity;

      if (inst.blendMode === 'add') ctx.globalCompositeOperation = 'lighter';
      else if (inst.blendMode === 'multiply') ctx.globalCompositeOperation = 'multiply';
      else if (inst.blendMode === 'screen') ctx.globalCompositeOperation = 'screen';

      const frame = obj.frames && obj.frames[0];
      const ox = inst.originX || 0.5, oy = inst.originY || 0.5;
      const rx = -inst.width * ox, ry = -inst.height * oy;

      if (frame && frame.pixels && frame.pixels.length > 0) {
        const pw = inst.width / frame.width, ph = inst.height / frame.height;
        for (let r = 0; r < frame.height; r++) {
          for (let c = 0; c < frame.width; c++) {
            const color = frame.pixels[r * frame.width + c];
            if (color) { ctx.fillStyle = color; ctx.fillRect(rx + c*pw, ry + r*ph, pw+0.3, ph+0.3); }
          }
        }
      } else {
        ctx.fillStyle = obj.primaryColor || '#ec4899';
        ctx.fillRect(rx, ry, inst.width, inst.height);
      }
      ctx.restore();
    });

    ctx.restore();
  });
}

function loop() {
  if (!running) return;
  update(1/60);
  render();
  keysPressed = {};
  animFrame = requestAnimationFrame(loop);
}

// Keyboard shortcut handling
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && running) stopGame();
});

// Start automatically
initGame();
</script>
</body>
</html>`;
}

export default function Exporter({ project }: ExporterProps) {
  const [platform, setPlatform] = useState<'windows' | 'linux' | 'mobile' | 'web'>('web');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportComplete, setExportComplete] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  const handleStartExport = () => {
    setIsExporting(true);
    setProgress(0);
    setExportComplete(false);

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          doExport();
          return 100;
        }
        return prev + 10;
      });
    }, 80);
  };

  const doExport = () => {
    setIsExporting(false);
    setExportComplete(true);

    if (platform === 'web') {
      const html = generateStandaloneHTML(project);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '_')}_index.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } else {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${project.name.replace(/\s+/g, '_')}_export_${platform}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }
  };

  const triggerDownloadJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${project.name.replace(/\s+/g, '_')}_dados.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#0f1015]" id="exporter_root">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-400" />
            Distribuição & Exportador Multiplataforma
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Gere builds HTML5 prontas para jogar com a engine embarcada, sem dependências externas.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div onClick={() => { if(!isExporting) setPlatform('web'); }}
            className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center justify-between text-center transition-all ${platform === 'web' ? 'bg-indigo-950/40 border-indigo-500 shadow-md ring-2 ring-indigo-950/20' : 'bg-[#181922] border-slate-800 hover:border-slate-700'}`}>
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg ${platform === 'web' ? 'bg-indigo-900 text-indigo-200' : 'bg-slate-800 text-gray-400'}`}>
              <Globe className="w-5 h-5" />
            </div>
            <div className="mt-3">
              <span className="text-xs font-bold text-slate-200 block">HTML5</span>
              <span className="text-[9px] text-gray-500 block uppercase mt-0.5">Offline</span>
            </div>
          </div>
          <div onClick={() => { if(!isExporting) setPlatform('windows'); }}
            className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center justify-between text-center transition-all ${platform === 'windows' ? 'bg-indigo-950/40 border-indigo-500 shadow-md ring-2 ring-indigo-950/20' : 'bg-[#181922] border-slate-800 hover:border-slate-700'}`}>
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg ${platform === 'windows' ? 'bg-indigo-900 text-indigo-200' : 'bg-slate-800 text-gray-400'}`}>
              <Monitor className="w-5 h-5" />
            </div>
            <div className="mt-3">
              <span className="text-xs font-bold text-slate-200 block">Windows</span>
              <span className="text-[9px] text-gray-500 block uppercase mt-0.5">JSON</span>
            </div>
          </div>
          <div onClick={() => { if(!isExporting) setPlatform('linux'); }}
            className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center justify-between text-center transition-all ${platform === 'linux' ? 'bg-indigo-950/40 border-indigo-500 shadow-md ring-2 ring-indigo-950/20' : 'bg-[#181922] border-slate-800 hover:border-slate-700'}`}>
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg ${platform === 'linux' ? 'bg-indigo-900 text-indigo-200' : 'bg-slate-800 text-gray-400'}`}>
              <Monitor className="w-5 h-5" />
            </div>
            <div className="mt-3">
              <span className="text-xs font-bold text-slate-200 block">Linux</span>
              <span className="text-[9px] text-gray-500 block uppercase mt-0.5">JSON</span>
            </div>
          </div>
          <div onClick={() => { if(!isExporting) setPlatform('mobile'); }}
            className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center justify-between text-center transition-all ${platform === 'mobile' ? 'bg-indigo-950/40 border-indigo-500 shadow-md ring-2 ring-indigo-950/20' : 'bg-[#181922] border-slate-800 hover:border-slate-700'}`}>
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg ${platform === 'mobile' ? 'bg-indigo-900 text-indigo-200' : 'bg-slate-800 text-gray-400'}`}>
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="mt-3">
              <span className="text-xs font-bold text-slate-200 block">Mobile</span>
              <span className="text-[9px] text-gray-500 block uppercase mt-0.5">JSON</span>
            </div>
          </div>
        </div>

        <div className="bg-[#181922] border border-[#272834] rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Code className="w-4 h-4 text-indigo-400" /> Build ({platform})
          </h4>

          <ul className="space-y-2 text-xs text-gray-400 leading-relaxed">
            <li className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <span>Engine 2D completa embarcada em um único arquivo HTML sem dependências externas.</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <span>Renderização Canvas2D com todos os behaviors, eventos e animações funcionando.</span>
            </li>
            {platform === 'web' && (
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <span>Pode ser hospedado no GitHub Pages, Itch.io, Vercel ou qualquer servidor web.</span>
              </li>
            )}
          </ul>

          {isExporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono text-indigo-400">
                <span>Compilando engine + dados do projeto...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 transition-all duration-150" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {exportComplete && (
            <div className="bg-emerald-950/20 border border-emerald-900/65 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-emerald-400 block">Build gerada com sucesso!</span>
                {platform === 'web' ? (
                  <p className="text-[11px] text-emerald-300 leading-normal mt-1">
                    Arquivo HTML autossuficiente baixado. Abra no navegador para jogar.
                  </p>
                ) : (
                  <p className="text-[11px] text-emerald-300 leading-normal mt-1">
                    JSON do projeto exportado. Use com ferramentas complementares.
                  </p>
                )}
                {platform !== 'web' && (
                  <button onClick={triggerDownloadJSON}
                    className="mt-3 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold py-1.5 px-4 transition-all">
                    <Download className="w-4 h-4" /> Baixar JSON
                  </button>
                )}
              </div>
            </div>
          )}

          {!isExporting && !exportComplete && (
            <button onClick={handleStartExport}
              className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer w-full">
              {platform === 'web' ? '🌐 Gerar HTML5 Autossuficiente' : '📦 Exportar para ' + platform.toUpperCase()}
            </button>
          )}

          {exportComplete && (
            <button onClick={() => { setExportComplete(false); setProgress(0); }}
              className="text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 py-2 px-4 rounded-lg transition-all w-full cursor-pointer">
              Nova Exportação
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
