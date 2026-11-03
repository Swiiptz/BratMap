import { useEffect, useRef } from 'react';
import maplibregl, { type GeoJSONSource, type MapLayerMouseEvent, type MapMouseEvent } from 'maplibre-gl';
import type { FeatureCollection, Geometry } from 'geojson';
import type { EntityRef } from '../../domain/chronicle';
import { closeRing, formatArea, formatDistance, lineLengthM, midpoints, ringAreaM2, ringCentroid, translateRing, type Coordinate } from '../../domain/geometry';
import { insertShapeVertex, moveShapeVertex, removeShapeVertex, type EditShape } from './editShape';
import { registerPingImages } from './pingImages';
import { labelMinZoom, type LabelDensity } from '../../domain/appConfig';
import { LANDMARKS_URL, mainZone, mainZoneBounds, parseFeatureRef, zoneMask, type LayerVisibility, type MapFeatures } from './mapData';

export type MapTool = 'idle' | 'place' | 'draw' | 'area' | 'line' | 'measure';
/** Outils qui tracent un polygone (fermeture sur le premier sommet, aperçu rempli). */
const isPolygonTool = (tool: MapTool) => tool === 'draw' || tool === 'area';
export type FlyTarget = { token: number; center?: Coordinate; zoom?: number; bounds?: [Coordinate, Coordinate] };
/** Impulsion visuelle à l'apparition d'un nouvel élément. */
export type Pulse = { token: number; coordinate: Coordinate; color: string };
export type LandmarkHit = { key: string; name?: string; coordinate: Coordinate };

type Props = {
  features: MapFeatures;
  selected?: EntityRef;
  /** Sélection multiple (Maj+clic, Maj+glisser). */
  multiSelected: EntityRef[];
  realPois: LayerVisibility;
  landmarks: LayerVisibility;
  /** Vue inclinée pour les repères 3D. */
  tilt: boolean;
  /** Ordre des groupes de zones : zones de plots au-dessus des territoires (sinon en dessous). */
  plotsAboveTerritories: boolean;
  fadeIntensity: number;
  labelDensity: LabelDensity;
  editMode: boolean;
  tool: MapTool;
  draft: Coordinate[];
  editShape?: EditShape;
  veil: number;
  tempMarker?: Coordinate;
  flyTarget?: FlyTarget;
  pulse?: Pulse;
  /** Itinéraire calculé (variantes, tronçons surface / souterrain) et ses points A, étapes, B. */
  route?: FeatureCollection;
  routePoints?: Coordinate[];
  /** Cercle de recherche « Autour d'ici ». */
  proximityCircle?: Coordinate[];
  /** Surface mesurée affichée après la mesure. */
  measuredArea?: Coordinate[];
  onViewChange?: (center: Coordinate, zoom: number) => void;
  onEditShape: (shape: EditShape) => void;
  onSelect: (ref: EntityRef | undefined) => void;
  /** `toggle` : Maj+clic sur un élément ; `add` : rectangle de sélection. */
  onMultiSelect: (refs: EntityRef[], mode: 'toggle' | 'add') => void;
  /** `metersPerPixel` permet d'accrocher les clics à une distance indépendante du zoom. */
  onMapClick: (point: Coordinate, metersPerPixel: number) => void;
  onDoubleClick: () => void;
  onContextMenu: (point: Coordinate, screen: { x: number; y: number }) => void;
  onPointMove: (ref: EntityRef, point: Coordinate) => void;
  onLandmarkClick: (landmark: LandmarkHit) => void;
  /** Le fond de carte n'a pas pu être chargé : fond uni de secours. */
  onBasemapError?: () => void;
};

const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
/** Fond de secours si CARTO est injoignable : uni, mais la zone, les territoires et les pings restent affichés. */
const OFFLINE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0e1419' } }],
};
/** Couleurs d'habillage de la carte (les couleurs de la chronique restent celles choisies). */
const palette = { fade: '#080b0e', halo: '#0a0f14', label: '#dbe6e9', casing: '#05080b', zoneHalo: '#0a0f14' };
const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };
const INTERACTIVE_LAYERS = ['points-unclustered', 'underground-access', 'underground-access-minor', 'underground-hit', 'models-3d', 'plot-zone-fill', 'territory-fill'];
const HOVER_LAYERS = [...INTERACTIVE_LAYERS, 'landmarks-3d'];
const DRAGGABLE: Record<string, string> = { 'points-unclustered': 'points', 'underground-access': 'underground-access', 'underground-access-minor': 'underground-access' };
const world: Coordinate[] = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
];
const lngLat = (event: MapMouseEvent): Coordinate => [event.lngLat.lng, event.lngLat.lat];
const lineFeature = (coordinates: Coordinate[], closed: boolean): FeatureCollection => ({
  type: 'FeatureCollection',
  features:
    coordinates.length > 1 ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: closed ? closeRing(coordinates) : coordinates } as Geometry, properties: {} }] : [],
});
const pointsFeature = (coordinates: Coordinate[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: coordinates.map((coordinate, index) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: coordinate }, properties: { label: String(index + 1) } })),
});

