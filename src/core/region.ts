export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MIN_REGION_SIZE = 8;

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}

export function normalizeRect(start: Point, end: Point, viewport: Size): Rect {
  const x1 = clamp(Math.min(start.x, end.x), viewport.width);
  const y1 = clamp(Math.min(start.y, end.y), viewport.height);
  const x2 = clamp(Math.max(start.x, end.x), viewport.width);
  const y2 = clamp(Math.max(start.y, end.y), viewport.height);
  return {
    x: Math.round(x1),
    y: Math.round(y1),
    width: Math.round(x2 - x1),
    height: Math.round(y2 - y1)
  };
}

export function toDeviceRect(rect: Rect, devicePixelRatio: number): Rect {
  return {
    x: Math.round(rect.x * devicePixelRatio),
    y: Math.round(rect.y * devicePixelRatio),
    width: Math.round(rect.width * devicePixelRatio),
    height: Math.round(rect.height * devicePixelRatio)
  };
}

export function isViableRegion(rect: Rect): boolean {
  return rect.width >= MIN_REGION_SIZE && rect.height >= MIN_REGION_SIZE;
}
