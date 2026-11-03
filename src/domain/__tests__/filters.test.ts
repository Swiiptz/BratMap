import { describe, expect, it } from 'vitest';
import { filterCharacters } from '../filters';
import { character } from './fixtures';

describe('filtres personnages', () => {
  const characters = [
    character('a', { name: 'Anaïs', clanId: 'ventrue', factionId: 'camarilla', statusId: 'active', territoryIds: ['t1'] }),
    character('b', { name: 'Bastien', clanId: 'brujah', factionId: 'anarchs', statusId: 'dead', influences: [{ id: 'i', name: 'Dockers', domainId: 'pegre', level: 2 }] }),
    character('c', { name: 'Céleste', nickname: 'La Veuve', clanId: 'ventrue', factionId: 'anarchs', statusId: 'active' }),
  ];

  it('combine les filtres', () => {
    expect(filterCharacters(characters, '', { clanId: 'ventrue', factionId: 'anarchs' }).map((item) => item.id)).toEqual(['c']);
  });

  it('cherche dans le surnom sans accents', () => {
    expect(filterCharacters(characters, 'veuve', {}).map((item) => item.id)).toEqual(['c']);
    expect(filterCharacters(characters, 'anais', {}).map((item) => item.id)).toEqual(['a']);
  });

  it('filtre par territoire et domaine d’influence', () => {
    expect(filterCharacters(characters, '', { territoryId: 't1' }).map((item) => item.id)).toEqual(['a']);
    expect(filterCharacters(characters, '', { domainId: 'pegre' }).map((item) => item.id)).toEqual(['b']);
  });
});
