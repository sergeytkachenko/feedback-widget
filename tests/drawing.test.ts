import { describe, expect, it, vi } from 'vitest';
import { arrowHead, renderOp, renderOps, toImagePoint } from '../src/core/drawing.js';
import type { DrawingOp } from '../src/core/drawing.js';

function mockContext() {
  return {
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: '',
    lineCap: '',
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn()
  };
}

describe('toImagePoint', () => {
  it('maps client coordinates into natural image pixels', () => {
    const stage = { left: 100, top: 50, width: 400 };
    expect(toImagePoint(300, 150, stage, 800)).toEqual({ x: 400, y: 200 });
  });

  it('is identity when displayed size equals natural size', () => {
    const stage = { left: 0, top: 0, width: 640 };
    expect(toImagePoint(10, 20, stage, 640)).toEqual({ x: 10, y: 20 });
  });

  it('guards against zero-width stages', () => {
    expect(toImagePoint(10, 20, { left: 0, top: 0, width: 0 }, 640)).toEqual({ x: 10, y: 20 });
  });
});

describe('arrowHead', () => {
  it('produces symmetric head points behind the tip for a horizontal arrow', () => {
    const [a, b] = arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, 4);
    expect(a.x).toBeLessThan(100);
    expect(b.x).toBeLessThan(100);
    expect(a.x).toBeCloseTo(b.x);
    expect(a.y).toBeCloseTo(-b.y);
  });

  it('never collapses the head below the minimum length', () => {
    const [a] = arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, 1);
    expect(100 - a.x).toBeGreaterThanOrEqual(12 * Math.cos(0.5) - 1e-9);
  });
});

describe('renderOp', () => {
  it('draws a pen op as a polyline', () => {
    const ctx = mockContext();
    const op: DrawingOp = {
      tool: 'pen',
      color: '#e0342f',
      size: 4,
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 2 }
      ]
    };
    renderOp(ctx as unknown as CanvasRenderingContext2D, op);
    expect(ctx.strokeStyle).toBe('#e0342f');
    expect(ctx.lineWidth).toBe(4);
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
    expect(ctx.lineTo).toHaveBeenCalledTimes(2);
    expect(ctx.stroke).toHaveBeenCalledOnce();
  });

  it('draws a rect op normalized from any drag direction', () => {
    const ctx = mockContext();
    const op: DrawingOp = {
      tool: 'rect',
      color: '#2563eb',
      size: 3,
      points: [
        { x: 50, y: 60 },
        { x: 10, y: 20 }
      ]
    };
    renderOp(ctx as unknown as CanvasRenderingContext2D, op);
    expect(ctx.strokeRect).toHaveBeenCalledWith(10, 20, 40, 40);
  });

  it('draws an arrow op with a two-segment head', () => {
    const ctx = mockContext();
    const op: DrawingOp = {
      tool: 'arrow',
      color: '#111827',
      size: 4,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ]
    };
    renderOp(ctx as unknown as CanvasRenderingContext2D, op);
    expect(ctx.moveTo).toHaveBeenCalledTimes(2);
    expect(ctx.lineTo).toHaveBeenCalledTimes(3);
    expect(ctx.stroke).toHaveBeenCalledOnce();
  });

  it('ignores ops without points', () => {
    const ctx = mockContext();
    renderOp(ctx as unknown as CanvasRenderingContext2D, { tool: 'pen', color: '#000', size: 2, points: [] });
    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});

describe('renderOps', () => {
  it('clears the canvas before replaying the op stack', () => {
    const ctx = mockContext();
    const op: DrawingOp = {
      tool: 'rect',
      color: '#16a34a',
      size: 3,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ]
    };
    renderOps(ctx as unknown as CanvasRenderingContext2D, [op, op], 800, 600);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(ctx.strokeRect).toHaveBeenCalledTimes(2);
  });
});
