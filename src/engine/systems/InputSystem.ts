export interface GamepadState {
  connected: boolean;
  axes: number[];
  buttons: boolean[];
  prevButtons: boolean[];
}

export class InputSystem {
  public keysHeld: Record<string, boolean> = {};
  public keysPressed: Record<string, boolean> = {};
  public keysReleased: Record<string, boolean> = {};
  public mouseX = 0;
  public mouseY = 0;
  public mouseDown = false;
  public mouseClicked = false;
  public touches: { x: number; y: number }[] = [];

  private gamepadStates: Map<number, GamepadState> = new Map();
  private canvas: HTMLCanvasElement;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;
  private boundGamepadConnected: (e: GamepadEvent) => void;
  private boundGamepadDisconnected: (e: GamepadEvent) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundMouseDown = this.handleMouseDown.bind(this);
    this.boundMouseUp = this.handleMouseUp.bind(this);
    this.boundTouchStart = this.handleTouchStart.bind(this);
    this.boundTouchMove = this.handleTouchMove.bind(this);
    this.boundTouchEnd = this.handleTouchEnd.bind(this);
    this.boundGamepadConnected = this.handleGamepadConnected.bind(this);
    this.boundGamepadDisconnected = this.handleGamepadDisconnected.bind(this);
    this.setupListeners();
  }

  private setupListeners() {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    this.canvas.addEventListener('mousemove', this.boundMouseMove);
    this.canvas.addEventListener('mousedown', this.boundMouseDown);
    this.canvas.addEventListener('mouseup', this.boundMouseUp);
    this.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: true });
    this.canvas.addEventListener('touchmove', this.boundTouchMove, { passive: true });
    this.canvas.addEventListener('touchend', this.boundTouchEnd);
    window.addEventListener('gamepadconnected', this.boundGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.boundGamepadDisconnected);
  }

  destroy() {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    this.canvas.removeEventListener('mousemove', this.boundMouseMove);
    this.canvas.removeEventListener('mousedown', this.boundMouseDown);
    this.canvas.removeEventListener('mouseup', this.boundMouseUp);
    this.canvas.removeEventListener('touchstart', this.boundTouchStart);
    this.canvas.removeEventListener('touchmove', this.boundTouchMove);
    this.canvas.removeEventListener('touchend', this.boundTouchEnd);
    window.removeEventListener('gamepadconnected', this.boundGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.boundGamepadDisconnected);
  }

  endFrame() {
    this.keysPressed = {};
    this.keysReleased = {};
    this.mouseClicked = false;
    this.touches = [];
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (!this.keysHeld[e.key]) {
      this.keysPressed[e.key] = true;
    }
    this.keysHeld[e.key] = true;
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.keysHeld[e.key] = false;
    this.keysReleased[e.key] = true;
  }

  private handleMouseMove(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
  }

  private handleMouseDown(e: MouseEvent) {
    this.mouseDown = true;
    this.mouseClicked = true;
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
  }

  private handleMouseUp() {
    this.mouseDown = false;
  }

  private handleTouchStart(e: TouchEvent) {
    this.updateTouches(e);
  }

  private handleTouchMove(e: TouchEvent) {
    this.updateTouches(e);
  }

  private handleTouchEnd() {
    this.touches = [];
  }

  private updateTouches(e: TouchEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.touches = Array.from(e.touches).map(t => ({
      x: t.clientX - rect.left,
      y: t.clientY - rect.top,
    }));
  }

  private handleGamepadConnected(e: GamepadEvent) {
    this.gamepadStates.set(e.gamepad.index, {
      connected: true,
      axes: [],
      buttons: [],
      prevButtons: [],
    });
  }

  private handleGamepadDisconnected(e: GamepadEvent) {
    this.gamepadStates.delete(e.gamepad.index);
  }

  updateGamepads() {
    const gamepads = navigator.getGamepads?.() ?? [];
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (!gp) continue;
      let state = this.gamepadStates.get(i);
      if (!state) {
        state = { connected: true, axes: [], buttons: [], prevButtons: [] };
        this.gamepadStates.set(i, state);
      }
      state.prevButtons = [...state.buttons];
      state.axes = Array.from(gp.axes);
      state.buttons = Array.from(gp.buttons).map(b => b.pressed);
    }
  }

  isGamepadButtonPressed(gamepadIndex: number, buttonIndex: number): boolean {
    const state = this.gamepadStates.get(gamepadIndex);
    if (!state) return false;
    return state.buttons[buttonIndex] && !state.prevButtons[buttonIndex];
  }

  isGamepadButtonHeld(gamepadIndex: number, buttonIndex: number): boolean {
    return this.gamepadStates.get(gamepadIndex)?.buttons[buttonIndex] ?? false;
  }

  getGamepadAxis(gamepadIndex: number, axisIndex: number): number {
    return this.gamepadStates.get(gamepadIndex)?.axes[axisIndex] ?? 0;
  }

  get isGamepadConnected(): boolean {
    for (const state of this.gamepadStates.values()) {
      if (state.connected) return true;
    }
    return false;
  }
}
