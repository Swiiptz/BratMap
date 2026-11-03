import { describe, expect, it } from 'vitest';
import { relatedEntities } from '../focus';
import { access, character, chronicle, haven, location, plot, segment, territory } from './fixtures';

describe('mode focus', () => {
  const data = chronicle({
    plots: [plot('p1', { characterIds: ['c1'], territoryIds: ['t1'] })],
    characters: [
      character('c1', { mainHavenId: 'h1', influences: [{ id: 'i', name: 'Police', domainId: 'police', level: 2, locationId: 'l2' }] }),
      character('c2', { plotIds: ['p1'] }),
    ],
    locations: [location('l1', { plotIds: ['p1'], territoryId: 't1' }), location('l2'), location('l3')],
    havens: [haven('h1', { ownerCharacterIds: ['c1'], territoryId: 't1' })],
    territories: [territory('t1')],
  });

  it('lit les liens d’un plot dans les deux sens', () => {
    const focus = relatedEntities(data, { collection: 'plots', id: 'p1' });
    expect([...focus.characters].sort()).toEqual(['c1', 'c2']);
    expect([...focus.locations]).toEqual(['l1']);
    expect([...focus.territories]).toEqual(['t1']);
    expect(focus.plots.has('p1')).toBe(true);
  });

  it('inclut havre, influences et propriétés d’un personnage', () => {
    const focus = relatedEntities(data, { collection: 'characters', id: 'c1' });
    expect(focus.havens.has('h1')).toBe(true);
    expect(focus.locations.has('l2')).toBe(true);
    expect(focus.plots.has('p1')).toBe(true);
    expect(focus.locations.has('l3')).toBe(false);
  });

  it('rassemble ce qui est rattaché à un territoire', () => {
    const focus = relatedEntities(data, { collection: 'territories', id: 't1' });
    expect(focus.locations.has('l1')).toBe(true);
    expect(focus.havens.has('h1')).toBe(true);
  });
});

describe('focus réseau souterrain', () => {
  it('inclut tout le réseau connexe et le lieu associé à l’accès', () => {
    const data = chronicle({
      locations: [location('cafe')],
      undergroundAccess: [access('A', [2.3, 48.86], { locationId: 'cafe' })],
      undergroundSegments: [
        segment('s1', 'A', 'j1', [
          [2.3, 48.86],
          [2.31, 48.86],
        ]),
        segment('s2', 'j1', 'j2', [
          [2.31, 48.86],
          [2.32, 48.86],
        ]),
        segment('far', 'j7', 'j8', [
          [2.4, 48.9],
          [2.41, 48.9],
        ]),
      ],
    });
    const focus = relatedEntities(data, { collection: 'undergroundSegments', id: 's2' });
    expect([...focus.undergroundSegments].sort()).toEqual(['s1', 's2']);
    expect([...focus.undergroundAccess]).toEqual(['A']);
    expect(focus.locations.has('cafe')).toBe(true);
  });
});
