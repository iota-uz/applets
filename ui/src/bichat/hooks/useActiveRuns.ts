/**
 * useActiveRuns — live map of per-session generation status.
 *
 * Subscribes to the data source's `subscribeActiveRuns` channel
 * (`GET /bi-chat/stream/active-runs`) and maintains a
 * sessionId → status dictionary so the sidebar can render a status
 * dot next to each session card without polling /stream/status per
 * session.
 *
 * The hook is a no-op when:
 * - the data source does not implement subscribeActiveRuns (older
 *   backends without the active-run index);
 * - `enabled` is false (e.g. the user is offline).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { ActiveRunDelivery, ChatDataSource } from '../types';

export interface ActiveRunSnapshot {
  runId: string;
  status: ActiveRunDelivery['status'];
  updatedAt: number;
}

export interface UseActiveRunsOptions {
  enabled?: boolean;
  /** Optional hook for raw SSE errors. */
  onError?: (event: Event) => void;
}

export interface UseActiveRunsResult {
  /** sessionId → current live status. Terminal statuses are emitted then the entry is removed. */
  runs: Record<string, ActiveRunSnapshot>;
  /** True once the initial HGETALL snapshot is delivered. */
  ready: boolean;
  /** Convenience: undefined when not active. */
  status: (sessionId: string) => ActiveRunDelivery['status'] | undefined;
}

const TERMINAL = new Set<ActiveRunDelivery['status']>([
  'completed',
  'cancelled',
  'failed',
]);

export function useActiveRuns(
  dataSource: Pick<ChatDataSource, 'subscribeActiveRuns'>,
  options: UseActiveRunsOptions = {}
): UseActiveRunsResult {
  const [runs, setRuns] = useState<Record<string, ActiveRunSnapshot>>({});
  const [ready, setReady] = useState(false);
  const onErrorRef = useRef(options.onError);
  onErrorRef.current = options.onError;

  const enabled = options.enabled ?? true;

  useEffect(() => {
    if (!enabled) {return;}
    if (!dataSource.subscribeActiveRuns) {return;}

    const controller = new AbortController();
    // Collect snapshot rows into a staging object so we only flip
    // `ready` once at the end of the initial batch. Each SSE
    // "snapshot" event is a single row; the server never emits a
    // delimiter, so we use a microtask coalescer instead.
    let stagingTimer: ReturnType<typeof setTimeout> | undefined;
    const staging: Record<string, ActiveRunSnapshot> = {};
    let sawSnapshotRow = false;

    const flushSnapshot = () => {
      setRuns((prev) => ({ ...prev, ...staging }));
      setReady(true);
      stagingTimer = undefined;
    };

    dataSource.subscribeActiveRuns({
      signal: controller.signal,
      onError: (evt) => onErrorRef.current?.(evt),
      onEvent: (evt) => {
        if (evt.event === 'snapshot') {
          sawSnapshotRow = true;
          staging[evt.sessionId] = {
            runId: evt.runId,
            status: evt.status,
            updatedAt: evt.updatedAt,
          };
          if (stagingTimer === undefined) {
            stagingTimer = setTimeout(flushSnapshot, 16);
          }
          return;
        }
        // update: apply immediately, prune on terminal status.
        setRuns((prev) => {
          const next = { ...prev };
          if (TERMINAL.has(evt.status)) {
            delete next[evt.sessionId];
          } else {
            next[evt.sessionId] = {
              runId: evt.runId,
              status: evt.status,
              updatedAt: evt.updatedAt,
            };
          }
          return next;
        });
      },
    });

    // If the server has zero active runs on connect it never emits a
    // snapshot row; mark ready after a brief idle so consumers don't
    // spin forever.
    const readyTimeout = setTimeout(() => {
      if (!sawSnapshotRow) {setReady(true);}
    }, 250);

    return () => {
      controller.abort();
      if (stagingTimer !== undefined) {clearTimeout(stagingTimer);}
      clearTimeout(readyTimeout);
    };
  }, [dataSource, enabled]);

  const status = useCallback(
    (sessionId: string) => runs[sessionId]?.status,
    [runs]
  );

  return { runs, ready, status };
}
