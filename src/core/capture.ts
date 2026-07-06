import { snapdom } from '@zumer/snapdom';
import type { Rect } from './region.js';
import { stopStream } from './streams.js';
import type { DisplayCaptureOptions } from '../types.js';

export type CaptureEngine = 'dom' | 'native';

export interface CaptureRequest {
  engine: CaptureEngine;
  excludeTag: string;
  maskSelector?: string;
}

export interface ViewportCapture {
  canvas: HTMLCanvasElement;
  full: Blob;
}

export interface PageSnapshot {
  rasterizeViewport(): Promise<ViewportCapture>;
}

export const MAX_CAPTURE_AREA = 32_000_000;

export const MIN_CAPTURE_SCALE = 0.25;

export const MAX_DECODE_SIDE = 16_384;

export const MAX_DECODE_AREA = 268_000_000;

export function effectiveScale(pageWidth: number, pageHeight: number, dpr: number, maxArea = MAX_CAPTURE_AREA): number {
  const area = pageWidth * pageHeight;
  if (area <= 0) return dpr;
  return Math.min(dpr, Math.max(MIN_CAPTURE_SCALE, Math.sqrt(maxArea / area)));
}

export function parseMaskSelector(maskSelector?: string): string[] {
  return (maskSelector ?? '')
    .split(',')
    .map((selector) => selector.trim())
    .filter(Boolean);
}

export interface NativeCaptureEnv {
  secureContext: boolean;
  userAgent: string;
  hasGetDisplayMedia: boolean;
}

export function isNativeCaptureSupported(env: NativeCaptureEnv): boolean {
  if (!env.secureContext || !env.hasGetDisplayMedia) return false;
  return !/Mobi|Android|iPhone|iPad|iPod/i.test(env.userAgent);
}

function currentNativeEnv(): NativeCaptureEnv {
  return {
    secureContext: window.isSecureContext,
    userAgent: navigator.userAgent,
    hasGetDisplayMedia: Boolean(navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices)
  };
}

export function willUseNativeCapture(engine: CaptureEngine): boolean {
  return engine === 'native' && isNativeCaptureSupported(currentNativeEnv());
}

export interface StyleReader {
  getComputedStyle(el: Element): { display: string };
}

export function collectHiddenRoots(root: Element, win: StyleReader): WeakSet<Element> {
  const hidden = new WeakSet<Element>();
  const visit = (el: Element) => {
    if (win.getComputedStyle(el).display === 'none') {
      hidden.add(el);
      return;
    }
    if (el.shadowRoot) {
      for (const child of Array.from(el.shadowRoot.children)) visit(child);
    }
    for (const child of Array.from(el.children)) visit(child);
  };
  visit(root);
  return hidden;
}

export function buildSnapFilter(hiddenRoots: WeakSet<Element>): (el: Element) => boolean {
  return (el) => !hiddenRoots.has(el);
}

export function canRasterizeViewportDirect(pageWidth: number, pageHeight: number, userAgent: string): boolean {
  if (/AppleWebKit/i.test(userAgent) && !/Chrome|Chromium|CriOS|Edg/i.test(userAgent)) return false;
  if (pageWidth > MAX_DECODE_SIDE || pageHeight > MAX_DECODE_SIDE) return false;
  return pageWidth * pageHeight <= MAX_DECODE_AREA;
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

function cropToCanvas(source: HTMLCanvasElement, rect: Rect): HTMLCanvasElement {
  const target = document.createElement('canvas');
  target.width = Math.max(rect.width, 1);
  target.height = Math.max(rect.height, 1);
  const ctx = target.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d context unavailable');
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  return target;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'sync';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Screenshot image failed to load'));
    image.src = url;
  });
}

function drawViewportFromImage(image: HTMLImageElement, pageWidth: number, pageHeight: number, scale: number): HTMLCanvasElement {
  const kx = image.naturalWidth > 0 ? image.naturalWidth / pageWidth : 1;
  const ky = image.naturalHeight > 0 ? image.naturalHeight / pageHeight : 1;
  const target = document.createElement('canvas');
  target.width = Math.max(1, Math.round(window.innerWidth * scale));
  target.height = Math.max(1, Math.round(window.innerHeight * scale));
  const ctx = target.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d context unavailable');
  ctx.drawImage(
    image,
    window.scrollX * kx,
    window.scrollY * ky,
    window.innerWidth * kx,
    window.innerHeight * ky,
    0,
    0,
    target.width,
    target.height
  );
  return target;
}

