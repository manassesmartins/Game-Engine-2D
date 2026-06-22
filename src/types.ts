export type ObjectType = 'sprite' | 'tilemap' | 'hud' | 'dictionary' | 'array';

export interface SpriteFrame {
  id: string;
  width: number;
  height: number;
  pixels: string[];
}

export interface SpriteAnimation {
  id: string;
  name: string;
  frames: string[];
  speed: number;
  loop: boolean;
}

export interface ProjectObject {
  id: string;
  name: string;
  type: ObjectType;
  primaryColor: string;
  frames: SpriteFrame[];
  animations: SpriteAnimation[];
  currentAnimation: string;
  behaviors: string[];
  properties: {
    speed?: number;
    acceleration?: number;
    deceleration?: number;
    jumpStrength?: number;
    doubleJump?: boolean;
    gravity?: number;
    maxSpeed?: number;
    carSpeed?: number;
    carAcceleration?: number;
    carDeceleration?: number;
    carTurnSpeed?: number;
    carDriftFactor?: number;
    bulletSpeed?: number;
    bulletAcceleration?: number;
    bulletGravity?: number;
    sineAmplitude?: number;
    sinePeriod?: number;
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
  grid: Record<string, number | string>;
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
  objectTypeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  opacity: number;
  variables: Record<string, number | string>;
  layerId?: string;
  originX?: number;
  originY?: number;
  collisionPolygon?: [number, number][];
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
  tilemaps: TileMapLayer[];
  layers: SceneLayer[];
}

export type ConditionType =
  | 'system_onload'
  | 'system_tick'
  | 'every_x_seconds'
  | 'every_x_ticks'
  | 'trigger_once'
  | 'keyboard_keypress'
  | 'keyboard_keyholding'
  | 'keyboard_keyrelease'
  | 'mouse_click'
  | 'mouse_cursor_on_object'
  | 'object_collision'
  | 'object_click'
  | 'object_distance'
  | 'object_count_compare'
  | 'timer_elapsed'
  | 'animation_finished'
  | 'function_called'
  | 'gesture_touch'
  | 'global_var_compare'
  | 'instance_var_compare'
  | 'compare_dictionary_value'
  | 'array_compare_at_index'
  | 'else_condition'
  | 'always'
  | 'pick_random_instance'
  | 'pick_nearest'
  | 'pick_farthest'
  | 'double_jump_available'
  | 'is_on_floor';

export interface EventCondition {
  id: string;
  type: ConditionType;
  param1?: string;
  param2?: string;
  param3?: string;
  negation?: boolean;
}

export type ActionType =
  | 'object_move'
  | 'object_move_to'
  | 'object_set_pos'
  | 'object_spawn'
  | 'object_destroy'
  | 'object_set_angle'
  | 'object_set_scale'
  | 'object_set_opacity'
  | 'object_set_filter'
  | 'object_set_blend'
  | 'object_set_visible'
  | 'object_set_animation'
  | 'object_set_frame'
  | 'object_set_size'
  | 'object_flash'
  | 'object_fade'
  | 'object_pin'
  | 'object_unpin'
  | 'play_sound'
  | 'play_music'
  | 'stop_music'
  | 'system_set_variable'
  | 'system_add_variable'
  | 'system_sub_variable'
  | 'set_instance_variable'
  | 'call_function'
  | 'dictionary_set'
  | 'array_push'
  | 'array_pop'
  | 'array_insert'
  | 'array_remove'
  | 'array_set'
  | 'array_clear'
  | 'timer_start'
  | 'wait'
  | 'go_to_layout'
  | 'restart_layout'
  | 'next_layout'
  | 'set_camera_position'
  | 'scroll_to_object'
  | 'shake_camera'
  | 'log_message'
  | 'broadcast_function'
  | 'set_gravity'
  | 'set_velocity'
  | 'apply_force';

export interface EventAction {
  id: string;
  type: ActionType;
  targetObjectId?: string;
  param1?: string;
  param2?: string;
  param3?: string;
  param4?: string;
}

export interface EventBlock {
  id: string;
  conditions: EventCondition[];
  actions: EventAction[];
  collapsed?: boolean;
  disabled?: boolean;
  comment?: string;
  subEvents?: EventBlock[];
  elseEvents?: EventBlock[];
  localVars?: Record<string, number | string>;
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
  cropStart?: number;
  cropEnd?: number;
}

export interface MusicTrack {
  id: string;
  name: string;
  bpm: number;
  notes: Record<string, string>;
  tempoLimit?: number;
}

export interface ScriptFile {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

export interface TimelineKeyframe {
  time: number;
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
  duration: number;
  loop: boolean;
  playing?: boolean;
}

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

export interface ProjectSettings {
  windowWidth: number;
  windowHeight: number;
  fps: number;
  renderMode: 'canvas2d' | 'webgl';
  fullscreen: boolean;
  pixelArt: boolean;
  backgroundColor: string;
  startSceneId: string;
}

export interface GameProject {
  name: string;
  settings: ProjectSettings;
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

export interface GameTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'platformer' | 'rpg' | 'puzzle' | 'arcade' | 'board' | 'blank';
  project: GameProject;
}
