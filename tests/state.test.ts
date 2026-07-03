import { describe, expect, it } from 'vitest';
import { TRANSITIONS, canTransition } from '../src/core/state.js';
import type { WidgetState } from '../src/core/state.js';

const ALL_STATES = Object.keys(TRANSITIONS) as WidgetState[];

describe('state machine', () => {
  it('allows every declared transition', () => {
    for (const from of ALL_STATES) {
      for (const to of TRANSITIONS[from]) {
        expect(canTransition(from, to)).toBe(true);
      }
    }
  });

  it('rejects undeclared transitions', () => {
    for (const from of ALL_STATES) {
      for (const to of ALL_STATES) {
        if (TRANSITIONS[from].includes(to)) continue;
        expect(canTransition(from, to)).toBe(false);
      }
    }
  });

  it('routes both flows through menu', () => {
    expect(canTransition('idle', 'menu')).toBe(true);
    expect(canTransition('idle', 'selecting')).toBe(false);
    expect(canTransition('idle', 'recording')).toBe(false);
    expect(canTransition('menu', 'selecting')).toBe(true);
    expect(canTransition('menu', 'recording')).toBe(true);
  });

  it('always allows returning to idle from interactive states', () => {
    for (const from of ALL_STATES) {
      if (from === 'idle') continue;
      expect(canTransition(from, 'idle')).toBe(true);
    }
  });
});
