import { describe, expect, it } from 'vitest';
import { buildUndergroundGraph, connectedSegmentIds, moveNode, networkOf, resolveEndpoint, shortestPath } from '../underground';
import { access, segment } from './fixtures';

// A (surface) —escalier→ j1 (-1) —tunnel→ j2 (-1) —puits→ j3 (-3) ; tunnel isolé j8—j9
const accesses = [access('A', [2.3, 48.86]), access('B', [2.32, 48.86], { level: -1 })];
const segments = [
  segment(
    'stairs',
    'A',
    'j1',
    [
      [2.3, 48.86],
      [2.3001, 48.86],
    ],
    { level: 0, toLevel: -1, type: 'vertical' },
  ),
  segment('t1', 'j1', 'j2', [
    [2.3001, 48.86],
    [2.31, 48.86],
  ]),
  segment('t2', 'j2', 'B', [
    [2.31, 48.86],
    [2.32, 48.86],
  ]),
  segment(
    'shaft',
    'j2',
    'j3',
    [
      [2.31, 48.86],
      [2.3101, 48.86],
    ],
    { level: -1, toLevel: -3 },
  ),
  segment(
    'isolated',
    'j8',
    'j9',
    [
      [2.4, 48.9],
      [2.41, 48.9],
    ],
    { level: -2 },
  ),
];
const graph = buildUndergroundGraph(accesses, segments);

describe('graphe souterrain', () => {
  it('déduit les segments connectés par nœuds communs', () => {
    expect(connectedSegmentIds(graph, 't1').sort()).toEqual(['shaft', 'stairs', 't2']);
    expect(connectedSegmentIds(graph, 'isolated')).toEqual([]);
  });

  it('rattache les niveaux aux nœuds, y compris via une connexion verticale', () => {
    expect([...graph.nodes.get('j1')!.levels]).toEqual([-1]);
    expect([...graph.nodes.get('A')!.levels]).toEqual([0]);
    expect([...graph.nodes.get('j3')!.levels]).toEqual([-3]);
  });

  it('isole les réseaux connexes', () => {
    const network = networkOf(graph, { segmentId: 't1' });
    expect([...network.segmentIds].sort()).toEqual(['shaft', 'stairs', 't1', 't2']);
    expect([...network.accessIds].sort()).toEqual(['A', 'B']);
    expect(networkOf(graph, { nodeId: 'j8' }).segmentIds).toEqual(new Set(['isolated']));
  });

  it('trouve le plus court chemin et les niveaux traversés', () => {
    const path = shortestPath(graph, 'A', 'j3');
    expect(path?.segmentIds).toEqual(['stairs', 't1', 'shaft']);
    expect(path?.levels).toEqual([0, -1, -3]);
    expect(path?.accessIds).toEqual(['A']);
    expect(path!.lengthM).toBeGreaterThan(700);
  });

  it('parcourt un segment à rebours', () => {
    expect(shortestPath(graph, 'B', 'A')?.segmentIds).toEqual(['t2', 't1', 'stairs']);
  });

  it('renvoie undefined entre réseaux disjoints', () => {
    expect(shortestPath(graph, 'A', 'j9')).toBeUndefined();
  });

  it('accroche en priorité un accès proche', () => {
    // A et j1 sont à ~7 m l'un de l'autre : on clique plus près de j1 mais l'accès l'emporte.
    expect(resolveEndpoint(graph, [2.30008, 48.86], 15)?.id).toBe('A');
    expect(resolveEndpoint(graph, [2.35, 48.86], 15)).toBeUndefined();
  });

  it('déplace les extrémités rattachées à un nœud', () => {
    const updates = moveNode(segments, 'j2', [2.311, 48.861]);
    expect(updates.map((update) => update.id).sort()).toEqual(['shaft', 't1', 't2']);
    expect(updates.find((update) => update.id === 't1')!.coordinates.at(-1)).toEqual([2.311, 48.861]);
    expect(updates.find((update) => update.id === 't2')!.coordinates[0]).toEqual([2.311, 48.861]);
  });
});

describe('souterrains d’un territoire', () => {
  it('retient les accès dedans et les segments qui le traversent', async () => {
    const { undergroundWithin } = await import('../underground');
    const square = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [2.295, 48.855],
          [2.315, 48.855],
          [2.315, 48.865],
          [2.295, 48.865],
          [2.295, 48.855],
        ] as Array<[number, number]>,
      ],
    };
    const result = undergroundWithin(square, accesses, segments);
    expect(result.accessIds).toEqual(['A']);
    expect(result.segmentIds.sort()).toEqual(['shaft', 'stairs', 't1', 't2']);
    expect(undergroundWithin(undefined, accesses, segments)).toEqual({ accessIds: [], segmentIds: [] });
  });
});

describe('déplacement discret', () => {
  // Deux chemins de A vers B : un tunnel ferré direct (exposé) et un détour par les égouts (discret).
  const net = [
    segment(
      'rail',
      'A',
      'B',
      [
        [2.3, 48.86],
        [2.31, 48.86],
      ],
      { type: 'rail', reference: true },
    ),
    segment(
      'sewer-1',
      'A',
      'j',
      [
        [2.3, 48.86],
        [2.305, 48.862],
      ],
      { type: 'sewer', reference: true, passability: 'upright' },
    ),
    segment(
      'sewer-2',
      'j',
      'B',
      [
        [2.305, 48.862],
        [2.31, 48.86],
      ],
      { type: 'sewer', reference: true, passability: 'upright' },
    ),
  ];
  const nodes = [access('A', [2.3, 48.86]), access('B', [2.31, 48.86])];

  it('prend le plus court en mode rapide, et évite les tronçons exposés en mode discret', () => {
    const graph = buildUndergroundGraph(nodes, net);
    expect(shortestPath(graph, 'A', 'B', 'short')?.segmentIds).toEqual(['rail']);
    const discreet = shortestPath(graph, 'A', 'B', 'discreet');
    expect(discreet?.segmentIds).toEqual(['sewer-1', 'sewer-2']);
    expect(discreet?.risk).toBe('faible');
    expect(shortestPath(graph, 'A', 'B', 'short')?.risk).toBe('très élevé');
  });

  it('n’emprunte jamais un tronçon impraticable', () => {
    const blocked = net.map((item) => (item.id === 'sewer-2' ? { ...item, passability: 'impassable' as const } : item));
    const graph = buildUndergroundGraph(nodes, blocked);
    expect(shortestPath(graph, 'A', 'B', 'discreet')?.segmentIds).toEqual(['rail']);
    const isolated = buildUndergroundGraph(
      nodes,
      blocked.filter((item) => item.id !== 'rail'),
    );
    expect(shortestPath(isolated, 'A', 'B', 'discreet')).toBeUndefined();
  });

  it('applique des valeurs par défaut cohérentes selon le type', async () => {
    const { effectiveExposure, effectivePassability } = await import('../underground');
    expect(effectiveExposure({ type: 'rail', reference: true })).toBe('exposed');
    expect(effectiveExposure({ type: 'sewer', reference: true })).toBe('discreet');
    expect(effectivePassability({ type: 'sewer', reference: true })).toBe('unknown');
    expect(effectivePassability({ type: 'quarry' })).toBe('stooped');
    expect(effectivePassability({ type: 'sewer', passability: 'crawl' })).toBe('crawl');
  });
});
