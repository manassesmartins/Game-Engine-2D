import type { GameProject, ObjectInstance, ProjectObject, SpriteAnimation } from '../types';

export type CollisionLayer = number;
export type CollisionMask = number;

export const COLLISION_LAYER = {
  DEFAULT: 1 << 0,
  PLAYER: 1 << 1,
  ENEMY: 1 << 2,
  SOLID: 1 << 3,
  BULLET: 1 << 4,
  COLLECTIBLE: 1 << 5,
  TRIGGER: 1 << 6,
  UI: 1 << 7,
  ALL: 0xFFFF,
} as const;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
  rotation: number;
  rotationSpeed: number;
}

export interface ParticleEmitter {
  id: string;
  x: number;
  y: number;
  active: boolean;
  rate: number;
  count: number;
  life: number;
  speed: number;
  spread: number;
  colors: string[];
  size: number;
  sizeEnd: number;
  emitting: boolean;
  accum: number;
}

export interface UITextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  align: CanvasTextAlign;
  baseline: CanvasTextBaseline;
  visible: boolean;
  layerId?: string;
}

export interface LiveVariable {
  name: string;
  value: number | string;
}

export interface GameState {
  score: number;
  lives: number;
  level: number;
  health: number;
  custom: Record<string, number | string>;
}

export interface EngineStats {
  fps: number;
  dt: number;
  instanceCount: number;
  particleCount: number;
}

export interface EngineOptions {
  debug?: boolean;
  showHUD?: boolean;
  onLog?: (msg: string) => void;
}

export interface BehaviorContext {
  inst: LiveInstance;
  obj: ProjectObject;
  dt: number;
  keysHeld: Record<string, boolean>;
  keysPressed: Record<string, boolean>;
  globalTime: number;
  liveInstances: LiveInstance[];
  engine: any;
}

export interface AnimationState {
  currentAnimation: string;
  currentFrame: number;
  frameTimer: number;
  frameIndex: number;
  finished: boolean;
  animationSpeed: number;
}

export type TransitionType = 'fade' | 'slide_left' | 'slide_right' | 'slide_up' | 'slide_down' | 'zoom_in' | 'zoom_out' | 'none';

export interface SceneTransition {
  type: TransitionType;
  duration: number;
  elapsed: number;
  active: boolean;
  callback?: () => void;
}

export interface LiveInstance extends ObjectInstance {
  vx: number;
  vy: number;
  onGround: boolean;
  timer: number;
  health: number;
  sineAccumulator: number;
  initialX: number;
  initialY: number;
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
  targetX?: number;
  targetY?: number;
  collisionLayer?: CollisionLayer;
  collisionMask?: CollisionMask;
  zIndex?: number;
  animState?: AnimationState;
}

export interface BehaviorHandler {
  name: string;
  update(ctx: BehaviorContext): void;
}
