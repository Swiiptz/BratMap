import type { ChronicleData, EntityRef } from './chronicle';
import type { EntityCollection } from './models';
import { buildUndergroundGraph, networkOf, undergroundWithin } from './underground';

export type FocusSet = Record<EntityCollection, Set<string>>;

const emptySet = (): FocusSet => ({
  locations: new Set(),
  havens: new Set(),
  territories: new Set(),
  plots: new Set(),
  characters: new Set(),
  undergroundAccess: new Set(),
  undergroundSegments: new Set(),
});

/**
 * Calcule tout ce qui est relié à une entité (mode focus CDC §13, « Afficher ce plot », « Voir tout ce qui est lié »).
 * Les liens sont lus dans les deux sens : un lieu qui référence un plot est lié à ce plot même si le plot l'ignore.
 */
export function relatedEntities(data: ChronicleData, focus: EntityRef): FocusSet {
  const result = emptySet();
  const add = (collection: EntityCollection, ids: Array<string | undefined> | undefined) => ids?.forEach((id) => id && result[collection].add(id));
  add(focus.collection, [focus.id]);
  const { id } = focus;

  if (focus.collection === 'plots') {
    const plot = data.plots.find((item) => item.id === id);
    add('characters', plot?.characterIds);
    add('locations', plot?.locationIds);
    add('havens', plot?.havenIds);
    add('territories', plot?.territoryIds);
    add('undergroundAccess', plot?.undergroundAccessIds);
    add('undergroundSegments', plot?.undergroundSegmentIds);
    add(
      'characters',
      data.characters.filter((item) => item.plotIds.includes(id)).map((item) => item.id),
    );
    add(
      'locations',
      data.locations.filter((item) => item.plotIds.includes(id)).map((item) => item.id),
    );
    add(
      'havens',
      data.havens.filter((item) => item.plotIds.includes(id)).map((item) => item.id),
    );
    add(
      'territories',
      data.territories.filter((item) => item.plotIds.includes(id)).map((item) => item.id),
    );
    add(
      'undergroundAccess',
      data.undergroundAccess.filter((item) => item.plotIds.includes(id)).map((item) => item.id),
    );
    add(
      'undergroundSegments',
      data.undergroundSegments.filter((item) => item.plotIds.includes(id)).map((item) => item.id),
    );
  }

  if (focus.collection === 'characters') {
    const character = data.characters.find((item) => item.id === id);
    add('havens', [character?.mainHavenId]);
    add('locations', character?.locationIds);
    add(
      'locations',
      character?.influences.map((influence) => influence.locationId),
    );
    add('territories', character?.territoryIds);
    add('plots', character?.plotIds);
    add(
      'characters',
      character?.relations.map((relation) => relation.characterId),
    );
    add(
      'locations',
      data.locations.filter((item) => item.characterIds.includes(id)).map((item) => item.id),
    );
    add(
      'havens',
      data.havens.filter((item) => item.ownerCharacterIds.includes(id) || item.residentCharacterIds.includes(id)).map((item) => item.id),
    );
    add(
      'territories',
      data.territories.filter((item) => item.ownerCharacterIds.includes(id) || item.characterIds.includes(id)).map((item) => item.id),
    );
    add(
      'plots',
      data.plots.filter((item) => item.characterIds.includes(id)).map((item) => item.id),
    );
  }

  if (focus.collection === 'territories') {
    const territory = data.territories.find((item) => item.id === id);
    add('characters', territory?.ownerCharacterIds);
    add('characters', territory?.characterIds);
    add('locations', territory?.locationIds);
    add('havens', territory?.havenIds);
    add('plots', territory?.plotIds);
    add(
      'locations',
      data.locations.filter((item) => item.territoryId === id).map((item) => item.id),
    );
    add(
      'havens',
      data.havens.filter((item) => item.territoryId === id).map((item) => item.id),
    );
    add(
      'undergroundAccess',
      data.undergroundAccess.filter((item) => item.territoryId === id).map((item) => item.id),
    );
    add(
      'characters',
      data.characters.filter((item) => item.territoryIds.includes(id)).map((item) => item.id),
    );
    const underground = undergroundWithin(territory?.geometry, data.undergroundAccess, data.undergroundSegments);
    add('undergroundAccess', underground.accessIds);
    add('undergroundSegments', underground.segmentIds);
  }

  if (focus.collection === 'locations') {
    const location = data.locations.find((item) => item.id === id);
    add('characters', location?.characterIds);
    add('plots', location?.plotIds);
    add('territories', [location?.territoryId]);
  }

  if (focus.collection === 'havens') {
    const haven = data.havens.find((item) => item.id === id);
    add('characters', haven?.ownerCharacterIds);
    add('characters', haven?.residentCharacterIds);
    add('plots', haven?.plotIds);
    add('territories', [haven?.territoryId]);
    add(
      'characters',
      data.characters.filter((item) => item.mainHavenId === id).map((item) => item.id),
    );
    // Coterie propriétaire : ses membres sont liés au havre.
    if (haven?.ownerCoterieId)
      add(
        'characters',
        data.characters.filter((item) => item.coterieId === haven.ownerCoterieId).map((item) => item.id),
      );
  }

  // Focus « réseau » : tout le réseau souterrain connexe, plus les liens narratifs de l'élément.
  if (focus.collection === 'undergroundAccess' || focus.collection === 'undergroundSegments') {
    const network = networkOf(
      buildUndergroundGraph(data.undergroundAccess, data.undergroundSegments),
      focus.collection === 'undergroundAccess' ? { nodeId: id } : { segmentId: id },
    );
    add('undergroundSegments', [...network.segmentIds]);
    add('undergroundAccess', [...network.accessIds]);
    for (const accessId of result.undergroundAccess) {
      const access = data.undergroundAccess.find((item) => item.id === accessId);
      add('locations', [access?.locationId]);
      add('territories', accessId === id ? [access?.territoryId] : []);
      add('plots', accessId === id ? access?.plotIds : []);
    }
    if (focus.collection === 'undergroundSegments') add('plots', data.undergroundSegments.find((item) => item.id === id)?.plotIds);
    add(
      'plots',
      data.plots.filter((plot) => plot.undergroundAccessIds.includes(id) || plot.undergroundSegmentIds.includes(id)).map((plot) => plot.id),
    );
  }

  return result;
}

export function focusSize(focus: FocusSet): number {
  return Object.values(focus).reduce((total, ids) => total + ids.size, 0);
}
