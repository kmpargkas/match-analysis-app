import { create } from 'zustand';
import type { Point } from '@/domain/schemas';

export type PlayerField = 'player' | 'playerOn';

/** Screen state only; records are always saved through the repositories. */
interface CollectorState {
  /** Collector timeline, mirrored a few times a second for the clock and possession. */
  timeS: number;
  activeEventId: string | null;
  /** Event waiting for its location on the minimap. */
  awaitingLocationId: string | null;
  /** First click of a pass mapped with two clicks instead of a drag. */
  pendingStart: Point | null;
  playerSearch: { eventId: string; field: PlayerField } | null;
  pendingSaves: number;
  saveFailed: boolean;

  setTimeS(t: number): void;
  activate(eventId: string | null, awaitLocation?: boolean): void;
  setAwaitingLocation(eventId: string | null): void;
  setPendingStart(point: Point | null): void;
  openPlayerSearch(eventId: string, field?: PlayerField): void;
  closePlayerSearch(): void;
  /** Runs a write and tracks it for the Saved indicator. */
  save<T>(write: Promise<T>): Promise<T>;
  reset(): void;
}

const initial = {
  timeS: 0,
  activeEventId: null,
  awaitingLocationId: null,
  pendingStart: null,
  playerSearch: null,
  pendingSaves: 0,
  saveFailed: false,
};

export const useCollector = create<CollectorState>()((set) => ({
  ...initial,
  setTimeS: (timeS) => set({ timeS }),
  activate: (activeEventId, awaitLocation = false) =>
    set({ activeEventId, awaitingLocationId: awaitLocation ? activeEventId : null, pendingStart: null, playerSearch: null }),
  setAwaitingLocation: (awaitingLocationId) => set({ awaitingLocationId, pendingStart: null }),
  setPendingStart: (pendingStart) => set({ pendingStart }),
  openPlayerSearch: (eventId, field = 'player') => set({ playerSearch: { eventId, field } }),
  closePlayerSearch: () => set({ playerSearch: null }),
  save: async (write) => {
    set((s) => ({ pendingSaves: s.pendingSaves + 1 }));
    try {
      const result = await write;
      set((s) => ({ pendingSaves: s.pendingSaves - 1, saveFailed: false }));
      return result;
    } catch (error) {
      set((s) => ({ pendingSaves: s.pendingSaves - 1, saveFailed: true }));
      throw error;
    }
  },
  reset: () => set(initial),
}));
