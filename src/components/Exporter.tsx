import React, { useState } from 'react';
import { GameProject } from '../types';
import { Monitor, Smartphone, Globe, Download, CheckCircle, Package, ArrowRight, Code } from 'lucide-react';

interface ExporterProps {
  project: GameProject;
}

function generateEngineBundle(): string {
  return `
const ENGINE = (function() {
  // === CAMERA ===
  class Camera {
    constructor(w,h) { this.x=w/2; this.y=h/2; this.w=w; this.h=h; this.zoom=1; }
    get hw() { return this.w/2; }
    get hh() { return this.h/2; }
    follow(tx,ty,lw,lh) { this.x=tx; this.y=ty; this.clamp(lw,lh); }
    clamp(lw,lh) {
      const hw=this.hw, hh=this.hh;
      this.x=Math.max(Math.min(hw,lw/2),Math.min(Math.max(hw,lw-hw),this.x));
      this.y=Math.max(Math.min(hh,lh/2),Math.min(Math.max(hh,lh-hh),this.y));
    }
  }

  // === INPUT SYSTEM ===
  class InputSystem {
    constructor() {
      this.keysHeld={}; this.keysPressed={}; this.keysReleased={};
      this.mouseX=0; this.mouseY=0; this.mouseDown=false; this.mouseClicked=false;
      this.touches=[];
      this._onKeyDown=(e)=>{if(!this.keysHeld[e.key])this.keysPressed[e.key]=true;this.keysHeld[e.key]=true;};
      this._onKeyUp=(e)=>{this.keysHeld[e.key]=false;this.keysReleased[e.key]=true;};
      window.addEventListener('keydown',this._onKeyDown);
      window.addEventListener('keyup',this._onKeyUp);
    }
    endFrame() { this.keysPressed={}; this.keysReleased={}; this.mouseClicked=false; }
    destroy() { window.removeEventListener('keydown',this._onKeyDown); window.removeEventListener('keyup',this._onKeyUp); }
  }

  // === AUDIO SYSTEM ===
  class AudioSystem {
    constructor() { this.ctx=null; }
    _getCtx() {
      if(!this.ctx) this.ctx=new(window.AudioContext||window.webkitAudioContext)();
      if(this.ctx.state==='suspended') this.ctx.resume();
      return this.ctx;
    }
    playTone(type,freq,dur,atk=0.01,dec=0.1) {
      try {
        const ctx=this._getCtx();
        const o=ctx.createOscillator(), g=ctx.createGain();
        o.type=type; o.frequency.setValueAtTime(freq,ctx.currentTime);
        g.gain.setValueAtTime(0,ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.15,ctx.currentTime+atk);
        g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+atk+dec+dur);
        o.connect(g); g.connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime+atk+dec+dur+0.1);
      } catch(e) {}
    }
    playSound(s) { this.playTone(s.type||'square',s.frequency||440,s.duration||0.2,s.attack||0.01,s.decay||0.1); }
    destroy() { if(this.ctx) this.ctx.close(); }
  }

  // === PHYSICS ===
  const TILE_DEFS=[
    {id:1,color:'#10b981',solid:true},{id:2,color:'#0ea5e9',solid:false},
    {id:3,color:'#d97706',solid:true},{id:4,color:'#ef4444',solid:true}
  ];

  function checkAABB(a,b) {
    return a.x+a.w>b.x && a.x<b.x+b.w && a.y+a.h>b.y && a.y<b.y+b.h;
  }

  function checkSolidCollision(inst,scene,instances) {
    for(const other of instances) {
      if(other.id===inst.id) continue;
      if(checkAABB(inst,other)) return true;
    }
    const gs=scene.gridSize;
    const checkGrid=(grid)=>{
      const mc=Math.floor(inst.x/gs), mcx=Math.ceil((inst.x+inst.w)/gs);
      const mr=Math.floor(inst.y/gs), mry=Math.ceil((inst.y+inst.h)/gs);
      for(let r=mr;r<=mry;r++) for(let c=mc;c<=mcx;c++) {
        const v=grid[c+','+r]; if(v==null) continue;
        if(TILE_DEFS.find(t=>t.id===v)?.solid) {
          if(inst.x+inst.w>c*gs&&inst.x<(c+1)*gs&&inst.y+inst.h>r*gs&&inst.y<(r+1)*gs) return true;
        }
      }
      return false;
    };
    if(scene.tilemap?.grid&&checkGrid(scene.tilemap.grid)) return true;
    if(scene.tilemaps) for(const tm of scene.tilemaps) if(checkGrid(tm.grid)) return true;
    return false;
  }

  function resolveCollisions(inst,dir,scene) {
    const gs=scene.gridSize;
    const resolveGrid=(grid)=>{
      const mc=Math.floor(inst.x/gs), mcx=Math.ceil((inst.x+inst.w)/gs);
      const mr=Math.floor(inst.y/gs), mry=Math.ceil((inst.y+inst.h)/gs);
      for(let r=mr;r<=mry;r++) for(let c=mc;c<=mcx;c++) {
        const tv=grid[c+','+r]; if(tv==null) continue;
        if(!TILE_DEFS.find(t=>t.id===tv)?.solid) continue;
        const tl=c*gs,tr=(c+1)*gs,tt=r*gs,tb=(r+1)*gs;
        if(inst.x+inst.w>tl&&inst.x<tr&&inst.y+inst.h>tt&&inst.y<tb) {
          if(dir==='h') { if(inst.vx>0)inst.x=tl-inst.w;else if(inst.vx<0)inst.x=tr;inst.vx=0; }
          else { if(inst.vy>0){inst.y=tt-inst.h;inst.onGround=true;}else if(inst.vy<0)inst.y=tb;inst.vy=0; }
        }
      }
    };
    if(scene.tilemap?.grid) resolveGrid(scene.tilemap.grid);
    if(scene.tilemaps) for(const tm of scene.tilemaps) resolveGrid(tm.grid);
  }

  // === MAIN ENGINE ===
  class Engine {
    constructor(canvas,project) {
      this.canvas=canvas; this.ctx=canvas.getContext('2d');
      this.project=project; this.instances=[]; this.globalVars={};
      this.globalTime=0; this.running=false; this.animId=null;
      this.input=new InputSystem(); this.audio=new AudioSystem();
      this.camera=new Camera(800,600);
      this.particles=[];
    }

    start() {
      this.running=true; this.globalTime=0; this.instances=[];
      const scene=this.project.scenes.find(s=>s.id===this.project.currentSceneId)||this.project.scenes[0];
      if(scene) {
        this.camera=new Camera(scene.width||800,scene.height||600);
        const vars=document.getElementById('_engine_vars');
        if(vars) this.globalVars=JSON.parse(vars.textContent||'{}');
        else this.globalVars={...this.project.globalVariables};
        for(const inst of scene.instances) {
          this.instances.push({
            id:inst.id, objectTypeId:inst.objectTypeId,
            x:inst.x,y:inst.y,w:inst.width,h:inst.height,
            angle:inst.angle||0,opacity:inst.opacity||1,
            vx:0,vy:0,onGround:false,timer:0,health:100,
            sineAccumulator:0,initialX:inst.x,initialY:inst.y,
            variables:{...inst.variables||{}},
            flashTimer:0,flashVisible:true,isFading:false,
            timerValue:{},doubleJumpAvailable:true,carVelocity:0,
            originX:inst.originX||0.5,originY:inst.originY||0.5,
            blendMode:inst.blendMode||'normal',
            effectFilter:inst.effectFilter||'none',
            layerId:inst.layerId,
          });
        }
      }
      this._setupListeners();
      this._evalEvents(true);
      this.loop=this._loop.bind(this);
      this._loop();
    }

    stop() {
      this.running=false;
      if(this.animId) { cancelAnimationFrame(this.animId); this.animId=null; }
    }

    _setupListeners() {
      this.canvas.addEventListener('mousedown',this._onMouseDown.bind(this));
      this.canvas.addEventListener('touchstart',this._onTouch.bind(this));
    }

    _onMouseDown(e) {
      const r=this.canvas.getBoundingClientRect();
      const x=e.clientX-r.left+(this.camera.x-this.camera.hw);
      const y=e.clientY-r.top+(this.camera.y-this.camera.hh);
      for(const inst of this.instances) {
        if(x>=inst.x&&x<=inst.x+inst.w&&y>=inst.y&&y<=inst.y+inst.h) {
          this._triggerClick(inst.objectTypeId);
        }
      }
      this._evalMouseClick();
    }

    _onTouch(e) {
      if(e.touches.length>0) {
        const t=e.touches[0], r=this.canvas.getBoundingClientRect();
        for(const block of this.project.events) {
          if(block.conditions.find(c=>c.type==='gesture_touch')) {
            block.actions.forEach(a=>this._execAction(a));
          }
        }
      }
    }

    _triggerClick(typeId) {
      for(const block of this.project.events) {
        if(block.conditions.find(c=>c.type==='object_click'&&c.param1===typeId)) {
          block.actions.forEach(a=>this._execAction(a));
          if(block.subEvents) block.subEvents.forEach(s=>this._evalBlock(s,false));
        }
      }
    }

    _evalMouseClick() {
      for(const block of this.project.events) {
        if(block.conditions.find(c=>c.type==='mouse_click')) {
          block.actions.forEach(a=>this._execAction(a));
        }
      }
    }

    _loop() {
      if(!this.running) return;
      const dt=1/60; this.globalTime+=dt;
      this._update(dt); this._render();
      this.input.endFrame();
      this.animId=requestAnimationFrame(this._loop);
    }

    _update(dt) {
      const scene=this.project.scenes.find(s=>s.id===this.project.currentSceneId);
      if(!scene) return;
      const layoutW=scene.width||800, layoutH=scene.height||600;

      // Update behaviors
      for(const inst of this.instances) {
        const obj=this.project.objects.find(o=>o.id===inst.objectTypeId);
        if(!obj) continue;
        const b=obj.behaviors||[];

        // Sine
        if(b.includes('Sine')) {
          inst.sineAccumulator+=dt;
          inst.x=inst.initialX+Math.sin(inst.sineAccumulator*Math.PI*2/(obj.properties.sinePeriod||2))*(obj.properties.sineAmplitude||50);
        }

        // Bullet
        if(b.includes('Bullet')) {
          const spd=obj.properties.bulletSpeed||200, grav=obj.properties.bulletGravity||0;
          const rad=inst.angle*Math.PI/180;
          inst.vx=Math.cos(rad)*spd; inst.vy+=grav*200*dt;
          inst.x+=inst.vx*dt; inst.y+=inst.vy*dt;
          if(checkSolidCollision(inst,scene,this.instances)) {
            this.instances=this.instances.filter(i=>i.id!==inst.id); continue;
          }
        }

        // 8Direction
        if(b.includes('8Direction')) {
          const spd=obj.properties.speed||150; let dx=0,dy=0;
          if(this.input.keysHeld['ArrowLeft']||this.input.keysHeld['a']||this.input.keysHeld['A'])dx=-1;
          if(this.input.keysHeld['ArrowRight']||this.input.keysHeld['d']||this.input.keysHeld['D'])dx=1;
          if(this.input.keysHeld['ArrowUp']||this.input.keysHeld['w']||this.input.keysHeld['W'])dy=-1;
          if(this.input.keysHeld['ArrowDown']||this.input.keysHeld['s']||this.input.keysHeld['S'])dy=1;
          if(dx&&dy){dx*=0.7071;dy*=0.7071;}
          inst.x+=dx*spd*dt; inst.y+=dy*spd*dt;
          if(dx||dy) inst.angle=Math.atan2(dy,dx)*180/Math.PI;
        }

        // Car
        if(b.includes('Car')) {
          const mx=obj.properties.carSpeed||200,ac=obj.properties.carAcceleration||150;
          const dc=obj.properties.carDeceleration||100,ts=obj.properties.carTurnSpeed||120;
          const dr=obj.properties.carDriftFactor||0.8;
          let drive=0;
          if(this.input.keysHeld['ArrowUp']||this.input.keysHeld['w']||this.input.keysHeld['W'])drive=1;
          if(this.input.keysHeld['ArrowDown']||this.input.keysHeld['s']||this.input.keysHeld['S'])drive=-1;
          if(drive)inst.carVelocity=(inst.carVelocity||0)+drive*ac*dt;
          else{const v=inst.carVelocity||0;if(v>0)inst.carVelocity=Math.max(0,v-dc*dt);else if(v<0)inst.carVelocity=Math.min(0,v+dc*dt);}
          inst.carVelocity=Math.max(-mx*0.4,Math.min(mx,inst.carVelocity||0));
          if(Math.abs(inst.carVelocity||0)>5){const sd=(inst.carVelocity||0)>0?1:-1;if(this.input.keysHeld['ArrowLeft']||this.input.keysHeld['a']||this.input.keysHeld['A'])inst.angle-=ts*sd*dt;if(this.input.keysHeld['ArrowRight']||this.input.keysHeld['d']||this.input.keysHeld['D'])inst.angle+=ts*sd*dt;}
          const rad=inst.angle*Math.PI/180,fx=Math.cos(rad)*(inst.carVelocity||0),fy=Math.sin(rad)*(inst.carVelocity||0);
          inst.vx=inst.vx*dr+fx*(1-dr);inst.vy=inst.vy*dr+fy*(1-dr);
          inst.x+=inst.vx*dt;inst.y+=inst.vy*dt;
        }

        // Platform
        if(b.includes('Platform')) {
          const mx=obj.properties.speed||150,ac=obj.properties.acceleration||600;
          const dc=obj.properties.deceleration||850,gv=obj.properties.gravity||800;
          const js=obj.properties.jumpStrength||380,dj=obj.properties.doubleJump??true;
          let tvx=0;
          if(this.input.keysHeld['ArrowLeft']||this.input.keysHeld['a']||this.input.keysHeld['A'])tvx=-mx;
          if(this.input.keysHeld['ArrowRight']||this.input.keysHeld['d']||this.input.keysHeld['D'])tvx=mx;
          if(tvx){if(tvx>inst.vx)inst.vx=Math.min(tvx,inst.vx+ac*dt);else inst.vx=Math.max(tvx,inst.vx-ac*dt);}
          else{if(inst.vx>0)inst.vx=Math.max(0,inst.vx-dc*dt);else if(inst.vx<0)inst.vx=Math.min(0,inst.vx+dc*dt);}
          inst.vy+=gv*dt;
          const wj=this.input.keysPressed['ArrowUp']||this.input.keysPressed['w']||this.input.keysPressed['W']||this.input.keysPressed[' ']||this.input.keysPressed['space'];
          if(wj){if(inst.onGround){inst.vy=-js;inst.onGround=false;inst.doubleJumpAvailable=true;}else if(dj&&inst.doubleJumpAvailable){inst.vy=-js*0.9;inst.doubleJumpAvailable=false;}}
          inst.x+=inst.vx*dt;resolveCollisions(inst,'h',scene);inst.y+=inst.vy*dt;resolveCollisions(inst,'v',scene);
          if(inst.vy>0&&inst.onGround)inst.onGround=false;
        }

        // BoundToLayout
        if(b.includes('BoundToLayout')){inst.x=Math.max(0,Math.min(layoutW-inst.w,inst.x));inst.y=Math.max(0,Math.min(layoutH-inst.h,inst.y));}

        // Flash
        if(b.includes('Flash')&&inst.flashTimer&&inst.flashTimer>0){inst.flashTimer-=dt;inst.flashVisible=Math.floor(inst.flashTimer*12)%2===0;if(inst.flashTimer<=0)inst.flashVisible=true;}

        // Fade
        if(b.includes('Fade')&&inst.isFading){inst.opacity=Math.max(0,inst.opacity-(1/(obj.properties.fadeDuration||1.5))*dt);if(inst.opacity<=0)this.instances=this.instances.filter(v=>v.id!==inst.id);}

        // Physics
        if(b.includes('Physics')){inst.vy+=(obj.properties.gravity||800)*dt;inst.vx*=0.98;inst.vy*=0.98;inst.x+=inst.vx*dt;resolveCollisions(inst,'h',scene);inst.y+=inst.vy*dt;resolveCollisions(inst,'v',scene);if(inst.onGround&&Math.abs(inst.vx)>10)inst.angle+=inst.vx*dt*0.2;}

        // Timer
        if(b.includes('Timer')&&inst.timerValue){Object.keys(inst.timerValue).forEach(tn=>{if(inst.timerValue[tn]>0){inst.timerValue[tn]-=dt;if(inst.timerValue[tn]<=0){for(const b2 of this.project.events){if(b2.conditions.find(c=>c.type==='timer_elapsed'&&c.param1===tn)){b2.actions.forEach(a=>this._execAction(a));}}}}})}

        // Pathfinding
        if(b.includes('Pathfinding')&&inst.targetX!==undefined&&inst.targetY!==undefined){
          const dx=inst.targetX-(inst.x+inst.w/2),dy=inst.targetY-(inst.y+inst.h/2);
          if(Math.sqrt(dx*dx+dy*dy)>5){const spd=obj.properties.speed||100,a=Math.atan2(dy,dx),sx=Math.cos(a)*spd*dt,sy=Math.sin(a)*spd*dt;if(!checkSolidCollision({...inst,x:inst.x+sx,y:inst.y+sy},scene,this.instances)){inst.x+=sx;inst.y+=sy;}inst.angle=Math.atan2(sy,sx)*180/Math.PI;}
          else{delete inst.targetX;delete inst.targetY;}
        }

        // Pin
        if(b.includes('Pin')&&inst.pinParentId){const p=this.instances.find(i=>i.id===inst.pinParentId);if(p){const rad=p.angle*Math.PI/180,ox=inst.pinOffsetX||0,oy=inst.pinOffsetY||0;inst.x=p.x+p.w/2+(ox*Math.cos(rad)-oy*Math.sin(rad))-inst.w/2;inst.y=p.y+p.h/2+(ox*Math.sin(rad)+oy*Math.cos(rad))-inst.h/2;inst.angle=p.angle+(inst.pinOffsetAngle||0);}}

        // Destroy far instances
        if(inst.x<-2000||inst.x>layoutW+2000||inst.y<-2000||inst.y>layoutH+2000){this.instances=this.instances.filter(i=>i.id!==inst.id);}
      }

      this._evalEvents(false);
    }

    _execAction(act) {
      const targets=act.targetObjectId?this.instances.filter(i=>i.objectTypeId===act.targetObjectId):[];
      switch(act.type) {
        case 'object_move':{const ax=parseFloat(act.param1||'0'),ay=parseFloat(act.param2||'0');targets.forEach(t=>{t.x+=ax;t.y+=ay;});break;}
        case 'object_set_pos':{const px=parseFloat(act.param1||'0'),py=parseFloat(act.param2||'0');targets.forEach(t=>{t.x=px;t.y=py;});break;}
        case 'object_destroy':this.instances=this.instances.filter(i=>i.objectTypeId!==act.targetObjectId);break;
        case 'object_spawn':{const st=act.param1,host=targets[0];if(host&&st){this.instances.push({id:'s_'+Math.random().toString(36).substr(2,9),objectTypeId:st,x:host.x+host.w/2,y:host.y+host.h/2,w:32,h:32,angle:host.angle,opacity:1,vx:0,vy:0,onGround:false,timer:0,health:100,sineAccumulator:0,initialX:host.x,initialY:host.y,variables:{},flashTimer:0,flashVisible:true,isFading:false,timerValue:{}});}break;}
        case 'object_set_angle':targets.forEach(t=>{t.angle=parseFloat(act.param1||'0');});break;
        case 'object_set_scale':{const s=parseFloat(act.param1||'1');targets.forEach(t=>{t.w*=s;t.h*=s;});break;}
        case 'object_set_opacity':targets.forEach(t=>{t.opacity=parseFloat(act.param1||'1');});break;
        case 'object_set_visible':targets.forEach(t=>{t.opacity=act.param1!=='false'?1:0;});break;
        case 'object_flash':targets.forEach(t=>{t.flashTimer=parseFloat(act.param1||'1');});break;
        case 'object_fade':targets.forEach(t=>{t.isFading=true;});break;
        case 'play_sound':{const sn=act.param1,s=this.project.sounds.find(s=>s.name===sn);if(s)this.audio.playSound(s);break;}
        case 'system_set_variable':this.globalVars[act.param1||'']=parseFloat(act.param2||'0');break;
        case 'system_add_variable':{const vn=act.param1||'',amt=parseFloat(act.param2||'1');this.globalVars[vn]=(this.globalVars[vn]||0)+amt;break;}
        case 'system_sub_variable':{const vn=act.param1||'',amt=parseFloat(act.param2||'1');this.globalVars[vn]=(this.globalVars[vn]||0)-amt;break;}
        case 'timer_start':{const tn=act.param1||'t',sec=parseFloat(act.param2||'2');targets.forEach(t=>{if(!t.timerValue)t.timerValue={};t.timerValue[tn]=sec;});break;}
        case 'call_function':{const fn=act.param1||'';for(const b of this.project.events){if(b.isFunction&&b.funcName===fn){b.actions.forEach(a=>this._execAction(a));}}break;}
        case 'go_to_layout':{const sid=act.param1||'';this.project.currentSceneId=sid;this.stop();this.start();break;}
        case 'restart_layout':this.stop();this.start();break;
        case 'set_camera_position':this.camera.x=parseFloat(act.param1||'0');this.camera.y=parseFloat(act.param2||'0');break;
        case 'set_velocity':targets.forEach(t=>{t.vx=parseFloat(act.param1||'0');t.vy=parseFloat(act.param2||'0');});break;
        case 'apply_force':targets.forEach(t=>{t.vx+=parseFloat(act.param1||'0');t.vy+=parseFloat(act.param2||'0');});break;
        case 'log_message':console.log('[LOG]',act.param1||'');break;
      }
    }

    _evalBlock(block,startup) {
      if(block.conditions.length===0){block.actions.forEach(a=>this._execAction(a));if(block.subEvents)block.subEvents.forEach(s=>this._evalBlock(s,startup));return;}
      let ok=true;
      for(const c of block.conditions){if(!ok)break;if(startup){ok=c.type==='system_onload';continue;}
        switch(c.type){
          case 'system_onload':ok=false;break;case 'system_tick':ok=true;break;
          case 'keyboard_keypress':ok=!!this.input.keysPressed[c.param1||''];break;
          case 'keyboard_keyholding':ok=!!this.input.keysHeld[c.param1||''];break;
          case 'mouse_click':ok=false;break;case 'object_click':ok=false;break;
          case 'function_called':ok=false;break;case 'gesture_touch':ok=false;break;
          case 'timer_elapsed':ok=false;break;
          case 'object_collision':{const s=c.param1,t=c.param2;let coll=false;this.instances.filter(a=>a.objectTypeId===s).forEach(a=>{this.instances.filter(b=>b.objectTypeId===t).forEach(b=>{if(checkAABB(a,b))coll=true;})});ok=coll;break;}
          default:break;
        }
      }
      if(ok&&block.conditions.length>0){block.actions.forEach(a=>this._execAction(a));if(block.subEvents)block.subEvents.forEach(s=>this._evalBlock(s,startup));}
    }

    _evalEvents(startup){for(const b of this.project.events)this._evalBlock(b,startup);}

    _render() {
      const scene=this.project.scenes.find(s=>s.id===this.project.currentSceneId);
      if(!scene)return;
      const ctx=this.ctx;
      ctx.fillStyle=this.project.settings.backgroundColor||'#0f1015';
      ctx.fillRect(0,0,this.canvas.width,this.canvas.height);

      let scrollTarget=null;
      for(const inst of this.instances){const o=this.project.objects.find(ob=>ob.id===inst.objectTypeId);if(o?.behaviors.includes('ScrollTo')){scrollTarget=inst;break;}}
      if(scrollTarget) this.camera.follow(scrollTarget.x+scrollTarget.w/2,scrollTarget.y+scrollTarget.h/2,scene.width,scene.height);

      const layers=scene.layers&&scene.layers.length?scene.layers:[{id:'d',name:'Main',parallaxX:1,parallaxY:1,opacity:1,visible:true}];
      for(const lay of layers){
        if(!lay.visible)continue;
        ctx.save();ctx.translate(this.camera.hw-this.camera.x*lay.parallaxX,this.camera.hh-this.camera.y*lay.parallaxY);ctx.globalAlpha=lay.opacity;
        const gs=scene.gridSize;
        if(lay.parallaxX===1){ctx.strokeStyle='#22232e';ctx.lineWidth=1;for(let x=0;x<=scene.width;x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,scene.height);ctx.stroke();}for(let y=0;y<=scene.height;y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(scene.width,y);ctx.stroke();}}
        const drawTG=(grid)=>{if(!grid)return;for(const[k,v]of Object.entries(grid)){const[col,row]=k.split(',').map(Number);const x=col*gs,y=row*gs,tid=typeof v==='string'?parseInt(v):v,def=TILE_DEFS.find(t=>t.id===tid);if(!def)continue;if(def.id===2){const wo=Math.sin(this.globalTime*6+col)*3;ctx.fillStyle=def.color;ctx.fillRect(x,y+wo/3,gs,gs);}else if(def.id===4){const lp=10+Math.sin(this.globalTime*8)*4;ctx.fillStyle='rgb('+(220+lp)+',38,38)';ctx.fillRect(x,y,gs,gs);}else{ctx.fillStyle=def.color;ctx.fillRect(x,y,gs,gs);}if(def.solid){ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=0.5;ctx.strokeRect(x,y,gs,gs);}}};
        if(scene.tilemap?.grid)drawTG(scene.tilemap.grid);if(scene.tilemaps)for(const tm of scene.tilemaps)drawTG(tm.grid);

        for(const inst of this.instances){
          const il=inst.layerId||'d';if(il!==lay.id&&!(il==='d'&&lay.id==='d'))continue;
          if(inst.flashVisible===false)continue;
          const obj=this.project.objects.find(o=>o.id===inst.objectTypeId);if(!obj)continue;
          ctx.save();ctx.translate(inst.x+inst.w/2,inst.y+inst.h/2);ctx.rotate(inst.angle*Math.PI/180);ctx.globalAlpha=inst.opacity;
          if(inst.blendMode==='add')ctx.globalCompositeOperation='lighter';else if(inst.blendMode==='multiply')ctx.globalCompositeOperation='multiply';else if(inst.blendMode==='screen')ctx.globalCompositeOperation='screen';
          const ox=inst.originX||0.5,oy=inst.originY||0.5,rx=-inst.w*ox,ry=-inst.h*oy;
          const frame=obj.frames&&obj.frames[0];
          if(frame&&frame.pixels&&frame.pixels.length>0){
            const pw=inst.w/frame.width,ph=inst.h/frame.height;
            for(let r=0;r<frame.height;r++)for(let c=0;c<frame.width;c++){const clr=frame.pixels[r*frame.width+c];if(clr){ctx.fillStyle=clr;ctx.fillRect(rx+c*pw,ry+r*ph,pw+0.3,ph+0.3);}}
          }else{ctx.fillStyle=obj.primaryColor||'#ec4899';ctx.fillRect(rx,ry,inst.w,inst.h);}
          ctx.restore();
        }
        ctx.restore();
      }

      // HUD
      const vars=this.globalVars; const h=35+Object.keys(vars).length*15;
      ctx.fillStyle='rgba(10,11,16,0.9)';ctx.fillRect(15,15,230,h);
      ctx.strokeStyle='#2d2e38';ctx.lineWidth=1.5;ctx.strokeRect(15,15,230,h);
      ctx.fillStyle='#f8fafc';ctx.font='bold 9px monospace';ctx.fillText('[HUD]',24,28);
      let off=42;
      for(const[k,v]of Object.entries(vars)){ctx.fillStyle='#94a3b8';ctx.fillText(k+':',24,off);ctx.fillStyle='#10b981';ctx.fillText(v,140,off);off+=14;}
    }
  }

  return { Engine, Camera, InputSystem, AudioSystem, checkAABB, checkSolidCollision, resolveCollisions, TILE_DEFS };
})();
`.trim();
}

