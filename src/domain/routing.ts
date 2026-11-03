import type { ChronicleData } from './chronicle';
import { distanceM, lineLengthM, pointInPolygon, type Coordinate } from './geometry';
import type { Territory } from './models';
import { buildUndergroundGraph, narrativeRisk, shortestPath, type NarrativeRisk, type UndergroundPath } from './underground';

export type TravelProfile = 'foot' | 'car';
export type RouteMode = 'fast' | 'discreet' | 'underground';
export type SurfaceRoute = { geometry: Coordinate[]; distanceM: number; durationMin: number };

/** Abstraction de moteur de routage (VTM_MAP_TECH.md) : brancher un autre fournisseur sans toucher à l'interface. */
export interface RoutingProvider {
  readonly label: string;
  route(points: Coordinate[], profile: TravelProfile): Promise<SurfaceRoute[]>;
}

/** Moteur OSRM (par défaut les serveurs FOSSGIS d'OpenStreetMap, usage raisonnable uniquement). */
export function createOsrmProvider(baseUrl = 'https://routing.openstreetmap.de', fetcher: typeof fetch = fetch): RoutingProvider {
  return {
    label: 'OSRM · OpenStreetMap',
    async route(points, profile) {
      const path = profile === 'car' ? 'routed-car/route/v1/driving' : 'routed-foot/route/v1/foot';
      const coordinates = points.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');
      const response = await fetcher(`${baseUrl}/${path}/${coordinates}?overview=full&geometries=geojson&alternatives=${points.length === 2 ? 'true' : 'false'}`);
      if (!response.ok) throw new Error(`Moteur de routage indisponible (${response.status}).`);
      const body = (await response.json()) as { code: string; routes?: Array<{ distance: number; duration: number; geometry: { coordinates: Coordinate[] } }> };
      if (body.code !== 'Ok' || !body.routes?.length) throw new Error('Aucun trajet trouvé.');
      return body.routes.map((route) => ({ geometry: route.geometry.coordinates, distanceM: route.distance, durationMin: route.duration / 60 }));
    },
  };
}

/** Repli hors ligne : ligne droite (vitesse de marche ou de voiture urbaine). */
export const straightLineProvider: RoutingProvider = {
  label: 'Ligne droite (hors ligne)',
  async route(points, profile) {
    const distance = lineLengthM(points);
    return [{ geometry: points, distanceM: distance, durationMin: distance / (profile === 'car' ? 400 : 75) }];
  },
};

// --- Analyse narrative d'un trajet ------------------------------------------------------------------------

export type TerritoryCrossing = { territoryId: string; name: string; distanceM: number; stance: Territory['stance']; traditions: Array<{ name: string; note?: string }> };
export type NearbyPlace = { collection: 'locations' | 'havens'; id: string; name: string; distanceM: number };
export type RouteAnalysis = { territories: TerritoryCrossing[]; dangers: NearbyPlace[]; places: NearbyPlace[]; hostileM: number; risk: NarrativeRisk };

const DANGER_RADIUS_M = 120;
const PLACE_RADIUS_M = 150;
const RISK_ORDER: NarrativeRisk[] = ['faible', 'moyen', 'élevé', 'très élevé'];
/** Poids d'un lieu dangereux longé, en mètres « exposés » équivalents. */
const DANGER_WEIGHT_M = 150;

/** Échantillonne une ligne tous les `step` mètres (milieux de tronçons, avec leur longueur). */
export function sampleLine(line: Coordinate[], step = 25): Array<{ point: Coordinate; lengthM: number }> {
  const samples: Array<{ point: Coordinate; lengthM: number }> = [];
  for (let i = 0; i < line.length - 1; i += 1) {
    const [a, b] = [line[i], line[i + 1]];
    const length = distanceM(a, b);
    const pieces = Math.max(1, Math.ceil(length / step));
    for (let k = 0; k < pieces; k += 1) {
      const t = (k + 0.5) / pieces;
      samples.push({ point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], lengthM: length / pieces });
    }
  }
  return samples;
}

