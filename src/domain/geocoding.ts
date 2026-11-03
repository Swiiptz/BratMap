import { distanceM, type Coordinate } from './geometry';

/** Recherche d'adresses réelles (CDC §14) via la Base Adresse Nationale (api-adresse.data.gouv.fr). */
export type AddressHit = { label: string; context: string; coordinate: Coordinate; type: string };

const ZONE_CENTER: Coordinate = [2.27, 48.86];
const MAX_DISTANCE_M = 25_000;

export function createBanGeocoder(fetcher: typeof fetch = (...args) => fetch(...args), baseUrl = 'https://api-adresse.data.gouv.fr') {
  return async function searchAddresses(query: string, limit = 5): Promise<AddressHit[]> {
    const text = query.trim();
    if (text.length < 4) return [];
    const url = `${baseUrl}/search/?q=${encodeURIComponent(text)}&limit=15&lat=${ZONE_CENTER[1]}&lon=${ZONE_CENTER[0]}`;
    const response = await fetcher(url);
    if (!response.ok) throw new Error('Recherche d’adresse indisponible.');
    const body = (await response.json()) as {
      features?: Array<{ geometry: { coordinates: Coordinate }; properties: { label: string; context?: string; type: string; city?: string } }>;
    };
    // On ne garde que la zone de jeu et ses abords, du plus proche au plus loin.
    return (body.features ?? [])
      .map((feature) => ({
        label: feature.properties.label,
        context: feature.properties.context ?? feature.properties.city ?? '',
        coordinate: feature.geometry.coordinates,
        type: feature.properties.type,
      }))
      .filter((hit) => distanceM(hit.coordinate, ZONE_CENTER) <= MAX_DISTANCE_M)
      .slice(0, limit);
  };
}
