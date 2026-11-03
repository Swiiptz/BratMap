import type { CollectionName } from '../domain/models';

export type DocumentValues = Record<string, unknown>;
export type StoredDocument = DocumentValues & { id: string };
export type DeletedFilter = 'exclude' | 'only';
export type Unsubscribe = () => void;

export class ConflictError extends Error {
  constructor() {
    super('Cet élément a été modifié ailleurs entre-temps. Recharge la fiche avant d’enregistrer.');
    this.name = 'ConflictError';
  }
}

/**
 * Contrat unique d'accès aux données. Firestore en environnement configuré,
 * localStorage sinon : l'UI ne connaît que cette interface.
 */
export interface DataStore {
  readonly mode: 'firestore' | 'local';
  subscribe(collection: CollectionName, onData: (items: StoredDocument[]) => void, onError: (error: Error) => void, deleted?: DeletedFilter): Unsubscribe;
  getAll(collection: CollectionName): Promise<StoredDocument[]>;
  create(collection: CollectionName, values: DocumentValues, id?: string): Promise<string>;
  /** `expectedVersion` active le contrôle d'écrasement : l'écriture échoue si le document a changé. */
  update(collection: CollectionName, id: string, values: DocumentValues, expectedVersion?: number): Promise<void>;
  softDelete(collection: CollectionName, id: string): Promise<void>;
  restore(collection: CollectionName, id: string): Promise<void>;
  remove(collection: CollectionName, id: string): Promise<void>;
  /** Remplace ou ajoute des documents tels quels (import / restauration). */
  putMany(collection: CollectionName, documents: StoredDocument[]): Promise<void>;
}

export function toMillis(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis() as number;
  return undefined;
}

export function formatDate(value: unknown): string {
  const millis = toMillis(value);
  return millis ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(millis) : '—';
}
