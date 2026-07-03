import { domToCanvas } from 'modern-screenshot';
import type { Rect } from './region.js';

export interface ViewportCapture {
  canvas: HTMLCanvasElement;
  full: Blob;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas export failed'));
    }, 'image/png');
  });
}

export function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function captureViewport(excludeTag: string): Promise<ViewportCapture> {
  const scale = window.devicePixelRatio || 1;
  const canvas = await domToCanvas(document.documentElement, {
    width: window.innerWidth,
    height: window.innerHeight,
    scale,
    filter: (node) => !(node instanceof Element && node.tagName.toLowerCase() === excludeTag),
    style: { transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)` }
  });
  const full = await canvasToBlob(canvas);
  return { canvas, full };
}

export async function cropCanvas(source: HTMLCanvasElement, deviceRect: Rect): Promise<Blob> {
  const target = document.createElement('canvas');
  target.width = Math.max(deviceRect.width, 1);
  target.height = Math.max(deviceRect.height, 1);
  const ctx = target.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d context unavailable');
  ctx.drawImage(
    source,
    deviceRect.x,
    deviceRect.y,
    deviceRect.width,
    deviceRect.height,
    0,
    0,
    deviceRect.width,
    deviceRect.height
  );
  return canvasToBlob(target);
}
