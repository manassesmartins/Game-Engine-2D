/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ObjectType = 'sprite' | 'tilemap' | 'hud' | 'dictionary' | 'array';

export interface SpriteFrame {
  id: string;
  width: number;
  height: number;
  pixels: string[]; // Flat 1D array of colors (hex or transparent "")
}

export interface SpriteAnimation {
  id: string;
  name: string;
  frames: string[]; // SpriteFrame IDs
  speed: number; // FPS
  loop: boolean;
}

export interface ProjectObject {
  id: string;
  name: string;
  type: ObjectType;
  primaryColor: string; // fallback color
  frames: SpriteFrame[];
  animations: SpriteAnimation[];
  currentAnimation: string; // Animation ID
  behaviors: string[]; // 'Platform' | '8Direction' | 'Car' | 'Bullet' | 'Solid' | 'JumpThru' | 'BoundToLayout' | 'ScrollTo' | 'Flash' | 'Fade' | 'Timer' | 'Pin' | 'Physics' | 'Pathfinding'
  properties: {
    // Platform variables
    speed?: number;
    acceleration?: number;
    deceleration?: number;
    jumpStrength?: number;
    doubleJump?: boolean;
    gravity?: number;
    maxSpeed?: number;
    // Car variables
    carSpeed?: number;
    carAcceleration?: number;
    carDeceleration?: number;
    carTurnSpeed?: number;
    carDriftFactor?: number;
    // Bullet variables
    bulletSpeed?: number;
    bulletAcceleration?: number;
    bulletGravity?: number;
    // Sine variables
    sineAmplitude?: number;
    sinePeriod?: number;
    // Timer & General
    flashDuration?: number;
    fadeDuration?: number;
    timerValue?: number;
  };
}

export interface TileDef {
  id: number;
  color: string;
  solid: boolean;
  name: string;
}

export interface TileMapLayer {
  id: string;
  name: string;
  grid: Record<string, number | string>; // "x,y": TileDef ID or "objId:frameIdx"
}

export interface SceneLayer {
  id: string;
  name: string;
  parallaxX: number;
  parallaxY: number;
  opacity: number;
  visible: boolean;
}

export interface ObjectInstance {
  id: string;
  objectTypeId: string; // Reference to ProjectObject
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number; // degrees
  opacity: number; // 0 to 1
  variables: Record<string, number | string>;
  layerId?: string; // Reference to SceneLayer ID
  originX?: number; // 0 to 1 (default 0.5)
  originY?: number; // 0 to 1 (default 0.5)
  collisionPolygon?: [number, number][]; // Offset points relative to top-left [x, y]
  blendMode?: 'normal' | 'add' | 'multiply' | 'screen';
  effectFilter?: 'none' | 'grayscale' | 'sepia' | 'blur' | 'glow' | 'water' | 'shockwave' | 'warp';
}

export interface Scene {
  id: string;
  name: string;
  width: number;
  height: number;
  gridSize: number;
  instances: ObjectInstance[];
  tilemap: TileMapLayer;
  layers: SceneLayer[];
}

export type ConditionType =
  | 'system_onload'
  | 'system_tick'
  | 'keyboard_keypress'
  | 'keyboard_keyholding'
  | 'mouse_click'
  | 'object_collision'
  | 'object_click'
  | 'timer_elapsed'
  | 'function_called'
  | 'gesture_touch';

export interface EventCondition {
  id: string;
  type: ConditionType;
  param1?: string; // e.g. key name, object type, function name
  param2?: string; // e.g. target object type, collision object type
}

export type ActionType =
  | 'object_move'
  | 'object_set_pos'
  | 'object_spawn'
  | 'object_destroy'
  | 'object_set_angle'
  | 'object_set_scale'
  | 'object_set_opacity'
  | 'object_set_filter'
  | 'object_set_blend'
  | 'object_flash'
  | 'object_fade'
  | 'play_sound'
  | 'system_set_variable'
  | 'system_add_variable'
  | 'call_function'
  | 'dictionary_set'
  | 'array_push'
  | 'timer_start';

export interface EventAction {
  id: string;
  type: ActionType;
  targetObjectId?: string; // Which objecttype the action applies to
  param1?: string; // custom params (key, function name, asset name, X, var name)
  param2?: string; // custom params (value, Y, volume, timer seconds)
}

export interface EventBlock {
  id: string;
  conditions: EventCondition[];
  actions: EventAction[];
  collapsed?: boolean;
  subEvents?: EventBlock[]; // Nested child conditions
  localVars?: Record<string, number | string>; // localized variables
  isFunction?: boolean;
  funcName?: string;
}

export interface SoundPreset {
  id: string;
  name: string;
  type: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';
  frequency: number;
  duration: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  cropStart?: number; // Crop parameter to slice sounds directly in engine
  cropEnd?: number;   // Crop parameter 
}

export interface MusicTrack {
  id: string;
  name: string;
  bpm: number;
  notes: Record<string, string>; // "trackNumber:stepNumber": "C4", "E4", "G4"
  tempoLimit?: number;
}

export interface ScriptFile {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

export interface TimelineKeyframe {
  time: number; // time offset in seconds
  x?: number;
  y?: number;
  angle?: number;
  scale?: number;
  opacity?: number;
}

export interface TimelineSequence {
  id: string;
  name: string;
  targetInstanceId: string;
  keyframes: TimelineKeyframe[];
  duration: number; // total animation time in seconds
  loop: boolean;
  playing?: boolean;
}

// Memory repositories modeling construct 3 Dictionary and Array layout nodes
export interface DictionaryPluginData {
  id: string;
  name: string;
  entries: Record<string, string | number>;
}

export interface ArrayPluginData {
  id: string;
  name: string;
  values: (string | number)[];
}

export interface GameProject {
  name: string;
  objects: ProjectObject[];
  scenes: Scene[];
  currentSceneId: string;
  events: EventBlock[];
  sounds: SoundPreset[];
  music: MusicTrack[];
  globalVariables: Record<string, number>;
  scripts: ScriptFile[];
  timelines: TimelineSequence[];
  dictionaries: DictionaryPluginData[];
  arrays: ArrayPluginData[];
}
