import { describe, expect, it } from 'vitest';
import { FeedbackEvents, emitInternal, emitPublic } from '../src/core/events.js';

describe('emitPublic', () => {
  it('dispatches a bubbling composed event with the detail intact', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    let received: CustomEvent | undefined;
    document.body.addEventListener(FeedbackEvents.submit, (event) => {
      received = event as CustomEvent;
    });
    emitPublic(el, FeedbackEvents.submit, { type: 'video' });
    expect(received).toBeDefined();
    expect(received?.bubbles).toBe(true);
    expect(received?.composed).toBe(true);
    expect(received?.detail).toEqual({ type: 'video' });
    el.remove();
  });
});

describe('emitInternal', () => {
  it('dispatches a bubbling non-composed event', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    let received: CustomEvent | undefined;
    document.body.addEventListener('fw-mode', (event) => {
      received = event as CustomEvent;
    });
    emitInternal(el, 'fw-mode', { mode: 'annotate', mic: false });
    expect(received).toBeDefined();
    expect(received?.bubbles).toBe(true);
    expect(received?.composed).toBe(false);
    expect(received?.detail).toEqual({ mode: 'annotate', mic: false });
    el.remove();
  });
});
