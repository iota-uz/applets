/**
 * Translation hook using locale from IotaContext
 */

import { useCallback } from 'react'
import { useIotaContext } from '../context/IotaContext'

export function useTranslation() {
  const { locale } = useIotaContext()
  const { translations, language } = locale

  /**
   * Translate a key with optional parameter interpolation
   * @param key - Translation key (e.g., 'bichat.title')
   * @param params - Optional parameters for interpolation (e.g., { name: 'John' })
   * @returns Translated string
   */
  const t = useCallback(
    (key: string, params?: Record<string, string | number | boolean>): string => {
      let text = translations[key] || key

      // Simple interpolation: replace {{key}} with params[key]
      if (params) {
        Object.keys(params).forEach((paramKey) => {
          const value = params[paramKey]
          text = text.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(value))
        })
      }

      return text
    },
    [translations]
  )

  return {
    t,
    locale: language,
  }
}
