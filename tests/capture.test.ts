import { describe, expect, it } from 'vitest';
import { FAST_STYLE_PROPERTIES, buildCaptureFilter } from '../src/core/capture.js';

function styleReader(displayByTag: Record<string, string>) {
  return {
    getComputedStyle: (el: Element) => ({
      display: displayByTag[el.tagName.toLowerCase()] ?? 'block'
    })
  };
}

describe('buildCaptureFilter', () => {
  const filter = buildCaptureFilter('feedback-widget', styleReader({ aside: 'none' }));

  it('keeps non-element nodes', () => {
    expect(filter(document.createTextNode('hello'))).toBe(true);
    expect(filter(document.createComment('x'))).toBe(true);
  });

  it('keeps visible elements', () => {
    expect(filter(document.createElement('div'))).toBe(true);
  });

  it('excludes the widget element', () => {
    expect(filter(document.createElement('feedback-widget'))).toBe(false);
  });

  it('excludes display:none subtree roots without reading their style twice', () => {
    expect(filter(document.createElement('aside'))).toBe(false);
  });

  it('uses the injected style reader', () => {
    const strict = buildCaptureFilter('feedback-widget', styleReader({ div: 'none' }));
    expect(strict(document.createElement('div'))).toBe(false);
    expect(strict(document.createElement('span'))).toBe(true);
  });
});

describe('FAST_STYLE_PROPERTIES', () => {
  it('contains only longhand-style unique names', () => {
    expect(new Set(FAST_STYLE_PROPERTIES).size).toBe(FAST_STYLE_PROPERTIES.length);
  });

  it('covers the properties modern-screenshot post-processing depends on', () => {
    for (const required of ['background-clip', 'transform', 'visibility', 'opacity', 'content']) {
      expect(FAST_STYLE_PROPERTIES).toContain(required);
    }
  });

  it('covers core layout, text, and svg fidelity groups', () => {
    for (const required of [
      'display',
      'grid-template-columns',
      'border-collapse',
      'font-family',
      'line-height',
      'background-image',
      'border-top-left-radius',
      'box-shadow',
      'fill',
      'stroke'
    ]) {
      expect(FAST_STYLE_PROPERTIES).toContain(required);
    }
  });
});
