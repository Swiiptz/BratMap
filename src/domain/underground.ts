import type { PolygonGeometry } from './geo';
import { distanceM, lineLengthM, pointInPolygon, type Coordinate } from './geometry';
import type { Exposure, Passability, UndergroundAccess, UndergroundLevel, UndergroundSegment } from './models';

export const undergroundLevels: UndergroundLevel[] = [0, -1, -2, -3];
export const levelNames: Record<UndergroundLevel, string> = { 0: 'Surface', [-1]: 'Peu profond', [-2]: 'Intermédiaire', [-3]: 'Profond' };
/** Profondeurs indicatives de chaque niveau (repères pour la saisie, pas une mesure). */
export const levelDepths: Record<UndergroundLevel, string> = { 0: '0 m', [-1]: '0 à 10 m', [-2]: '10 à 25 m', [-3]: 'plus de 25 m' };
export const levelExamples: Record<UndergroundLevel, string> = {
  0: 'Bouches, entrées, rez-de-chaussée',
  [-1]: 'Couloirs, parkings, métro sous chaussée, égouts, rivières couvertes',
  [-2]: 'Métro profond, RER, carrières, grands ouvrages',
  [-3]: 'RER E, Grand Paris Express, carrières profondes',
};
export const levelOptions = undergroundLevels.map((level) => ({ id: String(level), name: `${level} · ${levelNames[level]} (${levelDepths[level]})` }));

export const undergroundKnowledgeLevels = [
  { id: 'supposed', name: 'Supposé' },
  { id: 'spotted', name: 'Repéré' },
  { id: 'confirmed', name: 'Confirmé' },
  { id: 'partial', name: 'Partiellement exploré' },
  { id: 'mapped', name: 'Entièrement cartographié' },
] as const;

export const undergroundOrigins = [
  { id: 'public', name: 'Infrastructure publique' },
  { id: 'chronicle', name: 'Ajout chronique' },
  { id: 'discovered', name: 'Découverte en jeu' },
] as const;

export const accessTypes = [
  { id: 'metro-entrance', name: 'Entrée de station' },
  { id: 'station', name: 'Station / gare' },
  { id: 'stairs', name: 'Escalier' },
  { id: 'shaft', name: 'Puits' },
  { id: 'cellar', name: 'Cave' },
  { id: 'parking', name: 'Parking' },
  { id: 'hatch', name: 'Trappe / regard' },
  { id: 'quarry', name: 'Ancienne carrière' },
  { id: 'bunker', name: 'Abri / bunker' },
  { id: 'chamber', name: 'Ouvrage / bassin souterrain' },
  { id: 'other', name: 'Autre' },
] as const;

export const segmentTypes = [
  { id: 'tunnel', name: 'Tunnel' },
  { id: 'gallery', name: 'Galerie' },
  { id: 'passage', name: 'Passage' },
  { id: 'rail', name: 'Voie ferrée / métro' },
  { id: 'corridor', name: 'Couloir de correspondance' },
  { id: 'quarry', name: 'Carrière' },
  { id: 'sewer', name: 'Collecteur' },
  { id: 'vertical', name: 'Connexion verticale' },
  { id: 'river', name: 'Rivière enterrée' },
  { id: 'aqueduct', name: 'Aqueduc' },
  { id: 'sewer', name: "Collecteur d'égout" },
] as const;

// --- Déplacement discret : praticabilité et exposition ---------------------------------------------------

export const passabilityOptions: Array<{ id: Passability; name: string; speedMPerMin: number; costFactor: number }> = [
  { id: 'upright', name: 'Debout', speedMPerMin: 70, costFactor: 1 },
  { id: 'stooped', name: 'Voûté / courbé', speedMPerMin: 40, costFactor: 1.6 },
  { id: 'crawl', name: 'En rampant', speedMPerMin: 15, costFactor: 4 },
  { id: 'unknown', name: 'Inconnu', speedMPerMin: 35, costFactor: 2 },
  { id: 'impassable', name: 'Impraticable', speedMPerMin: 0, costFactor: Infinity },
];
export const exposureOptions: Array<{ id: Exposure; name: string; costFactor: number }> = [
  { id: 'discreet', name: 'Discret', costFactor: 1 },
  { id: 'neutral', name: 'Neutre', costFactor: 1.8 },
  { id: 'exposed', name: 'Exposé', costFactor: 5 },
];