function warmImageRaster(image: HTMLImageElement, scale: number, background: boolean) {
  const draw = () => {
    const probe = document.createElement('canvas');
    probe.width = Math.max(1, Math.round(scale));
    probe.height = Math.max(1, Math.round(scale));
    probe.getContext('2d')?.drawImage(image, 0, 0, 1, 1, 0, 0, probe.width, probe.height);
  };
  if (!background) {
    draw();
    return;
  }
  if ('requestIdleCallback' in window) requestIdleCallback(draw, { timeout: 2000 });
  else setTimeout(draw, 50);
}

function cropPageCanvas(page: HTMLCanvasElement, pageWidth: number, pageHeight: number): HTMLCanvasElement {
  const scaleX = page.width / pageWidth;
  const scaleY = page.height / pageHeight;
  return cropToCanvas(page, {
    x: Math.round(window.scrollX * scaleX),
    y: Math.round(window.scrollY * scaleY),
    width: Math.round(window.innerWidth * scaleX),
    height: Math.round(window.innerHeight * scaleY)
  });
}

async function finishViewportCapture(canvas: HTMLCanvasElement): Promise<ViewportCapture> {
  return { canvas, full: await canvasToBlob(canvas) };
}

export interface SnapshotOptions {
  background?: boolean;
}

export async function capturePageSnapshot(excludeTag: string, maskSelector?: string, options?: SnapshotOptions): Promise<PageSnapshot> {
  const root = document.documentElement;
  const pageWidth = Math.max(root.scrollWidth, window.innerWidth);
  const pageHeight = Math.max(root.scrollHeight, window.innerHeight);
  const dpr = window.devicePixelRatio || 1;
  const direct = canRasterizeViewportDirect(pageWidth, pageHeight, navigator.userAgent);
  const scale = direct
    ? effectiveScale(window.innerWidth, window.innerHeight, dpr)
    : effectiveScale(pageWidth, pageHeight, dpr);
  const result = await snapdom(root, {
    scale,
    dpr: 1,
    fast: !options?.background,
    exclude: [excludeTag, ...parseMaskSelector(maskSelector)],
    excludeMode: 'hide',
    filter: buildSnapFilter(collectHiddenRoots(root, window)),
    filterMode: 'remove'
  });
  if (direct) {
    const image = await loadImage(result.url);
    warmImageRaster(image, scale, Boolean(options?.background));
    return {
      rasterizeViewport: () => finishViewportCapture(drawViewportFromImage(image, pageWidth, pageHeight, scale))
    };
  }
  const page = await result.toCanvas();
  return {
    rasterizeViewport: () => finishViewportCapture(cropPageCanvas(page, pageWidth, pageHeight))
  };
}

function nextVideoFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const requestFrame = (video as { requestVideoFrameCallback?: (callback: () => void) => void }).requestVideoFrameCallback;
    if (requestFrame) requestFrame.call(video, () => resolve());
    else video.addEventListener('loadedmetadata', () => resolve(), { once: true });
  });
}

async function captureNativeViewport(): Promise<ViewportCapture> {
  const dpr = window.devicePixelRatio || 1;
  const options: DisplayCaptureOptions = {
    video: { width: window.innerWidth * dpr, height: window.innerHeight * dpr },
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
    surfaceSwitching: 'exclude',
    monitorTypeSurfaces: 'exclude'
  };
  const stream = await navigator.mediaDevices.getDisplayMedia(options);
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    await nextVideoFrame(video);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2d context unavailable');
    ctx.drawImage(video, 0, 0);
    video.srcObject = null;
    return { canvas, full: await canvasToBlob(canvas) };
  } finally {
    stopStream(stream);
  }
}

export async function captureViewport(request: CaptureRequest): Promise<ViewportCapture> {
  if (willUseNativeCapture(request.engine)) {
    return captureNativeViewport();
  }
  const snapshot = await capturePageSnapshot(request.excludeTag, request.maskSelector);
  return snapshot.rasterizeViewport();
}

export async function cropCanvas(source: HTMLCanvasElement, canvasRect: Rect): Promise<Blob> {
  return canvasToBlob(cropToCanvas(source, canvasRect));
}
