/**
 * Hand-mirrored copy of the backend's pkg/httpdto.StreamEventType
 * constant set. Used by subscribeRunEvents / subscribeActiveRuns /
 * openManagedEventSource to register addEventListener handlers that
 * match every `event:` label the server emits.
 *
 * Drift between this file and the Go definition is caught by
 * eventNames.test.ts — the test reads the sibling Go source at test
 * time and diffs the constant set. When the Go file is absent (CI
 * without the SDK sidecar checkout) the drift guard self-skips.
 */

export const STREAM_EVENT_TYPES = [
  'chunk',
  'content',
  'thinking',
  'tool_start',
  'tool_end',
  'text_block_end',
  'snapshot',
  'interrupt',
  'citation',
  'usage',
  'ping',
  'stream_started',
  'done',
  'cancelled',
  'error',
  'failed',
] as const;

export type StreamEventType = typeof STREAM_EVENT_TYPES[number];

/**
 * Subset of {@link STREAM_EVENT_TYPES} that terminates a run from the
 * client's perspective. Callers should close the EventSource and
 * settle their promise on any of these.
 */
export const TERMINAL_STREAM_EVENT_TYPES: readonly StreamEventType[] = [
  'done',
  'cancelled',
  'error',
  'failed',
];

/**
 * Narrow + type-guard helper. Returns true when `name` is one of the
 * terminal stream event types.
 */
export function isTerminalEvent(name: string): name is StreamEventType {
  return TERMINAL_STREAM_EVENT_TYPES.includes(name as StreamEventType);
}
