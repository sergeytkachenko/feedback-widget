import type { Point } from './region.js';

export type DrawingTool = 'pen' | 'rect' | 'arrow';

export interface DrawingOp {
  tool: DrawingTool;
  color: string;
  size: number;
  points: Point[];
}

export interface StageRect {
  left: number;
  top: number;
  width: number;
}

export function toImagePoint(clientX: number, clientY: number, stage: StageRect, naturalWidth: number): Point {
  const scale = stage.width > 0 ? naturalWidth / stage.width : 1;
  return {
    x: (clientX - stage.left) * scale,
    y: (clientY - stage.top) * scale
  };
}

export function arrowHead(from: Point, to: Point, size: number): [Point, Point] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const headLength = Math.max(size * 4, 12);
  const spread = 0.5;
  return [
    {
      x: to.x - headLength * Math.cos(angle - spread),
      y: to.y - headLength * Math.sin(angle - spread)
    },
    {
      x: to.x - headLength * Math.cos(angle + spread),
      y: to.y - headLength * Math.sin(angle + spread)
    }
  ];
}

export function renderOp(ctx: CanvasRenderingContext2D, op: DrawingOp): void {
  const first = op.points[0];
  const last = op.points[op.points.length - 1];
  if (!first || !last) return;
  ctx.strokeStyle = op.color;
  ctx.lineWidth = op.size;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (op.tool === 'pen') {
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (const point of op.points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
    return;
  }
  if (op.tool === 'rect') {
    ctx.strokeRect(
      Math.min(first.x, last.x),
      Math.min(first.y, last.y),
      Math.abs(last.x - first.x),
      Math.abs(last.y - first.y)
    );
    return;
  }
  const [headA, headB] = arrowHead(first, last, op.size);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  ctx.lineTo(last.x, last.y);
  ctx.moveTo(headA.x, headA.y);
  ctx.lineTo(last.x, last.y);
  ctx.lineTo(headB.x, headB.y);
  ctx.stroke();
}

export function renderOps(ctx: CanvasRenderingContext2D, ops: readonly DrawingOp[], width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
  for (const op of ops) renderOp(ctx, op);
}
