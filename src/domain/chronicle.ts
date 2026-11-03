import { segmentTypes } from './underground';
import type {
  Character,
  EntityCollection,
  EntityByCollection,
  Haven,
  Location,
  Plot,
  Referential,
  ReferentialCollection,
  Territory,
  UndergroundAccess,
  UndergroundSegment,
} from './models';

/** Instantané de toutes les données de chronique, consommé par les fonctions pures (recherche, focus, filtres). */
export type ChronicleData = {
  locations: Location[];
  havens: Haven[];
  territories: Territory[];
  plots: Plot[];
  characters: Character[];
  undergroundAccess: UndergroundAccess[];
  undergroundSegments: UndergroundSegment[];
  refs: Record<ReferentialCollection, Referential[]>;
};

export type EntityRef = { collection: EntityCollection; id: string };

export const emptyChronicle = (): ChronicleData => ({
  locations: [],
  havens: [],
  territories: [],
  plots: [],
  characters: [],
  undergroundAccess: [],
  undergroundSegments: [],
  refs: {
    markerTypes: [],
    clans: [],
    factions: [],
    traditions: [],
    disciplines: [],
    skills: [],
    specialAbilities: [],
    influenceDomains: [],
    characterStatuses: [],
    plotStatuses: [],
    coteries: [],
  },
});

export function findEntity<C extends EntityCollection>(data: ChronicleData, collection: C, id: string | undefined): EntityByCollection[C] | undefined {
  if (!id) return undefined;
  return (data[collection] as Array<EntityByCollection[C]>).find((item) => item.id === id);
}

export function refName(data: ChronicleData, collection: ReferentialCollection, id: string | undefined): string | undefined {
  if (!id) return undefined;
  return data.refs[collection].find((item) => item.id === id)?.name ?? id;
}

export function entityName(data: ChronicleData, ref: EntityRef): string {
  const entity = findEntity(data, ref.collection, ref.id) as { name?: string; type?: string } | undefined;
  if (!entity) return 'Élément supprimé';
  // Les segments souterrains n'ont pas toujours de nom : on retombe sur leur type.
  return entity.name || (ref.collection === 'undergroundSegments' ? (segmentTypes.find((type) => type.id === entity.type)?.name ?? 'Segment') : 'Sans nom');
}
