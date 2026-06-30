/**
 * Wrapper EngineRunner for backward compatibility with existing code.
 * Internally uses the new modular Engine architecture.
 */

import { GameProject } from '../types';
import { Engine } from './core/Engine';

export { Engine } from './core/Engine';

export class EngineRunner {
  private engine: Engine;

  constructor(
    canvas: HTMLCanvasElement,
    project: GameProject,
    onDebugLog: (msg: string) => void
  ) {
    this.engine = new Engine(canvas, project, {
      onLog: onDebugLog,
      showHUD: true,
      debug: false,
    });
  }

  start() {
    this.engine.start();
  }

  stop() {
    this.engine.stop();
  }

  destroy() {
    this.engine.destroy();
  }
}
