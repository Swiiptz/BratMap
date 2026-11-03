import { useSyncExternalStore } from 'react';
import type { EntityRef } from '../domain/chronicle';

/** Favoris propres à ce navigateur (CDC §17) : références `collection/id`, partagées entre tous les composants. */
const KEY = 'bratmap:pref:favorites';
const listeners = new Set<() => void>();
let cache: string[] | undefined;

function read(): string[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: string[]) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Stockage indisponible : les favoris restent en mémoire pour la session.
  }
  listeners.forEach((listener) => listener());
}

const keyOf = (ref: EntityRef) => `${ref.collection}/${ref.id}`;

export function useFavorites() {
  const favorites = useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, read);
  return {
    refs: favorites.map((key) => {
      const [collection, id] = key.split('/');
      return { collection, id } as EntityRef;
    }),
    isFavorite: (ref: EntityRef) => favorites.includes(keyOf(ref)),
    toggle: (ref: EntityRef) => write(favorites.includes(keyOf(ref)) ? favorites.filter((key) => key !== keyOf(ref)) : [...favorites, keyOf(ref)]),
  };
}
