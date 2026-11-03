import type { Character } from './models';
import { normalizeText } from './text';

export type CharacterFilters = { clanId?: string; factionId?: string; statusId?: string; territoryId?: string; domainId?: string };

/** Filtres combinables de la liste des personnages (CDC §9). */
export function filterCharacters(characters: Character[], query: string, filters: CharacterFilters): Character[] {
  const normalized = normalizeText(query);
  return characters.filter(
    (character) =>
      (!normalized || normalizeText(`${character.name} ${character.nickname ?? ''}`).includes(normalized)) &&
      (!filters.clanId || character.clanId === filters.clanId) &&
      (!filters.factionId || character.factionId === filters.factionId) &&
      (!filters.statusId || character.statusId === filters.statusId) &&
      (!filters.territoryId || character.territoryIds.includes(filters.territoryId)) &&
      (!filters.domainId || character.influences.some((influence) => influence.domainId === filters.domainId)),
  );
}
