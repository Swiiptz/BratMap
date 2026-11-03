import { describe, expect, it } from 'vitest';
import { mergeReference, parsePublicUnderground } from '../publicUnderground';

describe('référence souterraine publique', () => {
  it('restitue origine, source et marque de référence', () => {
    const { undergroundAccess, undergroundSegments } = parsePublicUnderground({
      accesses: [{ id: 'osm-n1', name: 'Châtelet', type: 'station', level: -1, osm: 'node/1', geometry: { type: 'Point', coordinates: [2.34, 48.86] } }],
      segments: [
        {
          id: 'osm-w2-0',
          type: 'rail',
          level: -1,
          knowledgeLevel: 'supposed',
          startNodeId: 'osm-n1',
          endNodeId: 'j-osm-3',
          osm: 'way/2',
          geometry: {
            type: 'LineString',
            coordinates: [
              [2.34, 48.86],
              [2.35, 48.86],
            ],
          },
        },
      ],
    });
    expect(undergroundAccess[0]).toMatchObject({ origin: 'public', knowledgeLevel: 'confirmed', reference: true, plotIds: [], source: { type: 'OSM', externalId: 'node/1' } });
    expect(undergroundSegments[0]).toMatchObject({ knowledgeLevel: 'supposed', connectedSegmentIds: [] });
  });

  it('laisse la version de chronique primer et masque les éléments à la corbeille', () => {
    const reference = [
      { id: 'a', name: 'public' },
      { id: 'b', name: 'public' },
      { id: 'c', name: 'public' },
    ];
    const merged = mergeReference(reference, [{ id: 'a', name: 'modifié' }], new Set(['b']));
    expect(merged).toEqual([
      { id: 'c', name: 'public' },
      { id: 'a', name: 'modifié' },
    ]);
  });
});