/** Valeurs par défaut par type : lignes et couloirs publics praticables mais exposés, égouts et carrières discrets. */
export function effectivePassability(segment: Pick<UndergroundSegment, 'passability' | 'type' | 'reference'>): Passability {
  if (segment.passability) return segment.passability;
  if (['rail', 'tunnel', 'corridor', 'vertical'].includes(segment.type)) return 'upright';
  if (['quarry', 'gallery', 'passage'].includes(segment.type)) return 'stooped';
  return 'unknown';
}

export function effectiveExposure(segment: Pick<UndergroundSegment, 'exposure' | 'type' | 'reference'>): Exposure {
  if (segment.exposure) return segment.exposure;
  if (['rail', 'tunnel', 'corridor'].includes(segment.type) || (segment.type === 'vertical' && segment.reference)) return 'exposed';
  if (['sewer', 'river', 'aqueduct', 'quarry', 'gallery', 'passage'].includes(segment.type)) return 'discreet';
  return 'neutral';
}

export const isSupposed = (segment: Pick<UndergroundSegment, 'knowledgeLevel'>) => segment.knowledgeLevel === 'supposed' || segment.knowledgeLevel === 'rumor';
export const isVertical = (segment: Pick<UndergroundSegment, 'level' | 'toLevel'>) =>
  segment.toLevel !== undefined && segment.toLevel !== null && segment.toLevel !== segment.level;
export const segmentLevels = (segment: Pick<UndergroundSegment, 'level' | 'toLevel'>): UndergroundLevel[] =>
  isVertical(segment) ? [segment.level, segment.toLevel as UndergroundLevel] : [segment.level];
export const newJunctionId = () => `j-${Math.random().toString(36).slice(2, 12)}`;

export type GraphNode = { id: string; coordinate: Coordinate; accessId?: string; levels: Set<UndergroundLevel> };
export type GraphEdge = {
  segmentId: string;
  from: string;
  to: string;
  fromLevel: UndergroundLevel;
  toLevel: UndergroundLevel;
  lengthM: number;
  levelChange: number;
  passability: Passability;
  exposure: Exposure;
};
export type UndergroundGraph = { nodes: Map<string, GraphNode>; edges: GraphEdge[]; adjacency: Map<string, GraphEdge[]> };

const validLine = (segment: UndergroundSegment) => segment.geometry?.type === 'LineString' && segment.geometry.coordinates.length >= 2;

/**
 * Graphe souterrain (CDC §11) : les nœuds sont les accès et les jonctions implicites partagées par les extrémités des segments.
 * Les liens « segments connectés » ne sont pas stockés : ils se déduisent des nœuds communs, ce qui évite toute dérive.
 */
export function buildUndergroundGraph(accesses: UndergroundAccess[], segments: UndergroundSegment[]): UndergroundGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const adjacency = new Map<string, GraphEdge[]>();
  const touch = (id: string, coordinate: Coordinate, level: UndergroundLevel, accessId?: string) => {
    const node = nodes.get(id) ?? { id, coordinate, accessId, levels: new Set<UndergroundLevel>() };
    node.levels.add(level);
    nodes.set(id, node);
  };

  accesses.forEach((access) => access.geometry?.coordinates && touch(access.id, access.geometry.coordinates, access.level, access.id));
  segments.filter(validLine).forEach((segment) => {
    const coordinates = segment.geometry.coordinates;
    const [startLevel, endLevel = startLevel] = segmentLevels(segment);
    touch(segment.startNodeId, coordinates[0], startLevel);
    touch(segment.endNodeId, coordinates[coordinates.length - 1], endLevel);
    const edge: GraphEdge = {
      segmentId: segment.id,
      from: segment.startNodeId,
      to: segment.endNodeId,
      fromLevel: startLevel,
      toLevel: endLevel,
      lengthM: lineLengthM(coordinates),
      levelChange: Math.abs(endLevel - startLevel),
      passability: effectivePassability(segment),
      exposure: effectiveExposure(segment),
    };
    edges.push(edge);
    for (const id of [edge.from, edge.to]) adjacency.set(id, [...(adjacency.get(id) ?? []), edge]);
  });
  return { nodes, edges, adjacency };
}

const otherEnd = (edge: GraphEdge, nodeId: string) => (edge.from === nodeId ? edge.to : edge.from);

export function segmentsAtNode(graph: UndergroundGraph, nodeId: string): string[] {
  return [...new Set((graph.adjacency.get(nodeId) ?? []).map((edge) => edge.segmentId))];
}

