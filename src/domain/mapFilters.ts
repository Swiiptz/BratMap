import type { ChronicleData } from './chronicle';
import { relatedEntities, type FocusSet } from './focus';
import type { EntityCollection } from './models';

/** Filtres combinables de la carte (CDC §13). Chaque critère ne restreint que les familles qu'il concerne. */
export type MapFilters = {
  markerTypeId?: string;
  knowledgeLevel?: string;
  territoryId?: string;
  plotId?: string;
  ownerId?: string;
  factionId?: string;
  traditionId?: string;
  plotStatusId?: string;
  origin?: string;
};

export const activeFilterCount = (filters: MapFilters) => Object.values(filters).filter(Boolean).length;

type Entity = Record<string, unknown> & { id: string };
const has = (list: unknown, id: string) => Array.isArray(list) && list.includes(id);

/** Prédicat de visibilité d'un élément selon les filtres actifs. `plotScope` : éléments liés au plot filtré (précalculé). */
export function matchesFilters(collection: EntityCollection, entity: Entity, filters: MapFilters, plotScope?: FocusSet): boolean {
  const f = filters;
  if (
    f.plotId &&
    plotScope &&
    ['locations', 'havens', 'territories', 'plots', 'undergroundAccess', 'undergroundSegments'].includes(collection) &&
    !plotScope[collection].has(entity.id)
  )
    return false;

  if (f.territoryId) {
    if ((collection === 'locations' || collection === 'havens' || collection === 'undergroundAccess') && entity.territoryId !== f.territoryId) return false;
    if (collection === 'territories' && entity.id !== f.territoryId) return false;
    if (collection === 'plots' && !has(entity.territoryIds, f.territoryId)) return false;
  }

  if (collection === 'locations') {
    if (f.markerTypeId && entity.typeId !== f.markerTypeId) return false;
    if (f.knowledgeLevel && entity.knowledgeLevel !== f.knowledgeLevel) return false;
  }
  if (f.ownerId && (collection === 'havens' || collection === 'territories') && !has(entity.ownerCharacterIds, f.ownerId)) return false;
  if (collection === 'territories') {
    if (f.factionId && entity.factionId !== f.factionId) return false;
    if (f.traditionId && !(entity.traditionRules as Array<{ traditionId: string; active: boolean }> | undefined)?.some((rule) => rule.active && rule.traditionId === f.traditionId))
      return false;
  }
  if (f.plotStatusId && collection === 'plots' && entity.statusId !== f.plotStatusId) return false;
  if (f.origin && (collection === 'undergroundAccess' || collection === 'undergroundSegments') && entity.origin !== f.origin) return false;
  return true;
}

/** Données de chronique réduites aux éléments qui passent les filtres. */
export function applyFilters(data: ChronicleData, filters: MapFilters): ChronicleData {
  if (activeFilterCount(filters) === 0) return data;
  const plotScope = filters.plotId ? relatedEntities(data, { collection: 'plots', id: filters.plotId }) : undefined;
  const keep = <T extends Entity>(collection: EntityCollection, items: T[]) => items.filter((item) => matchesFilters(collection, item, filters, plotScope));
  return {
    ...data,
    locations: keep('locations', data.locations),
    havens: keep('havens', data.havens),
    territories: keep('territories', data.territories),
    plots: keep('plots', data.plots),
    undergroundAccess: keep('undergroundAccess', data.undergroundAccess),
    undergroundSegments: keep('undergroundSegments', data.undergroundSegments),
  };
}
