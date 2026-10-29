import { createContext, useContext } from 'react';
import type { CollectorData } from './useCollectorData';

export interface CollectorContextValue {
  data: CollectorData;
  /** Current collector timeline time in seconds. */
  now: () => number;
}

export const CollectorContext = createContext<CollectorContextValue | null>(null);

export function useCollectorContext(): CollectorContextValue {
  const value = useContext(CollectorContext);
  if (!value) throw new Error('useCollectorContext must be used inside the collector');
  return value;
}