/** Segments partageant une extrémité avec le segment donné. */
export function connectedSegmentIds(graph: UndergroundGraph, segmentId: string): string[] {
  const edge = graph.edges.find((item) => item.segmentId === segmentId);
  if (!edge) return [];
  return [...new Set([...segmentsAtNode(graph, edge.from), ...segmentsAtNode(graph, edge.to)])].filter((id) => id !== segmentId);
}

/** Réseau connexe contenant un nœud ou un segment (focus « réseau »). */
export function networkOf(graph: UndergroundGraph, start: { nodeId: string } | { segmentId: string }) {
  const nodeIds = new Set<string>();
  const segmentIds = new Set<string>();
  const queue = 'nodeId' in start ? [start.nodeId] : graph.edges.filter((edge) => edge.segmentId === start.segmentId).flatMap((edge) => [edge.from, edge.to]);
  while (queue.length > 0) {
    const nodeId = queue.pop() as string;
    if (nodeIds.has(nodeId) || !graph.nodes.has(nodeId)) continue;
    nodeIds.add(nodeId);
    for (const edge of graph.adjacency.get(nodeId) ?? []) {
      segmentIds.add(edge.segmentId);
      queue.push(otherEnd(edge, nodeId));
    }
  }
  const accessIds = new Set([...nodeIds].map((id) => graph.nodes.get(id)?.accessId).filter((id): id is string => Boolean(id)));
  return { nodeIds, segmentIds, accessIds };
}

/** Pénalité d'un changement de niveau, en mètres équivalents : on préfère rester au même niveau à distance égale. */
export const LEVEL_CHANGE_COST_M = 40;

export type RouteMode = 'short' | 'discreet';
export type NarrativeRisk = 'faible' | 'moyen' | 'élevé' | 'très élevé';
export type UndergroundPath = {
  nodeIds: string[];
  segmentIds: string[];
  lengthM: number;
  durationMin: number;
  levels: UndergroundLevel[];
  accessIds: string[];
  risk: NarrativeRisk;
  exposedM: number;
  uncertainM: number;
};

const passability = new Map(passabilityOptions.map((option) => [option.id, option]));
const exposure = new Map(exposureOptions.map((option) => [option.id, option]));

/** Coût d'un tronçon : longueur × difficulté (× exposition en mode discret) + pénalité de changement de niveau. */
export function edgeCost(edge: GraphEdge, mode: RouteMode): number {
  const difficulty = passability.get(edge.passability)?.costFactor ?? 2;
  const visibility = mode === 'discreet' ? (exposure.get(edge.exposure)?.costFactor ?? 1.8) : 1;
  return edge.lengthM * difficulty * visibility + edge.levelChange * LEVEL_CHANGE_COST_M;
}

/** Risque narratif simple (CDC §12) : part du trajet exposée, et part dont la praticabilité est incertaine. */
export function narrativeRisk(lengthM: number, exposedM: number, uncertainM: number): NarrativeRisk {
  if (lengthM <= 0) return 'faible';
  const score = exposedM / lengthM + 0.35 * (uncertainM / lengthM);
  return score < 0.15 ? 'faible' : score < 0.4 ? 'moyen' : score < 0.7 ? 'élevé' : 'très élevé';
}

/** File de priorité minimale (tas binaire) pour Dijkstra sur plusieurs milliers de nœuds. */
class MinHeap {
  private items: Array<[number, string]> = [];
  get size() {
    return this.items.length;
  }
  push(item: [number, string]) {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent][0] <= items[i][0]) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop(): [number, string] | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0 && last) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < items.length && items[left][0] < items[smallest][0]) smallest = left;
        if (right < items.length && items[right][0] < items[smallest][0]) smallest = right;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

/**
 * Trajet souterrain (Dijkstra). Mode « short » : le plus rapide praticable ; mode « discreet » : évite les tronçons exposés.
 * Les tronçons impraticables ne sont jamais empruntés.
 */
