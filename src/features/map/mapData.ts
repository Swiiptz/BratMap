import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import type { ChronicleData, EntityRef } from '../../domain/chronicle';
import type { FocusSet } from '../../domain/focus';
import { closeRing, ringCentroid, type Coordinate } from '../../domain/geometry';
import type { UndergroundLevel } from '../../domain/models';
import { buildUndergroundGraph, effectiveExposure, effectivePassability, isSupposed, isVertical, segmentLevels } from '../../domain/underground';
import { buildModel } from '../../domain/models3d';
import { resolveIcon } from '../../domain/icons';
import { effectiveOrders } from '../../domain/layering';
import mainZoneData from '../../assets/main-zone.json';

export type LayerKey = 'locations' | 'havens' | 'territories' | 'plots' | 'underground' | 'undergroundAccess' | 'sewers' | 'landmarks' | 'realPois';
export type LevelFilter = UndergroundLevel | 'all';
/** Filtre de déplacement : tout, seulement l'exploitable (ni impraticable ni « en rampant »), ou exploitable et discret. */
export type TravelFilter = 'all' | 'passable' | 'discreet';
export type LayerVisibility = 'visible' | 'dimmed' | 'hidden';
export type LayerState = Record<LayerKey, LayerVisibility>;

export const defaultLayers: LayerState = {
  locations: 'visible',
  havens: 'visible',
  territories: 'visible',
  plots: 'visible',
  underground: 'visible',
  undergroundAccess: 'visible',
  sewers: 'visible',
  landmarks: 'visible',
  realPois: 'visible',
};

/** Couleur par niveau : du cyan de surface au violet profond, complétée par l'épaisseur et le motif (pas la couleur seule). */
export const levelColors: Record<UndergroundLevel, string> = { 0: '#9fd9e8', [-1]: '#70a8d8', [-2]: '#8c8ff0', [-3]: '#c07ee0' };

/**
 * Hiérarchie visuelle du réseau : les ajouts de chronique dominent, puis les grandes lignes publiques,
 * puis les tunnels routiers et cours d'eau, enfin les petits passages (couleur neutre pour ne pas brouiller la lecture).
 */
export type UndergroundCategory = 'chronicle' | 'major' | 'road' | 'water' | 'minor' | 'sewer';
export const categoryStyles: Record<UndergroundCategory, { label: string; color?: string; width: number; glow: number }> = {
  chronicle: { label: 'Ajouts de la chronique', width: 3, glow: 0.45 },
  major: { label: 'Métro, RER, train', width: 2, glow: 0.12 },
  road: { label: 'Tunnels routiers', color: '#a39577', width: 1.5, glow: 0 },
  water: { label: 'Rivières et aqueducs enterrés', color: '#4fc1a6', width: 1.8, glow: 0.1 },
  minor: { label: 'Petits passages publics', color: '#7d93a0', width: 1, glow: 0 },
  sewer: { label: 'Égouts (Département)', color: '#a07c4a', width: 0.9, glow: 0 },
};
export const SEWER_COLOR = '#a07c4a';
const accessColors: Record<string, string> = { quarry: '#c9a36b', bunker: '#b39a9a', chamber: SEWER_COLOR };

export function segmentCategory(segment: { reference?: boolean; type: string }): UndergroundCategory {
  if (!segment.reference) return 'chronicle';
  if (segment.type === 'rail') return 'major';
  if (segment.type === 'tunnel') return 'road';
  if (segment.type === 'river' || segment.type === 'aqueduct') return 'water';
  if (segment.type === 'sewer') return 'sewer';
  return 'minor';
}

/** Mise en avant du niveau sélectionné, niveaux adjacents atténués, autres presque effacés (CDC design §Souterrains). */
export function levelEmphasis(levels: UndergroundLevel[], selected: LevelFilter): number {
  if (selected === 'all') return 1;
  const gap = Math.min(...levels.map((level) => Math.abs(level - selected)));
  return gap === 0 ? 1 : gap === 1 ? 0.5 : 0.25;
}

export type MapFeatures = {
  points: FeatureCollection<Point>;
  territories: FeatureCollection<Polygon>;
  plotZones: FeatureCollection<Polygon>;
  territoryLabels: FeatureCollection<Point>;
  underground: FeatureCollection<LineString>;
  undergroundAccess: FeatureCollection<Point>;
  undergroundNodes: FeatureCollection<Point>;
  models3d: FeatureCollection<Polygon>;
  /** Repères 3D existants rattachés à un lieu de la chronique. */
  linkedLandmarks: Record<string, string>;
};

