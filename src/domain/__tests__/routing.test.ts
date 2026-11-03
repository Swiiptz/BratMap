import { describe, expect, it } from 'vitest';
import { analyzeRoute, createOsrmProvider, planUnderground, sampleLine, undergroundPathLine } from '../routing';
import { access, chronicle, location, segment, territory } from './fixtures';
import type { Coordinate } from '../geometry';

// Territoire carré autour de [2.30..2.31] × [48.855..48.865]
const square = (x0: number, x1: number): Array<[number, number]> => [
  [x0, 48.855],
  [x1, 48.855],
  [x1, 48.865],
  [x0, 48.865],
  [x0, 48.855],
];
const line: Coordinate[] = [
  [2.29, 48.86],
  [2.33, 48.86],
];

describe('analyse narrative d’un trajet', () => {
  it('échantillonne la ligne sans perdre de longueur', () => {
    const total = sampleLine(line).reduce((sum, sample) => sum + sample.lengthM, 0);
    expect(total).toBeCloseTo(2930, -1);
  });

  it('mesure la distance dans chaque territoire et liste les Traditions actives', () => {
    const data = chronicle({
      territories: [
        territory('hostile', {
          name: 'Domaine Sabbat',
          stance: 'hostile',
          geometry: { type: 'Polygon', coordinates: [square(2.3, 2.31)] },
          traditionRules: [{ traditionId: 'domaine', active: true, note: 'Se présenter' }],
        }),
      ],
    });
    data.refs.traditions = [{ id: 'domaine', name: 'Domaine', active: true }];
    const analysis = analyzeRoute(data, line);
    expect(analysis.territories[0].name).toBe('Domaine Sabbat');
    // 733 m réels ; l'échantillonnage tous les 25 m donne une précision de l'ordre du pas.
    expect(Math.abs(analysis.territories[0].distanceM - 733)).toBeLessThan(25);
    expect(analysis.territories[0].traditions).toEqual([{ name: 'Domaine', note: 'Se présenter' }]);
    expect(analysis.risk).toBe('moyen');
  });

  it('signale les lieux dangereux longés et monte le risque', () => {
    const data = chronicle({
      locations: [
        location('d1', { typeId: 'danger', geometry: { type: 'Point', coordinates: [2.31, 48.8605] } }),
        location('far', { typeId: 'danger', geometry: { type: 'Point', coordinates: [2.31, 48.87] } }),
      ],
    });
    const analysis = analyzeRoute(data, line);
    expect(analysis.dangers.map((item) => item.id)).toEqual(['d1']);
    expect(analysis.risk).toBe('moyen');
    expect(analyzeRoute(chronicle(), line).risk).toBe('faible');
  });
});

describe('plancher de risque', () => {
  it('un court passage en territoire hostile sur un long trajet reste au moins moyen', () => {
    const data = chronicle({ territories: [territory('h', { stance: 'hostile', geometry: { type: 'Polygon', coordinates: [square(2.3, 2.302)] } })] });
    const long: Coordinate[] = [
      [2.29, 48.86],
      [2.4, 48.86],
    ];
    expect(analyzeRoute(data, long).risk).toBe('moyen');
  });
});

describe('moteur de routage OSRM', () => {
  it('construit la requête et convertit les trajets', async () => {
    let requested = '';
    const fake = (async (url: string) => {
      requested = url;
      return new Response(
        JSON.stringify({
          code: 'Ok',
          routes: [
            {
              distance: 1200,
              duration: 900,
              geometry: {
                coordinates: [
                  [2.3, 48.86],
                  [2.31, 48.86],
                ],
              },
            },
          ],
        }),
      );
    }) as typeof fetch;
    const routes = await createOsrmProvider('https://example.test', fake).route(
      [
        [2.3, 48.86],
        [2.31, 48.86],
      ],
      'foot',
    );
    expect(requested).toContain('/routed-foot/route/v1/foot/2.300000,48.860000;2.310000,48.860000');
    expect(requested).toContain('alternatives=true');
    expect(routes).toEqual([
      {
        geometry: [
          [2.3, 48.86],
          [2.31, 48.86],
        ],
        distanceM: 1200,
        durationMin: 15,
      },
    ]);
  });
});

