import { store } from '../../data';
import type { EntityRef } from '../../domain/chronicle';
import type { Coordinate } from '../../domain/geometry';
import type { EntityCollection, EntityMeta } from '../../domain/models';

export const options = (items: Array<{ id: string; name?: string }>) => items.map((item) => ({ id: item.id, name: item.name || 'Sans nom' }));
export const refsOf = (collection: EntityCollection, ids: Array<string | undefined | null> = []): EntityRef[] =>
  ids.filter((id): id is string => Boolean(id)).map((id) => ({ collection, id }));

/** Copie d'un élément (CDC §16) : nouvel ID, nom suffixé, point légèrement décalé pour rester visible. */
export async function duplicate(collection: EntityCollection, entity: EntityMeta & { name?: string; geometry?: unknown }, onSelect: (ref: EntityRef) => void) {
  const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, version: _v, ...values } = entity;
  const geometry = values.geometry as { type: string; coordinates: Coordinate } | undefined;
  const shifted = geometry?.type === 'Point' ? { ...geometry, coordinates: [geometry.coordinates[0] + 0.0004, geometry.coordinates[1] - 0.0003] } : geometry;
  const id = await store.create(collection, { ...values, name: `${values.name ?? 'Élément'} (copie)`, geometry: shifted });
  onSelect({ collection, id });
}
