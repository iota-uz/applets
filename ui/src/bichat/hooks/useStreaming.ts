/**
 * useStreaming hook
 * BiChat-specific streaming hook that composes on top of applet-core's useStreaming.
 * Adds content accumulation, error state, and chunk type dispatch.
 */

import { useState, useCallback, useRef } from 'react';
import { useStreaming as useCoreStreaming } from '../../applet-core/hooks/useStreaming';
import { StreamChunk } from '../types';

interface UseStreamingOptions {
  onChunk?: (content: string) => void
  onError?: (error: string) => void
  onDone?: () => void
}

export function useStreaming(options: UseStreamingOptions = {}) {
  const [content, setContent] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const core = useCoreStreaming();
  const coreRef = useRef(core);
  coreRef.current = core;

  const processStream = useCallback(
    async (stream: AsyncGenerator<StreamChunk>, signal?: AbortSignal) => {
      setError(null);
      setContent('');

      try {
        await coreRef.current.processStream<StreamChunk>(
          stream,
          (chunk) => {
            if ((chunk.type === 'chunk' || chunk.type === 'content') && chunk.content) {
              setContent((prev) => {
                const newContent = prev + chunk.content;
                optionsRef.current.onChunk?.(newContent);
                return newContent;
              });
            } else if (chunk.type === 'error') {
              const errorMsg = chunk.error || 'Stream error';
              const err = new Error(errorMsg);
              setError(err);
              optionsRef.current.onError?.(errorMsg);
            } else if (chunk.type === 'done') {
              optionsRef.current.onDone?.();
            }
          },
          signal
        );
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error('Unknown error');
        setError(errorObj);
        optionsRef.current.onError?.(errorObj.message);
      }
    },
    []
  );

  const cancel = useCallback(() => {
    coreRef.current.cancel();
  }, []);

  const reset = useCallback(() => {
    setContent('');
    setError(null);
    coreRef.current.reset();
  }, []);

  return {
    content,
    isStreaming: core.isStreaming,
    error,
    processStream,
    cancel,
    reset,
  };
}