function installLayers(map: maplibregl.Map) {
  // Hors zone : masque sombre + bord flouté (fondu progressif, pas de coupure nette) ; contours discrets de la zone et du 92.
  map.addSource('fade', { type: 'geojson', data: zoneMask() });
  map.addSource('main-zone', { type: 'geojson', data: mainZone });
  map.addLayer({ id: 'fade', type: 'fill', source: 'fade', paint: { 'fill-color': palette.fade, 'fill-opacity': 0.6, 'fill-antialias': false } });
  map.addLayer({
    id: 'fade-edge',
    type: 'line',
    source: 'main-zone',
    filter: ['==', ['get', 'kind'], 'zone'],
    paint: {
      'line-color': palette.fade,
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 18, 14, 90],
      'line-blur': ['interpolate', ['linear'], ['zoom'], 9, 18, 14, 90],
      'line-opacity': 0.35,
    },
  });
  map.addLayer({
    id: 'zone-outline',
    type: 'line',
    source: 'main-zone',
    filter: ['==', ['get', 'kind'], 'zone'],
    paint: { 'line-color': '#bfe3d8', 'line-width': 1.2, 'line-opacity': 0.35 },
  });
  map.addLayer({
    id: 'forbidden-outline',
    type: 'line',
    source: 'main-zone',
    filter: ['==', ['get', 'kind'], 'forbidden'],
    paint: { 'line-color': '#c98f80', 'line-width': 1, 'line-dasharray': [1, 2], 'line-opacity': 0.4 },
  });
  map.addLayer({
    id: 'forbidden-label',
    type: 'symbol',
    source: 'main-zone',
    filter: ['==', ['get', 'kind'], 'forbidden'],
    maxzoom: 13,
    layout: { 'text-field': 'PARIS · HORS ZONE', 'text-size': 11, 'text-letter-spacing': 0.3, 'text-font': ['Montserrat SemiBold', 'Open Sans Bold', 'Noto Sans Regular'] },
    paint: { 'text-color': '#c98f80', 'text-opacity': 0.7, 'text-halo-color': palette.halo, 'text-halo-width': 1.5 },
  });
  map.addLayer({
    id: 'department-outline',
    type: 'line',
    source: 'main-zone',
    filter: ['==', ['get', 'kind'], 'department'],
    paint: { 'line-color': '#bfe3d8', 'line-width': 1, 'line-dasharray': [3, 3], 'line-opacity': 0.22 },
  });

  map.addSource('territories', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'territory-fill',
    type: 'fill',
    source: 'territories',
    layout: { 'fill-sort-key': ['get', 'order'] },
    paint: { 'fill-color': ['get', 'fillColor'], 'fill-opacity': ['get', 'fillOpacity'] },
  });
  map.addLayer({
    id: 'territory-line',
    type: 'line',
    source: 'territories',
    layout: { 'line-sort-key': ['get', 'order'] },
    paint: { 'line-color': ['get', 'strokeColor'], 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 15, 2.5], 'line-opacity': ['get', 'lineOpacity'] },
  });
  map.addLayer({
    id: 'territory-selected',
    type: 'line',
    source: 'territories',
    filter: ['==', ['get', 'ref'], ''],
    paint: { 'line-color': '#ffffff', 'line-width': 3, 'line-blur': 1.5 },
  });

  // Zones de plots : pointillés à la couleur du statut, remplissage très léger.
  map.addSource('plot-zones', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'plot-zone-fill',
    type: 'fill',
    source: 'plot-zones',
    layout: { 'fill-sort-key': ['get', 'order'] },
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['get', 'dimmed'], 0.04, 0.1] },
  });
  map.addLayer({
    id: 'plot-zone-line',
    type: 'line',
    source: 'plot-zones',
    layout: { 'line-sort-key': ['get', 'order'] },
    paint: { 'line-color': ['get', 'color'], 'line-width': 1.8, 'line-dasharray': [3, 2], 'line-opacity': ['case', ['get', 'dimmed'], 0.35, 0.9] },
  });
  map.addLayer({
    id: 'plot-zone-selected',
    type: 'line',
    source: 'plot-zones',
    filter: ['==', ['get', 'ref'], ''],
    paint: { 'line-color': '#ffffff', 'line-width': 3, 'line-blur': 1.5 },
  });

  // Voile sur la surface quand un niveau souterrain est mis en avant : la surface reste perceptible.
  map.addSource('underground-veil', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [world] }, properties: {} }] },
  });
  map.addLayer({ id: 'underground-veil', type: 'fill', source: 'underground-veil', paint: { 'fill-color': '#04070a', 'fill-opacity': 0 } });

  map.addSource('underground', { type: 'geojson', data: empty });
  const lineOpacity = (factor: number): maplibregl.ExpressionSpecification => ['*', ['get', 'emphasis'], factor];
  // Épaisseur proportionnelle au zoom : lisible en vue d'ensemble, fine en détail.
  const lineWidth = (extra = 0): maplibregl.ExpressionSpecification => [
    'interpolate',
    ['linear'],
    ['zoom'],
    10,
    ['+', ['*', ['get', 'width'], 0.9], extra],
    14,
    ['+', ['get', 'width'], extra],
    17,
    ['+', ['*', ['get', 'width'], 1.6], extra],
  ];
  map.addLayer({
    id: 'underground-glow',
    type: 'line',
    source: 'underground',
    layout: { 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': ['*', ['get', 'width'], 3.5], 'line-opacity': ['*', ['get', 'emphasis'], ['get', 'glow']], 'line-blur': 4 },
  });
  map.addLayer({
    id: 'underground-line',
    type: 'line',
    source: 'underground',
    filter: ['==', ['get', 'style'], 'solid'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': lineWidth(), 'line-opacity': lineOpacity(0.95) },
  });
  map.addLayer({
    id: 'underground-supposed',
    type: 'line',
    source: 'underground',
    filter: ['==', ['get', 'style'], 'supposed'],
    paint: { 'line-color': ['get', 'color'], 'line-width': lineWidth(), 'line-dasharray': [2, 2], 'line-opacity': lineOpacity(0.85) },
  });
  map.addLayer({
    id: 'underground-vertical',
    type: 'line',
    source: 'underground',
    filter: ['==', ['get', 'style'], 'vertical'],
    layout: { 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': lineWidth(2), 'line-dasharray': [0.1, 1.6], 'line-opacity': lineOpacity(1) },
  });
  map.addLayer({
    id: 'underground-path',
    type: 'line',
    source: 'underground',
    filter: ['get', 'highlighted'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#f4fbff', 'line-width': 5, 'line-opacity': 0.9, 'line-blur': 1 },
  });
  map.addLayer({
    id: 'underground-selected',
    type: 'line',
    source: 'underground',
    filter: ['==', ['get', 'ref'], ''],
    layout: { 'line-cap': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': ['+', ['get', 'width'], 3], 'line-opacity': 0.55, 'line-blur': 2 },
  });
  map.addLayer({ id: 'underground-hit', type: 'line', source: 'underground', paint: { 'line-color': '#000000', 'line-width': 14, 'line-opacity': 0 } });

  // Repères 3D : l'extrusion « pousse » entre z12.5 et z13.5 ; teinte froide pour les tours, pierre pour les monuments.
  map.addSource('landmarks', { type: 'geojson', data: LANDMARKS_URL, attribution: '© OpenStreetMap contributors' });
  const grow = (property: string): maplibregl.ExpressionSpecification => ['interpolate', ['linear'], ['zoom'], 12.5, 0, 13.5, ['get', property]];
  map.addLayer({
    id: 'landmarks-3d',
    type: 'fill-extrusion',
    source: 'landmarks',
    minzoom: 12.5,
    paint: {
      'fill-extrusion-color': [
        'case',
        ['==', ['get', 'role'], 'roof'],
        '#262b33',
        ['==', ['get', 'kind'], 'monument'],
        ['interpolate', ['linear'], ['get', 'height'], 10, '#56503f', 80, '#605846', 300, '#6e6552'],
        ['interpolate', ['linear'], ['get', 'height'], 90, '#1d252c', 160, '#26323b', 250, '#33434d'],
      ],
      'fill-extrusion-height': grow('height'),
      'fill-extrusion-base': grow('base'),
      'fill-extrusion-opacity': 0.92,
      'fill-extrusion-vertical-gradient': true,
    },
  });

  // Maquettes posées sur les lieux de la chronique : pierre chaude, toiture ardoise, accent à la couleur du lieu.
  map.addSource('models-3d', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'models-3d',
    type: 'fill-extrusion',
    source: 'models-3d',
    minzoom: 13,
    paint: {
      'fill-extrusion-color': ['match', ['get', 'role'], 'roof', '#353b47', 'accent', ['get', 'color'], '#6b6457'],
      'fill-extrusion-height': grow('height'),
      'fill-extrusion-base': grow('base'),
      'fill-extrusion-opacity': 0.95,
      'fill-extrusion-vertical-gradient': true,
    },
  });

  map.addSource('territory-labels', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'territory-labels',
    type: 'symbol',
    source: 'territory-labels',
    minzoom: 11,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10, 15, 13],
      'text-font': ['Montserrat Medium', 'Open Sans Regular'],
      'text-letter-spacing': 0.08,
      'text-transform': 'uppercase',
    },
    paint: { 'text-color': ['get', 'strokeColor'], 'text-halo-color': palette.zoneHalo, 'text-halo-width': 1.4, 'text-opacity': ['get', 'lineOpacity'] },
  });

  map.addSource('points', { type: 'geojson', data: empty, cluster: true, clusterRadius: 38, clusterMaxZoom: 14 });
  map.addLayer({
    id: 'points-cluster',
    type: 'circle',
    source: 'points',
    filter: ['has', 'point_count'],
    paint: { 'circle-color': '#1a2a2f', 'circle-stroke-color': '#87c6b2', 'circle-stroke-width': 1.2, 'circle-radius': ['step', ['get', 'point_count'], 13, 10, 17, 30, 22] },
  });
  map.addLayer({
    id: 'points-cluster-count',
    type: 'symbol',
    source: 'points',
    filter: ['has', 'point_count'],
    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 11, 'text-font': ['Montserrat Medium', 'Open Sans Bold'] },
    paint: { 'text-color': '#cfeee3' },
  });
  // Zone de clic et de glisser (invisible) sous le pictogramme.
  map.addLayer({
    id: 'points-unclustered',
    type: 'circle',
    source: 'points',
    filter: ['!', ['has', 'point_count']],
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, ['+', ['get', 'size'], 4], 16, ['+', ['get', 'size'], 8]], 'circle-color': '#000000', 'circle-opacity': 0 },
  });
  map.addLayer({
    id: 'points-selected',
    type: 'circle',
    source: 'points',
    filter: ['==', ['get', 'ref'], ''],
    paint: {
      'circle-radius': ['+', ['get', 'size'], 12],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.25,
      'circle-blur': 0.6,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.5,
    },
  });
  // Pictogramme du ping : pastille ronde (lieu) ou carrée (havre), icône et couleur au choix.
  map.addLayer({
    id: 'points-icons',
    type: 'symbol',
    source: 'points',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': ['concat', 'ping|', ['get', 'shape'], '|', ['get', 'icon'], '|', ['get', 'color']],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 10, ['*', ['get', 'size'], 0.085], 16, ['*', ['get', 'size'], 0.13]],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-opacity': ['case', ['get', 'dimmed'], 0.4, 1] },
  });
  map.addLayer({
    id: 'points-labels',
    type: 'symbol',
    source: 'points',
    filter: ['!', ['has', 'point_count']],
    minzoom: 13,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 11,
      'text-offset': [0, 1.5],
      'text-anchor': 'top',
      'text-font': ['Montserrat Medium', 'Open Sans Regular'],
      'text-optional': true,
    },
    paint: { 'text-color': palette.label, 'text-halo-color': palette.halo, 'text-halo-width': 1.3, 'text-opacity': ['case', ['get', 'dimmed'], 0.4, 1] },
  });

  map.addSource('underground-nodes', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'underground-nodes',
    type: 'circle',
    source: 'underground-nodes',
    minzoom: 15,
    paint: {
      'circle-radius': 3.5,
      'circle-color': '#0b1116',
      'circle-stroke-color': '#c9e6f2',
      'circle-stroke-width': 1.2,
      'circle-opacity': ['get', 'emphasis'],
      'circle-stroke-opacity': ['get', 'emphasis'],
    },
  });
  map.addSource('underground-access', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'access-selected',
    type: 'circle',
    source: 'underground-access',
    filter: ['==', ['get', 'ref'], ''],
    paint: { 'circle-radius': 13, 'circle-color': ['get', 'color'], 'circle-opacity': 0.25, 'circle-blur': 0.6, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 },
  });
  // Bouches et parkings : seulement à fort zoom pour garder la vue lisible.
  map.addLayer({
    id: 'underground-access-minor',
    type: 'circle',
    source: 'underground-access',
    minzoom: 15,
    filter: ['get', 'minor'],
    paint: {
      'circle-radius': 4,
      'circle-color': '#0b1116',
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-width': 1.6,
      'circle-opacity': ['get', 'emphasis'],
      'circle-stroke-opacity': ['get', 'emphasis'],
    },
  });
  map.addLayer({
    id: 'underground-access',
    type: 'circle',
    source: 'underground-access',
    filter: ['!', ['get', 'minor']],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 7],
      'circle-color': '#0b1116',
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-width': 2.5,
      'circle-opacity': ['get', 'emphasis'],
      'circle-stroke-opacity': ['get', 'emphasis'],
    },
  });
  map.addLayer({
    id: 'underground-access-core',
    type: 'circle',
    source: 'underground-access',
    filter: ['!', ['get', 'minor']],
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 16, 2.5], 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'emphasis'] },
  });
  map.addLayer({
    id: 'underground-access-labels',
    type: 'symbol',
    source: 'underground-access',
    minzoom: 14,
    filter: ['any', ['!', ['get', 'minor']], ['>=', ['zoom'], 17]],
    layout: {
      'text-field': ['concat', ['get', 'name'], '  ', ['get', 'levelLabel']],
      'text-size': 10,
      'text-offset': [0, 1.3],
      'text-anchor': 'top',
      'text-font': ['Montserrat Medium', 'Open Sans Regular'],
      'text-optional': true,
    },
    paint: { 'text-color': ['get', 'color'], 'text-halo-color': palette.zoneHalo, 'text-halo-width': 1.3, 'text-opacity': ['get', 'emphasis'] },
  });

  // Aperçu du tracé : remplissage provisoire, segment élastique jusqu'au curseur, halo d'accrochage.
  map.addSource('draft-preview', { type: 'geojson', data: empty });
  map.addLayer({ id: 'draft-fill', type: 'fill', source: 'draft-preview', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#be8ec6', 'fill-opacity': 0.2 } });
  map.addLayer({
    id: 'draft-rubber',
    type: 'line',
    source: 'draft-preview',
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: { 'line-color': '#ffffff', 'line-width': 1.5, 'line-opacity': 0.7, 'line-dasharray': [2, 2] },
  });
  map.addSource('snap-halo', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'snap-halo',
    type: 'circle',
    source: 'snap-halo',
    paint: { 'circle-radius': 12, 'circle-color': '#ffcf5c', 'circle-opacity': 0.18, 'circle-stroke-color': '#ffcf5c', 'circle-stroke-width': 2 },
  });
  map.addSource('route', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'route-alt',
    type: 'line',
    source: 'route',
    filter: ['!', ['get', 'selected']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#8fa3ab', 'line-width': 3, 'line-opacity': 0.45 },
  });
  map.addLayer({
    id: 'route-casing',
    type: 'line',
    source: 'route',
    filter: ['get', 'selected'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': palette.casing, 'line-width': 8, 'line-opacity': 0.8 },
  });
  // Tronçon en voiture : trait plein ambre ; à pied : pointillés clairs.
  map.addLayer({
    id: 'route-main',
    type: 'line',
    source: 'route',
    filter: ['all', ['get', 'selected'], ['==', ['get', 'kind'], 'surface'], ['==', ['get', 'travel'], 'car']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#f2b54a', 'line-width': 4.5 },
  });
  map.addLayer({
    id: 'route-main-foot',
    type: 'line',
    source: 'route',
    filter: ['all', ['get', 'selected'], ['==', ['get', 'kind'], 'surface'], ['!=', ['get', 'travel'], 'car']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#f6e3a8', 'line-width': 3.5, 'line-dasharray': [0.1, 1.8] },
  });
  map.addLayer({
    id: 'route-underground',
    type: 'line',
    source: 'route',
    filter: ['all', ['get', 'selected'], ['==', ['get', 'kind'], 'underground']],
    paint: { 'line-color': '#8cd3ff', 'line-width': 4, 'line-dasharray': [1.5, 1] },
  });
  map.addSource('route-points', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'route-points',
    type: 'circle',
    source: 'route-points',
    paint: {
      'circle-radius': 9,
      'circle-color': ['match', ['get', 'role'], 'start', '#87c6b2', 'end', '#e07a6f', '#f2d27a'],
      'circle-stroke-color': '#05080b',
      'circle-stroke-width': 2,
    },
  });
  map.addLayer({
    id: 'route-points-label',
    type: 'symbol',
    source: 'route-points',
    layout: { 'text-field': ['get', 'label'], 'text-size': 11, 'text-font': ['Montserrat SemiBold', 'Open Sans Bold', 'Noto Sans Regular'], 'text-allow-overlap': true },
    paint: { 'text-color': '#05080b' },
  });

  map.addSource('proximity', { type: 'geojson', data: empty });
  map.addLayer({ id: 'proximity-fill', type: 'fill', source: 'proximity', paint: { 'fill-color': '#ffcf5c', 'fill-opacity': 0.06 } });
  map.addLayer({ id: 'proximity-line', type: 'line', source: 'proximity', paint: { 'line-color': '#ffcf5c', 'line-width': 1.5, 'line-dasharray': [2, 2], 'line-opacity': 0.8 } });
  map.addSource('measured-area', { type: 'geojson', data: empty });
  map.addLayer({ id: 'measured-area-fill', type: 'fill', source: 'measured-area', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.1 } });
  map.addLayer({ id: 'measured-area-line', type: 'line', source: 'measured-area', paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-dasharray': [3, 1.5] } });
  map.addSource('draft-line', { type: 'geojson', data: empty });
  map.addLayer({ id: 'draft-line', type: 'line', source: 'draft-line', paint: { 'line-color': '#ffffff', 'line-width': 2.5, 'line-dasharray': [3, 1.5] } });
  map.addSource('draft-points', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'draft-points',
    type: 'circle',
    source: 'draft-points',
    paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-color': '#9de2ce', 'circle-stroke-width': 2 },
  });
  map.addSource('edit-ring', { type: 'geojson', data: empty });
  map.addLayer({ id: 'edit-ring-fill', type: 'fill', source: 'edit-ring', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.08 } });
  map.addLayer({ id: 'edit-ring-line', type: 'line', source: 'edit-ring', paint: { 'line-color': '#ffffff', 'line-width': 2 } });
}

function shapeFeature(shape: EditShape | undefined): FeatureCollection {
  if (!shape) return empty;
  if (shape.kind === 'line') return lineFeature(shape.coordinates, false);
  return {
    type: 'FeatureCollection',
    features: shape.coordinates.length > 3 ? [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [closeRing(shape.coordinates)] }, properties: {} }] : [],
  };
}