/** `undergroundView` : vue Souterrain active (réseau mis en avant, niveau choisi). Sinon le réseau reste discret sous la surface. */
type BuildOptions = {
  layers: LayerState;
  focus?: FocusSet;
  editMode: boolean;
  editingId?: string;
  undergroundView?: boolean;
  undergroundLevel?: LevelFilter;
  travelFilter?: TravelFilter;
  pathSegmentIds?: Set<string>;
  undergroundWidth?: number;
};

const featureCollection = <G extends Point | Polygon | LineString>(features: Array<Feature<G>>): FeatureCollection<G> => ({ type: 'FeatureCollection', features });
const isValidPoint = (coordinates: unknown): coordinates is Coordinate =>
  Array.isArray(coordinates) && coordinates.length >= 2 && coordinates.every((value) => typeof value === 'number');

/**
 * Transforme la chronique en GeoJSON prêt pour MapLibre. Le mode focus et les couches masquées
 * filtrent les données elles-mêmes : le clustering et les compteurs restent ainsi cohérents.
 */
export function buildMapFeatures(
  data: ChronicleData,
  {
    layers,
    focus,
    editMode,
    editingId,
    undergroundView = false,
    undergroundLevel: selectedLevel = 'all',
    travelFilter = 'all',
    pathSegmentIds,
    undergroundWidth = 1,
  }: BuildOptions,
): MapFeatures {
  const undergroundLevel: LevelFilter = undergroundView ? selectedLevel : 'all';
  const undergroundFactor = undergroundView ? 1 : 0.45;
  const inFocus = (ref: EntityRef) => !focus || focus[ref.collection].has(ref.id);
  const markerType = (typeId: string) => data.refs.markerTypes.find((type) => type.id === typeId);

  const points: Array<Feature<Point>> = [];
  if (layers.locations !== 'hidden')
    data.locations.forEach((item) => {
      if (!isValidPoint(item.geometry?.coordinates) || !inFocus({ collection: 'locations', id: item.id })) return;
      const type = markerType(item.typeId);
      points.push({
        type: 'Feature',
        id: `locations/${item.id}`,
        geometry: item.geometry,
        properties: {
          ref: `locations/${item.id}`,
          kind: 'location',
          shape: 'round',
          icon: resolveIcon(item.markerStyle?.icon ?? type?.icon, 'diamond'),
          name: item.name,
          typeName: type?.name ?? 'Lieu',
          color: item.markerStyle?.color || type?.color || '#87c6b2',
          size: item.markerStyle?.size || 6,
          importance: item.importance ?? 0,
          dimmed: layers.locations === 'dimmed',
        },
      });
    });
  if (layers.havens !== 'hidden')
    data.havens.forEach((item) => {
      if (!isValidPoint(item.geometry?.coordinates) || !inFocus({ collection: 'havens', id: item.id })) return;
      points.push({
        type: 'Feature',
        id: `havens/${item.id}`,
        geometry: item.geometry,
        properties: {
          ref: `havens/${item.id}`,
          kind: 'haven',
          shape: 'square',
          icon: resolveIcon(item.markerStyle?.icon, 'house'),
          name: item.name,
          typeName: 'Havre',
          color: item.markerStyle?.color || '#dba866',
          size: item.markerStyle?.size || 7,
          importance: 3,
          dimmed: layers.havens === 'dimmed',
        },
      });
    });

  // Plots : ping (losange) et zone, à la couleur de leur statut.
  const plotZones: Array<Feature<Polygon>> = [];
  const plotOrders = effectiveOrders(data.plots);
  const territoryOrders = effectiveOrders(data.territories);
  if (layers.plots !== 'hidden')
    data.plots.forEach((plot) => {
      if (!inFocus({ collection: 'plots', id: plot.id }) || (plot.statusId === 'completed' && !focus)) return;
      const status = data.refs.plotStatuses.find((item) => item.id === plot.statusId);
      const color = status?.color ?? '#9dd7c4';
      const dimmed = layers.plots === 'dimmed';
      if (plot.zoneGeometry?.type === 'Polygon' && plot.zoneGeometry.coordinates[0]?.length && plot.id !== editingId)
        plotZones.push({
          type: 'Feature',
          id: `plots/${plot.id}`,
          geometry: { type: 'Polygon', coordinates: plot.zoneGeometry.coordinates.map(closeRing) },
          properties: { ref: `plots/${plot.id}`, kind: 'plot', name: plot.name, typeName: `Plot · ${status?.name ?? ''}`, color, dimmed, order: plotOrders.get(plot.id) ?? 0 },
        });
      if (isValidPoint(plot.pingGeometry?.coordinates))
        points.push({
          type: 'Feature',
          id: `plots/${plot.id}`,
          geometry: plot.pingGeometry as Point,
          properties: {
            ref: `plots/${plot.id}`,
            kind: 'plot',
            shape: 'diamond',
            icon: 'star',
            name: plot.name,
            typeName: `Plot · ${status?.name ?? ''}`,
            color,
            size: 7,
            importance: plot.importance ?? 2,
            dimmed,
          },
        });
    });

  const territories: Array<Feature<Polygon>> = [];
  const territoryLabels: Array<Feature<Point>> = [];
  if (layers.territories !== 'hidden')
    data.territories.forEach((item) => {
      if (item.geometry?.type !== 'Polygon' || !item.geometry.coordinates[0]?.length) return;
      if (item.id === editingId || !inFocus({ collection: 'territories', id: item.id })) return;
      if (item.hidden && !editMode) return;
      const dimmed = layers.territories === 'dimmed' || Boolean(item.hidden);
      const style = item.style ?? { fillColor: '#dba866', strokeColor: '#f0c687', opacity: 0.18, outlineOnly: false };
      const properties = {
        ref: `territories/${item.id}`,
        kind: 'territory',
        order: territoryOrders.get(item.id) ?? 0,
        name: item.name,
        fillColor: style.fillColor,
        strokeColor: style.strokeColor,
        fillOpacity: style.outlineOnly ? 0 : style.opacity * (dimmed ? 0.35 : 1),
        lineOpacity: dimmed ? 0.35 : 0.95,
      };
      territories.push({ type: 'Feature', id: `territories/${item.id}`, geometry: { type: 'Polygon', coordinates: item.geometry.coordinates.map(closeRing) }, properties });
      territoryLabels.push({ type: 'Feature', geometry: { type: 'Point', coordinates: ringCentroid(item.geometry.coordinates[0]) }, properties });
    });

  const underground: Array<Feature<LineString>> = [];
  if (layers.underground !== 'hidden')
    data.undergroundSegments.forEach((item) => {
      if (item.geometry?.type !== 'LineString' || item.geometry.coordinates.length < 2 || item.id === editingId || !inFocus({ collection: 'undergroundSegments', id: item.id }))
        return;
      // Réseau public importé : réservé à la vue Souterrain (ou au focus) pour ne pas charger la surface.
      if (item.reference && !undergroundView && !focus) return;
      // Les égouts ont leur propre interrupteur de couche.
      const layerState = item.type === 'sewer' ? layers.sewers : layers.underground;
      if (layerState === 'hidden') return;
      const passability = effectivePassability(item);
      const exposure = effectiveExposure(item);
      // Non exploitable pour se déplacer : impraticable ou seulement en rampant.
      if (travelFilter !== 'all' && (passability === 'impassable' || passability === 'crawl')) return;
      // Impraticable : estompé ; en filtre « Discret », les tronçons exposés s'effacent au profit des passages sûrs.
      const travelFactor =
        passability === 'impassable' ? 0.3 : undergroundView && travelFilter === 'discreet' ? (exposure === 'exposed' ? 0.12 : exposure === 'neutral' ? 0.6 : 1) : 1;
      const emphasis = levelEmphasis(segmentLevels(item), undergroundLevel) * undergroundFactor * travelFactor * (layerState === 'dimmed' ? 0.35 : 1);
      const style = isVertical(item) ? 'vertical' : isSupposed(item) ? 'supposed' : 'solid';
      const category = segmentCategory(item);
      const look = categoryStyles[category];
      underground.push({
        type: 'Feature',
        id: `undergroundSegments/${item.id}`,
        geometry: item.geometry,
        properties: {
          ref: `undergroundSegments/${item.id}`,
          kind: 'underground',
          category,
          name: item.name || item.transitLines?.map((line) => line.name).join(' · ') || 'Segment',
          typeName: `${item.transitLines?.length && item.name ? `${item.transitLines.map((line) => line.name).join(', ')} · ` : ''}${look.label} · niveau ${segmentLevels(item).join(' → ')}`,
          color: look.color ?? levelColors[item.level] ?? levelColors[-1],
          emphasis,
          style,
          width: look.width * undergroundWidth,
          glow: look.glow,
          highlighted: Boolean(pathSegmentIds?.has(item.id)),
        },
      });
    });

  const undergroundAccess: Array<Feature<Point>> = [];
  if (layers.undergroundAccess !== 'hidden')
    data.undergroundAccess.forEach((item) => {
      if (!isValidPoint(item.geometry?.coordinates) || !inFocus({ collection: 'undergroundAccess', id: item.id })) return;
      if (item.reference && !undergroundView && !focus) return;
      const emphasis = levelEmphasis([item.level, 0], undergroundLevel) * Math.max(undergroundFactor, 0.7) * (layers.undergroundAccess === 'dimmed' ? 0.35 : 1);
      undergroundAccess.push({
        type: 'Feature',
        id: `undergroundAccess/${item.id}`,
        geometry: item.geometry,
        properties: {
          ref: `undergroundAccess/${item.id}`,
          kind: 'access',
          minor: Boolean(item.minor),
          name: item.name,
          typeName: `${item.transitLines?.length ? `${item.transitLines.map((line) => line.name).join(', ')} · ` : ''}${item.state ? `${item.state} · ` : ''}niveau ${item.level}`,
          color: accessColors[item.type] ?? (item.minor ? categoryStyles.minor.color : levelColors[item.level]) ?? levelColors[-1],
          emphasis,
          levelLabel: String(item.level),
        },
      });
    });

  // Jonctions affichées en édition pour faciliter l'accrochage des nouveaux segments.
  const undergroundNodes: Array<Feature<Point>> = [];
  if (editMode && undergroundView && layers.underground !== 'hidden')
    for (const node of buildUndergroundGraph(data.undergroundAccess, data.undergroundSegments).nodes.values())
      if (!node.accessId)
        undergroundNodes.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: node.coordinate },
          properties: { emphasis: levelEmphasis([...node.levels], undergroundLevel) },
        });

  // Maquettes 3D posées sur les lieux et havres (facultatives).
  const models3d: Array<Feature<Polygon>> = [];
  const linkedLandmarks: Record<string, string> = {};
  for (const [collection, items, layer] of [
    ['locations', data.locations, layers.locations],
    ['havens', data.havens, layers.havens],
  ] as const) {
    if (layer === 'hidden') continue;
    for (const item of items) {
      if (!inFocus({ collection, id: item.id })) continue;
      if (item.landmarkKey) linkedLandmarks[item.landmarkKey] = `${collection}/${item.id}`;
      if (!item.model3d || !isValidPoint(item.geometry?.coordinates)) continue;
      for (const part of buildModel(item.geometry.coordinates, item.model3d))
        models3d.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [part.ring] },
          properties: {
            ref: `${collection}/${item.id}`,
            kind: 'model',
            name: item.name,
            role: part.role,
            base: part.base,
            height: part.height,
            color: item.markerStyle?.color ?? '#87c6b2',
          },
        });
    }
  }

  return {
    models3d: featureCollection(models3d),
    linkedLandmarks,
    points: featureCollection(points),
    territories: featureCollection(territories),
    plotZones: featureCollection(plotZones),
    territoryLabels: featureCollection(territoryLabels),
    underground: featureCollection(underground),
    undergroundAccess: featureCollection(undergroundAccess),
    undergroundNodes: featureCollection(undergroundNodes),
  };
}

