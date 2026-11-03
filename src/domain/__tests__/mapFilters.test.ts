import { describe, expect, it } from 'vitest';
import { activeFilterCount, applyFilters } from '../mapFilters';
import { chronicle, haven, location, plot, territory } from './fixtures';

const data = chronicle({
  locations: [
    location('bar', { typeId: 'place', knowledgeLevel: 'known', territoryId: 't1', plotIds: ['p1'] }),
    location('elysium', { typeId: 'elysium', knowledgeLevel: 'rumor', territoryId: 't2' }),
  ],
  havens: [haven('h1', { ownerCharacterIds: ['c1'], territoryId: 't1' }), haven('h2', { ownerCharacterIds: ['c2'], territoryId: 't2' })],
  territories: [
    territory('t1', { factionId: 'camarilla', ownerCharacterIds: ['c1'], traditionRules: [{ traditionId: 'hospitalite', active: true }] }),
    territory('t2', { factionId: 'anarchs', traditionRules: [{ traditionId: 'hospitalite', active: false }] }),
  ],
  plots: [plot('p1', { statusId: 'active', territoryIds: ['t1'] }), plot('p2', { statusId: 'paused' })],
});
const ids = (items: Array<{ id: string }>) => items.map((item) => item.id);

describe('filtres de carte', () => {
  it('ne touche à rien sans filtre', () => {
    expect(applyFilters(data, {})).toBe(data);
    expect(activeFilterCount({ factionId: 'x', origin: undefined })).toBe(1);
  });

  it('ne restreint que la famille concernée', () => {
    const result = applyFilters(data, { factionId: 'camarilla' });
    expect(ids(result.territories)).toEqual(['t1']);
    expect(ids(result.locations)).toEqual(['bar', 'elysium']);
  });

  it('combine les critères', () => {
    const result = applyFilters(data, { territoryId: 't1', knowledgeLevel: 'known', plotStatusId: 'active' });
    expect(ids(result.locations)).toEqual(['bar']);
    expect(ids(result.havens)).toEqual(['h1']);
    expect(ids(result.plots)).toEqual(['p1']);
    expect(ids(result.territories)).toEqual(['t1']);
  });

  it('filtre par Tradition active et par propriétaire', () => {
    expect(ids(applyFilters(data, { traditionId: 'hospitalite' }).territories)).toEqual(['t1']);
    expect(ids(applyFilters(data, { ownerId: 'c2' }).havens)).toEqual(['h2']);
  });

  it('restreint à ce qui est lié à un plot', () => {
    const result = applyFilters(data, { plotId: 'p1' });
    expect(ids(result.locations)).toEqual(['bar']);
    expect(ids(result.plots)).toEqual(['p1']);
    expect(ids(result.territories)).toEqual(['t1']);
  });
});
