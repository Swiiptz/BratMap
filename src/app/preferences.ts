import { useEffect, useState } from 'react';

/** Préférence d'affichage propre à ce navigateur (non synchronisée), persistée en localStorage. */
export function usePreference<T>(key: string, fallback: T): [T, (value: T) => void] {
  const storageKey = `bratmap:pref:${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Stockage indisponible (navigation privée) : la préférence reste en mémoire.
    }
  }, [storageKey, value]);
  return [value, setValue];
}
