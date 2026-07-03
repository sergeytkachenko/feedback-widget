import { domToCanvas } from 'modern-screenshot';
import type { Rect } from './region.js';

export type CaptureFidelity = 'fast' | 'full';

export interface ViewportCapture {
  canvas: HTMLCanvasElement;
  full: Blob;
}

export const FAST_STYLE_PROPERTIES: readonly string[] = [
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
  'float',
  'clear',
  'box-sizing',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'aspect-ratio',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'overflow-x',
  'overflow-y',
  'overflow-wrap',
  'contain',
  'flex-direction',
  'flex-wrap',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'justify-content',
  'justify-items',
  'justify-self',
  'align-items',
  'align-content',
  'align-self',
  'order',
  'row-gap',
  'column-gap',
  'grid-template-columns',
  'grid-template-rows',
  'grid-template-areas',
  'grid-auto-columns',
  'grid-auto-rows',
  'grid-auto-flow',
  'grid-column-start',
  'grid-column-end',
  'grid-row-start',
  'grid-row-end',
  'table-layout',
  'border-collapse',
  'border-spacing',
  'caption-side',
  'empty-cells',
  'vertical-align',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-stretch',
  'font-variant',
  'font-feature-settings',
  'font-kerning',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'white-space',
  'word-break',
  'text-align',
  'text-align-last',
  'text-decoration-line',
  'text-decoration-color',
  'text-decoration-style',
  'text-decoration-thickness',
  'text-underline-offset',
  'text-transform',
  'text-indent',
  'text-overflow',
  'text-shadow',
  'text-rendering',
  '-webkit-text-fill-color',
  '-webkit-text-stroke-color',
  '-webkit-text-stroke-width',
  '-webkit-line-clamp',
  '-webkit-box-orient',
  'direction',
  'unicode-bidi',
  'writing-mode',
  'text-orientation',
  'tab-size',
  'color',
  'content',
  'quotes',
  'background-color',
  'background-image',
  'background-position-x',
  'background-position-y',
  'background-size',
  'background-repeat',
  'background-attachment',
  'background-clip',
  'background-origin',
  'background-blend-mode',
  'box-shadow',
  'opacity',
  'visibility',
  'mix-blend-mode',
  'isolation',
  'border-top-width',
  'border-top-style',
  'border-top-color',
  'border-right-width',
  'border-right-style',
  'border-right-color',
  'border-bottom-width',
  'border-bottom-style',
  'border-bottom-color',
  'border-left-width',
  'border-left-style',
  'border-left-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'border-image-source',
  'border-image-slice',
  'border-image-width',
  'border-image-outset',
  'border-image-repeat',
  'outline-width',
  'outline-style',
  'outline-color',
  'outline-offset',
  'list-style-type',
  'list-style-position',
  'list-style-image',
  'transform',
  'transform-origin',
  'transform-style',
  'perspective',
  'perspective-origin',
  'rotate',
  'scale',
  'translate',
  'filter',
  'backdrop-filter',
  'clip-path',
  'mask-image',
  'mask-size',
  'mask-position',
  'mask-repeat',
  'object-fit',
  'object-position',
  'image-rendering',
  'column-count',
  'column-width',
  'column-rule-width',
  'column-rule-style',
  'column-rule-color',
  'column-span',
  'column-fill',
  'break-inside',
  'appearance',
  'accent-color',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'paint-order',
  'stop-color',
  'stop-opacity',
  'vector-effect',
  'dominant-baseline',
  'text-anchor',
  'clip-rule',
  'color-interpolation',
  'shape-rendering'
];

export interface StyleReader {
  getComputedStyle(el: Element): { display: string };
}

export function buildCaptureFilter(excludeTag: string, win: StyleReader): (node: Node) => boolean {
  return (node) => {
    if (!(node instanceof Element)) return true;
    if (node.tagName.toLowerCase() === excludeTag) return false;
    return win.getComputedStyle(node).display !== 'none';
  };
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

export async function captureViewport(excludeTag: string, fidelity: CaptureFidelity = 'fast'): Promise<ViewportCapture> {
  const scale = window.devicePixelRatio || 1;
  const canvas = await domToCanvas(document.documentElement, {
    width: window.innerWidth,
    height: window.innerHeight,
    scale,
    filter: buildCaptureFilter(excludeTag, window),
    includeStyleProperties: fidelity === 'fast' ? [...FAST_STYLE_PROPERTIES] : null,
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