export function MapCanvas(props: Props) {
  const node = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const ready = useRef(false);
  const dragging = useRef<{ ref: EntityRef; source: string; point?: Coordinate } | null>(null);

  // Initialisation unique de la carte et des interactions ; les callbacks sont lus via `latest`.
  useEffect(() => {
    if (!node.current) return;
    const map = new maplibregl.Map({
      container: node.current,
      style: STYLE_URL,
      bounds: mainZoneBounds,
      fitBoundsOptions: { padding: window.innerWidth > 900 ? { top: 60, bottom: 40, left: 330, right: 60 } : 24 },
      minZoom: 9.5,
      maxZoom: 19,
      attributionControl: false,
      maxBounds: [
        [1.4, 48.4],
        [3.2, 49.3],
      ],
    });
    mapRef.current = map;
    // Accès de débogage en développement uniquement (console : window.__bratmap).
    if (import.meta.env.DEV) (window as unknown as { __bratmap?: maplibregl.Map }).__bratmap = map;
    map.doubleClickZoom.disable();
    // Maj+glisser sert à la sélection rectangulaire, pas au zoom.
    map.boxZoom.disable();
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    const hover = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'map-tooltip', offset: 12 });

    registerPingImages(map);
    // Fond de carte injoignable (coupure réseau, CDN en panne) : on bascule sur le fond uni plutôt que d'afficher une carte vide.
    let offline = false;
    const goOffline = () => {
      if (offline || ready.current) return;
      offline = true;
      map.once('style.load', onLoad);
      map.setStyle(OFFLINE_STYLE);
      latest.current.onBasemapError?.();
    };
    const offlineTimer = window.setTimeout(goOffline, 12_000);
    map.on('error', (event) => {
      if (!ready.current && !map.isStyleLoaded() && String(event.error?.message ?? '').includes('style.json')) goOffline();
    });
    function onLoad() {
      if (ready.current) return;
      window.clearTimeout(offlineTimer);
      map.setLight({ anchor: 'viewport', color: '#c9d6e2', intensity: 0.3, position: [1.4, 210, 40] });
      installLayers(map);
      // Attribution compacte repliée par défaut (consultable via le bouton ⓘ).
      map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      ready.current = true;
      map.fire('bratmap:ready');
    }
    // Dès que le style est prêt, sans attendre les tuiles (qui peuvent ne jamais arriver hors ligne).
    map.once('style.load', onLoad);

    const readout = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'draw-readout', offset: 18, anchor: 'left' });
    const toPixel = (coordinate: Coordinate) => map.project(coordinate as [number, number]);

    // Cible d'accrochage sous le curseur : premier sommet (fermer le territoire) ou nœud souterrain.
    const snapTarget = (pixel: { x: number; y: number }): { kind: 'close' | 'node'; coordinate: Coordinate } | undefined => {
      const { tool, draft, features } = latest.current;
      const near = (coordinate: Coordinate) => {
        const point = toPixel(coordinate);
        return Math.hypot(point.x - pixel.x, point.y - pixel.y) < 14;
      };
      if (isPolygonTool(tool) && draft.length >= 3 && near(draft[0])) return { kind: 'close', coordinate: draft[0] };
      if (tool !== 'line') return undefined;
      const nodes = [...features.undergroundAccess.features, ...features.undergroundNodes.features].map((feature) => feature.geometry.coordinates as Coordinate);
      const hit = nodes.find(near);
      return hit ? { kind: 'node', coordinate: hit } : undefined;
    };

    const updatePreview = (cursor: Coordinate | undefined, pixel?: { x: number; y: number }) => {
      const { tool, draft } = latest.current;
      const preview = map.getSource('draft-preview') as GeoJSONSource | undefined;
      const halo = map.getSource('snap-halo') as GeoJSONSource | undefined;
      if (!preview || !halo) return;
      if (tool === 'idle' || tool === 'place' || !cursor || !pixel) {
        preview.setData(empty);
        halo.setData(empty);
        readout.remove();
        return;
      }
      const target = snapTarget(pixel);
      const point = target?.coordinate ?? cursor;
      halo.setData(target ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: target.coordinate }, properties: {} }] } : empty);
      const features: FeatureCollection['features'] = [];
      if (draft.length > 0)
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: isPolygonTool(tool) && draft.length > 1 ? [draft[draft.length - 1], point, draft[0]] : [draft[draft.length - 1], point] },
          properties: {},
        });
      if (isPolygonTool(tool) && draft.length >= 2) features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [closeRing([...draft, point])] }, properties: {} });
      preview.setData({ type: 'FeatureCollection', features });

      let text = '';
      if (isPolygonTool(tool))
        text =
          target?.kind === 'close'
            ? `Cliquer pour fermer · ${formatArea(ringAreaM2([...draft]))}`
            : draft.length >= 2
              ? `${draft.length + 1} sommets · ${formatArea(ringAreaM2([...draft, point]))}`
              : 'Clique pour poser les sommets';
      else if (draft.length > 0) text = `${formatDistance(lineLengthM([...draft, point]))}${target?.kind === 'node' ? ' · raccordement' : ''}`;
      else text = tool === 'line' ? (target ? 'Partir de ce nœud' : 'Clique pour commencer le segment') : 'Clique pour commencer';
      readout.setLngLat(point).setText(text).addTo(map);
    };
    map.on('mousemove', (event) => {
      if (!dragging.current) updatePreview(lngLat(event), event.point);
    });
    map.on('mouseout', () => updatePreview(undefined));
    map.on('moveend', () => latest.current.onViewChange?.([map.getCenter().lng, map.getCenter().lat], map.getZoom()));
    map.on('bratmap:draft', () => updatePreview(undefined));

    // Sélection rectangulaire : Maj+glisser dessine un cadre, les éléments qu'il couvre rejoignent la sélection.
    let box: { start: maplibregl.Point; element: HTMLDivElement } | undefined;
    let suppressClick = false;
    const boxRect = (a: maplibregl.Point, b: maplibregl.Point) => ({ left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), right: Math.max(a.x, b.x), bottom: Math.max(a.y, b.y) });
    map.on('mousedown', (event) => {
      if (!event.originalEvent.shiftKey || event.originalEvent.button !== 0 || latest.current.tool !== 'idle') return;
      event.preventDefault();
      map.dragPan.disable();
      const element = document.createElement('div');
      element.className = 'map-select-box';
      map.getCanvasContainer().appendChild(element);
      box = { start: event.point, element };
    });
    map.on('mousemove', (event) => {
      if (!box) return;
      const r = boxRect(box.start, event.point);
      Object.assign(box.element.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.right - r.left}px`, height: `${r.bottom - r.top}px` });
    });
    map.on('mouseup', (event) => {
      if (!box) return;
      const r = boxRect(box.start, event.point);
      box.element.remove();
      box = undefined;
      map.dragPan.enable();
      if (r.right - r.left < 4 && r.bottom - r.top < 4) return;
      suppressClick = true;
      const refs = map
        .queryRenderedFeatures(
          [
            [r.left, r.top],
            [r.right, r.bottom],
          ],
          { layers: INTERACTIVE_LAYERS.filter((id) => map.getLayer(id) && id !== 'territory-fill' && id !== 'plot-zone-fill') },
        )
        .map((feature) => parseFeatureRef(feature.properties?.ref))
        .filter((ref): ref is EntityRef => Boolean(ref));
      const unique = [...new Map(refs.map((ref) => [`${ref.collection}/${ref.id}`, ref])).values()];
      if (unique.length > 0) latest.current.onMultiSelect(unique, 'add');
    });

    map.on('click', (event) => {
      const { tool, onMapClick, onSelect } = latest.current;
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      if (tool !== 'idle') {
        if (snapTarget(event.point)?.kind === 'close') return latest.current.onDoubleClick();
        const metersPerPixel = (40_075_016.7 * Math.cos((event.lngLat.lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
        return onMapClick(lngLat(event), metersPerPixel);
      }
      const clusters = map.queryRenderedFeatures(event.point, { layers: ['points-cluster'] });
      if (clusters.length > 0) {
        const clusterId = clusters[0].properties?.cluster_id as number;
        void (map.getSource('points') as GeoJSONSource).getClusterExpansionZoom(clusterId).then((zoom) => map.easeTo({ center: event.lngLat, zoom: zoom + 0.3, duration: 400 }));
        return;
      }
      const hits = map.queryRenderedFeatures(event.point, { layers: INTERACTIVE_LAYERS.filter((id) => map.getLayer(id)) });
      // Rang d'empilement visible : groupe (plots / territoires) puis ordre dans le groupe.
      const stackRank = (feature: maplibregl.MapGeoJSONFeature) =>
        ((feature.layer.id === 'plot-zone-fill') === latest.current.plotsAboveTerritories ? 1e6 : 0) + Number(feature.properties?.order ?? 0);
      // Zones superposées : un nouveau clic sur la zone déjà sélectionnée passe à celle du dessous.
      const zoneRefs = [
        ...new Set(
          hits
            .filter((feature) => feature.layer.id === 'territory-fill' || feature.layer.id === 'plot-zone-fill')
            .sort((a, b) => stackRank(b) - stackRank(a))
            .map((feature) => String(feature.properties?.ref)),
        ),
      ];
      const current = latest.current.selected ? `${latest.current.selected.collection}/${latest.current.selected.id}` : '';
      const nonZoneHit = hits.find((feature) => feature.layer.id !== 'territory-fill' && feature.layer.id !== 'plot-zone-fill');
      if (!nonZoneHit && zoneRefs.length > 1 && zoneRefs.includes(current)) return onSelect(parseFeatureRef(zoneRefs[(zoneRefs.indexOf(current) + 1) % zoneRefs.length]));
      const hit = nonZoneHit ?? hits.find((feature) => String(feature.properties?.ref) === zoneRefs[0]);
      if (event.originalEvent.shiftKey) {
        const ref = parseFeatureRef(hit?.properties?.ref);
        if (ref) latest.current.onMultiSelect([ref], 'toggle');
        return;
      }
      // Un bâtiment 3D existant est un point d'intérêt : on ouvre son lieu ou on propose de le créer.
      const landmark = !hit || hit.layer.id === 'territory-fill' ? map.queryRenderedFeatures(event.point, { layers: ['landmarks-3d'] })[0] : undefined;
      if (landmark?.properties?.key)
        return latest.current.onLandmarkClick({
          key: String(landmark.properties.key),
          name: landmark.properties.name ? String(landmark.properties.name) : undefined,
          coordinate: lngLat(event),
        });
      onSelect(parseFeatureRef(hit?.properties?.ref));
    });
    map.on('dblclick', (event) => {
      if (latest.current.tool === 'idle') map.easeTo({ center: event.lngLat, zoom: map.getZoom() + 1, duration: 300 });
      else latest.current.onDoubleClick();
    });
    map.on('contextmenu', (event) => {
      event.preventDefault();
      latest.current.onContextMenu(lngLat(event), { x: event.point.x, y: event.point.y });
    });

    // Infobulle courte au survol (CDC §18).
    const onHover = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || latest.current.tool !== 'idle' || dragging.current) return;
      const isLandmark = feature.layer.id === 'landmarks-3d';
      // Un repère 3D ne masque pas les éléments de chronique situés devant lui.
      if (isLandmark && map.queryRenderedFeatures(event.point, { layers: INTERACTIVE_LAYERS.filter((id) => map.getLayer(id) && id !== 'territory-fill') }).length > 0) return;
      map.getCanvas().style.cursor =
        isLandmark || feature.layer.id === 'models-3d' ? 'pointer' : latest.current.editMode && feature.properties?.kind !== 'territory' ? 'grab' : 'pointer';
      const properties = feature.properties ?? {};
      const linked = isLandmark && latest.current.features.linkedLandmarks[String(properties.key)];
      const subtitle = isLandmark
        ? `${linked ? 'Lieu de la chronique · ' : 'Cliquer pour en faire un lieu · '}${Math.round(Number(properties.height))} m${properties.estimated ? ' (estimée)' : ''}`
        : properties.typeName;
      const type = subtitle ? `<small>${subtitle}</small>` : '';
      const label = document.createElement('div');
      label.textContent = String(properties.name ?? (isLandmark ? 'Immeuble de grande hauteur' : ''));
      hover.setLngLat(event.lngLat).setHTML(`${label.innerHTML}${type}`).addTo(map);
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = '';
      hover.remove();
    };
    for (const layer of HOVER_LAYERS) {
      map.on('mousemove', layer, onHover);
      map.on('mouseleave', layer, onLeave);
    }

    // Déplacement des pings en mode édition, directement sur la source GeoJSON (pas de marqueurs DOM).
    for (const layer of Object.keys(DRAGGABLE))
      map.on('mousedown', layer, (event) => {
        if (!latest.current.editMode || latest.current.tool !== 'idle' || event.originalEvent.button !== 0 || event.originalEvent.shiftKey) return;
        const ref = parseFeatureRef(event.features?.[0]?.properties?.ref);
        if (!ref) return;
        event.preventDefault();
        dragging.current = { ref, source: DRAGGABLE[layer] };
        hover.remove();
        map.getCanvas().style.cursor = 'grabbing';
      });
    map.on('mousemove', (event) => {
      const drag = dragging.current;
      if (!drag) return;
      drag.point = lngLat(event);
      const points = drag.source === 'points' ? latest.current.features.points : latest.current.features.undergroundAccess;
      (map.getSource(drag.source) as GeoJSONSource).setData({
        ...points,
        features: points.features.map((feature) =>
          feature.properties?.ref === `${drag.ref.collection}/${drag.ref.id}` ? { ...feature, geometry: { type: 'Point', coordinates: drag.point! } } : feature,
        ),
      });
    });
    map.on('mouseup', () => {
      const drag = dragging.current;
      if (!drag) return;
      dragging.current = null;
      map.getCanvas().style.cursor = '';
      if (drag.point) latest.current.onPointMove(drag.ref, drag.point);
    });

    return () => {
      window.clearTimeout(offlineTimer);
      ready.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const whenReady = (callback: (map: maplibregl.Map) => void) => {
    const map = mapRef.current;
    if (!map) return;
    if (ready.current) callback(map);
    else map.once('bratmap:ready', () => callback(map));
  };

  const { features, selected, multiSelected, realPois, fadeIntensity, draft, tool, editShape, veil, tempMarker, flyTarget, editMode } = props;

  useEffect(() => {
    whenReady((map) => {
      (map.getSource('points') as GeoJSONSource).setData(features.points);
      (map.getSource('territories') as GeoJSONSource).setData(features.territories);
      (map.getSource('plot-zones') as GeoJSONSource).setData(features.plotZones);
      (map.getSource('territory-labels') as GeoJSONSource).setData(features.territoryLabels);
      (map.getSource('underground') as GeoJSONSource).setData(features.underground);
      (map.getSource('underground-access') as GeoJSONSource).setData(features.undergroundAccess);
      (map.getSource('underground-nodes') as GeoJSONSource).setData(features.undergroundNodes);
      (map.getSource('models-3d') as GeoJSONSource).setData(features.models3d);
      // Repères devenus lieux : teinte chaude pour les distinguer des bâtiments simplement décoratifs.
      const linkedKeys = Object.keys(features.linkedLandmarks);
      map.setPaintProperty('landmarks-3d', 'fill-extrusion-color', [
        'case',
        ['in', ['get', 'key'], ['literal', linkedKeys]],
        ['match', ['get', 'role'], 'roof', '#4a3a2a', '#8a6d48'],
        ['==', ['get', 'role'], 'roof'],
        '#262b33',
        ['==', ['get', 'kind'], 'monument'],
        ['interpolate', ['linear'], ['get', 'height'], 10, '#56503f', 80, '#605846', 300, '#6e6552'],
        ['interpolate', ['linear'], ['get', 'height'], 90, '#1d252c', 160, '#26323b', 250, '#33434d'],
      ]);
    });
  }, [features]);

  useEffect(() => {
    const refs = [...(selected ? [selected] : []), ...multiSelected].map((ref) => `${ref.collection}/${ref.id}`);
    const filter: maplibregl.FilterSpecification = ['in', ['get', 'ref'], ['literal', refs]];
    whenReady((map) => {
      for (const layer of ['points-selected', 'territory-selected', 'plot-zone-selected', 'underground-selected', 'access-selected']) map.setFilter(layer, filter);
    });
  }, [selected, multiSelected]);

  // POI réels du fond CARTO : masquage / atténuation sans toucher au reste du style.
  useEffect(() => {
    whenReady((map) => {
      for (const layer of map.getStyle().layers) {
        if (!layer.id.startsWith('poi')) continue;
        map.setLayoutProperty(layer.id, 'visibility', realPois === 'hidden' ? 'none' : 'visible');
        if (layer.type === 'symbol') map.setPaintProperty(layer.id, 'text-opacity', realPois === 'dimmed' ? 0.35 : 1);
      }
    });
  }, [realPois]);

  useEffect(() => {
    whenReady((map) => {
      // Hors zone : assombri et désaturé (gris-bleu opaque à ~60 %), avec un bord flouté pour éviter la coupure nette.
      map.setPaintProperty('fade', 'fill-opacity', Math.min(0.9, 0.25 + fadeIntensity * 0.75));
      map.setPaintProperty('fade-edge', 'line-opacity', Math.min(0.8, 0.15 + fadeIntensity * 0.6));
    });
  }, [fadeIntensity]);

  useEffect(() => {
    whenReady((map) => map.setPaintProperty('underground-veil', 'fill-opacity', veil));
  }, [veil]);

  const { labelDensity } = props;
  // Densité d'information partagée : seuils d'apparition des étiquettes.
  useEffect(() => {
    whenReady((map) => {
      const zooms = labelMinZoom[labelDensity];
      map.setLayerZoomRange('points-labels', zooms.points, 24);
      map.setLayerZoomRange('territory-labels', zooms.territories, 24);
      map.setLayerZoomRange('underground-access-labels', zooms.accesses, 24);
    });
  }, [labelDensity]);

  const { landmarks, tilt, plotsAboveTerritories, proximityCircle, measuredArea, route, routePoints } = props;
  useEffect(() => {
    whenReady((map) => {
      (map.getSource('route') as GeoJSONSource).setData(route ?? empty);
      const pointsData: FeatureCollection = {
        type: 'FeatureCollection',
        features: (routePoints ?? []).map((coordinate, index, all) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: coordinate },
          properties: {
            role: index === 0 ? 'start' : index === all.length - 1 && all.length > 1 ? 'end' : 'via',
            label: index === 0 ? 'A' : index === all.length - 1 && all.length > 1 ? 'B' : String(index),
          },
        })),
      };
      (map.getSource('route-points') as GeoJSONSource).setData(pointsData);
    });
  }, [route, routePoints]);
  useEffect(() => {
    const polygon = (ring: Coordinate[] | undefined): FeatureCollection => ({
      type: 'FeatureCollection',
      features: ring && ring.length > 3 ? [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [closeRing(ring)] }, properties: {} }] : [],
    });
    whenReady((map) => {
      (map.getSource('proximity') as GeoJSONSource).setData(polygon(proximityCircle));
      (map.getSource('measured-area') as GeoJSONSource).setData(polygon(measuredArea));
    });
  }, [proximityCircle, measuredArea]);
  useEffect(() => {
    whenReady((map) => {
      const plotLayers = ['plot-zone-fill', 'plot-zone-line', 'plot-zone-selected'];
      const anchor = plotsAboveTerritories ? 'underground-veil' : 'territory-fill';
      for (const id of plotLayers) map.moveLayer(id, anchor);
    });
  }, [plotsAboveTerritories]);
  useEffect(() => {
    whenReady((map) => {
      map.setLayoutProperty('landmarks-3d', 'visibility', landmarks === 'hidden' ? 'none' : 'visible');
      map.setPaintProperty('landmarks-3d', 'fill-extrusion-opacity', landmarks === 'dimmed' ? 0.4 : 0.92);
    });
  }, [landmarks]);

  // Vue 3D : inclinaison + légère rotation ; on rapproche si l'on est trop haut pour voir les extrusions.
  const appliedTilt = useRef(false);
  useEffect(() => {
    if (tilt === appliedTilt.current) return;
    appliedTilt.current = tilt;
    whenReady((map) => map.easeTo({ pitch: tilt ? 58 : 0, bearing: tilt ? -18 : 0, zoom: tilt && map.getZoom() < 13.8 ? 14.6 : map.getZoom(), duration: 900 }));
  }, [tilt]);

  useEffect(() => {
    whenReady((map) => {
      // Tracé ouvert : la fermeture est montrée par l'élastique (dernier point → curseur → premier point).
      (map.getSource('draft-line') as GeoJSONSource).setData(lineFeature(draft, false));
      (map.getSource('draft-points') as GeoJSONSource).setData(pointsFeature(draft));
      map.setPaintProperty('draft-line', 'line-color', tool === 'line' ? '#8cc2ec' : '#ffffff');
      if (tool === 'idle' || draft.length === 0) map.fire('bratmap:draft');
    });
    const canvas = mapRef.current?.getCanvas();
    if (canvas) canvas.style.cursor = tool === 'idle' ? '' : 'crosshair';
  }, [draft, tool]);

  // Poignées d'édition : sommets déplaçables, milieux cliquables, centre pour translater un territoire.
  // Les extrémités d'un segment souterrain sont des nœuds du graphe : elles restent fixes ici.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    whenReady((ready) => (ready.getSource('edit-ring') as GeoJSONSource).setData(shapeFeature(editShape)));
    if (!editShape || editShape.coordinates.length < 2) return;
    const markers: maplibregl.Marker[] = [];
    const preview = (next: EditShape) => (map.getSource('edit-ring') as GeoJSONSource | undefined)?.setData(shapeFeature(next));
    const handle = (className: string, title: string) => {
      const element = document.createElement('div');
      element.className = className;
      element.title = title;
      return element;
    };
    const vertices = editShape.kind === 'ring' ? editShape.coordinates.slice(0, -1) : editShape.coordinates;

    vertices.forEach((coordinate, index) => {
      const locked = editShape.kind === 'line' && (index === 0 || index === vertices.length - 1);
      if (locked) {
        markers.push(new maplibregl.Marker({ element: handle('vertex-handle locked', 'Extrémité reliée au réseau') }).setLngLat(coordinate).addTo(map));
        return;
      }
      const element = handle('vertex-handle', 'Glisser pour déplacer · clic droit pour supprimer');
      const marker = new maplibregl.Marker({ element, draggable: true }).setLngLat(coordinate).addTo(map);
      const moved = () => moveShapeVertex(editShape, index, [marker.getLngLat().lng, marker.getLngLat().lat]);
      marker.on('drag', () => preview(moved()));
      marker.on('dragend', () => latest.current.onEditShape(moved()));
      element.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        latest.current.onEditShape(removeShapeVertex(editShape, index));
      });
      markers.push(marker);
    });
    midpoints(editShape.coordinates).forEach((coordinate, index) => {
      const element = handle('midpoint-handle', 'Cliquer pour ajouter un sommet');
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        latest.current.onEditShape(insertShapeVertex(editShape, index, coordinate));
      });
      markers.push(new maplibregl.Marker({ element }).setLngLat(coordinate).addTo(map));
    });
    if (editShape.kind === 'ring') {
      const center = ringCentroid(editShape.coordinates);
      const centerElement = handle('move-handle', 'Glisser pour déplacer toute la zone');
      centerElement.textContent = '✥';
      const centerMarker = new maplibregl.Marker({ element: centerElement, draggable: true }).setLngLat(center).addTo(map);
      const translated = (): EditShape => ({
        kind: 'ring',
        coordinates: translateRing(editShape.coordinates, [centerMarker.getLngLat().lng - center[0], centerMarker.getLngLat().lat - center[1]]),
      });
      centerMarker.on('drag', () => preview(translated()));
      centerMarker.on('dragend', () => latest.current.onEditShape(translated()));
      markers.push(centerMarker);
    }
    return () => markers.forEach((marker) => marker.remove());
  }, [editShape]);

  useEffect(() => {
    const map = mapRef.current;
    const pulse = props.pulse;
    if (!map || !pulse) return;
    const element = document.createElement('div');
    element.className = 'pulse-ring';
    element.style.setProperty('--pulse-color', pulse.color);
    const marker = new maplibregl.Marker({ element }).setLngLat(pulse.coordinate).addTo(map);
    const timer = window.setTimeout(() => marker.remove(), 1600);
    return () => {
      window.clearTimeout(timer);
      marker.remove();
    };
  }, [props.pulse]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tempMarker) return;
    const element = document.createElement('div');
    element.className = 'temp-marker';
    const marker = new maplibregl.Marker({ element }).setLngLat(tempMarker).addTo(map);
    return () => {
      marker.remove();
    };
  }, [tempMarker]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTarget) return;
    if (flyTarget.bounds)
      map.fitBounds(flyTarget.bounds, { padding: window.innerWidth > 900 ? { top: 120, bottom: 80, left: 360, right: 420 } : 30, maxZoom: 16.5, duration: 700 });
    else if (flyTarget.center) map.flyTo({ center: flyTarget.center, zoom: flyTarget.zoom ?? Math.max(map.getZoom(), 15), duration: 700 });
  }, [flyTarget]);

  useEffect(() => {
    mapRef.current?.getCanvasContainer().classList.toggle('editing', editMode);
  }, [editMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const observer = new ResizeObserver(() => map.resize());
    if (node.current) observer.observe(node.current);
    return () => observer.disconnect();
  }, []);

  return <div ref={node} className="map-canvas" aria-label="Carte interactive de Paris et des Hauts-de-Seine" />;
}