export function shortestPath(graph: UndergroundGraph, from: string, to: string, mode: RouteMode = 'short'): UndergroundPath | undefined {
  if (!graph.nodes.has(from) || !graph.nodes.has(to)) return undefined;
  const cost = new Map<string, number>([[from, 0]]);
  const previous = new Map<string, GraphEdge>();
  const done = new Set<string>();
  const heap = new MinHeap();
  heap.push([0, from]);
  while (heap.size > 0) {
    const [currentCost, current] = heap.pop() as [number, string];
    if (done.has(current)) continue;
    if (current === to) break;
    done.add(current);
    for (const edge of graph.adjacency.get(current) ?? []) {
      if (edge.passability === 'impassable') continue;
      const next = otherEnd(edge, current);
      if (done.has(next)) continue;
      const candidate = currentCost + edgeCost(edge, mode);
      if (candidate < (cost.get(next) ?? Infinity)) {
        cost.set(next, candidate);
        previous.set(next, edge);
        heap.push([candidate, next]);
      }
    }
  }
  if (from !== to && !previous.has(to)) return undefined;

  const nodeIds = [to];
  const edges: GraphEdge[] = [];
  while (nodeIds[0] !== from) {
    const edge = previous.get(nodeIds[0]) as GraphEdge;
    edges.unshift(edge);
    nodeIds.unshift(otherEnd(edge, nodeIds[0]));
  }
  // Niveaux parcourus dans l'ordre, sans répétition consécutive.
  const levels: UndergroundLevel[] = [];
  const pushLevel = (level: UndergroundLevel) => levels[levels.length - 1] !== level && levels.push(level);
  if (edges.length === 0) [...(graph.nodes.get(from)?.levels ?? [])].forEach(pushLevel);
  edges.forEach((edge, index) => {
    const forward = edge.from === nodeIds[index];
    pushLevel(forward ? edge.fromLevel : edge.toLevel);
    pushLevel(forward ? edge.toLevel : edge.fromLevel);
  });
  const lengthM = edges.reduce((total, edge) => total + edge.lengthM, 0);
  const exposedM = edges.filter((edge) => edge.exposure === 'exposed').reduce((total, edge) => total + edge.lengthM, 0);
  const uncertainM = edges.filter((edge) => edge.passability === 'unknown').reduce((total, edge) => total + edge.lengthM, 0);
  const durationMin = edges.reduce((total, edge) => total + edge.lengthM / (passability.get(edge.passability)?.speedMPerMin || 35) + edge.levelChange * 0.5, 0);
  return {
    nodeIds,
    segmentIds: edges.map((edge) => edge.segmentId),
    lengthM,
    durationMin,
    levels,
    accessIds: nodeIds.map((id) => graph.nodes.get(id)?.accessId).filter((id): id is string => Boolean(id)),
    risk: narrativeRisk(lengthM, exposedM, uncertainM),
    exposedM,
    uncertainM,
  };
}

/** Accroche un clic au nœud le plus proche dans le rayon donné, en privilégiant les accès. */
export function resolveEndpoint(graph: UndergroundGraph, point: Coordinate, radiusM: number): GraphNode | undefined {
  let best: { node: GraphNode; score: number } | undefined;
  for (const node of graph.nodes.values()) {
    const distance = distanceM(point, node.coordinate);
    if (distance > radiusM) continue;
    const score = distance - (node.accessId ? radiusM / 2 : 0);
    if (!best || score < best.score) best = { node, score };
  }
  return best?.node;
}

/** Déplace un nœud : toutes les extrémités de segments qui y aboutissent suivent. */
export function moveNode(segments: UndergroundSegment[], nodeId: string, coordinate: Coordinate): Array<{ id: string; coordinates: Coordinate[] }> {
  return segments.filter(validLine).flatMap((segment) => {
    if (segment.startNodeId !== nodeId && segment.endNodeId !== nodeId) return [];
    const coordinates = [...segment.geometry.coordinates];
    if (segment.startNodeId === nodeId) coordinates[0] = coordinate;
    if (segment.endNodeId === nodeId) coordinates[coordinates.length - 1] = coordinate;
    return [{ id: segment.id, coordinates }];
  });
}

/** Souterrains d'un territoire : accès situés dans le polygone, segments qui le traversent (au moins un point dedans). */
export function undergroundWithin(polygon: PolygonGeometry | undefined, accesses: UndergroundAccess[], segments: UndergroundSegment[]) {
  if (polygon?.type !== 'Polygon' || !polygon.coordinates[0]?.length) return { accessIds: [] as string[], segmentIds: [] as string[] };
  return {
    accessIds: accesses.filter((access) => access.geometry?.coordinates && pointInPolygon(access.geometry.coordinates, polygon)).map((access) => access.id),
    segmentIds: segments
      .filter(validLine)
      .filter((segment) => segment.geometry.coordinates.some((point) => pointInPolygon(point, polygon)))
      .map((segment) => segment.id),
  };
}
