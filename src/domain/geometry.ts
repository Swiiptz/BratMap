import type { LineStringGeometry, PointGeometry, PolygonGeometry } from './geo';

export type Coordinate = [number, number];
export type AnyGeometry = PointGeometry | LineStringGeometry | PolygonGeometry;

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (degrees: number) => (degrees * Math.PI) / 180;

export function moveVertex(ring: Coordinate[], index: number, coordinate: Coordinate): Coordinate[] {
  if (index < 0 || index >= ring.length) return ring;
  const next = ring.map((point, currentIndex) => (currentIndex === index ? coordinate : point));
  if (next.length > 1 && index === 0) next[next.length - 1] = coordinate;
  if (next.length > 1 && index === next.length - 1) next[0] = coordinate;
  return next;
}

export function insertVertex(ring: Coordinate[], afterIndex: number, coordinate: Coordinate): Coordinate[] {
  const next = [...ring];
  next.splice(Math.max(0, Math.min(afterIndex + 1, next.length)), 0, coordinate);
  return next;
}

export function removeVertex(ring: Coordinate[], index: number): Coordinate[] {
  if (ring.length <= 4 || index < 0 || index >= ring.length - 1) return ring;
  const next = ring.filter((_, currentIndex) => currentIndex !== index);
  if (index === 0) next[next.length - 1] = next[0];
  return next;
}

export function translateRing(ring: Coordinate[], delta: Coordinate): Coordinate[] {
  return ring.map(([lng, lat]) => [lng + delta[0], lat + delta[1]]);
}

/** Ferme un anneau ouvert (premier point répété en fin) ; renvoie tel quel un anneau déjà fermé. */
export function closeRing(points: Coordinate[]): Coordinate[] {
  if (points.length === 0) return points;
  const [first, last] = [points[0], points[points.length - 1]];
  return first[0] === last[0] && first[1] === last[1] ? points : [...points, first];
}

export function midpoints(ring: Coordinate[]): Coordinate[] {
  return ring.slice(0, -1).map((point, index) => {
    const next = ring[index + 1];
    return [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2];
  });
}

export function distanceM(a: Coordinate, b: Coordinate): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function lineLengthM(points: Coordinate[]): number {
  return points.slice(1).reduce((total, point, index) => total + distanceM(points[index], point), 0);
}

/** Aire géodésique approchée d'un anneau (formule sphérique), en m². */
export function ringAreaM2(ring: Coordinate[]): number {
  const closed = closeRing(ring);
  let total = 0;
  for (let index = 0; index < closed.length - 1; index += 1) {
    const [lng1, lat1] = closed[index];
    const [lng2, lat2] = closed[index + 1];
    total += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

export function pointInRing(point: Coordinate, ring: Coordinate[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(point: Coordinate, polygon: PolygonGeometry): boolean {
  const [outer, ...holes] = polygon.coordinates;
  return Boolean(outer) && pointInRing(point, outer) && !holes.some((hole) => pointInRing(point, hole));
}

export function ringCentroid(ring: Coordinate[]): Coordinate {
  const points = ring.length > 1 ? ring.slice(0, -1) : ring;
  const sum = points.reduce<Coordinate>((acc, [lng, lat]) => [acc[0] + lng, acc[1] + lat], [0, 0]);
  return [sum[0] / Math.max(points.length, 1), sum[1] / Math.max(points.length, 1)];
}

export function geometryBounds(geometry: AnyGeometry): [Coordinate, Coordinate] {
  const points: Coordinate[] = geometry.type === 'Point' ? [geometry.coordinates] : geometry.type === 'LineString' ? geometry.coordinates : geometry.coordinates.flat();
  const lngs = points.map((point) => point[0]);
  const lats = points.map((point) => point[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

export function formatDistance(meters: number): string {
  if (meters < 1) return '< 1 m';
  return meters >= 1000 ? `${(meters / 1000).toFixed(meters >= 10_000 ? 1 : 2)} km` : `${Math.round(meters)} m`;
}

export function formatArea(squareMeters: number): string {
  return squareMeters >= 100_000 ? `${(squareMeters / 1_000_000).toFixed(2)} km²` : `${Math.round(squareMeters)} m²`;
}
