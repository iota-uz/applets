import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STREAM_EVENT_TYPES, TERMINAL_STREAM_EVENT_TYPES, isTerminalEvent } from './eventNames';

const SDK_EVENTS_FILE = '/Users/diyorkhaydarov/Projects/sdk/iota-sdk/pkg/httpdto/stream_events.go';

describe('STREAM_EVENT_TYPES', () => {
  it('contains a unique, non-empty set of lowercase tokens', () => {
    expect(STREAM_EVENT_TYPES.length).toBeGreaterThan(0);
    const set = new Set(STREAM_EVENT_TYPES);
    expect(set.size).toBe(STREAM_EVENT_TYPES.length);
    for (const name of STREAM_EVENT_TYPES) {
      expect(name).toMatch(/^[a-z_]+$/);
    }
  });

  it('exposes TERMINAL_STREAM_EVENT_TYPES as a strict subset', () => {
    const all = new Set<string>(STREAM_EVENT_TYPES);
    for (const t of TERMINAL_STREAM_EVENT_TYPES) {
      expect(all.has(t)).toBe(true);
    }
  });

  it('isTerminalEvent narrows only the terminal set', () => {
    for (const t of TERMINAL_STREAM_EVENT_TYPES) {
      expect(isTerminalEvent(t)).toBe(true);
    }
    expect(isTerminalEvent('chunk')).toBe(false);
    expect(isTerminalEvent('content')).toBe(false);
    expect(isTerminalEvent('nope')).toBe(false);
  });
});

// Drift guard. Reads the Go source of truth at test time and diffs
// the constant set against STREAM_EVENT_TYPES. Silently skipped when
// the SDK sibling tree is not checked out next to this repo.
describe.skipIf(!existsSync(SDK_EVENTS_FILE))('STREAM_EVENT_TYPES drift guard', () => {
  it('matches the Go StreamEventType constant set', () => {
    const src = readFileSync(SDK_EVENTS_FILE, 'utf8');
    const re = /StreamEvent[A-Za-z0-9_]+\s+StreamEventType\s*=\s*"([^"]+)"/g;
    const goValues = new Set<string>();
    for (const m of src.matchAll(re)) {
      goValues.add(m[1]);
    }
    const tsValues = new Set<string>(STREAM_EVENT_TYPES);
    expect(goValues.size).toBeGreaterThan(0);
    expect(Array.from(tsValues).sort()).toEqual(Array.from(goValues).sort());
  });
});
