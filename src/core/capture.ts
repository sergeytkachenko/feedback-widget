import { preCache, snapdom } from '@zumer/snapdom';
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

export const MAX_CAPTURE_AREA = 32_000_000;

export const MIN_CAPTURE_SCALE = 0.25;

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

export interface StyleReader {
  getComputedStyle(el: Element): { display: string };
}

export function buildSnapFilter(win: StyleReader): (el: Element) => boolean {
  return (el) => win.getComputedStyle(el).display !== 'none';
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

export function warmCaptureCache(): void {
  void preCache(document).catch(() => undefined);
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

async function captureDomViewport(excludeTag: string, maskSelector?: string): Promise<ViewportCapture> {
  const root = document.documentElement;
  const pageWidth = Math.max(root.scrollWidth, window.innerWidth);
  const pageHeight = Math.max(root.scrollHeight, window.innerHeight);
  const scale = effectiveScale(pageWidth, pageHeight, window.devicePixelRatio || 1);
  const result = await snapdom(root, {
    scale,
    dpr: 1,
    fast: true,
    exclude: [excludeTag, ...parseMaskSelector(maskSelector)],
    excludeMode: 'hide',
    filter: buildSnapFilter(window),
    filterMode: 'remove'
  });
  const page = await result.toCanvas();
  const scaleX = page.width / pageWidth;
  const scaleY = page.height / pageHeight;
  const canvas = cropToCanvas(page, {
    x: Math.round(window.scrollX * scaleX),
    y: Math.round(window.scrollY * scaleY),
    width: Math.round(window.innerWidth * scaleX),
    height: Math.round(window.innerHeight * scaleY)
  });
  return { canvas, full: await canvasToBlob(canvas) };
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

export function captureViewport(request: CaptureRequest): Promise<ViewportCapture> {
  if (request.engine === 'native' && isNativeCaptureSupported(currentNativeEnv())) {
    return captureNativeViewport();
  }
  return captureDomViewport(request.excludeTag, request.maskSelector);
}

export async function cropCanvas(source: HTMLCanvasElement, canvasRect: Rect): Promise<Blob> {
  return canvasToBlob(cropToCanvas(source, canvasRect));
}
