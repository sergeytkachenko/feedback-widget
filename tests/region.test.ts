import { describe, expect, it } from 'vitest';
import { isViableRegion, normalizeRect, toCanvasRect } from '../src/core/region.js';

const VIEWPORT = { width: 1280, height: 800 };

describe('normalizeRect', () => {
  it.each([
    ['top-left to bottom-right', { x: 10, y: 20 }, { x: 110, y: 90 }],
    ['bottom-right to top-left', { x: 110, y: 90 }, { x: 10, y: 20 }],
    ['top-right to bottom-left', { x: 110, y: 20 }, { x: 10, y: 90 }],
    ['bottom-left to top-right', { x: 10, y: 90 }, { x: 110, y: 20 }]
  ])('normalizes drag %s', (_label, start, end) => {
    expect(normalizeRect(start, end, VIEWPORT)).toEqual({ x: 10, y: 20, width: 100, height: 70 });
  });

  it('clamps coordinates to the viewport', () => {
    expect(normalizeRect({ x: -50, y: -10 }, { x: 2000, y: 900 }, VIEWPORT)).toEqual({
      x: 0,
      y: 0,
      width: VIEWPORT.width,
      height: VIEWPORT.height
    });
  });

  it('rounds fractional coordinates', () => {
    expect(normalizeRect({ x: 10.4, y: 10.6 }, { x: 20.5, y: 30.2 }, VIEWPORT)).toEqual({
      x: 10,
      y: 11,
      width: 10,
      height: 20
    });
  });
});

describe('toCanvasRect', () => {
  it('scales by uniform factors', () => {
    expect(toCanvasRect({ x: 10, y: 20, width: 100, height: 50 }, 2, 2)).toEqual({
      x: 20,
      y: 40,
      width: 200,
      height: 100
    });
  });

  it('scales each axis independently for native frames', () => {
    expect(toCanvasRect({ x: 10, y: 20, width: 100, height: 50 }, 2, 1.5)).toEqual({
      x: 20,
      y: 30,
      width: 200,
      height: 75
    });
  });

  it('is identity at scale 1', () => {
    const rect = { x: 3, y: 4, width: 5, height: 6 };
    expect(toCanvasRect(rect, 1, 1)).toEqual(rect);
  });
});

describe('isViableRegion', () => {
  it('accepts regions at the minimum size', () => {
    expect(isViableRegion({ x: 0, y: 0, width: 8, height: 8 })).toBe(true);
  });

  it('rejects regions below the minimum size', () => {
    expect(isViableRegion({ x: 0, y: 0, width: 7, height: 100 })).toBe(false);
    expect(isViableRegion({ x: 0, y: 0, width: 100, height: 7 })).toBe(false);
    expect(isViableRegion({ x: 0, y: 0, width: 0, height: 0 })).toBe(false);
  });
});
