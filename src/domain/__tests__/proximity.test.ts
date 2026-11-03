import { describe, expect, it } from 'vitest';
import { distanceM } from '../geometry';
import { circlePolygon, nearby } from '../proximity';
import { chronicle, haven, location, plot, territory } from './fixtures';

describe('recherche de proximité', () => {
  const data = chronicle({
    locations: [location('near', { geometry: { type: 'Point', coordinates: [2.3005, 48.86] } }), location('far', { geometry: { type: 'Point', coordinates: [2.33, 48.86] } })],
    havens: [haven('h', { geometry: { type: 'Point', coordinates: [2.301, 48.8605] } })],
    territories: [territory('t')],
  });

  it('liste ce qui est dans le rayon, du plus proche au plus loin, zones englobantes à 0 m', () => {
    const hits = nearby(data, [2.3, 48.86], 200);
    expect(hits.map((hit) => hit.id)).toEqual(['t', 'near', 'h']);
    expect(hits[0].inside).toBe(true);
  });

  it('compte la zone d’un plot qui contient le point', () => {
    const zone = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [2.299, 48.859],
          [2.302, 48.859],
          [2.302, 48.861],
          [2.299, 48.861],
          [2.299, 48.859],
        ] as Array<[number, number]>,
      ],
    };
    const withPlot = { ...data, plots: [plot('p', { zoneGeometry: zone })] };
    expect(nearby(withPlot, [2.3, 48.86], 50).find((hit) => hit.id === 'p')?.inside).toBe(true);
  });

  it('trace un cercle au bon rayon', () => {
    const ring = circlePolygon([2.3, 48.86], 500);
    expect(distanceM([2.3, 48.86], ring[7])).toBeCloseTo(500, -1);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
});