function generateStandaloneHTML(project: GameProject): string {
  const projectJSON = JSON.stringify(project);
  const engineBundle = generateEngineBundle();

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
<canvas id="game-canvas" width="${project.settings.windowWidth || 800}" height="${project.settings.windowHeight || 600}"></canvas>
<div id="ui-overlay">
  <button onclick="window.engine && window.engine.running ? window.engine.stop() : window.engine.start()" id="play-btn">⏸ Pausar</button>
  <button onclick="window.engine && (window.engine.stop(), startGame())">↻ Reiniciar</button>
</div>
<script id="_engine_vars" type="application/json">${JSON.stringify(project.globalVariables)}</script>
<script>
${engineBundle}

const PROJECT = ${projectJSON};
const canvas = document.getElementById('game-canvas');

function startGame() {
  const engine = new ENGINE.Engine(canvas, PROJECT);
  window.engine = engine;
  document.getElementById('play-btn').textContent = '⏸ Pausar';
  engine.start();
}

window.startGame = startGame;
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && window.engine) { window.engine.stop(); document.getElementById('play-btn').textContent = '▶ Jogar'; } });

startGame();
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
              <span>Engine 2D modular completa embarcada em um único arquivo HTML.</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <span>Renderização Canvas2D com behaviors, eventos, câmera, áudio e mais.</span>
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
