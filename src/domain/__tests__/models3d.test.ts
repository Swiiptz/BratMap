import { describe, expect, it } from 'vitest';
import { distanceM, type Coordinate } from '../geometry';
import { buildModel, modelPresets, scaleRing, steppedRoof } from '../models3d';

const center: Coordinate = [2.3, 48.77];

describe('modèles 3D', () => {
  it('produit des volumes valides et empilés pour chaque modèle du catalogue', () => {
    for (const preset of modelPresets) {
      const parts = buildModel(center, { preset: preset.id, rotation: 30, ...preset.defaults });
      expect(parts.length).toBeGreaterThan(0);
      for (const part of parts) {
        expect(part.ring[0]).toEqual(part.ring[part.ring.length - 1]);
        expect(part.height).toBeGreaterThan(part.base);
      }
      expect(Math.max(...parts.map((part) => part.height))).toBeCloseTo(
        preset.id === 'immeuble' ? preset.defaults.height + 2.5 : preset.id === 'entrepot' ? preset.defaults.height + 3 : preset.defaults.height,
        5,
      );
    }
  });

  it('respecte les dimensions demandées en mètres', () => {
    const [wall] = buildModel(center, { preset: 'immeuble', width: 40, depth: 10, height: 20, rotation: 0 });
    expect(distanceM(wall.ring[0], wall.ring[1])).toBeCloseTo(40, 0);
    expect(distanceM(wall.ring[1], wall.ring[2])).toBeCloseTo(10, 0);
  });

  it('fait monter la toiture en gradins de plus en plus étroits', () => {
    const ring: Coordinate[] = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ];
    const roof = steppedRoof(ring, 10, 18, 4, 0.2);
    expect(roof.map((part) => [part.base, part.height])).toEqual([
      [10, 12],
      [12, 14],
      [14, 16],
      [16, 18],
    ]);
    expect(scaleRing(ring, 0.5)[0]).toEqual([0.5, 0.5]);
  });
});