/**
 * Lecture narrative d'un trajet de surface (CDC §12) : territoires traversés et distance dans chacun, Traditions actives,
 * lieux dangereux et lieux importants longés, risque simple. Uniquement à partir des données de la chronique.
 */
export function analyzeRoute(data: ChronicleData, line: Coordinate[], exposureFactor = 1): RouteAnalysis {
  const samples = sampleLine(line);
  const crossing = new Map<string, number>();
  for (const sample of samples)
    for (const territory of data.territories)
      if (territory.geometry?.type === 'Polygon' && pointInPolygon(sample.point, territory.geometry))
        crossing.set(territory.id, (crossing.get(territory.id) ?? 0) + sample.lengthM);

  const territories: TerritoryCrossing[] = [...crossing.entries()]
    .map(([territoryId, distance]) => {
      const territory = data.territories.find((item) => item.id === territoryId) as Territory;
      const traditions = territory.traditionRules
        .filter((rule) => rule.active)
        .map((rule) => ({ name: data.refs.traditions.find((item) => item.id === rule.traditionId)?.name ?? rule.traditionId, note: rule.note }));
      return { territoryId, name: territory.name, distanceM: distance, stance: territory.stance, traditions };
    })
    .sort((a, b) => b.distanceM - a.distanceM);

  const closest = (coordinates: Coordinate | undefined) => (coordinates ? Math.min(...samples.map((sample) => distanceM(sample.point, coordinates))) : Infinity);
  const isDanger = (item: { typeId: string; tags: string[] }) => item.typeId === 'danger' || item.tags.some((tag) => tag.toLowerCase() === 'danger');
  const dangers = data.locations
    .filter(isDanger)
    .map((item) => ({ collection: 'locations' as const, id: item.id, name: item.name, distanceM: closest(item.geometry?.coordinates) }))
    .filter((item) => item.distanceM <= DANGER_RADIUS_M);
  const places = [
    ...data.locations
      .filter((item) => !isDanger(item) && (item.importance ?? 0) >= 3)
      .map((item) => ({ collection: 'locations' as const, id: item.id, name: item.name, distanceM: closest(item.geometry?.coordinates) })),
    ...data.havens.map((item) => ({ collection: 'havens' as const, id: item.id, name: item.name, distanceM: closest(item.geometry?.coordinates) })),
  ]
    .filter((item) => item.distanceM <= PLACE_RADIUS_M)
    .sort((a, b) => a.distanceM - b.distanceM);

  const lengthM = lineLengthM(line);
  const hostileM = exposureFactor * territories.filter((item) => item.stance === 'hostile').reduce((total, item) => total + item.distanceM, 0);
  const exposedM = Math.min(lengthM, hostileM + dangers.length * DANGER_WEIGHT_M);
  // Plancher narratif : traverser un domaine hostile ou longer un danger n'est jamais « faible », quelle que soit la longueur du trajet.
  const floor: NarrativeRisk = hostileM > 1500 || dangers.length >= 3 ? 'élevé' : hostileM > 0 || dangers.length > 0 ? 'moyen' : 'faible';
  const proportional = narrativeRisk(lengthM, exposedM, 0);
  return { territories, dangers, places, hostileM, risk: RISK_ORDER.indexOf(proportional) >= RISK_ORDER.indexOf(floor) ? proportional : floor };
}

// --- Trajet souterrain combiné ----------------------------------------------------------------------------

export type NetworkPoint = { nodeId: string; coordinate: Coordinate; accessId?: string };
export type UndergroundPlan = { entry: NetworkPoint; exit: NetworkPoint; path: UndergroundPath; walkInM: number; walkOutM: number };
export type UndergroundPlanResult = { plan: UndergroundPlan } | { reason: 'no-access' | 'not-connected' };

