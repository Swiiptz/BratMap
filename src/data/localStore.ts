import type { CollectionName } from '../domain/models';
import { decodeDocument } from './geometryCodec';
import { ConflictError, type DataStore, type DeletedFilter, type DocumentValues, type StoredDocument } from './store';

const keyFor = (collection: CollectionName) => `bratmap:${collection}`;
const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).replace(/-/g, '').slice(0, 20);

/** Stockage navigateur pour le développement hors Firebase. Synchronise les onglets via l'événement `storage`. */
export function createLocalStore(storage: Storage = window.localStorage): DataStore {
  const listeners = new Map<CollectionName, Set<() => void>>();

  const read = (collection: CollectionName): StoredDocument[] => {
    try {
      const raw = storage.getItem(keyFor(collection));
      return raw ? (JSON.parse(raw) as StoredDocument[]) : [];
    } catch {
      return [];
    }
  };
  const notify = (collection: CollectionName) => listeners.get(collection)?.forEach((listener) => listener());
  const write = (collection: CollectionName, documents: StoredDocument[]) => {
    storage.setItem(keyFor(collection), JSON.stringify(documents));
    notify(collection);
  };
  const patch = (collection: CollectionName, id: string, values: DocumentValues, expectedVersion?: number) => {
    const documents = read(collection);
    const index = documents.findIndex((document) => document.id === id);
    if (index < 0) throw new Error('Élément introuvable.');
    const current = documents[index];
    const currentVersion = typeof current.version === 'number' ? current.version : 0;
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) throw new ConflictError();
    documents[index] = { ...current, ...values, id, updatedAt: Date.now(), version: currentVersion + 1 };
    write(collection, documents);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      const collection = event.key?.startsWith('bratmap:') ? (event.key.slice(8) as CollectionName) : undefined;
      if (collection) notify(collection);
    });
  }

  return {
    mode: 'local',
    subscribe(collection, onData, _onError, deleted: DeletedFilter = 'exclude') {
      const emit = () =>
        onData(
          read(collection)
            .filter((document) => (deleted === 'only' ? Boolean(document.deletedAt) : !document.deletedAt))
            .map(decodeDocument),
        );
      const set = listeners.get(collection) ?? new Set();
      set.add(emit);
      listeners.set(collection, set);
      emit();
      return () => set.delete(emit);
    },
    async getAll(collection) {
      return read(collection).map(decodeDocument);
    },
    async create(collection, values, id = newId()) {
      const now = Date.now();
      const documents = read(collection).filter((document) => document.id !== id);
      write(collection, [...documents, { ...values, id, createdAt: now, updatedAt: now, deletedAt: null, version: 1 }]);
      return id;
    },
    async update(collection, id, values, expectedVersion) {
      patch(collection, id, values, expectedVersion);
    },
    async softDelete(collection, id) {
      patch(collection, id, { deletedAt: Date.now() });
    },
    async restore(collection, id) {
      patch(collection, id, { deletedAt: null });
    },
    async remove(collection, id) {
      write(
        collection,
        read(collection).filter((document) => document.id !== id),
      );
    },
    async putMany(collection, incoming) {
      const byId = new Map(read(collection).map((document) => [document.id, document]));
      incoming.forEach((document) => byId.set(document.id, document));
      write(collection, [...byId.values()]);
    },
  };
}
