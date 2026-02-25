/**
 * Builds HttpDataSourceConfig from window.__APPLET_CONTEXT__.
 * For use with createHttpDataSource when the app is embedded via the applet framework.
 *
 * Expects the host to inject context with:
 * - config.rpcUIEndpoint, config.streamEndpoint
 * - session.csrfToken (or window.__CSRF_TOKEN__)
 */

import { useMemo } from 'react';
import type { HttpDataSourceConfig } from '../data/HttpDataSource';
import type { IotaContext } from '../types/iota';

/**
 * Returns HttpDataSourceConfig derived from window.__APPLET_CONTEXT__.
 * Use with createHttpDataSource() for RPC and SSE endpoints.
 *
 * @throws Error if window.__APPLET_CONTEXT__ is not available
 */
export function useHttpDataSourceConfigFromApplet(
  options?: { timeout?: number; rpcTimeoutMs?: number; streamConnectTimeoutMs?: number }
): HttpDataSourceConfig {
  return useMemo(() => {
    const ctx = typeof window !== 'undefined' ? (window as Window & { __APPLET_CONTEXT__?: IotaContext }).__APPLET_CONTEXT__ : undefined;
    if (!ctx) {
      throw new Error(
        'Applet context not found. Ensure window.__APPLET_CONTEXT__ is injected by the backend.'
      );
    }

    const rpcEndpoint = ctx.config?.rpcUIEndpoint ?? '/rpc';
    const streamEndpoint = ctx.config?.streamEndpoint ?? '/stream';
    const csrfToken =
      ctx.session?.csrfToken ??
      (typeof window !== 'undefined' ? (window as Window & { __CSRF_TOKEN__?: string }).__CSRF_TOKEN__ : undefined) ??
      '';

    const isDev = typeof (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === 'boolean'
      && (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;
    if (!csrfToken && isDev) {
      console.warn(
        '[useHttpDataSourceConfigFromApplet] CSRF token is empty — requests may be rejected by the server.'
      );
    }

    return {
      baseUrl: '',
      rpcEndpoint,
      streamEndpoint,
      csrfToken,
      timeout: options?.timeout,
      rpcTimeoutMs: options?.rpcTimeoutMs ?? options?.timeout ?? 120_000,
      streamConnectTimeoutMs: options?.streamConnectTimeoutMs ?? options?.timeout ?? 30_000,
    };
  }, [options?.rpcTimeoutMs, options?.streamConnectTimeoutMs, options?.timeout]);
}