/**
 * Choisit l'entrée et la sortie du réseau qui minimisent marche + trajet souterrain discret.
 * Points d'entrée : accès praticables, et — si `allowManholes` — jonctions du réseau discret praticable
 * (égouts, rivières enterrées), traitées comme des « regards supposés » (hypothèse narrative, pas un regard réel).
 */
export function planUnderground(data: ChronicleData, from: Coordinate, to: Coordinate, { searchM = 1500, candidates = 3, allowManholes = true } = {}): UndergroundPlanResult {
  const graph = buildUndergroundGraph(data.undergroundAccess, data.undergroundSegments);
  const usableEdge = (edge: { passability: string }) => edge.passability !== 'impassable' && edge.passability !== 'crawl';
  const points: NetworkPoint[] = [];
  for (const node of graph.nodes.values()) {
    const edges = graph.adjacency.get(node.id) ?? [];
    if (!edges.some(usableEdge)) continue;
    if (node.accessId) points.push({ nodeId: node.id, coordinate: node.coordinate, accessId: node.accessId });
    else if (allowManholes && edges.some((edge) => usableEdge(edge) && edge.exposure === 'discreet')) points.push({ nodeId: node.id, coordinate: node.coordinate });
  }
  // Réseaux connexes praticables : on ne cherche un trajet qu'entre une entrée et une sortie du même réseau.
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root) as string;
    parent.set(id, root);
    return root;
  };
  for (const edge of graph.edges) if (usableEdge(edge)) parent.set(find(edge.from), find(edge.to));

  const within = (point: Coordinate) =>
    points
      .map((item) => ({ item, distance: distanceM(point, item.coordinate), network: find(item.nodeId) }))
      .filter((entry) => entry.distance <= searchM)
      .sort((a, b) => a.distance - b.distance);
  const starts = within(from);
  const ends = within(to);
  if (starts.length === 0 || ends.length === 0) return { reason: 'no-access' };
  const endNetworks = new Set(ends.map((entry) => entry.network));
  const sharedNetworks = [...new Set(starts.map((entry) => entry.network))].filter((network) => endNetworks.has(network));

  const WALK_FACTOR = 1.3; // la marche réelle dépasse la ligne droite
  let best: (UndergroundPlan & { score: number }) | undefined;
  for (const network of sharedNetworks) {
    // Les plus proches entrées et sorties de ce réseau (quelques-unes, pour laisser jouer la discrétion).
    const entries = starts.filter((entry) => entry.network === network).slice(0, candidates);
    const exits = ends.filter((entry) => entry.network === network).slice(0, candidates);
    for (const entry of entries)
      for (const exit of exits) {
        if (entry.item.nodeId === exit.item.nodeId) continue;
        const path = shortestPath(graph, entry.item.nodeId, exit.item.nodeId, 'discreet');
        if (!path) continue;
        const score = (entry.distance + exit.distance) * WALK_FACTOR + path.durationMin * 75 + path.exposedM * 3;
        if (!best || score < best.score) best = { entry: entry.item, exit: exit.item, path, walkInM: entry.distance, walkOutM: exit.distance, score };
      }
  }
  if (!best) return { reason: 'not-connected' };
  const { score: _score, ...plan } = best;
  return { plan };
}

/** Géométrie continue d'un trajet souterrain (segments réorientés bout à bout). */
export function undergroundPathLine(data: ChronicleData, path: UndergroundPath): Coordinate[] {
  const line: Coordinate[] = [];
  path.segmentIds.forEach((segmentId, index) => {
    const segment = data.undergroundSegments.find((item) => item.id === segmentId);
    if (!segment) return;
    const forward = segment.startNodeId === path.nodeIds[index];
    const coordinates = forward ? segment.geometry.coordinates : [...segment.geometry.coordinates].reverse();
    line.push(...(line.length ? coordinates.slice(1) : coordinates));
  });
  return line;
}

// --- Itinéraires multimodaux et stationnement ---------------------------------------------------------------

