import { describe, expect, it } from 'vitest';
import {
  MAX_CAPTURE_AREA,
  MAX_DECODE_SIDE,
  MIN_CAPTURE_SCALE,
  buildSnapFilter,
  canRasterizeViewportDirect,
  collectHiddenRoots,
  effectiveScale,
  isNativeCaptureSupported,
  parseMaskSelector
} from '../src/core/capture.js';

describe('effectiveScale', () => {
  it('keeps full device pixel ratio for small pages', () => {
    expect(effectiveScale(1440, 900, 2)).toBe(2);
  });

  it('lowers the scale so huge pages stay under the area budget', () => {
    const scale = effectiveScale(1440, 40000, 2);
    expect(scale).toBeLessThan(2);
    expect(1440 * 40000 * scale * scale).toBeLessThanOrEqual(MAX_CAPTURE_AREA * 1.001);
  });

  it('never drops below the minimum scale', () => {
    expect(effectiveScale(10000, 1000000, 3)).toBe(MIN_CAPTURE_SCALE);
  });

  it('falls back to dpr for degenerate page sizes', () => {
    expect(effectiveScale(0, 0, 2)).toBe(2);
  });
});

describe('parseMaskSelector', () => {
  it('splits and trims comma-separated selectors', () => {
    expect(parseMaskSelector(' .secret , [data-private] ')).toEqual(['.secret', '[data-private]']);
  });

  it('returns empty list for undefined or blank input', () => {
    expect(parseMaskSelector(undefined)).toEqual([]);
    expect(parseMaskSelector('  ')).toEqual([]);
    expect(parseMaskSelector(',,')).toEqual([]);
  });
});

describe('isNativeCaptureSupported', () => {
  const desktop = { secureContext: true, userAgent: 'Mozilla/5.0 (Macintosh) Chrome/130', hasGetDisplayMedia: true };

  it('accepts secure desktop browsers with getDisplayMedia', () => {
    expect(isNativeCaptureSupported(desktop)).toBe(true);
  });

  it('rejects insecure contexts', () => {
    expect(isNativeCaptureSupported({ ...desktop, secureContext: false })).toBe(false);
  });

  it('rejects browsers without getDisplayMedia', () => {
    expect(isNativeCaptureSupported({ ...desktop, hasGetDisplayMedia: false })).toBe(false);
  });

  it('rejects mobile user agents that lie about support', () => {
    expect(
      isNativeCaptureSupported({ ...desktop, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148' })
    ).toBe(false);
    expect(isNativeCaptureSupported({ ...desktop, userAgent: 'Mozilla/5.0 (Linux; Android 14) Mobile' })).toBe(false);
  });
});

describe('collectHiddenRoots', () => {
  const reader = {
    getComputedStyle: (el: Element) => ({ display: el.tagName.toLowerCase() === 'aside' ? 'none' : 'block' })
  };

  function buildTree() {
    const root = document.createElement('main');
    const visible = document.createElement('div');
    const hiddenRoot = document.createElement('aside');
    const hiddenChild = document.createElement('div');
    hiddenRoot.appendChild(hiddenChild);
    root.append(visible, hiddenRoot);
    return { root, visible, hiddenRoot, hiddenChild };
  }

  it('marks display:none subtree roots without visiting their children', () => {
    const { root, visible, hiddenRoot, hiddenChild } = buildTree();
    const calls: Element[] = [];
    const spyReader = {
      getComputedStyle: (el: Element) => {
        calls.push(el);
        return reader.getComputedStyle(el);
      }
    };
    const hidden = collectHiddenRoots(root, spyReader);
    expect(hidden.has(hiddenRoot)).toBe(true);
    expect(hidden.has(visible)).toBe(false);
    expect(hidden.has(root)).toBe(false);
    expect(calls).not.toContain(hiddenChild);
  });

  it('feeds buildSnapFilter so lookups need no style reads', () => {
    const { root, visible, hiddenRoot } = buildTree();
    const filter = buildSnapFilter(collectHiddenRoots(root, reader));
    expect(filter(visible)).toBe(true);
    expect(filter(hiddenRoot)).toBe(false);
    expect(filter(document.createElement('span'))).toBe(true);
  });
});

describe('canRasterizeViewportDirect', () => {
  const chrome =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  const safari =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

  it('allows direct viewport rasterization on Chromium for normal pages', () => {
    expect(canRasterizeViewportDirect(1440, 8000, chrome)).toBe(true);
  });

  it('falls back on Safari', () => {
    expect(canRasterizeViewportDirect(1440, 8000, safari)).toBe(false);
  });

  it('falls back when a page side exceeds the decode limit', () => {
    expect(canRasterizeViewportDirect(1440, MAX_DECODE_SIDE + 1, chrome)).toBe(false);
  });

  it('falls back when the page area exceeds the decode limit', () => {
    expect(canRasterizeViewportDirect(MAX_DECODE_SIDE, MAX_DECODE_SIDE, chrome)).toBe(false);
  });
});
