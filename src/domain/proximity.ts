import type { ChronicleData, EntityRef } from './chronicle';
import { distanceM, pointInPolygon, ringCentroid, type Coordinate } from './geometry';

export type NearbyHit = EntityRef & { name: string; distanceM: number; inside?: boolean };

/** Éléments situés dans un rayon autour d'un point (CDC §17), du plus proche au plus lointain. Les zones contenant le point comptent à 0 m. */
export function nearby(data: ChronicleData, center: Coordinate, radiusM: number): NearbyHit[] {
  const hits: NearbyHit[] = [];
  const point = (collection: EntityRef['collection'], id: string, name: string | undefined, coordinates: Coordinate | undefined) => {
    if (!coordinates) return;
    const distance = distanceM(center, coordinates);
    if (distance <= radiusM) hits.push({ collection, id, name: name || 'Sans nom', distanceM: distance });
  };
  data.locations.forEach((item) => point('locations', item.id, item.name, item.geometry?.coordinates));
  data.havens.forEach((item) => point('havens', item.id, item.name, item.geometry?.coordinates));
  data.undergroundAccess.forEach((item) => point('undergroundAccess', item.id, item.name, item.geometry?.coordinates));
  data.plots.forEach((item) => {
    // Un plot compte par sa zone si le point y est, sinon par son ping.
    if (item.zoneGeometry?.type === 'Polygon' && pointInPolygon(center, item.zoneGeometry))
      hits.push({ collection: 'plots', id: item.id, name: item.name, distanceM: 0, inside: true });
    else point('plots', item.id, item.name, item.pingGeometry?.coordinates ?? (item.zoneGeometry?.coordinates?.[0] ? ringCentroid(item.zoneGeometry.coordinates[0]) : undefined));
  });
  data.territories.forEach((item) => {
    if (item.geometry?.type !== 'Polygon') return;
    if (pointInPolygon(center, item.geometry)) hits.push({ collection: 'territories', id: item.id, name: item.name, distanceM: 0, inside: true });
    else point('territories', item.id, item.name, ringCentroid(item.geometry.coordinates[0]));
  });
  return hits.sort((a, b) => a.distanceM - b.distanceM);
}

/** Polygone approximant un cercle géodésique (affichage du rayon de recherche). */
export function circlePolygon(center: Coordinate, radiusM: number, steps = 48): Coordinate[] {
  const ring: Coordinate[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = (2 * Math.PI * i) / steps;
    const dx = (radiusM * Math.cos(angle)) / (111_320 * Math.cos((center[1] * Math.PI) / 180));
    const dy = (radiusM * Math.sin(angle)) / 110_540;
    ring.push([center[0] + dx, center[1] + dy]);
  }
  return ring;
}
