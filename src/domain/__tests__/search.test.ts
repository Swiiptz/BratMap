import { describe, expect, it } from 'vitest';
import { searchChronicle } from '../search';
import { character, chronicle, location, territory } from './fixtures';

describe('recherche globale', () => {
  const data = chronicle({
    characters: [
      character('c1', { name: 'Hélène Marchetti', clanId: 'toreador', influences: [{ id: 'i', name: 'Galeries', domainId: 'culture', level: 3 }] }),
      character('c2', { name: 'Marc', clanId: 'nosferatu' }),
    ],
    locations: [location('l1', { name: 'Élysée du Palais', tags: ['neutre'] }), location('l2', { name: 'Marché aux puces', territoryId: 't1' })],
    territories: [territory('t1', { name: 'Saint-Ouen' })],
  });
  data.refs.clans = [
    { id: 'toreador', name: 'Toréador', active: true },
    { id: 'nosferatu', name: 'Nosferatu', active: true },
  ];
  data.refs.influenceDomains = [{ id: 'culture', name: 'Culture', active: true }];

  it('ignore les accents et regroupe par catégorie', () => {
    const groups = searchChronicle(data, 'elysee');
    expect(groups.map((group) => group.collection)).toEqual(['locations']);
    expect(groups[0].hits[0].id).toBe('l1');
  });

  it('trouve un personnage par clan ou domaine d’influence', () => {
    expect(searchChronicle(data, 'toreador')[0].hits.map((hit) => hit.id)).toEqual(['c1']);
    expect(searchChronicle(data, 'culture')[0].hits.map((hit) => hit.id)).toEqual(['c1']);
  });

  it('trouve un lieu par son territoire', () => {
    const groups = searchChronicle(data, 'saint-ouen');
    expect(groups.find((group) => group.collection === 'locations')?.hits.map((hit) => hit.id)).toEqual(['l2']);
  });

  it('classe la correspondance exacte en premier', () => {
    const characters = searchChronicle(data, 'marc').find((group) => group.collection === 'characters');
    expect(characters?.hits.map((hit) => hit.id)).toEqual(['c2', 'c1']);
  });
});
