import { createContext, useContext, ReactNode } from 'react'
import type { InitialContext } from '../types'

/**
 * AppletContext provides access to the global context injected by the backend.
 * The context is read from window.__*_CONTEXT__ (configured via windowKey).
 */
const AppletContext = createContext<InitialContext | null>(null)

const REQUIRED_KEYS: Array<keyof InitialContext> = ['user', 'tenant', 'locale', 'config', 'route', 'session']

function validateInitialContext(value: unknown, windowKey: string): InitialContext {
  if (!value || typeof value !== 'object') {
    throw new Error(`${windowKey}: expected an object, got ${typeof value}`)
  }
  const obj = value as Record<string, unknown>
  const missing = REQUIRED_KEYS.filter((k) => !(k in obj))
  if (missing.length > 0) {
    throw new Error(`${windowKey}: missing required keys: ${missing.join(', ')}`)
  }

  // Deep validation for nested required fields
  const user = obj.user as Record<string, unknown> | undefined
  if (!user || typeof user !== 'object') {
    throw new Error(`${windowKey}.user: expected an object, got ${typeof user}`)
  }
  if (typeof user.id !== 'number') {
    throw new Error(`${windowKey}.user.id: expected number, got ${typeof user.id}`)
  }
  if (!Array.isArray(user.permissions)) {
    throw new Error(`${windowKey}.user.permissions: expected array, got ${typeof user.permissions}`)
  }

  const tenant = obj.tenant as Record<string, unknown> | undefined
  if (!tenant || typeof tenant !== 'object') {
    throw new Error(`${windowKey}.tenant: expected an object, got ${typeof tenant}`)
  }
  if (typeof tenant.id !== 'string') {
    throw new Error(`${windowKey}.tenant.id: expected string, got ${typeof tenant.id}`)
  }

  const session = obj.session as Record<string, unknown> | undefined
  if (!session || typeof session !== 'object') {
    throw new Error(`${windowKey}.session: expected an object, got ${typeof session}`)
  }
  if (typeof session.csrfToken !== 'string') {
    throw new Error(`${windowKey}.session.csrfToken: expected string, got ${typeof session.csrfToken}`)
  }
  if (typeof session.expiresAt !== 'number') {
    throw new Error(`${windowKey}.session.expiresAt: expected number, got ${typeof session.expiresAt}`)
  }
  if (typeof session.refreshURL !== 'string') {
    throw new Error(`${windowKey}.session.refreshURL: expected string, got ${typeof session.refreshURL}`)
  }

  const config = obj.config
  if (!config || typeof config !== 'object') {
    throw new Error(`${windowKey}.config: expected object, got ${typeof config}`)
  }

  return value as InitialContext
}

export interface AppletProviderProps {
  children: ReactNode
  windowKey: string
  context?: InitialContext
}

/**
 * AppletProvider reads context from window global and provides it to hooks.
 *
 * Usage:
 * <AppletProvider windowKey="__BICHAT_CONTEXT__">
 *   <App />
 * </AppletProvider>
 */
export function AppletProvider({ children, windowKey, context }: AppletProviderProps) {
  // Use provided context or read from window global
  const raw = context ?? (window as any)[windowKey]

  if (!raw) {
    throw new Error(`${windowKey} not found on window. Ensure backend context injection is working.`)
  }

  const initialContext = validateInitialContext(raw, windowKey)

  return (
    <AppletContext.Provider value={initialContext}>
      {children}
    </AppletContext.Provider>
  )
}

/**
 * useAppletContext provides access to the full applet context.
 * Use specialized hooks (useUser, useConfig, etc.) for specific context parts.
 */
export function useAppletContext<T = InitialContext>(): T {
  const context = useContext(AppletContext)
  if (!context) {
    throw new Error('useAppletContext must be used within AppletProvider')
  }
  return context as T
}
