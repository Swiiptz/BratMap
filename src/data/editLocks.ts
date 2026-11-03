import { useEffect, useState } from 'react';
import { store } from './index';

/**
 * Verrou d'édition indicatif (CDC §21) : signale à l'autre poste qu'une fiche ou une forme est en cours de modification.
 * Ce n'est pas un verrou bloquant : la protection réelle contre l'écrasement reste le contrôle de version.
 */
export const LOCK_TTL_MS = 60_000;
const HEARTBEAT_MS = 20_000;

/** Identifiant de ce poste (un par onglet). */
export const sessionId: string = (() => {
  try {
    const existing = window.sessionStorage.getItem('bratmap:session');
    if (existing) return existing;
    const created = Math.random().toString(36).slice(2, 12);
    window.sessionStorage.setItem('bratmap:session', created);
    return created;
  } catch {
    return Math.random().toString(36).slice(2, 12);
  }
})();

type Lock = { id: string; sessionId: string; heartbeat: number; collection: string; entityId: string };
const lockId = (collection: string, id: string) => `${collection}__${id}`;

/** Le verrou est-il tenu par un autre poste et encore frais ? */
export function isForeignLock(lock: Pick<Lock, 'sessionId' | 'heartbeat'> | undefined, mine: string, now = Date.now()): boolean {
  return Boolean(lock && lock.sessionId !== mine && now - lock.heartbeat < LOCK_TTL_MS);
}

/** Pose et entretient le verrou tant que `active`, et indique si un autre poste édite le même élément. */
export function useEditLock(collection: string, id: string | undefined, active: boolean): boolean {
  const [foreign, setForeign] = useState(false);

  useEffect(() => {
    if (!id) return;
    return store.subscribe(
      'editLocks',
      (items) => setForeign(isForeignLock(items.find((item) => item.id === lockId(collection, id)) as Lock | undefined, sessionId)),
      () => setForeign(false),
    );
  }, [collection, id]);

  useEffect(() => {
    if (!id || !active) return;
    const key = lockId(collection, id);
    const beat = () => void store.create('editLocks', { sessionId, heartbeat: Date.now(), collection, entityId: id }, key).catch(() => undefined);
    beat();
    const timer = window.setInterval(beat, HEARTBEAT_MS);
    return () => {
      window.clearInterval(timer);
      void store.remove('editLocks', key).catch(() => undefined);
    };
  }, [collection, id, active]);

  return foreign;
}
