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
  timeout: number
  createHeaders: (additionalHeaders?: Record<string, string>) => Headers
  uploadFileFn: (file: File) => Promise<CoreUploadResponse>
  logAttachmentLifecycle: AttachmentLifecycleLogger
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
    const payload = {
      sessionId,
      content,
      debugMode: options?.debugMode ?? false,
      replaceFromMessageId: options?.replaceFromMessageID,
      attachments: streamAttachments,
    };

    const timeoutMs = deps.timeout ?? 0;
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
            ? `Stream request timed out after ${deps.timeout}ms`
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

export async function stopStream(
  deps: Pick<MessageTransportDeps, 'baseUrl' | 'streamEndpoint' | 'createHeaders'>,
  sessionId: string
): Promise<void> {
  const base = deps.baseUrl.replace(/\/+$/, '');
  const streamPath = deps.streamEndpoint.replace(/\/$/, '');
  const stopUrl = `${base}${streamPath}/stop`;
  const response = await fetch(stopUrl, {
    method: 'POST',
    headers: deps.createHeaders(),
    body: JSON.stringify({ sessionId }),
  });
  if (!response.ok) {
    // Non-fatal: local abort will still stop the stream
    console.warn('Stop stream request failed:', response.status);
  }
}

// ---------------------------------------------------------------------------
// Stream status and resume (refresh-safe)
// ---------------------------------------------------------------------------

type StreamStatusResumeDeps = Pick<
  MessageTransportDeps,
  'baseUrl' | 'streamEndpoint' | 'createHeaders'
>

export async function getStreamStatus(
  deps: StreamStatusResumeDeps,
  sessionId: string
): Promise<StreamStatus | null> {
  const base = deps.baseUrl.replace(/\/+$/, '');
  const streamPath = deps.streamEndpoint.replace(/\/$/, '');
  const url = `${base}${streamPath}/status?sessionId=${encodeURIComponent(sessionId)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: deps.createHeaders(),
  });
  if (!response.ok) {
    if (response.status === 404) {return null;}
    console.warn('Stream status request failed:', response.status);
    return null;
  }
  const data = (await response.json()) as StreamStatus;
  return data;
}

export async function resumeStream(
  deps: StreamStatusResumeDeps & { timeout?: number },
  sessionId: string,
  runId: string,
  onChunk: (chunk: StreamChunk) => void,
  signal?: AbortSignal
): Promise<void> {
  const base = deps.baseUrl.replace(/\/+$/, '');
  const streamPath = deps.streamEndpoint.replace(/\/$/, '');
  const url = `${base}${streamPath}/resume`;
  const response = await fetch(url, {
    method: 'POST',
    headers: deps.createHeaders(),
    body: JSON.stringify({ sessionId, runId }),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Resume stream failed: HTTP ${response.status}`);
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
}

// ---------------------------------------------------------------------------
// Question submission / rejection
// ---------------------------------------------------------------------------

export async function submitQuestionAnswers(
  callRPC: RPCCaller,
  sessionId: string,
  questionId: string,
  answers: QuestionAnswers
): Promise<Result<void>> {
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
    await callRPC('bichat.question.submit', {
      sessionId,
      checkpointId: questionId,
      answers: flatAnswers,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function rejectPendingQuestion(
  callRPC: RPCCaller,
  sessionId: string
): Promise<Result<void>> {
  try {
    await callRPC('bichat.question.reject', { sessionId });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
