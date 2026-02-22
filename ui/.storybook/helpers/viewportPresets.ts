/**
 * Reusable viewport parameter overrides for stories that need responsive testing.
 *
 * Usage in a story file:
 *   import { mobileViewport, tabletViewport } from '@sb-helpers/viewportPresets'
 *
 *   export const Mobile: Story = {
 *     parameters: mobileViewport,
 *     ...
 *   }
 */

export const mobileViewport = {
  viewport: { defaultViewport: 'mobile' },
  layout: 'fullscreen' as const,
}

export const tabletViewport = {
  viewport: { defaultViewport: 'tablet' },
  layout: 'fullscreen' as const,
}

export const desktopViewport = {
  viewport: { defaultViewport: 'desktop' },
  layout: 'fullscreen' as const,
}
