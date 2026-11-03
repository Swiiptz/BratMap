import type { AnyGeometry } from '../domain/geometry';

/**
 * Firestore refuse les tableaux imbriqués : les LineString et Polygon sont stockés en JSON texte.
 * Les Points restent des objets natifs. Le décodage accepte aussi les anciens formats.
 */
export function encodeGeometry(geometry: AnyGeometry): AnyGeometry | string {
  return geometry.type === 'Point' ? geometry : JSON.stringify(geometry);
}

export function decodeGeometry(value: unknown): AnyGeometry | undefined {
  try {
    const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object' || !('type' in parsed) || !('coordinates' in parsed)) return undefined;
    const raw = parsed as { type: string; coordinates: unknown };
    const coordinates = typeof raw.coordinates === 'string' ? JSON.parse(raw.coordinates) : raw.coordinates;
    if (!Array.isArray(coordinates)) return undefined;
    if (raw.type === 'Point' || raw.type === 'LineString' || raw.type === 'Polygon') return { type: raw.type, coordinates } as AnyGeometry;
  } catch {
    return undefined;
  }
  return undefined;
}

/** Champs géométriques d'un document : `geometry` et tout champ suffixé `Geometry` (ex. `zoneGeometry` d'un plot). */
const isGeometryKey = (key: string) => key === 'geometry' || key.endsWith('Geometry');

/** Encode les géométries d'un document avant écriture. */
export function encodeDocument<T extends Record<string, unknown>>(values: T): T {
  const entries = Object.entries(values).map(([key, value]) => [key, isGeometryKey(key) && value && typeof value === 'object' ? encodeGeometry(value as AnyGeometry) : value]);
  return Object.fromEntries(entries) as T;
}

export function decodeDocument<T extends Record<string, unknown>>(values: T): T {
  const entries = Object.entries(values).map(([key, value]) => [key, isGeometryKey(key) && value !== null && value !== undefined ? decodeGeometry(value) : value]);
  return Object.fromEntries(entries) as T;
}
