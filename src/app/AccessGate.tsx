import { useState, type FormEvent, type ReactNode } from 'react';
import { dismissSplash } from './splash';

/**
 * Protection légère par code d'accès global (CDC §22). Le code est comparé à `VITE_ACCESS_CODE_SHA256` (empreinte SHA-256).
 * Attention : ce n'est pas une sécurité forte (le code et les règles Firestore restent visibles côté client).
 */
const EXPECTED = (import.meta.env.VITE_ACCESS_CODE_SHA256 as string | undefined)?.trim().toLowerCase();
const STORAGE_KEY = 'bratmap:access';

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const alreadyGranted = () => {
  try {
    return Boolean(EXPECTED) && window.localStorage.getItem(STORAGE_KEY) === EXPECTED;
  } catch {
    return false;
  }
};

export function AccessGate({ children }: { children: ReactNode }) {
  const [granted, setGranted] = useState(() => !EXPECTED || alreadyGranted());
  const [error, setError] = useState('');
  if (granted) return <>{children}</>;
  dismissSplash();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code') ?? '');
    if ((await sha256(code)) !== EXPECTED) return setError('Code incorrect.');
    try {
      window.localStorage.setItem(STORAGE_KEY, EXPECTED as string);
    } catch {
      // Stockage indisponible : l'accès vaut pour cette session.
    }
    setGranted(true);
  };

  return (
    <div className="access-gate">
      <form className="entity-form" onSubmit={(event) => void submit(event)}>
        <div className="brand-mark">
          <span className="brand-glyph">B</span>
          <span>
            <strong>bratMap</strong>
            <small>CHRONIQUE / PARIS</small>
          </span>
        </div>
        <label>
          Code d'accès
          <input name="code" type="password" autoFocus autoComplete="current-password" />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button">Entrer</button>
      </form>
    </div>
  );
}
