import { refName, type ChronicleData, type EntityRef } from './chronicle';
import { entityCollections, type EntityCollection } from './models';
import { normalizeText } from './text';
import { accessTypes } from './underground';

export type SearchHit = EntityRef & { name: string; detail?: string; score: number };
export type SearchGroup = { collection: EntityCollection; label: string; hits: SearchHit[] };

/**
 * Recherche globale (CDC §14) : nom, tags, adresse, et attributs liés (clan, faction, domaine d'influence,
 * propriétaire, territoire, plot). Résultats regroupés par catégorie, meilleurs scores d'abord.
 */
export function searchChronicle(data: ChronicleData, rawQuery: string, limitPerGroup = 6): SearchGroup[] {
  const query = normalizeText(rawQuery);
  if (query.length < 1) return [];
  const terms = query.split(' ');
  const characterName = (id: string) => data.characters.find((item) => item.id === id)?.name ?? '';
  const territoryName = (id?: string) => (id ? (data.territories.find((item) => item.id === id)?.name ?? '') : '');
  const plotNames = (ids: string[]) => ids.map((id) => data.plots.find((item) => item.id === id)?.name ?? '');

  const score = (name: string, extra: Array<string | undefined>) => {
    const normalizedName = normalizeText(name);
    const haystack = normalizeText([name, ...extra].filter(Boolean).join(' '));
    if (!terms.every((term) => haystack.includes(term))) return 0;
    if (normalizedName === query) return 100;
    if (normalizedName.startsWith(query)) return 80;
    if (normalizedName.includes(query)) return 60;
    return 30;
  };

  // `penalty` relègue les accès secondaires (bouches, parkings) derrière les stations de même nom.
  const candidates: Record<EntityCollection, Array<{ id: string; name: string; detail?: string; extra: Array<string | undefined>; penalty?: number }>> = {
    locations: data.locations.map((item) => ({
      id: item.id,
      name: item.name,
      detail: item.address,
      extra: [item.address, item.description, ...item.tags, territoryName(item.territoryId), ...plotNames(item.plotIds), refName(data, 'markerTypes', item.typeId)],
    })),
    havens: data.havens.map((item) => ({
      id: item.id,
      name: item.name,
      detail: item.address,
      extra: [
        item.address,
        ...item.tags,
        refName(data, 'coteries', item.ownerCoterieId),
        ...item.ownerCharacterIds.map(characterName),
        territoryName(item.territoryId),
        ...plotNames(item.plotIds),
      ],
    })),
    territories: data.territories.map((item) => ({
      id: item.id,
      name: item.name,
      detail: refName(data, 'factions', item.factionId),
      extra: [
        item.description,
        refName(data, 'factions', item.factionId),
        ...item.ownerCharacterIds.map(characterName),
        ...item.traditionRules.filter((rule) => rule.active).map((rule) => refName(data, 'traditions', rule.traditionId)),
      ],
    })),
    plots: data.plots.map((item) => ({ id: item.id, name: item.name, detail: refName(data, 'plotStatuses', item.statusId), extra: [item.description] })),
    characters: data.characters.map((item) => ({
      id: item.id,
      name: item.name,
      detail: [refName(data, 'clans', item.clanId), refName(data, 'factions', item.factionId)].filter(Boolean).join(' · '),
      extra: [
        item.nickname,
        refName(data, 'coteries', item.coterieId),
        refName(data, 'clans', item.clanId),
        refName(data, 'factions', item.factionId),
        ...item.influences.flatMap((influence) => [influence.name, refName(data, 'influenceDomains', influence.domainId)]),
        ...item.territoryIds.map(territoryName),
        ...plotNames(item.plotIds),
      ],
    })),
    undergroundAccess: data.undergroundAccess.map((item) => ({
      id: item.id,
      name: item.name,
      detail: `${accessTypes.find((type) => type.id === item.type)?.name ?? 'Accès'} · niveau ${item.level}`,
      extra: [item.type, item.notes, ...(item.transitLines ?? []).map((line) => line.name)],
      penalty: item.minor ? 25 : 0,
    })),
    undergroundSegments: data.undergroundSegments.map((item) => ({
      id: item.id,
      name: item.name ?? item.transitLines?.[0]?.name ?? item.type,
      detail: `Niveau ${item.level}`,
      extra: [item.type, ...(item.transitLines ?? []).map((line) => line.name)],
    })),
  };

  return (Object.keys(candidates) as EntityCollection[])
    .map((collection) => ({
      collection,
      label: entityCollections[collection],
      hits: candidates[collection]
        .map((candidate) => {
          const base = score(candidate.name, candidate.extra);
          return { collection, id: candidate.id, name: candidate.name, detail: candidate.detail, score: base > 0 ? Math.max(1, base - (candidate.penalty ?? 0)) : 0 };
        })
        .filter((hit) => hit.score > 0)
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'))
        .slice(0, limitPerGroup),
    }))
    .filter((group) => group.hits.length > 0);
}
