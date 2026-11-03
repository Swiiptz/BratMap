import { entityCollections, referentialCollections, type CollectionName, type EntityCollection, type EntityMeta } from '../domain/models';
import { defaultReferentials, referentialId } from '../domain/referentials';
import { firestore } from './firebase';
import { createFirestoreStore } from './firestoreStore';
import { createLocalStore } from './localStore';
import { recordHistory } from './history';
import { APP_CONFIG_ID, defaultAppConfig, type AppConfig } from '../domain/appConfig';
import { trackSave } from './saveStatus';
import { toMillis, type DataStore, type DocumentValues, type StoredDocument } from './store';

const baseStore: DataStore = firestore ? createFirestoreStore(firestore) : createLocalStore();

const isEntity = (collection: CollectionName): collection is EntityCollection => collection in entityCollections;
const labelOf = (values: DocumentValues | EntityMeta) => ('name' in values && values.name ? `« ${String(values.name)} »` : 'l’élément');

/** Toutes les écritures passent par ici pour alimenter l'indicateur Enregistré / Sauvegarde / Erreur, et l'historique. */
export const store: DataStore = {
  ...baseStore,
  create: async (collection, values, id) => {
    const created = await trackSave(baseStore.create(collection, values, id));
    if (isEntity(collection))
      recordHistory({
        label: `Création de ${labelOf(values)}`,
        undo: () => trackSave(baseStore.softDelete(collection, created)),
        redo: () => trackSave(baseStore.restore(collection, created)),
      });
    return created;
  },
  update: (...args) => trackSave(baseStore.update(...args)),
  softDelete: (...args) => trackSave(baseStore.softDelete(...args)),
  restore: (...args) => trackSave(baseStore.restore(...args)),
  remove: (...args) => trackSave(baseStore.remove(...args)),
  putMany: (...args) => trackSave(baseStore.putMany(...args)),
};

const META_KEYS = new Set(['id', 'createdAt', 'updatedAt', 'deletedAt', 'version', 'reference']);
const withoutMeta = (entity: object) => Object.fromEntries(Object.entries(entity).filter(([key, value]) => !META_KEYS.has(key) && value !== undefined));

/**
 * Écrit une entité : mise à jour classique, ou première copie en base si c'est une référence publique
 * (elle devient alors un document de chronique de même ID, qui prime sur la donnée importée).
 */
export async function saveEntity(collection: EntityCollection, entity: EntityMeta, patch: DocumentValues, expectedVersion?: number) {
  const record = entity as unknown as DocumentValues;
  // Valeurs d'avant, uniquement pour les champs modifiés (null = champ absent) : de quoi annuler sans écraser le reste.
  const before = Object.fromEntries(Object.keys(patch).map((key) => [key, record[key] ?? null]));
  if (entity.reference) await trackSave(baseStore.create(collection, { ...withoutMeta(entity), ...patch }, entity.id));
  else await store.update(collection, entity.id, patch, expectedVersion);
  recordHistory({
    label: `Modification de ${labelOf(entity)}`,
    // Donnée publique copiée par cette modification : l'annuler retire la copie, la référence réapparaît.
    undo: () => trackSave(entity.reference ? baseStore.remove(collection, entity.id) : baseStore.update(collection, entity.id, before)),
    redo: async () => {
      if (entity.reference) await trackSave(baseStore.create(collection, { ...withoutMeta(entity), ...patch }, entity.id));
      else await trackSave(baseStore.update(collection, entity.id, patch));
    },
  });
}

export async function trashEntity(collection: EntityCollection, entity: EntityMeta) {
  if (entity.reference) await trackSave(baseStore.create(collection, withoutMeta(entity), entity.id));
  await trackSave(baseStore.softDelete(collection, entity.id));
  recordHistory({
    label: `Suppression de ${labelOf(entity)}`,
    undo: () => trackSave(entity.reference ? baseStore.remove(collection, entity.id) : baseStore.restore(collection, entity.id)),
    redo: () => trashEntity(collection, entity),
  });
}

export const allCollections = [...Object.keys(entityCollections), ...Object.keys(referentialCollections), 'appConfig', 'itineraries'] as CollectionName[];

/** Précharge les référentiels vides avec des IDs déterministes : idempotent même si deux clients le lancent. */
export async function ensureDefaultReferentials() {
  for (const [collection, seeds] of Object.entries(defaultReferentials) as Array<[CollectionName, typeof defaultReferentials.clans]>) {
    const existing = await baseStore.getAll(collection);
    if (existing.length > 0 || seeds.length === 0) continue;
    await baseStore.putMany(
      collection,
      seeds.map((seed, order) => ({
        ...seed,
        id: seed.id ?? referentialId(seed.name),
        order,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
        version: 1,
      })),
    );
  }
}

export type BackupFile = { app: 'bratmap'; format: 1; exportedAt: string; collections: Partial<Record<CollectionName, StoredDocument[]>> };

const serializeDates = (document: StoredDocument): StoredDocument => ({
  ...document,
  createdAt: toMillis(document.createdAt) ?? null,
  updatedAt: toMillis(document.updatedAt) ?? null,
  deletedAt: toMillis(document.deletedAt) ?? null,
});

export async function exportBackup(): Promise<BackupFile> {
  const collections: BackupFile['collections'] = {};
  for (const collection of allCollections) collections[collection] = (await baseStore.getAll(collection)).map(serializeDates);
  return { app: 'bratmap', format: 1, exportedAt: new Date().toISOString(), collections };
}

export function parseBackup(value: unknown): BackupFile {
  if (!value || typeof value !== 'object' || (value as BackupFile).app !== 'bratmap' || (value as BackupFile).format !== 1)
    throw new Error('Fichier de sauvegarde bratMap invalide.');
  return value as BackupFile;
}

/** Fusionne la sauvegarde : les documents de même ID sont remplacés, les autres conservés. */
export async function importBackup(backup: BackupFile) {
  for (const collection of allCollections) {
    const documents = backup.collections[collection];
    if (documents?.length)
      await store.putMany(
        collection,
        documents.filter((document): document is StoredDocument => typeof document?.id === 'string'),
      );
  }
}

export type { DocumentValues, StoredDocument };

/** Met à jour la configuration partagée (document unique `appConfig/main`, créé au premier réglage). */
export async function saveAppConfig(patch: Partial<AppConfig>) {
  const existing = (await baseStore.getAll('appConfig')).find((item) => item.id === APP_CONFIG_ID);
  if (existing) await trackSave(baseStore.update('appConfig', APP_CONFIG_ID, patch));
  else await trackSave(baseStore.create('appConfig', { ...defaultAppConfig, ...patch }, APP_CONFIG_ID));
}