/** En voiture, on est moins exposé qu'à pied dans un territoire hostile (on ne fait que passer). */
export const CAR_EXPOSURE_FACTOR = 0.4;

/** Fusionne l'analyse de plusieurs tronçons (voiture / à pied) en une lecture unique du trajet. */
export function analyzeLegs(data: ChronicleData, legs: Array<{ line: Coordinate[]; travel: TravelProfile }>): RouteAnalysis {
  const parts = legs.map((leg) => analyzeRoute(data, leg.line, leg.travel === 'car' ? CAR_EXPOSURE_FACTOR : 1));
  const territories = new Map<string, TerritoryCrossing>();
  for (const crossing of parts.flatMap((part) => part.territories)) {
    const current = territories.get(crossing.territoryId);
    territories.set(crossing.territoryId, current ? { ...current, distanceM: current.distanceM + crossing.distanceM } : crossing);
  }
  const unique = <T extends { id: string }>(items: T[]) => [...new Map(items.map((item) => [item.id, item])).values()];
  const dangers = unique(parts.flatMap((part) => part.dangers));
  const order: NarrativeRisk[] = ['faible', 'moyen', 'élevé', 'très élevé'];
  const worst = parts.reduce<NarrativeRisk>((risk, part) => (order.indexOf(part.risk) > order.indexOf(risk) ? part.risk : risk), 'faible');
  return {
    territories: [...territories.values()].sort((a, b) => b.distanceM - a.distanceM),
    dangers,
    places: unique(parts.flatMap((part) => part.places)).sort((a, b) => a.distanceM - b.distanceM),
    hostileM: parts.reduce((total, part) => total + part.hostileM, 0),
    risk: worst,
  };
}

export type ParkingSuggestion = { name: string; coordinate: Coordinate; walkM: number; reason: string; ref?: { collection: 'locations' | 'undergroundAccess'; id: string } };

const isHostileAt = (data: ChronicleData, point: Coordinate) =>
  data.territories.some((territory) => territory.stance === 'hostile' && territory.geometry?.type === 'Polygon' && pointInPolygon(point, territory.geometry));

/**
 * Stationnement stratégique avant la fin à pied : parkings connus (souterrains publics, lieux marqués « parking »)
 * à distance de marche de l'arrivée, en évitant de se garer dans un territoire hostile.
 */
export function suggestParking(data: ChronicleData, destination: Coordinate, maxWalkM = 1200, limit = 3): ParkingSuggestion[] {
  const candidates: ParkingSuggestion[] = [];
  for (const access of data.undergroundAccess)
    if (access.type === 'parking' && access.geometry?.coordinates)
      candidates.push({
        name: access.name,
        coordinate: access.geometry.coordinates,
        walkM: distanceM(destination, access.geometry.coordinates),
        reason: 'Parking souterrain',
        ref: { collection: 'undergroundAccess', id: access.id },
      });
  for (const location of data.locations) {
    const marked = location.typeId === 'parking' || location.tags.some((tag) => /parking|stationnement/i.test(tag)) || /parking/i.test(location.name);
    if (marked && location.geometry?.coordinates)
      candidates.push({
        name: location.name,
        coordinate: location.geometry.coordinates,
        walkM: distanceM(destination, location.geometry.coordinates),
        reason: 'Lieu de la chronique',
        ref: { collection: 'locations', id: location.id },
      });
  }
  return candidates
    .filter((candidate) => candidate.walkM <= maxWalkM && candidate.walkM >= 60)
    .map((candidate) => {
      const hostile = isHostileAt(data, candidate.coordinate);
      // Se garer en territoire hostile pèse lourd ; un lieu de la chronique est légèrement préféré (repéré, maîtrisé).
      const score = candidate.walkM + (hostile ? 2000 : 0) - (candidate.ref?.collection === 'locations' ? 150 : 0);
      return { candidate: { ...candidate, reason: hostile ? `${candidate.reason} · territoire hostile` : candidate.reason }, score };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((item) => item.candidate);
}
