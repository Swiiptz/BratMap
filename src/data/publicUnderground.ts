import type { UndergroundAccess, UndergroundSegment } from '../domain/models';

export const PUBLIC_UNDERGROUND_URL = `${import.meta.env.BASE_URL}data/public-underground.json`;
const OSM_LABEL = '© OpenStreetMap contributors (ODbL)';

type CompactItem = Record<string, unknown> & { id: string; osm?: string; cd92?: string; cd92set?: 'bassins' | 'collecteurs'; knowledgeLevel?: string };
const CD92_DATASETS = { bassins: 'bassins-de-retention', collecteurs: 'collecteurs-du-reseau-departemental-dassainissement' } as const;
export type PublicUnderground = { undergroundAccess: UndergroundAccess[]; undergroundSegments: UndergroundSegment[] };

/** Restitue les champs implicites du format compact (voir scripts/build-public-underground.py). */
function expand<T>(item: CompactItem): T {
  const { osm, cd92, cd92set = 'bassins', ...values } = item;
  const source = cd92
    ? {
        type: 'CD92',
        label: 'Département des Hauts-de-Seine — Licence Ouverte',
        externalId: cd92,
        url: `https://opendata.hauts-de-seine.fr/explore/dataset/${CD92_DATASETS[cd92set]}/`,
      }
    : osm
      ? { type: 'OSM', label: OSM_LABEL, externalId: osm, url: osm.includes('/') ? `https://www.openstreetmap.org/${osm}` : undefined }
      : undefined;
  return {
    plotIds: [],
    segmentIds: [],
    connectedSegmentIds: [],
    ...values,
    origin: 'public',
    knowledgeLevel: item.knowledgeLevel ?? 'confirmed',
    source,
    reference: true,
    version: 0,
  } as T;
}

export function parsePublicUnderground(raw: { accesses?: CompactItem[]; segments?: CompactItem[] }): PublicUnderground {
  return {
    undergroundAccess: (raw.accesses ?? []).map((item) => expand<UndergroundAccess>(item)),
    undergroundSegments: (raw.segments ?? []).map((item) => expand<UndergroundSegment>(item)),
  };
}

let cache: Promise<PublicUnderground> | undefined;

/** Infrastructures souterraines publiques (OSM) : fichier statique chargé une fois, jamais écrit en base. */
export function loadPublicUnderground(): Promise<PublicUnderground> {
  cache ??= fetch(PUBLIC_UNDERGROUND_URL)
    .then((response) => (response.ok ? response.json() : { accesses: [], segments: [] }))
    .then(parsePublicUnderground)
    .catch(() => ({ undergroundAccess: [], undergroundSegments: [] }));
  return cache;
}

/**
 * Fusion référence publique + chronique : un document de chronique de même ID remplace la référence
 * (modification manuelle jamais écrasée), un ID mis à la corbeille la masque.
 */
export function mergeReference<T extends { id: string }>(reference: T[], chronicle: T[], trashedIds: Set<string>): T[] {
  const overridden = new Set(chronicle.map((item) => item.id));
  return [...reference.filter((item) => !overridden.has(item.id) && !trashedIds.has(item.id)), ...chronicle];
}
