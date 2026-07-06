import { describe, expect, it } from 'vitest';
import {
  MAX_CAPTURE_AREA,
  MAX_DECODE_AREA,
  MAX_DECODE_SIDE,
  MIN_CAPTURE_SCALE,
  buildSnapFilter,
  clampSvgUrl,
  collectHiddenRoots,
  decodeClampFactor,
  effectiveScale,
  isNativeCaptureSupported,
  isWebKitOnly,
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

describe('isWebKitOnly', () => {
  const chrome =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  const safari =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
  const firefox = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:130.0) Gecko/20100101 Firefox/130.0';

  it('detects Safari but not Chromium or Firefox', () => {
    expect(isWebKitOnly(safari)).toBe(true);
    expect(isWebKitOnly(chrome)).toBe(false);
    expect(isWebKitOnly(firefox)).toBe(false);
  });
});

describe('decodeClampFactor', () => {
  it('keeps normal pages unclamped', () => {
    expect(decodeClampFactor(1440, 8000)).toBe(1);
  });

  it('clamps when a side exceeds the decode limit', () => {
    const factor = decodeClampFactor(1500, 116_375);
    expect(factor).toBeLessThan(1);
    expect(116_375 * factor).toBeLessThanOrEqual(MAX_DECODE_SIDE);
  });

  it('clamps when the area exceeds the decode limit', () => {
    const factor = decodeClampFactor(MAX_DECODE_SIDE, MAX_DECODE_SIDE);
    expect(factor).toBeLessThan(1);
    expect(MAX_DECODE_SIDE * factor * MAX_DECODE_SIDE * factor).toBeLessThanOrEqual(MAX_DECODE_AREA * 1.001);
  });

  it('returns 1 for degenerate sizes', () => {
    expect(decodeClampFactor(0, 0)).toBe(1);
  });
});

describe('clampSvgUrl', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="20000" viewBox="0 0 1500 20000"><rect/></svg>';
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  it('rewrites width and height by the clamp factor, preserving the viewBox', () => {
    const clamped = clampSvgUrl(url, 0.5);
    const decoded = decodeURIComponent(clamped.slice(clamped.indexOf(',') + 1));
    expect(decoded).toContain('width="750"');
    expect(decoded).toContain('height="10000"');
    expect(decoded).toContain('viewBox="0 0 1500 20000"');
  });

  it('returns the url untouched for factor 1 or unparsable input', () => {
    expect(clampSvgUrl(url, 1)).toBe(url);
    expect(clampSvgUrl('data:image/svg+xml,nope', 0.5)).toBe('data:image/svg+xml,nope');
  });
});
