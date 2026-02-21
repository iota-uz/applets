/**
 * Tool label resolution for the Activity Trace.
 *
 * Convention: `BiChat.Tools.{toolName}` for SDK-provided tools.
 * Upstream consumers can extend with their own prefix (e.g., `Ali.Tools.{customTool}`).
 */

type TranslateFn = (key: string, params?: Record<string, string | number | boolean>) => string

/**
 * Resolve a human-readable label for a tool invocation.
 *
 * Lookup order:
 * 1. Consumer prefix (if provided), e.g. `Ali.Tools.custom_tool`
 * 2. SDK default prefix `BiChat.Tools.{name}`
 * 3. Fallback: humanise the raw tool name
 */
export function getToolLabel(
  t: TranslateFn,
  name: string,
  args?: string,
  prefix?: string
): string {
  // 1. Consumer prefix
  if (prefix) {
    const key = `${prefix}.${name}`
    const label = t(key, parseToolParams(name, args))
    if (label !== key) return label
  }

  // 2. SDK default
  const sdkKey = `BiChat.Tools.${name}`
  const sdkLabel = t(sdkKey, parseToolParams(name, args))
  if (sdkLabel !== sdkKey) return sdkLabel

  // 3. Humanise fallback
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Extract interpolation params from tool arguments for specific tools.
 */
function parseToolParams(
  name: string,
  args?: string
): Record<string, string> | undefined {
  if (name === 'task' && args) {
    try {
      const parsed = JSON.parse(args) as Record<string, string>
      return { agent: parsed.description || parsed.subagent_type || 'specialist' }
    } catch {
      return { agent: 'specialist' }
    }
  }
  return undefined
}
