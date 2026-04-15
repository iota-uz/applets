/**
 * Message sending, SSE streaming, and HITL question handling.
 *
 * @internal — Not part of the public API. Consumed by HttpDataSource.
 */

import type { BichatRPC } from './rpc.generated';
import type {
  Attachment,
  StreamChunk,
  StreamStatus,
  QuestionAnswers,
  SendMessageOptions,
  AsyncRunAccepted,
} from '../types';
import { parseBichatStream } from '../utils/sseParser';
import {
  ensureAttachmentUpload,
  assertUploadReferences,
  type CoreUploadResponse,
} from './AttachmentUploader';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Result<T> {
  success: boolean
  data?: T
  error?: string
}

type RPCCaller = <TMethod extends keyof BichatRPC & string>(
  method: TMethod,
  params: BichatRPC[TMethod]['params']
) => Promise<BichatRPC[TMethod]['result']>

type AttachmentLifecycleLogger = (
  event: 'stream_send_with_upload_ids',
  details: Record<string, unknown>
) => void

export interface MessageTransportDeps {
  callRPC: RPCCaller
  baseUrl: string
  streamEndpoint: string
  rpcTimeoutMs: number
  streamConnectTimeoutMs?: number
  createHeaders: (additionalHeaders?: Record<string, string>) => Headers
  uploadFileFn: (file: File) => Promise<CoreUploadResponse>
  logAttachmentLifecycle: AttachmentLifecycleLogger
}

// ---------------------------------------------------------------------------
// Request-id generation
// ---------------------------------------------------------------------------

/**
 * Generate a UUID-ish idempotency key for a single send. Prefers
 * crypto.randomUUID when available (every evergreen browser + Node
 * 16.7+); falls back to a Math.random-based v4 string so the feature
 * still works in constrained WebViews.
 *
 * The resulting id is returned inline in the POST /stream body as
 * `requestId` so the backend's SetNX dedupe can collapse duplicates.
 */
function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 fallback. Not cryptographically strong, but sufficient
  // for idempotency keys that live < 30 min.
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ---------------------------------------------------------------------------
// Stream sending
// ---------------------------------------------------------------------------

