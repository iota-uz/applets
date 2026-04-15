import { useMemo } from 'react';
import { createAppletRPCClient, type AppletRPCSchema } from '../../applet-host/rpc';
import { useAppletContext } from '../context/AppletContext';

export interface UseAppletRPCClientOptions {
  endpoint?: string
  timeoutMs?: number
  fetcher?: typeof fetch
}

export function useAppletRPCClient<
  TRouter extends AppletRPCSchema = AppletRPCSchema,
>(options: UseAppletRPCClientOptions = {}) {
  const { config, session } = useAppletContext();
  const endpoint = options.endpoint ?? config.rpcUIEndpoint ?? '/rpc';
  const baseFetcher = options.fetcher ?? fetch;
  const csrfToken = session.csrfToken;

  return useMemo(() => {
    const fetcher: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers ?? undefined);
      if (csrfToken !== '' && !headers.has('X-CSRF-Token')) {
        headers.set('X-CSRF-Token', csrfToken);
      }

      return baseFetcher(input, {
        ...init,
        headers,
      });
    };

    return createAppletRPCClient({
      endpoint,
      timeoutMs: options.timeoutMs,
      fetcher,
    }) as ReturnType<typeof createAppletRPCClient> & {
      callTyped<TMethod extends keyof TRouter & string>(
        method: TMethod,
        params: TRouter[TMethod]['params']
      ): Promise<TRouter[TMethod]['result']>
    };
  }, [baseFetcher, csrfToken, endpoint, options.timeoutMs]);
}
