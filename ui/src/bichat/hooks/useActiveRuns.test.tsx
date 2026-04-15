// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useActiveRuns } from './useActiveRuns';
import type { ActiveRunDelivery, ChatDataSource } from '../types';

type Subscribe = NonNullable<ChatDataSource['subscribeActiveRuns']>;
type SubscribeOptions = Parameters<Subscribe>[0];

interface FakeDataSource {
  subscribeActiveRuns?: Subscribe;
  aborted: boolean;
  emit(evt: ActiveRunDelivery): void;
}

function createDataSource(): FakeDataSource {
  let capturedOnEvent: SubscribeOptions['onEvent'] | null = null;
  const ds: FakeDataSource = {
    aborted: false,
    emit(evt) {
      capturedOnEvent?.(evt);
    },
    subscribeActiveRuns: (options: SubscribeOptions) => {
      capturedOnEvent = options.onEvent;
      options.signal?.addEventListener('abort', () => {
        ds.aborted = true;
      });
      return new Promise<void>(() => { /* never resolves — caller aborts */ });
    },
  };
  return ds;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useActiveRuns', () => {
  it('coalesces snapshot rows into a single ready flip', () => {
    const ds = createDataSource();
    const { result } = renderHook(() => useActiveRuns(ds));

    expect(result.current.ready).toBe(false);

    act(() => {
      ds.emit({ event: 'snapshot', sessionId: 's1', runId: 'r1', status: 'streaming', updatedAt: 1 });
      ds.emit({ event: 'snapshot', sessionId: 's2', runId: 'r2', status: 'queued', updatedAt: 2 });
    });

    // Ready not flipped until the 16ms flush tick fires.
    expect(result.current.ready).toBe(false);

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(result.current.ready).toBe(true);
    expect(Object.keys(result.current.runs)).toEqual(['s1', 's2']);
    expect(result.current.status('s1')).toBe('streaming');
    expect(result.current.status('s2')).toBe('queued');
  });

  it('removes terminal-status entries immediately when retainTerminalMs is 0', () => {
    const ds = createDataSource();
    const { result } = renderHook(() => useActiveRuns(ds));

    act(() => {
      ds.emit({ event: 'update', sessionId: 's1', runId: 'r1', status: 'streaming', updatedAt: 1 });
    });
    expect(result.current.runs.s1?.status).toBe('streaming');

    act(() => {
      ds.emit({ event: 'update', sessionId: 's1', runId: 'r1', status: 'completed', updatedAt: 2 });
    });
    expect(result.current.runs.s1).toBeUndefined();
  });

  it('retains terminal entries for retainTerminalMs then prunes', () => {
    const ds = createDataSource();
    const { result } = renderHook(() =>
      useActiveRuns(ds, { retainTerminalMs: 1000 })
    );

    act(() => {
      ds.emit({ event: 'update', sessionId: 's1', runId: 'r1', status: 'completed', updatedAt: 10 });
    });
    // Entry still visible with terminal status.
    expect(result.current.runs.s1?.status).toBe('completed');

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.runs.s1?.status).toBe('completed');

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.runs.s1).toBeUndefined();
  });

  it('is a no-op when enabled is false', () => {
    const ds = createDataSource();
    const subscribeSpy = vi.spyOn(ds, 'subscribeActiveRuns' as const);
    const { result } = renderHook(() => useActiveRuns(ds, { enabled: false }));
    expect(subscribeSpy).not.toHaveBeenCalled();
    expect(result.current.ready).toBe(false);
    expect(result.current.runs).toEqual({});
  });

  it('aborts the previous subscription when the dataSource reference swaps', () => {
    const dsA = createDataSource();
    const dsB = createDataSource();
    const { rerender } = renderHook(
      ({ ds }: { ds: FakeDataSource }) => useActiveRuns(ds),
      { initialProps: { ds: dsA } },
    );
    expect(dsA.aborted).toBe(false);
    rerender({ ds: dsB });
    expect(dsA.aborted).toBe(true);
    expect(dsB.aborted).toBe(false);
  });

  it('flips ready after emptyStateTimeoutMs with no snapshot rows', () => {
    const ds = createDataSource();
    const { result } = renderHook(() =>
      useActiveRuns(ds, { emptyStateTimeoutMs: 100 })
    );
    expect(result.current.ready).toBe(false);
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.ready).toBe(true);
  });

  // APL-1 regression: a stale terminal-removal timer must not wipe a
  // newly arrived streaming snapshot for the same sessionId (the
  // native EventSource auto-reconnect path redelivers snapshot rows).
  it('cancels pending terminal prune when a new snapshot arrives for the same session', () => {
    const ds = createDataSource();
    const { result } = renderHook(() =>
      useActiveRuns(ds, { retainTerminalMs: 1000 })
    );

    // Arm a terminal prune for s1.
    act(() => {
      ds.emit({ event: 'update', sessionId: 's1', runId: 'r1', status: 'cancelled', updatedAt: 1 });
    });
    expect(result.current.runs.s1?.status).toBe('cancelled');

    // Before the 1000ms retention window elapses, a fresh snapshot
    // arrives (reconnect or a new run starting on the same session).
    act(() => {
      vi.advanceTimersByTime(200);
      ds.emit({ event: 'snapshot', sessionId: 's1', runId: 'r2', status: 'streaming', updatedAt: 2 });
    });

    // Flush the 16ms snapshot coalescer.
    act(() => { vi.advanceTimersByTime(16); });
    expect(result.current.runs.s1?.status).toBe('streaming');
    expect(result.current.runs.s1?.runId).toBe('r2');

    // Advance well past the original retention window. The stale
    // prune must have been cancelled — s1 should still be present.
    act(() => { vi.advanceTimersByTime(1500); });
    expect(result.current.runs.s1?.status).toBe('streaming');
    expect(result.current.runs.s1?.runId).toBe('r2');
  });

  // APL-2 regression: a rejection from subscribeActiveRuns (initial
  // connect failure, 401/503) must surface via onError rather than
  // leaking as an unhandled promise rejection.
  it('routes subscribeActiveRuns rejections through onError', async () => {
    const onError = vi.fn();
    const subscribeActiveRuns: Subscribe = () =>
      Promise.reject(new Error('mock connect failure'));
    const ds = { subscribeActiveRuns } as unknown as FakeDataSource;

    // Capture unhandled rejections so the test fails if we leak.
    const unhandled: unknown[] = [];
    const onUnhandled = (err: unknown) => unhandled.push(err);
    process.on('unhandledRejection', onUnhandled);

    try {
      renderHook(() => useActiveRuns(ds, { onError }));

      // Flush the rejected microtask queue.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Event);
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