export async function* sendMessage(
  deps: MessageTransportDeps,
  sessionId: string,
  content: string,
  attachments: Attachment[] = [],
  signal?: AbortSignal,
  options?: SendMessageOptions
): AsyncGenerator<StreamChunk> {
  // Create new abort controller for this stream
  const abortController = new AbortController();

  // Link external signal if provided, with cleanup
  let onExternalAbort: (() => void) | undefined;
  if (signal) {
    onExternalAbort = () => { abortController.abort(); };
    signal.addEventListener('abort', onExternalAbort);
  }

  const url = `${deps.baseUrl}${deps.streamEndpoint}`;

  let connectionTimeoutID: ReturnType<typeof setTimeout> | undefined;
  let connectionTimedOut = false;
  try {
    const uploads = await Promise.all(
      attachments.map((attachment, attachmentIndex) =>
        ensureAttachmentUpload(
          attachment,
          { sessionId, attachmentIndex },
          deps.uploadFileFn,
        )
      )
    );
    const streamAttachments = assertUploadReferences(uploads);
    deps.logAttachmentLifecycle('stream_send_with_upload_ids', {
      sessionId,
      attachmentCount: streamAttachments.length,
    });
    // Idempotency: one request_id per send, client-generated unless
    // the caller provided a deterministic one (e.g. retry flow). The
    // backend dedupes duplicates within a ~30 min window so a double
    // click / tab-level retry converges on the same run. Falls back to
    // a stable pseudo-id on environments that lack crypto.randomUUID.
    const requestId = options?.requestId ?? generateRequestId();
    const payload: Record<string, unknown> = {
      sessionId,
      content,
      debugMode: options?.debugMode ?? false,
      replaceFromMessageId: options?.replaceFromMessageID,
      attachments: streamAttachments,
      requestId,
    };
    if (options?.reasoningEffort) {
      payload.reasoningEffort = options.reasoningEffort;
    }
    if (options?.model) {
      payload.model = options.model;
    }

    const timeoutMs = deps.streamConnectTimeoutMs ?? 0;
    if (timeoutMs > 0) {
      connectionTimeoutID = setTimeout(() => {
        connectionTimedOut = true;
        abortController.abort();
      }, timeoutMs);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: deps.createHeaders(),
      body: JSON.stringify(payload),
      signal: abortController.signal,
    });
    if (connectionTimeoutID !== undefined) {
      clearTimeout(connectionTimeoutID);
      connectionTimeoutID = undefined;
    }

    if (!response.ok) {
      throw new Error(`Stream request failed: HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();

    for await (const chunk of parseBichatStream(reader)) {
      yield chunk;

      if (chunk.type === 'done' || chunk.type === 'error') {
        return;
      }
    }
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        yield {
          type: 'error',
          error: connectionTimedOut
            ? `Stream request timed out after ${deps.streamConnectTimeoutMs}ms`
            : 'Stream cancelled',
        };
      } else {
        yield {
          type: 'error',
          error: err.message,
        };
      }
    } else {
      yield {
        type: 'error',
        error: 'Unknown error',
      };
    }
  } finally {
    if (connectionTimeoutID !== undefined) {
      clearTimeout(connectionTimeoutID);
    }
    if (signal && onExternalAbort) {
      signal.removeEventListener('abort', onExternalAbort);
    }
  }
}

// ---------------------------------------------------------------------------
// Stop stream (explicit stop — backend discards partial assistant message)
// ---------------------------------------------------------------------------

function buildStreamUrl(
  deps: Pick<MessageTransportDeps, 'baseUrl' | 'streamEndpoint'>,
  path: string
): string {
  const base = deps.baseUrl.replace(/\/+$/, '');
  const streamPath = deps.streamEndpoint.replace(/\/$/, '');
  return `${base}${streamPath}${path}`;
}

const DEFAULT_STOP_STREAM_TIMEOUT_MS = 5000;

export async function stopStream(
  deps: Pick<MessageTransportDeps, 'baseUrl' | 'streamEndpoint' | 'createHeaders'> & { timeoutMs?: number },
  sessionId: string
): Promise<void> {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_STOP_STREAM_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const stopUrl = buildStreamUrl(deps, '/stop');
    const response = await fetch(stopUrl, {
      method: 'POST',
      headers: deps.createHeaders(),
      body: JSON.stringify({ sessionId }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn('Stop stream request failed:', response.status);
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('Stop stream request timed out');
    } else {
      throw err;
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Stream status and resume (refresh-safe)
// ---------------------------------------------------------------------------

const DEFAULT_STREAM_STATUS_TIMEOUT_MS = 5000;

type StreamStatusResumeDeps = Pick<
  MessageTransportDeps,
  'baseUrl' | 'streamEndpoint' | 'createHeaders'
> & { timeoutMs?: number; connectTimeoutMs?: number }

export async function getStreamStatus(
  deps: StreamStatusResumeDeps,
  sessionId: string
): Promise<StreamStatus | null> {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_STREAM_STATUS_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = buildStreamUrl(deps, `/status?sessionId=${encodeURIComponent(sessionId)}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: deps.createHeaders(),
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.warn('Stream status request failed:', response.status);
      return null;
    }
    const data = (await response.json()) as StreamStatus;
    return data;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return null;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function resumeStream(
  deps: StreamStatusResumeDeps,
  sessionId: string,
  runId: string,
  onChunk: (chunk: StreamChunk) => void,
  signal?: AbortSignal
): Promise<void> {
  const url = buildStreamUrl(deps, '/resume');
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutMs = deps.connectTimeoutMs;
  if (timeoutMs != null && timeoutMs > 0) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }
  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: deps.createHeaders(),
      body: JSON.stringify({ sessionId, runId }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Resume stream failed: HTTP ${response.status}`);
    }
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    if (!response.body) {
      throw new Error('Resume response body is null');
    }
    const reader = response.body.getReader();
    for await (const chunk of parseBichatStream(reader)) {
      onChunk(chunk);
      if (chunk.type === 'done' || chunk.type === 'error') {
        return;
      }
    }
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

// ---------------------------------------------------------------------------
// Cursor-based event tail (Last-Event-ID reconnect)
// ---------------------------------------------------------------------------

type StreamEventsDeps = Pick<
  MessageTransportDeps,
  'baseUrl' | 'streamEndpoint'
>

export interface SubscribeRunEventsOptions {
  /** When set, start from the last seen event id instead of a full replay. */
  lastEventId?: string;
  /** Fires for every chunk (content / tool / snapshot / done / error / …). */
  onChunk: (chunk: StreamChunk) => void;
  /** Optional hook for raw SSE errors (connection blips, parse failures). */
  onError?: (event: Event) => void;
  /** AbortSignal closes the underlying EventSource. */
  signal?: AbortSignal;
}

/**
 * Open a native EventSource against GET /stream/events for a run. The
 * browser handles reconnect + Last-Event-ID automatically on transient
 * network drops; we forward each SSE event onto onChunk and resolve the
 * returned promise when a terminal event (done / error) arrives or the
 * caller aborts.
 *
 * Kept separate from sendMessage so the applet can connect to a run
 * that was started by another tab (shared request_id) or that the
 * current session already had in flight (tab reopen, device switch).
 */
export function subscribeRunEvents(
  deps: StreamEventsDeps,
  sessionId: string,
  runId: string,
  options: SubscribeRunEventsOptions
): Promise<void> {
  const base = buildStreamUrl(deps, '/events');
  const qs = new URLSearchParams({ sessionId, runId });
  const url = `${base}?${qs.toString()}`;

  // EventSource ignores custom headers in most browsers, so we leave
  // auth to the cookie that backs the session. Last-Event-ID is only
  // honoured by native reconnects — when the caller explicitly
  // supplies one (first connect after a known cursor) we append it as
  // a query parameter the server reads as a fallback. Native
  // reconnect adds the real `Last-Event-ID` header for subsequent
  // drops.
  const withCursor = options.lastEventId
    ? `${url}&${new URLSearchParams({ lastEventId: options.lastEventId }).toString()}`
    : url;

  return new Promise((resolve, reject) => {
    const es = new EventSource(withCursor, { withCredentials: true });
    let settled = false;

    const cleanup = () => {
      es.close();
    };
    const settle = (err?: Error) => {
      if (settled) {return;}
      settled = true;
      cleanup();
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    };

    if (options.signal) {
      if (options.signal.aborted) {
        settle();
        return;
      }
      options.signal.addEventListener('abort', () => settle(), { once: true });
    }

    // Listen on every event type we emit server-side. Unknown types
    // fall through to the default handler.
    const forward = (evt: MessageEvent) => {
      try {
        const parsed = JSON.parse(evt.data) as StreamChunk;
        options.onChunk(parsed);
        if (parsed.type === 'done' || parsed.type === 'error') {
          settle();
        }
      } catch (parseErr) {
        // Malformed payload — surface as an error chunk but don't
        // tear the stream down; native EventSource will reconnect.
        options.onChunk({
          type: 'error',
          error: `Failed to parse event: ${String(parseErr)}`,
        });
      }
    };

    const eventNames = [
      'content',
      'chunk',
      'thinking',
      'tool_start',
      'tool_end',
      'text_block_end',
      'snapshot',
      'interrupt',
      'usage',
      'done',
      'error',
      'stream_started',
    ];
    for (const name of eventNames) {
      es.addEventListener(name, forward as EventListener);
    }
    es.onmessage = forward;

    es.onerror = (evt) => {
      options.onError?.(evt);
      // Don't settle here — EventSource auto-reconnects on transient
      // errors. The server closes the connection with a terminal
      // `done` / `error` event when the run ends, at which point the
      // forward() path settles the promise.
    };
  });
}

// ---------------------------------------------------------------------------
// Active-run sidebar fan-out (per-tenant status SSE)
// ---------------------------------------------------------------------------

export type ActiveRunSidebarEventType = 'snapshot' | 'update';

export interface ActiveRunSidebarEvent {
  event: ActiveRunSidebarEventType;
  sessionId: string;
  runId: string;
  status: 'queued' | 'streaming' | 'completed' | 'cancelled' | 'failed';
  updatedAt: number;
}

export interface SubscribeActiveRunsOptions {
  onEvent: (event: ActiveRunSidebarEvent) => void;
  onError?: (event: Event) => void;
  signal?: AbortSignal;
}

/**
 * Open an EventSource to the per-tenant active-run feed. Emits one
 * "snapshot" row per currently-running session on connect then live
 * "update" deltas as runs transition. Used by the chat list to render
 * a status dot without polling each session.
 *
 * Never resolves on its own — the caller should abort via the signal
 * when the component unmounts; the returned promise only settles on
 * signal abort.
 */
export function subscribeActiveRuns(
  deps: StreamEventsDeps,
  options: SubscribeActiveRunsOptions
): Promise<void> {
  const url = buildStreamUrl(deps, '/active-runs');
  return new Promise((resolve) => {
    const es = new EventSource(url, { withCredentials: true });

    const close = () => {
      es.close();
      resolve();
    };

    if (options.signal) {
      if (options.signal.aborted) {
        close();
        return;
      }
      options.signal.addEventListener('abort', close, { once: true });
    }

    const forward = (event: ActiveRunSidebarEventType) =>
      (msg: MessageEvent) => {
        try {
          const body = JSON.parse(msg.data) as Omit<ActiveRunSidebarEvent, 'event'>;
          options.onEvent({ event, ...body });
        } catch {
          // ignore malformed payloads — server contract guarantees JSON
        }
      };

    es.addEventListener('snapshot', forward('snapshot') as EventListener);
    es.addEventListener('update', forward('update') as EventListener);
    es.onerror = (evt) => options.onError?.(evt);
  });
}

// ---------------------------------------------------------------------------
// Question submission / rejection
// ---------------------------------------------------------------------------

export async function submitQuestionAnswers(
  callRPC: RPCCaller,
  sessionId: string,
  questionId: string,
  answers: QuestionAnswers
): Promise<Result<AsyncRunAccepted>> {
  try {
    // Convert QuestionAnswers to flat map[string]string for RPC
    const flatAnswers: Record<string, string> = {};
    for (const [qId, answerData] of Object.entries(answers)) {
      if (answerData.customText) {
        flatAnswers[qId] = answerData.customText;
      } else if (answerData.options.length > 0) {
        flatAnswers[qId] = answerData.options.join(', ');
      }
    }
    const result = await callRPC('bichat.question.submit', {
      sessionId,
      checkpointId: questionId,
      answers: flatAnswers,
    });
    return {
      success: true,
      data: normalizeAsyncRunAccepted(result),
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function rejectPendingQuestion(
  callRPC: RPCCaller,
  sessionId: string
): Promise<Result<AsyncRunAccepted>> {
  try {
    const result = await callRPC('bichat.question.reject', { sessionId });
    return { success: true, data: normalizeAsyncRunAccepted(result) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

function isAsyncRunOperation(value: string): value is AsyncRunAccepted['operation'] {
  return value === 'question_submit' || value === 'question_reject' || value === 'session_compact';
}

function normalizeAsyncRunAccepted(input: {
  accepted: boolean
  operation: string
  sessionId: string
  runId: string
  startedAt: number
}): AsyncRunAccepted {
  if (!input.accepted) {
    throw new Error('Async run request was not accepted');
  }
  if (!isAsyncRunOperation(input.operation)) {
    throw new Error(`Unexpected async operation: ${input.operation}`);
  }
  if (!input.sessionId || !input.runId) {
    throw new Error('Missing async run metadata');
  }
  return {
    accepted: true,
    operation: input.operation,
    sessionId: input.sessionId,
    runId: input.runId,
    startedAt: input.startedAt,
  };
}
