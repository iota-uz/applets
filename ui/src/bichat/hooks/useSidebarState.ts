/**
 * useSidebarState — mobile breakpoint detection + drawer open/close state.
 * SSR-safe. Auto-closes drawer when resizing to desktop.
 */

import { useState, useEffect, useCallback } from 'react';

const MOBILE_QUERY = '(max-width: 767px)';

function getIsMobile(): boolean {
  if (typeof window === 'undefined') {return false;}
  return window.matchMedia(MOBILE_QUERY).matches;
}

export interface UseSidebarStateReturn {
  isMobile: boolean
  isMobileOpen: boolean
  openMobile: () => void
  closeMobile: () => void
  toggleMobile: () => void
}

export function useSidebarState(): UseSidebarStateReturn {
  const [isMobile, setIsMobile] = useState(getIsMobile);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {return;}

    const mql = window.matchMedia(MOBILE_QUERY);

    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (!e.matches) {setIsMobileOpen(false);}
    };

    // Safari < 14 uses addListener; modern browsers use addEventListener
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
    } else if (mql.addListener) {
      mql.addListener(handler);
    }

    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', handler);
      } else if (mql.removeListener) {
        mql.removeListener(handler);
      }
    };
  }, []);

  const openMobile = useCallback(() => setIsMobileOpen(true), []);
  const closeMobile = useCallback(() => setIsMobileOpen(false), []);
  const toggleMobile = useCallback(() => setIsMobileOpen((v) => !v), []);

  return { isMobile, isMobileOpen, openMobile, closeMobile, toggleMobile };
}
