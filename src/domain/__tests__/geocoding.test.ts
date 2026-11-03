import { describe, expect, it } from 'vitest';
import { createBanGeocoder } from '../geocoding';

const feature = (label: string, coordinates: [number, number]) => ({ geometry: { coordinates }, properties: { label, type: 'street', context: '92' } });

describe('recherche d’adresses', () => {
  it('interroge la BAN et écarte les homonymes hors de la zone', async () => {
    let requested = '';
    const fake = (async (url: string) => {
      requested = url;
      return new Response(
        JSON.stringify({ features: [feature('Rue de la Paix, Boulogne-sur-Mer', [1.611, 50.729]), feature('Rue de la Paix, Boulogne-Billancourt', [2.2358, 48.842])] }),
      );
    }) as typeof fetch;
    const hits = await createBanGeocoder(fake, 'https://example.test')('rue de la paix boulogne');
    expect(requested).toContain('/search/?q=rue%20de%20la%20paix%20boulogne');
    expect(hits.map((hit) => hit.label)).toEqual(['Rue de la Paix, Boulogne-Billancourt']);
  });

  it('n’appelle pas le service pour une saisie trop courte', async () => {
    const fake = (async () => {
      throw new Error('ne devrait pas être appelé');
    }) as typeof fetch;
    expect(await createBanGeocoder(fake)('bar')).toEqual([]);
  });
});
