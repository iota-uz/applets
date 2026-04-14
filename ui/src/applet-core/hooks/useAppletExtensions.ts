import { useMemo } from 'react';
import { useAppletContext } from '../context/AppletContext';

export function useAppletExtensions<
  TExtensions extends Record<string, unknown> = Record<string, unknown>,
>(): TExtensions {
  const { extensions } = useAppletContext();

  return useMemo(
    () => ((extensions ?? {}) as TExtensions),
    [extensions],
  );
}
