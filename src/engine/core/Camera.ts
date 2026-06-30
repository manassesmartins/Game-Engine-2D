export class Camera {
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public zoom: number;

  constructor(width: number, height: number) {
    this.x = width / 2;
    this.y = height / 2;
    this.width = width;
    this.height = height;
    this.zoom = 1;
  }

  get halfWidth(): number {
    return this.width / 2;
  }

  get halfHeight(): number {
    return this.height / 2;
  }

  follow(targetX: number, targetY: number, layoutWidth: number, layoutHeight: number) {
    this.x = targetX;
    this.y = targetY;
    this.clamp(layoutWidth, layoutHeight);
  }

  clamp(layoutWidth: number, layoutHeight: number) {
    const hw = this.halfWidth;
    const hh = this.halfHeight;
    const minCamX = Math.min(hw, layoutWidth / 2);
    const maxCamX = Math.max(hw, layoutWidth - hw);
    const minCamY = Math.min(hh, layoutHeight / 2);
    const maxCamY = Math.max(hh, layoutHeight - hh);
    this.x = Math.max(minCamX, Math.min(maxCamX, this.x));
    this.y = Math.max(minCamY, Math.min(maxCamY, this.y));
  }

  getTransformX(parallax: number): number {
    return this.halfWidth - this.x * parallax;
  }

  getTransformY(parallax: number): number {
    return this.halfHeight - this.y * parallax;
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: screenX - this.halfWidth + this.x,
      y: screenY - this.halfHeight + this.y,
    };
  }

  reset(width: number, height: number) {
    this.x = width / 2;
    this.y = height / 2;
    this.width = width;
    this.height = height;
  }
}
