import type { Particle, ParticleEmitter } from '../types';

export class ParticleSystem {
  private particles: Particle[] = [];
  private emitters: ParticleEmitter[] = [];
  private nextEmitterId = 0;

  createEmitter(
    x: number, y: number,
    options: Partial<ParticleEmitter> = {}
  ): string {
    const id = `emitter_${this.nextEmitterId++}`;
    const emitter: ParticleEmitter = {
      id,
      x,
      y,
      active: true,
      rate: options.rate ?? 20,
      count: options.count ?? 50,
      life: options.life ?? 1,
      speed: options.speed ?? 100,
      spread: options.spread ?? Math.PI * 2,
      colors: options.colors ?? ['#ff6b35', '#f7c59f', '#ffcc00'],
      size: options.size ?? 4,
      sizeEnd: options.sizeEnd ?? 1,
      emitting: options.emitting ?? true,
      accum: 0,
    };
    this.emitters.push(emitter);
    return id;
  }

  removeEmitter(id: string) {
    const idx = this.emitters.findIndex(e => e.id === id);
    if (idx !== -1) this.emitters.splice(idx, 1);
  }

  burst(x: number, y: number, count: number, options: Partial<ParticleEmitter> = {}) {
    const colors = options.colors ?? ['#ff6b35', '#f7c59f', '#ffcc00'];
    const speed = options.speed ?? 100;
    const spread = options.spread ?? Math.PI * 2;
    const life = options.life ?? 0.5;
    const size = options.size ?? 4;
    const sizeEnd = options.sizeEnd ?? 0;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * spread;
      const spd = speed * (0.5 + Math.random() * 0.5);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: life * (0.5 + Math.random() * 0.5),
        maxLife: life,
        size: size * (0.5 + Math.random() * 0.5),
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }
  }

  update(dt: number) {
    for (const emitter of this.emitters) {
      if (!emitter.active) continue;
      emitter.x = emitter.x;
      emitter.y = emitter.y;

      if (emitter.emitting && this.particles.length < emitter.count) {
        emitter.accum += dt * emitter.rate;
        while (emitter.accum >= 1 && this.particles.length < emitter.count) {
          emitter.accum -= 1;
          const angle = Math.random() * emitter.spread;
          const spd = emitter.speed * (0.5 + Math.random() * 0.5);
          this.particles.push({
            x: emitter.x,
            y: emitter.y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            life: emitter.life * (0.5 + Math.random() * 0.5),
            maxLife: emitter.life,
            size: emitter.size * (0.5 + Math.random() * 0.5),
            color: emitter.colors[Math.floor(Math.random() * emitter.colors.length)],
            alpha: 1,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 10,
          });
        }
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      const t = 1 - p.life / p.maxLife;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.alpha = 1 - t;
      p.size = p.size + (0 - p.size) * t * 0.5;
      p.rotation += p.rotationSpeed * dt;
    }
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, halfW: number, halfH: number) {
    for (const p of this.particles) {
      const screenX = p.x - cameraX + halfW;
      const screenY = p.y - cameraY + halfH;
      if (screenX < -50 || screenX > halfW * 2 + 50 || screenY < -50 || screenY > halfH * 2 + 50) continue;

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
  }

  get count(): number {
    return this.particles.length;
  }

  clear() {
    this.particles = [];
    this.emitters = [];
  }

  destroy() {
    this.clear();
  }
}
