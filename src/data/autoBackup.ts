import { exportBackup, type BackupFile } from './index';

/**
 * Sauvegardes périodiques (CDC §22) : une copie complète par jour, conservée dans le navigateur (IndexedDB),
 * les 7 plus récentes gardées. Complément de l'export manuel, pas un substitut à une sauvegarde serveur.
 */
const DB = 'bratmap-backups';
const STORE = 'backups';
export const KEEP = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
export type AutoBackup = { id: string; createdAt: number; size: number; data: BackupFile };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = action(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listBackups(): Promise<AutoBackup[]> {
  const all = await run<AutoBackup[]>('readonly', (store) => store.getAll() as IDBRequest<AutoBackup[]>);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

/** Indices des sauvegardes à supprimer pour n'en garder que `keep` (les plus récentes). */
export function backupsToPrune(backups: Array<{ id: string; createdAt: number }>, keep = KEEP): string[] {
  return [...backups]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(keep)
    .map((item) => item.id);
}

export async function createBackupNow(): Promise<AutoBackup> {
  const data = await exportBackup();
  const backup: AutoBackup = { id: new Date().toISOString(), createdAt: Date.now(), size: JSON.stringify(data).length, data };
  await run('readwrite', (store) => store.put(backup));
  for (const id of backupsToPrune(await listBackups())) await run('readwrite', (store) => store.delete(id));
  return backup;
}

/** À l'ouverture : sauvegarde si la dernière date de plus d'un jour. Silencieux en cas d'échec (navigation privée…). */
export async function autoBackupIfDue(): Promise<void> {
  try {
    const [latest] = await listBackups();
    if (!latest || Date.now() - latest.createdAt > DAY_MS) await createBackupNow();
  } catch {
    // IndexedDB indisponible : l'export manuel reste possible.
  }
}