describe('trajet souterrain combiné', () => {
  const data = chronicle({
    undergroundAccess: [access('A', [2.3, 48.86]), access('B', [2.32, 48.86]), access('Z', [2.4, 48.9])],
    undergroundSegments: [
      segment(
        's1',
        'A',
        'j',
        [
          [2.3, 48.86],
          [2.31, 48.861],
        ],
        { passability: 'upright' },
      ),
      segment(
        's2',
        'B',
        'j',
        [
          [2.32, 48.86],
          [2.31, 48.861],
        ],
        { passability: 'upright' },
      ),
      segment(
        'iso',
        'Z',
        'k',
        [
          [2.4, 48.9],
          [2.401, 48.9],
        ],
        { passability: 'upright' },
      ),
    ],
  });

  it('choisit l’entrée et la sortie les plus proches reliées par le réseau', () => {
    const result = planUnderground(data, [2.299, 48.8601], [2.321, 48.8601], { allowManholes: false });
    if (!('plan' in result)) throw new Error('trajet attendu');
    expect(result.plan.entry.accessId).toBe('A');
    expect(result.plan.exit.accessId).toBe('B');
    expect(result.plan.path.segmentIds).toEqual(['s1', 's2']);
    // Le second segment est parcouru à rebours : la ligne reste continue.
    expect(undergroundPathLine(data, result.plan.path)).toEqual([
      [2.3, 48.86],
      [2.31, 48.861],
      [2.32, 48.86],
    ]);
  });

  it('distingue « rien à portée » et « rien de relié »', () => {
    expect(planUnderground(data, [2.0, 48.7], [2.321, 48.8601])).toEqual({ reason: 'no-access' });
    expect(planUnderground(data, [2.299, 48.8601], [2.4, 48.9], { allowManholes: false })).toEqual({ reason: 'not-connected' });
  });

  it('peut entrer par un regard supposé du réseau discret', () => {
    const sewers = chronicle({
      undergroundSegments: [
        segment(
          'e1',
          'j1',
          'j2',
          [
            [2.3, 48.86],
            [2.31, 48.86],
          ],
          { type: 'sewer', reference: true, passability: 'upright' },
        ),
      ],
    });
    const result = planUnderground(sewers, [2.2995, 48.8601], [2.3105, 48.8601]);
    if (!('plan' in result)) throw new Error('trajet attendu');
    expect(result.plan.entry.accessId).toBeUndefined();
    expect(result.plan.path.segmentIds).toEqual(['e1']);
    expect(planUnderground(sewers, [2.2995, 48.8601], [2.3105, 48.8601], { allowManholes: false })).toEqual({ reason: 'no-access' });
  });
});

describe('itinéraires multimodaux', () => {
  const hostileZone = territory('h', { stance: 'hostile', geometry: { type: 'Polygon', coordinates: [square(2.3, 2.31)] } });

  it('compte moins d’exposition en voiture qu’à pied dans un territoire hostile', async () => {
    const { analyzeLegs } = await import('../routing');
    const data = chronicle({ territories: [hostileZone] });
    const crossing: Coordinate[] = [
      [2.29, 48.86],
      [2.32, 48.86],
    ];
    const byCar = analyzeLegs(data, [{ line: crossing, travel: 'car' }]);
    const onFoot = analyzeLegs(data, [{ line: crossing, travel: 'foot' }]);
    expect(byCar.hostileM).toBeLessThan(onFoot.hostileM * 0.5);
    expect(byCar.territories[0].distanceM).toBeCloseTo(onFoot.territories[0].distanceM, 0);
  });

  it('propose un stationnement à distance de marche, hors territoire hostile de préférence', async () => {
    const { suggestParking } = await import('../routing');
    const data = chronicle({
      territories: [hostileZone],
      undergroundAccess: [
        access('in-hostile', [2.305, 48.86], { type: 'parking', name: 'Parking dans le domaine' }),
        access('outside', [2.312, 48.86], { type: 'parking', name: 'Parking voisin' }),
        access('far', [2.4, 48.9], { type: 'parking', name: 'Trop loin' }),
      ],
      locations: [location('ally-garage', { name: 'Garage allié', tags: ['parking'], geometry: { type: 'Point', coordinates: [2.3125, 48.8605] } })],
    });
    const suggestions = suggestParking(data, [2.3065, 48.86]);
    // Le garage allié (≈ 440 m, lieu connu de la chronique) passe devant le parking public (≈ 400 m).
    expect(suggestions.map((item) => item.name)).toEqual(['Garage allié', 'Parking voisin', 'Parking dans le domaine']);
    expect(suggestions[2].reason).toContain('hostile');
  });
});
