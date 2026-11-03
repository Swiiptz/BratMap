import { emptyChronicle, type ChronicleData } from '../chronicle';
import type { Character, Haven, Location, Plot, Territory, UndergroundAccess, UndergroundSegment } from '../models';

const square = (x: number, y: number, size = 0.01): Array<[number, number]> => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
];

export const location = (id: string, patch: Partial<Location> = {}): Location => ({
  id,
  name: id,
  typeId: 'place',
  tags: [],
  characterIds: [],
  plotIds: [],
  markerStyle: { color: '#fff', size: 6 },
  geometry: { type: 'Point', coordinates: [2.3, 48.86] },
  ...patch,
});
export const haven = (id: string, patch: Partial<Haven> = {}): Haven => ({
  id,
  name: id,
  ownerCharacterIds: [],
  residentCharacterIds: [],
  tags: [],
  plotIds: [],
  markerStyle: { color: '#fff', size: 7 },
  geometry: { type: 'Point', coordinates: [2.31, 48.87] },
  ...patch,
});
export const territory = (id: string, patch: Partial<Territory> = {}): Territory => ({
  id,
  name: id,
  ownerCharacterIds: [],
  characterIds: [],
  locationIds: [],
  havenIds: [],
  plotIds: [],
  traditionRules: [],
  style: { fillColor: '#000', strokeColor: '#fff', opacity: 0.2, outlineOnly: false },
  geometry: { type: 'Polygon', coordinates: [square(2.29, 48.85, 0.03)] },
  ...patch,
});
export const plot = (id: string, patch: Partial<Plot> = {}): Plot => ({
  id,
  name: id,
  statusId: 'active',
  characterIds: [],
  locationIds: [],
  havenIds: [],
  territoryIds: [],
  undergroundAccessIds: [],
  undergroundSegmentIds: [],
  ...patch,
});
export const character = (id: string, patch: Partial<Character> = {}): Character => ({
  id,
  name: id,
  disciplines: [],
  skills: [],
  specialAbilities: [],
  influences: [],
  locationIds: [],
  territoryIds: [],
  plotIds: [],
  relations: [],
  ...patch,
});

export function chronicle(patch: Partial<ChronicleData> = {}): ChronicleData {
  return { ...emptyChronicle(), ...patch };
}

export const access = (id: string, coordinates: [number, number], patch: Partial<UndergroundAccess> = {}): UndergroundAccess => ({
  id,
  name: id,
  type: 'stairs',
  level: 0,
  origin: 'chronicle',
  segmentIds: [],
  plotIds: [],
  geometry: { type: 'Point', coordinates },
  ...patch,
});
export const segment = (id: string, startNodeId: string, endNodeId: string, coordinates: Array<[number, number]>, patch: Partial<UndergroundSegment> = {}): UndergroundSegment => ({
  id,
  type: 'tunnel',
  level: -1,
  origin: 'chronicle',
  startNodeId,
  endNodeId,
  connectedSegmentIds: [],
  plotIds: [],
  geometry: { type: 'LineString', coordinates },
  ...patch,
});
