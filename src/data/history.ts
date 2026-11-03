import { useSyncExternalStore } from 'react';

/**
 * Historique d'annulation de la session (CDC §16, §19) : chaque écriture importante enregistre comment se défaire
 * et se refaire. Propre à ce poste ; il ne remonte pas les modifications faites par l'autre joueur.
 */
export type HistoryEntry = { label: string; undo: () => Promise<void>; redo: () => Promise<void> };

const LIMIT = 60;
const past: HistoryEntry[] = [];
const future: HistoryEntry[] = [];
const listeners = new Set<() => void>();
let snapshot = { canUndo: false, canRedo: false, nextUndo: undefined as string | undefined };
let replaying = false;

const notify = () => {
  snapshot = { canUndo: past.length > 0, canRedo: future.length > 0, nextUndo: past[past.length - 1]?.label };
  listeners.forEach((listener) => listener());
};

export function recordHistory(entry: HistoryEntry) {
  if (replaying) return; // une annulation n'est pas elle-même enregistrée
  past.push(entry);
  if (past.length > LIMIT) past.shift();
  future.length = 0;
  notify();
}

async function replay(from: HistoryEntry[], to: HistoryEntry[], action: 'undo' | 'redo'): Promise<string | undefined> {
  const entry = from.pop();
  if (!entry) return undefined;
  replaying = true;
  try {
    await entry[action]();
    to.push(entry);
    return entry.label;
  } catch (error) {
    from.push(entry);
    throw error;
  } finally {
    replaying = false;
    notify();
  }
}

export const undo = () => replay(past, future, 'undo');
export const redo = () => replay(future, past, 'redo');

export function useHistory() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
  );
}

/** Réinitialisation (tests). */
export function clearHistory() {
  past.length = 0;
  future.length = 0;
  notify();
}
