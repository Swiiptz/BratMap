import { describe, expect, it } from 'vitest';
import { decodeDocument, decodeGeometry, encodeDocument } from '../geometryCodec';

describe('codec géométrie Firestore', () => {
  const polygon = {
    type: 'Polygon' as const,
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ] as Array<[number, number]>,
    ],
  };

  it('sérialise les géométries imbriquées et laisse les points natifs', () => {
    expect(typeof encodeDocument({ geometry: polygon }).geometry).toBe('string');
    expect(encodeDocument({ geometry: { type: 'Point', coordinates: [1, 2] } }).geometry).toEqual({ type: 'Point', coordinates: [1, 2] });
  });

  it('fait un aller-retour sans perte', () => {
    expect(decodeDocument(encodeDocument({ id: 'x', geometry: polygon }))).toEqual({ id: 'x', geometry: polygon });
  });

  it('accepte l’ancien format à coordonnées sérialisées et rejette le reste', () => {
    expect(decodeGeometry({ type: 'LineString', coordinates: '[[0,0],[1,1]]' })).toEqual({
      type: 'LineString',
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    });
    expect(decodeGeometry('pas du json')).toBeUndefined();
    expect(decodeGeometry({ type: 'Circle', coordinates: [] })).toBeUndefined();
  });
});

describe('champs géométriques secondaires', () => {
  it('encode et décode aussi les champs suffixés Geometry', () => {
    const zone = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ] as Array<[number, number]>,
      ],
    };
    const encoded = encodeDocument({ name: 'Plot', zoneGeometry: zone, pingGeometry: { type: 'Point', coordinates: [1, 2] }, zoneGeometryLabel: 'x' });
    expect(typeof encoded.zoneGeometry).toBe('string');
    expect(encoded.pingGeometry).toEqual({ type: 'Point', coordinates: [1, 2] });
    expect(decodeDocument(encoded).zoneGeometry).toEqual(zone);
    expect(decodeDocument({ zoneGeometry: null }).zoneGeometry).toBeNull();
  });
});
