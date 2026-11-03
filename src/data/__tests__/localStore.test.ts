import { describe, expect, it } from 'vitest';
import { createLocalStore } from '../localStore';
import { ConflictError, type StoredDocument } from '../store';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('store local', () => {
  it('notifie les abonnés et exclut la corbeille', async () => {
    const store = createLocalStore(new MemoryStorage());
    const snapshots: StoredDocument[][] = [];
    store.subscribe(
      'plots',
      (items) => snapshots.push(items),
      () => undefined,
    );
    const id = await store.create('plots', { name: 'Nuit blanche' });
    await store.softDelete('plots', id);
    expect(snapshots.map((items) => items.length)).toEqual([0, 1, 0]);

    const trash: StoredDocument[][] = [];
    store.subscribe(
      'plots',
      (items) => trash.push(items),
      () => undefined,
      'only',
    );
    expect(trash.at(-1)?.[0].name).toBe('Nuit blanche');
    await store.restore('plots', id);
    expect(snapshots.at(-1)?.[0].id).toBe(id);
  });

  it('refuse un écrasement silencieux quand la version a changé', async () => {
    const store = createLocalStore(new MemoryStorage());
    const id = await store.create('locations', { name: 'Bar' });
    await store.update('locations', id, { name: 'Bar A' }, 1);
    await expect(store.update('locations', id, { name: 'Bar B' }, 1)).rejects.toBeInstanceOf(ConflictError);
    const [document] = await store.getAll('locations');
    expect(document.name).toBe('Bar A');
    expect(document.version).toBe(2);
  });
});
