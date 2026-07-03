import { describe, expect, it } from 'vitest';
import {
  MAX_CAPTURE_AREA,
  MIN_CAPTURE_SCALE,
  buildSnapFilter,
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

describe('buildSnapFilter', () => {
  const reader = {
    getComputedStyle: (el: Element) => ({ display: el.tagName.toLowerCase() === 'aside' ? 'none' : 'block' })
  };

  it('keeps visible elements and drops display:none subtree roots', () => {
    const filter = buildSnapFilter(reader);
    expect(filter(document.createElement('div'))).toBe(true);
    expect(filter(document.createElement('aside'))).toBe(false);
  });
});