export function parseFeatureRef(value: unknown): EntityRef | undefined {
  if (typeof value !== 'string') return undefined;
  const [collection, id] = value.split('/');
  return collection && id ? ({ collection, id } as EntityRef) : undefined;
}

/** Emprise de la zone jouable (92, Saint-Denis, Saint-Ouen ; Paris est hors zone) : cadrage initial et bouton « recentrer ». */
export const mainZoneBounds: [Coordinate, Coordinate] = [
  [2.146, 48.729],
  [2.398, 48.974],
];
/** Repères 3D : emprises OSM (ODbL) des tours ≥ 90 m et monuments, générées hors ligne. */
// URL absolue : MapLibre charge les sources GeoJSON dans un worker, où une URL relative ne se résout pas.
export const LANDMARKS_URL = new URL(`${import.meta.env.BASE_URL}geo/landmarks.geojson`, window.location.href).href;

type ZoneFeature = Feature<Polygon, { kind: 'zone' | 'department' | 'commune'; name: string }>;

/**
 * Contours de la zone (communes IGN : union du 92, de Saint-Denis et de Saint-Ouen, Paris marqué « hors zone »).
 * Intégrés au bundle plutôt que chargés à part : pas d'état intermédiaire ni d'échec réseau possible.
 */
export const mainZone = mainZoneData as unknown as FeatureCollection<Polygon>;

/** Masque hors zone (CDC §2) : le monde moins la zone principale. */
export function zoneMask(zone: FeatureCollection<Polygon> = mainZone): FeatureCollection<Polygon> {
  const world: Coordinate[] = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ];
  const ring = (zone.features as ZoneFeature[]).find((feature) => feature.properties?.kind === 'zone')?.geometry.coordinates[0];
  return featureCollection([{ type: 'Feature', geometry: { type: 'Polygon', coordinates: ring ? [world, ring as Coordinate[]] : [world] }, properties: {} }]);
}
