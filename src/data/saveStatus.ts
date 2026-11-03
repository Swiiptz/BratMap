import { useSyncExternalStore } from 'react';

export type SaveState = { status: 'saved' | 'saving' | 'error'; message?: string };

let pending = 0;
let state: SaveState = { status: 'saved' };
const listeners = new Set<() => void>();
const emit = (next: SaveState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

export async function trackSave<T>(operation: Promise<T>): Promise<T> {
  pending += 1;
  emit({ status: 'saving' });
  try {
    const result = await operation;
    pending -= 1;
    if (pending === 0) emit({ status: 'saved' });
    return result;
  } catch (error) {
    pending -= 1;
    emit({ status: 'error', message: error instanceof Error ? error.message : 'Erreur de sauvegarde' });
    throw error;
  }
}

export function useSaveStatus(): SaveState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}
