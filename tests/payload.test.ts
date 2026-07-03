import { describe, expect, it } from 'vitest';
import { buildMeta, buildSubmitDetail } from '../src/core/payload.js';

const META_SOURCE = {
  location: { href: 'https://example.com/checkout' },
  navigator: { userAgent: 'TestAgent/1.0' },
  innerWidth: 1440,
  innerHeight: 900
};

describe('buildMeta', () => {
  it('collects page context', () => {
    const meta = buildMeta(META_SOURCE);
    expect(meta.url).toBe('https://example.com/checkout');
    expect(meta.userAgent).toBe('TestAgent/1.0');
    expect(meta.viewportWidth).toBe(1440);
    expect(meta.viewportHeight).toBe(900);
    expect(new Date(meta.timestamp).getTime()).not.toBeNaN();
  });
});

describe('buildSubmitDetail', () => {
  const meta = buildMeta(META_SOURCE);

  it('builds a full annotation payload', () => {
    const screenshot = new Blob(['s'], { type: 'image/png' });
    const annotatedImage = new Blob(['a'], { type: 'image/png' });
    const audio = new Blob(['m'], { type: 'audio/webm' });
    const region = { x: 1, y: 2, width: 30, height: 40, devicePixelRatio: 2 };
    const detail = buildSubmitDetail(
      'annotation',
      { screenshot, annotatedImage, audio, region, description: 'broken button' },
      meta
    );
    expect(detail).toEqual({
      type: 'annotation',
      meta,
      screenshot,
      annotatedImage,
      audio,
      region,
      description: 'broken button'
    });
  });

  it('builds a video payload', () => {
    const video = new Blob(['v'], { type: 'video/webm' });
    const detail = buildSubmitDetail('video', { video }, meta);
    expect(detail).toEqual({ type: 'video', meta, video });
  });

  it('omits absent optional fields entirely', () => {
    const detail = buildSubmitDetail('annotation', {}, meta);
    expect(Object.keys(detail).sort()).toEqual(['meta', 'type']);
  });

  it('omits empty descriptions', () => {
    const detail = buildSubmitDetail('video', { description: '' }, meta);
    expect('description' in detail).toBe(false);
  });
});
