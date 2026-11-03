import { describe, expect, it } from 'vitest';
import { closeRing, distanceM, insertVertex, lineLengthM, moveVertex, pointInPolygon, removeVertex, ringAreaM2, ringCentroid, translateRing, type Coordinate } from '../geometry';

const ring: Coordinate[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [0, 0],
];

describe('édition de sommets', () => {
  it('garde l’anneau fermé quand on déplace le premier sommet', () => {
    const next = moveVertex(ring, 0, [-1, -1]);
    expect(next[0]).toEqual([-1, -1]);
    expect(next[next.length - 1]).toEqual([-1, -1]);
  });

  it('insère un sommet après l’index donné', () => {
    expect(insertVertex(ring, 0, [0.5, 0])).toEqual([
      [0, 0],
      [0.5, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ]);
  });

  it('refuse de descendre sous un triangle', () => {
    const triangle: Coordinate[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ];
    expect(removeVertex(triangle, 1)).toBe(triangle);
  });

  it('referme l’anneau quand on supprime le premier sommet', () => {
    const next = removeVertex(ring, 0);
    expect(next).toEqual([
      [1, 0],
      [1, 1],
      [0, 1],
      [1, 0],
    ]);
  });

  it('translate toute la zone', () => {
    expect(
      translateRing(
        [
          [0, 0],
          [1, 1],
        ],
        [2, 3],
      ),
    ).toEqual([
      [2, 3],
      [3, 4],
    ]);
  });

  it('ferme un anneau ouvert une seule fois', () => {
    expect(
      closeRing([
        [0, 0],
        [1, 0],
        [1, 1],
      ]),
    ).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ]);
    expect(closeRing(ring)).toBe(ring);
  });
});

describe('mesures', () => {
  it('calcule la distance Notre-Dame → Tour Eiffel (~4,1 km)', () => {
    const meters = distanceM([2.3499, 48.853], [2.2945, 48.8584]);
    expect(meters).toBeGreaterThan(4000);
    expect(meters).toBeLessThan(4200);
  });

  it('additionne les segments d’un tracé', () => {
    const points: Coordinate[] = [
      [2.3, 48.86],
      [2.31, 48.86],
      [2.32, 48.86],
    ];
    expect(lineLengthM(points)).toBeCloseTo(distanceM(points[0], points[1]) * 2, 0);
  });

  it('calcule une aire cohérente pour un carré de ~1 km', () => {
    const lat = 48.86;
    const dLat = 1000 / 111_195;
    const dLng = dLat / Math.cos((lat * Math.PI) / 180);
    const area = ringAreaM2([
      [2.3, lat],
      [2.3 + dLng, lat],
      [2.3 + dLng, lat + dLat],
      [2.3, lat + dLat],
    ]);
    expect(area).toBeGreaterThan(980_000);
    expect(area).toBeLessThan(1_020_000);
  });

  it('détecte un point dans un polygone à trou', () => {
    const polygon = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ] as Coordinate[],
        [
          [4, 4],
          [6, 4],
          [6, 6],
          [4, 6],
          [4, 4],
        ] as Coordinate[],
      ],
    };
    expect(pointInPolygon([1, 1], polygon)).toBe(true);
    expect(pointInPolygon([5, 5], polygon)).toBe(false);
    expect(pointInPolygon([11, 5], polygon)).toBe(false);
  });

  it('place le centroïde au centre d’un carré fermé', () => {
    expect(ringCentroid(ring)).toEqual([0.5, 0.5]);
  });
});
