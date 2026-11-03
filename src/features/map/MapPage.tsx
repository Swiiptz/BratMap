import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { usePreference } from '../../app/preferences';
import { shareUrl, type MapPosition, type Route } from '../../app/router';
import { saveAppConfig, saveEntity, store, trashEntity } from '../../data';
import { useEditLock } from '../../data/editLocks';
import { undergroundWidthFactor } from '../../domain/appConfig';
import { useChronicle } from '../../data/ChronicleProvider';
import { entityName, findEntity, type EntityRef } from '../../domain/chronicle';
import { focusSize, relatedEntities } from '../../domain/focus';
import { activeFilterCount, applyFilters, type MapFilters } from '../../domain/mapFilters';
import type { LineStringGeometry, PolygonGeometry } from '../../domain/geo';
import {
  closeRing,
  distanceM,
  ringCentroid,
  formatArea,
  formatDistance,
  geometryBounds,
  lineLengthM,
  pointInPolygon,
  ringAreaM2,
  type AnyGeometry,
  type Coordinate,
} from '../../domain/geometry';
import type { UndergroundLevel } from '../../domain/models';
import {
  accessTypes,
  buildUndergroundGraph,
  levelOptions,
  moveNode,
  newJunctionId,
  resolveEndpoint,
  segmentTypes,
  undergroundKnowledgeLevels,
  undergroundOrigins,
  type GraphNode,
} from '../../domain/underground';
import type { EditShape } from './editShape';
import { EntityPanel } from './EntityPanel';
import { MapCanvas, type FlyTarget, type MapTool, type Pulse } from './MapCanvas';
import { buildMapFeatures, defaultLayers, mainZoneBounds, parseFeatureRef, type LayerState, type LevelFilter, type TravelFilter } from './mapData';
import { MapSidePanel } from './MapSidePanel';
import { UndergroundDock } from './UndergroundDock';
import { MapToolDock } from './MapToolDock';
import { ProximityPanel } from './ProximityPanel';
import { SelectionTray, selectionBounds } from './SelectionTray';
import { WelcomeCard } from './WelcomeCard';
import { ItineraryPanel, type RoutePoint } from './ItineraryPanel';
import type { RouteMode, TravelProfile } from '../../domain/routing';
import type { FeatureCollection } from 'geojson';
import { circlePolygon } from '../../domain/proximity';
import { defaultModel, useModelPreview } from './Building3dFields';
import { modelPresets, type ModelPreset } from '../../domain/models3d';

type PointCollection = 'locations' | 'havens' | 'undergroundAccess';
type PendingCreate =
  | { kind: 'point'; collection: PointCollection; coordinate: Coordinate; name?: string; landmarkKey?: string; model?: ModelPreset }
  | { kind: 'territory'; ring: Coordinate[] }
  | { kind: 'plotPing'; coordinate: Coordinate }
  | { kind: 'plotZone'; ring: Coordinate[] }
  | { kind: 'segment'; coordinates: Coordinate[]; start?: GraphNode; end?: GraphNode };
type ShapeHistory = { past: EditShape[]; present?: EditShape; future: EditShape[] };
type ContextMenuState = { coordinate: Coordinate; x: number; y: number };
type Props = {
  select?: EntityRef;
  focus?: EntityRef;
  position?: MapPosition;
  navigate: (route: Route, replace?: boolean) => void;
  onOpen: (ref: EntityRef) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
};

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
const formatCoordinate = ([lng, lat]: Coordinate) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
const SNAP_PX = 14;
const pendingTitle: Record<string, string> = {
  locations: 'Nouveau lieu',
  havens: 'Nouveau havre',
  undergroundAccess: 'Nouvel accès souterrain',
  territory: 'Nouveau territoire',
  segment: 'Nouveau segment souterrain',
  plotPing: 'Ping de plot',
  plotZone: 'Zone de plot',
};
const formValue = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
/** Palette des territoires : teintes distinctes mais désaturées, lisibles sur le fond sombre. */
const territoryPalette = ['#be8ec6', '#dba866', '#87c6b2', '#e07a6f', '#8fb3d9', '#c9c27a', '#9d8fe0'];

export function MapPage({ select, focus, position, navigate, onOpen, fullscreen, onToggleFullscreen }: Props) {
  const data = useChronicle();
  const [leftOpen, setLeftOpen] = usePreference('leftPanelOpen', true);
  const [storedLayers, setLayers] = usePreference<LayerState>('layers', defaultLayers);
  const layers = useMemo(() => ({ ...defaultLayers, ...storedLayers }), [storedLayers]);
  const [undergroundLevel, setUndergroundLevel] = usePreference<LevelFilter>('undergroundLevel', 'all');
  const [undergroundView, setUndergroundView] = usePreference('undergroundView', false);
  const [travelFilter, setTravelFilter] = usePreference<TravelFilter>('travelFilter', 'all');
  const [tilt, setTilt] = usePreference('tilt3d', false);
  const [plotsAbove, setPlotsAbove] = usePreference('plotsAboveTerritories', true);
  const [filters, setFilters] = usePreference<MapFilters>('mapFilters', {});
  const filteredData = useMemo(() => applyFilters(data, filters), [data, filters]);
  // En vue Souterrain, la surface passe au second plan sans disparaître.
  const effectiveLayers = useMemo<LayerState>(() => {
    if (!undergroundView) return layers;
    const dim = (value: LayerState[keyof LayerState]) => (value === 'visible' ? 'dimmed' : value);
    return {
      ...layers,
      locations: dim(layers.locations),
      havens: dim(layers.havens),
      territories: dim(layers.territories),
      landmarks: dim(layers.landmarks),
      realPois: dim(layers.realPois),
    };
  }, [layers, undergroundView]);
  const [pathSegmentIds, setPathSegmentIds] = useState<string[]>();
  const { fadeIntensity, labelDensity, undergroundStyle, territoryOpacity } = data.config;
  const [editMode, setEditMode] = useState(false);
  const [tool, setTool] = useState<MapTool>('idle');
  const [placeCollection, setPlaceCollection] = useState<PointCollection>('locations');
  // Pose d'un « Bâtiment 3D » : un lieu créé avec une maquette.
  const [placeModel, setPlaceModel] = useState(false);
  const [draft, setDraft] = useState<Coordinate[]>([]);
  const [redoDraft, setRedoDraft] = useState<Coordinate[]>([]);
  const [pending, setPending] = useState<PendingCreate>();
  const [contextMenu, setContextMenu] = useState<ContextMenuState>();
  const [tempMarker, setTempMarker] = useState<Coordinate>();
  const [flyTarget, setFlyTarget] = useState<FlyTarget>();
  const [shapeHistory, setShapeHistory] = useState<ShapeHistory>({ past: [], future: [] });
  const [notice, setNotice] = useState('');
  const [pulse, setPulse] = useState<Pulse>();
  const [drawTarget, setDrawTarget] = useState<'territory' | 'plotZone'>('territory');
  const [proximity, setProximity] = useState<{ center: Coordinate; radius: number }>();
  const [itinerary, setItinerary] = useState<RoutePoint[]>();
  // Départ / arrivée en cours de choix sur la carte (outil `pick`).
  const [routePick, setRoutePick] = useState<'start' | 'end'>();
  const [routeMode, setRouteMode] = usePreference<RouteMode>('routeMode', 'discreet');
  const [routeProfile, setRouteProfile] = usePreference<TravelProfile>('routeProfile', 'foot');
  const [route, setRoute] = useState<FeatureCollection>();
  const routePoints = useMemo(() => itinerary?.map((point) => point.coordinate), [itinerary]);
  const pointName = (coordinate: Coordinate) => `Point ${coordinate[1].toFixed(4)}, ${coordinate[0].toFixed(4)}`;
  /** Clic droit « Départ / Arrivée / Étape » : complète l'itinéraire en gardant départ en tête et arrivée en fin. */
  const setRoutePoint = (role: 'start' | 'end' | 'via', coordinate: Coordinate) => {
    const point = { coordinate, label: pointName(coordinate) };
    setProximity(undefined);
    setItinerary((current = []) => {
      if (role === 'start') return current.length ? [point, ...current.slice(1)] : [point];
      if (role === 'end') return current.length >= 2 ? [...current.slice(0, -1), point] : [...current, point];
      return current.length >= 2 ? [...current.slice(0, -1), point, current[current.length - 1]] : [...current, point];
    });
    setContextMenu(undefined);
  };
  const [measuredArea, setMeasuredArea] = useState<Coordinate[]>();
  const view = useRef<{ center: Coordinate; zoom: number }>({ center: [2.27, 48.86], zoom: 12 });
  const proximityCircle = useMemo(() => (proximity ? circlePolygon(proximity.center, proximity.radius) : undefined), [proximity]);

  // Lien de position partagé : on centre la carte et on pose le marqueur s'il est demandé.
  useEffect(() => {
    if (!position) return;
    setFlyTarget({ token: Date.now(), center: [position.lng, position.lat], zoom: position.zoom });
    if (position.marker) setTempMarker([position.lng, position.lat]);
  }, [position]);
  const searchRef = useRef<HTMLInputElement>(null);
  const skipFly = useRef(false);

  const focusSet = useMemo(() => (focus ? relatedEntities(data, focus) : undefined), [data, focus]);
  const editingId = editMode && shapeHistory.present ? select?.id : undefined;
  const pathSet = useMemo(() => (pathSegmentIds ? new Set(pathSegmentIds) : undefined), [pathSegmentIds]);
  // La maquette en cours de réglage dans une fiche s'affiche avant d'être enregistrée.
  const modelPreview = useModelPreview();
  const previewData = useMemo(() => {
    if (!modelPreview) return filteredData;
    const [collection, id] = modelPreview.ref.split('/');
    const patch = <T extends { id: string }>(items: T[]) => items.map((item) => (item.id === id ? { ...item, model3d: modelPreview.model } : item));
    return collection === 'havens' ? { ...filteredData, havens: patch(filteredData.havens) } : { ...filteredData, locations: patch(filteredData.locations) };
  }, [filteredData, modelPreview]);
  const features = useMemo(
    () =>
      buildMapFeatures(previewData, {
        layers: effectiveLayers,
        focus: focusSet,
        editMode,
        editingId,
        undergroundView,
        undergroundLevel,
        travelFilter,
        pathSegmentIds: pathSet,
        undergroundWidth: undergroundWidthFactor[undergroundStyle],
      }),
    [previewData, effectiveLayers, focusSet, editMode, editingId, undergroundView, undergroundLevel, travelFilter, pathSet, undergroundStyle],
  );
  const graph = useMemo(() => buildUndergroundGraph(data.undergroundAccess, data.undergroundSegments), [data.undergroundAccess, data.undergroundSegments]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => (current === message ? '' : current)), 2600);
  };
  const flyToGeometry = (geometry: AnyGeometry | undefined) => {
    if (!geometry) return;
    if (geometry.type === 'Point') setFlyTarget({ token: Date.now(), center: geometry.coordinates });
    else setFlyTarget({ token: Date.now(), bounds: geometryBounds(geometry) });
  };
  const [multi, setMulti] = useState<EntityRef[]>([]);
  // Les données publiques (souterrains de référence) ne comptent pas : seule la chronique elle-même.
  const chronicleIsEmpty =
    [data.locations, data.havens, data.territories, data.characters, data.plots].every((items) => items.length === 0) &&
    data.undergroundAccess.every((item) => item.reference) &&
    data.undergroundSegments.every((item) => item.reference);
  const sameRef = (a: EntityRef) => (b: EntityRef) => a.collection === b.collection && a.id === b.id;
  const onMultiSelect = (refs: EntityRef[], mode: 'toggle' | 'add') =>
    setMulti((current) => {
      // La fiche ouverte rejoint la sélection : Maj+clic prolonge naturellement une sélection simple.
      let next = select && !current.some(sameRef(select)) ? [...current, select] : [...current];
      for (const ref of refs) {
        const present = next.some(sameRef(ref));
        if (mode === 'toggle' && present) next = next.filter((item) => !sameRef(ref)(item));
        else if (!present) next.push(ref);
      }
      return next;
    });
  // Les éléments disparus (corbeille, filtres) quittent la sélection.
  const liveMulti = multi.filter((ref) => findEntity(data, ref.collection, ref.id));
  const selectRef = useCallback(
    (ref: EntityRef | undefined, fromMap = false) => {
      skipFly.current = fromMap;
      navigate({ view: 'map', select: ref, focus: ref ? undefined : focus }, fromMap && !ref);
    },
    [navigate, focus],
  );

  // Sélection venant d'un lien, de la recherche ou d'une autre page : on centre la carte dessus.
  useEffect(() => {
    if (!select) return;
    if (skipFly.current) {
      skipFly.current = false;
      return;
    }
    const target = findEntity(data, select.collection, select.id) as { geometry?: AnyGeometry; zoneGeometry?: AnyGeometry; pingGeometry?: AnyGeometry } | undefined;
    flyToGeometry(target?.geometry ?? target?.zoneGeometry ?? target?.pingGeometry);
    // Ne se redéclenche qu'au changement de sélection, pas à chaque mise à jour des données.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [select?.collection, select?.id, data.locations.length > 0 || data.havens.length > 0 || data.territories.length > 0]);

  useEffect(() => {
    if (!focusSet) return;
    const geometries = (['locations', 'havens', 'territories'] as const)
      .flatMap((collection) => [...focusSet[collection]].map((id) => (findEntity(data, collection, id) as { geometry?: AnyGeometry } | undefined)?.geometry))
      .filter((geometry): geometry is AnyGeometry => Boolean(geometry));
    if (geometries.length === 0) return;
    const bounds = geometries.map(geometryBounds);
    setFlyTarget({
      token: Date.now(),
      bounds: [
        [Math.min(...bounds.map((b) => b[0][0])), Math.min(...bounds.map((b) => b[0][1]))],
        [Math.max(...bounds.map((b) => b[1][0])), Math.max(...bounds.map((b) => b[1][1]))],
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.collection, focus?.id]);

  // Quitter l'édition des sommets si la sélection ou le mode changent.
  useEffect(() => setShapeHistory({ past: [], future: [] }), [select?.id, editMode]);
  useEffect(() => setPathSegmentIds(undefined), [select?.id]);

  const cancelTool = () => {
    setRoutePick(undefined);
    setTool('idle');
    setDraft([]);
    setRedoDraft([]);
  };
  const startTool = (next: MapTool, collection?: PointCollection, target: 'territory' | 'plotZone' = 'territory') => {
    setContextMenu(undefined);
    setDrawTarget(target);
    setDraft([]);
    setRedoDraft([]);
    if (collection) setPlaceCollection(collection);
    if (next === 'area') setMeasuredArea(undefined);
    if (next !== 'measure' && next !== 'area' && !editMode) setEditMode(true);
    if (next === 'line' || collection === 'undergroundAccess') setUndergroundView(true);
    setTool(next);
  };

  const onMapClick = (clicked: Coordinate, metersPerPixel: number) => {
    setContextMenu(undefined);
    // Tracé souterrain : chaque clic proche d'un accès ou d'une jonction s'y accroche.
    const coordinate = tool === 'line' ? (resolveEndpoint(graph, clicked, SNAP_PX * metersPerPixel)?.coordinate ?? clicked) : clicked;
    if (tool === 'pick') {
      if (routePick) setRoutePoint(routePick, clicked);
      setRoutePick(undefined);
      setTool('idle');
      return;
    }
    if (tool === 'place') {
      setPending({ kind: 'point', collection: placeCollection, coordinate, model: placeModel ? 'manoir' : undefined });
      setTool('idle');
    } else {
      // Un double-clic émet aussi deux clics : on ignore les points quasi confondus avec le précédent.
      setDraft((current) => (current.length > 0 && distanceM(current[current.length - 1], coordinate) < 1 ? current : [...current, coordinate]));
      setRedoDraft([]);
    }
  };
  const finishDraw = () => {
    if (tool === 'draw') {
      if (draft.length < 3) return flash('Ajoute au moins trois sommets.');
      setPending(drawTarget === 'plotZone' ? { kind: 'plotZone', ring: closeRing(draft) } : { kind: 'territory', ring: closeRing(draft) });
      cancelTool();
    } else if (tool === 'area') {
      if (draft.length < 3) return flash('Ajoute au moins trois sommets.');
      setMeasuredArea(closeRing(draft));
      cancelTool();
    } else if (tool === 'line') {
      if (draft.length < 2) return flash('Ajoute au moins deux points.');
      const nodeAt = (point: Coordinate) => resolveEndpoint(graph, point, 0.5);
      const [start, end] = [nodeAt(draft[0]), nodeAt(draft[draft.length - 1])];
      if (start && end && start.id === end.id && draft.length < 3) return flash('Un segment doit relier deux points distincts.');
      setPending({ kind: 'segment', coordinates: draft, start, end });
      cancelTool();
    } else if (tool === 'measure') setTool('idle');
  };

  const undo = () => {
    if (tool === 'draw' || tool === 'area' || tool === 'line' || tool === 'measure') {
      if (draft.length === 0) return;
      setRedoDraft((current) => [draft[draft.length - 1], ...current]);
      setDraft(draft.slice(0, -1));
    } else if (shapeHistory.past.length > 0) {
      setShapeHistory(({ past, present, future }) => ({ past: past.slice(0, -1), present: past[past.length - 1], future: present ? [present, ...future] : future }));
    }
  };
  const redo = () => {
    if (tool === 'draw' || tool === 'area' || tool === 'line' || tool === 'measure') {
      if (redoDraft.length === 0) return;
      setDraft([...draft, redoDraft[0]]);
      setRedoDraft(redoDraft.slice(1));
    } else if (shapeHistory.future.length > 0) {
      setShapeHistory(({ past, present, future }) => ({ past: present ? [...past, present] : past, present: future[0], future: future.slice(1) }));
    }
  };

  const onPointMove = async (ref: EntityRef, coordinate: Coordinate) => {
    try {
      const entity = findEntity(data, ref.collection, ref.id);
      if (!entity) return;
      // Un plot se déplace par son ping, les autres éléments par leur géométrie.
      await saveEntity(ref.collection, entity, { [ref.collection === 'plots' ? 'pingGeometry' : 'geometry']: { type: 'Point', coordinates: coordinate } });
      // Un accès est un nœud du graphe : les segments qui y aboutissent suivent.
      if (ref.collection === 'undergroundAccess')
        await Promise.all(
          moveNode(data.undergroundSegments, ref.id, coordinate).map((update) => {
            const segment = findEntity(data, 'undergroundSegments', update.id);
            return segment ? saveEntity('undergroundSegments', segment, { geometry: { type: 'LineString', coordinates: update.coordinates } }) : undefined;
          }),
        );
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Déplacement non enregistré.');
    }
  };

  const territoryAt = (coordinate: Coordinate) =>
    data.territories.find((territory) => territory.geometry?.type === 'Polygon' && pointInPolygon(coordinate, territory.geometry))?.id;

  const selectedTerritory = select?.collection === 'territories' ? findEntity(data, 'territories', select.id) : undefined;
  const selectedSegment = select?.collection === 'undergroundSegments' ? findEntity(data, 'undergroundSegments', select.id) : undefined;
  const selectedPlotZone = select?.collection === 'plots' ? findEntity(data, 'plots', select.id)?.zoneGeometry : undefined;
  const startGeometryEdit = () => {
    if (selectedPlotZone) setShapeHistory({ past: [], present: { kind: 'ring', coordinates: closeRing(selectedPlotZone.coordinates[0]) }, future: [] });
    else if (selectedTerritory?.geometry) setShapeHistory({ past: [], present: { kind: 'ring', coordinates: closeRing(selectedTerritory.geometry.coordinates[0]) }, future: [] });
    else if (selectedSegment?.geometry) setShapeHistory({ past: [], present: { kind: 'line', coordinates: selectedSegment.geometry.coordinates }, future: [] });
  };
  const saveGeometry = async () => {
    const shape = shapeHistory.present;
    if (!shape || !select) return;
    try {
      if (shape.kind === 'ring') {
        const geometry: PolygonGeometry = { type: 'Polygon', coordinates: [shape.coordinates] };
        const plot = select.collection === 'plots' ? findEntity(data, 'plots', select.id) : undefined;
        const territory = select.collection === 'territories' ? findEntity(data, 'territories', select.id) : undefined;
        if (plot) await saveEntity('plots', plot, { zoneGeometry: geometry });
        else if (territory) await saveEntity('territories', territory, { geometry });
      } else {
        const geometry: LineStringGeometry = { type: 'LineString', coordinates: shape.coordinates };
        if (selectedSegment) await saveEntity('undergroundSegments', selectedSegment, { geometry });
      }
      setShapeHistory({ past: [], future: [] });
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Forme non enregistrée.');
    }
  };
  const shape = shapeHistory.present;
  const shapeLockedElsewhere = useEditLock(select?.collection ?? 'none', select?.id, Boolean(shape));
  const geometryControls =
    selectedTerritory || selectedSegment || selectedPlotZone ? (
      shape ? (
        <>
          {shapeLockedElsewhere && <p className="lock-banner">✎ Cette forme est aussi en cours de modification sur un autre poste.</p>}
          <p className="muted">
            Glisse les sommets, clique un point milieu pour en ajouter, clic droit sur un sommet pour le retirer
            {shape.kind === 'ring'
              ? `, ✥ pour déplacer la zone. ${formatArea(ringAreaM2(shape.coordinates))}`
              : `. Les extrémités restent reliées au réseau. ${formatDistance(lineLengthM(shape.coordinates))}`}
          </p>
          <div className="sheet-actions">
            <button type="button" className="primary-button" onClick={() => void saveGeometry()}>
              Enregistrer la forme
            </button>
            <button type="button" className="ghost-button" disabled={shapeHistory.past.length === 0} onClick={undo}>
              ↶
            </button>
            <button type="button" className="ghost-button" disabled={shapeHistory.future.length === 0} onClick={redo}>
              ↷
            </button>
            <button type="button" className="ghost-button" onClick={() => setShapeHistory({ past: [], future: [] })}>
              Annuler
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="ghost-button" onClick={startGeometryEdit}>
          ✎ {selectedSegment ? 'Modifier le tracé' : 'Modifier la forme'}
        </button>
      )
    ) : undefined;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const ctrl = event.ctrlKey || event.metaKey;
      if (event.key === 'Escape') {
        if (contextMenu) setContextMenu(undefined);
        else if (proximity) setProximity(undefined);
        else if (measuredArea) setMeasuredArea(undefined);
        else if (tool !== 'idle') cancelTool();
        else if (shapeHistory.present) setShapeHistory({ past: [], future: [] });
        else if (multi.length > 0) setMulti([]);
        else if (select) selectRef(undefined, true);
        else if (focus) navigate({ view: 'map' });
      } else if (ctrl && event.key.toLowerCase() === 'z' && !event.shiftKey && (tool !== 'idle' || shapeHistory.present)) {
        // Annulation locale (tracé, sommets) ; sinon l'historique global de l'App prend la main.
        event.preventDefault();
        undo();
      } else if (ctrl && (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey)) && (tool !== 'idle' || shapeHistory.present)) {
        event.preventDefault();
        redo();
      } else if (event.key === '/') {
        event.preventDefault();
        setLeftOpen(true);
        window.setTimeout(() => searchRef.current?.focus(), 0);
      } else if (event.key.toLowerCase() === 'f' && !ctrl) onToggleFullscreen();
      else if (event.key === 'Delete' && editMode && select && window.confirm('Mettre cet élément à la corbeille ?')) {
        const entity = findEntity(data, select.collection, select.id);
        if (entity) void trashEntity(select.collection, entity);
        selectRef(undefined, true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const createPending = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pending) return;
    const form = new FormData(event.currentTarget);
    const name = formValue(form, 'name');
    const plotId = formValue(form, 'plotId');
    if (!name && pending.kind !== 'segment' && !plotId)
      return flash(pending.kind === 'plotPing' || pending.kind === 'plotZone' ? 'Choisis un plot ou donne un nom au nouveau plot.' : 'Le nom est obligatoire.');
    const level = Number(formValue(form, 'level') || -1) as UndergroundLevel;
    const model3d = defaultModel(formValue(form, 'model3d') as ModelPreset) ?? null;
    try {
      let ref: EntityRef;
      if (pending.kind === 'point' && pending.collection === 'havens') {
        const id = await store.create('havens', {
          name,
          ownerCharacterIds: [],
          residentCharacterIds: [],
          territoryId: territoryAt(pending.coordinate) ?? null,
          tags: [],
          plotIds: [],
          markerStyle: { color: '#dba866', size: 7 },
          model3d,
          geometry: { type: 'Point', coordinates: pending.coordinate },
        });
        ref = { collection: 'havens', id };
      } else if (pending.kind === 'point' && pending.collection === 'undergroundAccess') {
        const id = await store.create('undergroundAccess', {
          name,
          type: formValue(form, 'type') || 'other',
          level,
          origin: formValue(form, 'origin') || 'chronicle',
          knowledgeLevel: formValue(form, 'knowledge') || 'confirmed',
          segmentIds: [],
          plotIds: [],
          territoryId: territoryAt(pending.coordinate) ?? null,
          geometry: { type: 'Point', coordinates: pending.coordinate },
        });
        ref = { collection: 'undergroundAccess', id };
      } else if (pending.kind === 'segment') {
        const toLevel = formValue(form, 'toLevel');
        const geometry: LineStringGeometry = { type: 'LineString', coordinates: pending.coordinates };
        const id = await store.create('undergroundSegments', {
          name: name || null,
          type: formValue(form, 'type') || 'tunnel',
          level,
          toLevel: toLevel && Number(toLevel) !== level ? Number(toLevel) : null,
          origin: formValue(form, 'origin') || 'chronicle',
          knowledgeLevel: formValue(form, 'knowledge') || 'spotted',
          startNodeId: pending.start?.id ?? newJunctionId(),
          endNodeId: pending.end?.id ?? newJunctionId(),
          connectedSegmentIds: [],
          plotIds: [],
          geometry,
        });
        ref = { collection: 'undergroundSegments', id };
      } else if (pending.kind === 'plotPing' || pending.kind === 'plotZone') {
        const field =
          pending.kind === 'plotPing' ? { pingGeometry: { type: 'Point', coordinates: pending.coordinate } } : { zoneGeometry: { type: 'Polygon', coordinates: [pending.ring] } };
        const existing = plotId ? findEntity(data, 'plots', plotId) : undefined;
        const id = existing
          ? (await saveEntity('plots', existing, field), existing.id)
          : await store.create('plots', {
              name,
              statusId: 'active',
              characterIds: [],
              locationIds: [],
              havenIds: [],
              territoryIds: [],
              undergroundAccessIds: [],
              undergroundSegmentIds: [],
              ...field,
            });
        ref = { collection: 'plots', id };
      } else if (pending.kind === 'point') {
        const type = data.refs.markerTypes.find((item) => item.id === 'place');
        const id = await store.create('locations', {
          name,
          landmarkKey: pending.landmarkKey ?? null,
          typeId: 'place',
          tags: [],
          characterIds: [],
          plotIds: [],
          territoryId: territoryAt(pending.coordinate) ?? null,
          knowledgeLevel: 'known',
          markerStyle: { color: type?.color ?? '#87c6b2', size: 6 },
          model3d,
          geometry: { type: 'Point', coordinates: pending.coordinate },
        });
        ref = { collection: 'locations', id };
      } else {
        const geometry: PolygonGeometry = { type: 'Polygon', coordinates: [pending.ring] };
        const color = formValue(form, 'color') || territoryPalette[0];
        const id = await store.create('territories', {
          name,
          factionId: formValue(form, 'faction') || null,
          ownerCharacterIds: [],
          characterIds: [],
          locationIds: [],
          havenIds: [],
          plotIds: [],
          traditionRules: [],
          style: { fillColor: color, strokeColor: color, opacity: territoryOpacity, outlineOnly: false },
          geometry,
        });
        ref = { collection: 'territories', id };
      }
      // Une maquette se règle mieux en vue inclinée.
      if (model3d) setTilt(true);
      const anchor =
        pending.kind === 'point' || pending.kind === 'plotPing'
          ? pending.coordinate
          : pending.kind === 'territory' || pending.kind === 'plotZone'
            ? ringCentroid(pending.ring)
            : pending.coordinates[Math.floor(pending.coordinates.length / 2)];
      setPulse({
        token: Date.now(),
        coordinate: anchor,
        color:
          pending.kind === 'plotPing' || pending.kind === 'plotZone'
            ? '#9dd7c4'
            : pending.kind === 'territory'
              ? formValue(form, 'color') || territoryPalette[0]
              : pending.kind === 'segment' || pending.collection === 'undergroundAccess'
                ? '#8cc2ec'
                : pending.collection === 'havens'
                  ? '#dba866'
                  : '#87c6b2',
      });
      setPending(undefined);
      selectRef(ref, true);
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Échec de sauvegarde.');
    }
  };

  const copyLink = (target: MapPosition, message: string) => {
    void navigator.clipboard?.writeText(shareUrl({ view: 'map', position: target }));
    flash(message);
    setContextMenu(undefined);
  };

  const copyCoordinates = (coordinate: Coordinate) => {
    void navigator.clipboard?.writeText(formatCoordinate(coordinate));
    flash(`Coordonnées copiées : ${formatCoordinate(coordinate)}`);
    setContextMenu(undefined);
  };

  const measureText = tool === 'measure' || draft.length > 1 ? formatDistance(lineLengthM(draft)) : '';

  return (
    <section className={`map-page${editMode ? ' edit-mode' : ''}${fullscreen ? ' fullscreen' : ''}`}>
      <MapCanvas
        features={features}
        selected={liveMulti.length > 0 ? undefined : select}
        multiSelected={liveMulti}
        realPois={effectiveLayers.realPois}
        landmarks={effectiveLayers.landmarks}
        tilt={tilt}
        plotsAboveTerritories={plotsAbove}
        fadeIntensity={fadeIntensity}
        labelDensity={labelDensity}
        editMode={editMode}
        tool={tool}
        draft={draft}
        editShape={shapeHistory.present}
        veil={undergroundView ? (undergroundLevel !== 'all' && undergroundLevel < 0 ? 0.5 : 0.4) : 0}
        tempMarker={tempMarker}
        flyTarget={flyTarget}
        pulse={pulse}
        proximityCircle={proximityCircle}
        route={route}
        routePoints={routePoints}
        measuredArea={measuredArea}
        onViewChange={(center, zoom) => (view.current = { center, zoom })}
        onEditShape={(next) => setShapeHistory(({ past, present }) => ({ past: present ? [...past, present] : past, present: next, future: [] }))}
        onSelect={(ref) => {
          setContextMenu(undefined);
          setMulti([]);
          if (ref?.collection === select?.collection && ref?.id === select?.id) return;
          selectRef(ref, true);
        }}
        onMultiSelect={onMultiSelect}
        onBasemapError={() => flash('Fond de carte injoignable (connexion ?) : affichage simplifié. Recharger la page une fois le réseau revenu.')}
        onMapClick={onMapClick}
        onDoubleClick={finishDraw}
        onContextMenu={(coordinate, screen) => setContextMenu({ coordinate, ...screen })}
        onPointMove={(ref, coordinate) => void onPointMove(ref, coordinate)}
        onLandmarkClick={(landmark) => {
          setContextMenu(undefined);
          const linked = parseFeatureRef(features.linkedLandmarks[landmark.key]);
          if (linked) return selectRef(linked, true);
          setPending({ kind: 'point', collection: 'locations', coordinate: landmark.coordinate, name: landmark.name, landmarkKey: landmark.key });
        }}
      />

      {!fullscreen && (
        <div className="map-overlay topbar">
          <div className="mode-switch" role="group" aria-label="Mode">
            <button className={!editMode ? 'selected' : ''} onClick={() => setEditMode(false)}>
              ◉ Consultation
            </button>
            <button className={editMode ? 'selected' : ''} onClick={() => setEditMode(true)}>
              ✎ Édition
            </button>
          </div>
          <div className="mode-switch" role="group" aria-label="Vue">
            <button
              className={undergroundView ? 'selected underground' : ''}
              aria-pressed={undergroundView}
              onClick={() => setUndergroundView(!undergroundView)}
              title="Vue souterraine : réseau mis en avant, surface atténuée"
            >
              ⌇ Souterrain
            </button>
          </div>
        </div>
      )}

      {focus && focusSet && !fullscreen && (
        <div className="focus-banner" role="status">
          <span>◎ Focus</span>
          <button className="focus-banner-name" onClick={() => onOpen(focus)}>
            {entityName(data, focus)}
          </button>
          <small>{focusSize(focusSet) - 1} élément(s) lié(s) · le reste est masqué</small>
          <button className="focus-banner-exit" onClick={() => navigate({ view: 'map' })}>
            Quitter ✕
          </button>
        </div>
      )}

      {!focus && activeFilterCount(filters) > 0 && !fullscreen && (
        <div className="focus-banner filters-banner" role="status">
          <span>⧩ Filtres</span>
          <small>{activeFilterCount(filters)} critère(s) actif(s) · une partie de la carte est masquée</small>
          <button className="focus-banner-exit" onClick={() => setFilters({})}>
            Tout afficher ✕
          </button>
        </div>
      )}

      {itinerary && !fullscreen && (
        <ItineraryPanel
          points={itinerary}
          onPointsChange={setItinerary}
          mode={routeMode}
          onModeChange={setRouteMode}
          profile={routeProfile}
          onProfileChange={setRouteProfile}
          onRouteChange={setRoute}
          onOpen={onOpen}
          onClose={() => {
            setItinerary(undefined);
            if (tool === 'pick') cancelTool();
          }}
          picking={routePick}
          onPickOnMap={(role) => {
            setContextMenu(undefined);
            setRoutePick(role);
            setTool('pick');
          }}
          onCancelPick={cancelTool}
        />
      )}

      {data.loaded && chronicleIsEmpty && !fullscreen && (
        <WelcomeCard
          onTerritory={() => startTool('draw')}
          onPlace={() => startTool('place', 'locations')}
          onCharacters={() => navigate({ view: 'characters' })}
          onImport={() => navigate({ view: 'settings', id: 'backup' })}
        />
      )}

      {liveMulti.length > 0 && !fullscreen && (
        <SelectionTray
          data={data}
          refs={liveMulti}
          editMode={editMode}
          onOpen={(ref) => {
            setMulti([]);
            selectRef(ref);
          }}
          onRemove={(ref) => setMulti((current) => current.filter((item) => !sameRef(ref)(item)))}
          onClear={() => setMulti([])}
          onFrame={() => {
            const bounds = selectionBounds(data, liveMulti);
            if (bounds) setFlyTarget({ token: Date.now(), bounds });
          }}
          onDone={flash}
        />
      )}

      {proximity && !fullscreen && (
        <ProximityPanel
          center={proximity.center}
          radius={proximity.radius}
          onRadiusChange={(radius) => setProximity({ ...proximity, radius })}
          onOpen={onOpen}
          onClose={() => setProximity(undefined)}
        />
      )}

      {undergroundView && (
        <UndergroundDock
          level={undergroundLevel}
          onLevelChange={setUndergroundLevel}
          travelFilter={travelFilter}
          onTravelFilterChange={setTravelFilter}
          onClose={() => setUndergroundView(false)}
          shifted={Boolean(select) && !fullscreen}
        />
      )}

      {!fullscreen && (
        <MapSidePanel
          ref={searchRef}
          open={leftOpen}
          onToggle={() => setLeftOpen(!leftOpen)}
          layers={layers}
          onLayersChange={setLayers}
          focus={focus}
          focusSet={focusSet}
          onClearFocus={() => navigate({ view: 'map' })}
          onOpen={onOpen}
          fadeIntensity={fadeIntensity}
          onFadeChange={(value) => void saveAppConfig({ fadeIntensity: value })}
          plotsAbove={plotsAbove}
          onPlotsAboveChange={setPlotsAbove}
          filters={filters}
          onFiltersChange={setFilters}
          onAddress={(hit) => {
            setFlyTarget({ token: Date.now(), center: hit.coordinate, zoom: 17 });
            setTempMarker(hit.coordinate);
            flash(`${hit.label} — clic droit sur le marqueur pour y créer un lieu`);
          }}
        />
      )}

      {!fullscreen && select && (
        <EntityPanel
          entityRef={select}
          editMode={editMode}
          onClose={() => selectRef(undefined, true)}
          onOpen={onOpen}
          onSelect={(ref) => selectRef(ref, false)}
          onFocus={(ref) => navigate({ view: 'map', focus: ref })}
          geometryControls={geometryControls}
          onShowPath={setPathSegmentIds}
        />
      )}

      <MapToolDock
        tool={tool}
        placeTarget={placeCollection}
        drawTarget={drawTarget}
        itineraryOpen={Boolean(itinerary)}
        tilt={tilt}
        fullscreen={fullscreen}
        shifted={Boolean(select) && !fullscreen}
        placeModel={placeModel}
        onCreate={(action) => {
          setPlaceModel(action.kind === 'place' && Boolean(action.model));
          if (action.kind === 'place') startTool('place', action.target);
          else if (action.kind === 'draw') startTool('draw', undefined, action.target);
          else startTool('line');
        }}
        onMeasure={(next) => startTool(next)}
        onItinerary={() => setItinerary(itinerary ? undefined : [])}
        onRecenter={() => setFlyTarget({ token: Date.now(), bounds: mainZoneBounds })}
        onTilt={() => setTilt(!tilt)}
        onFullscreen={onToggleFullscreen}
      />

      {tool !== 'idle' && tool !== 'pick' && (
        <div className="placement-hint">
          {tool === 'place' &&
            `Clique sur la carte pour placer ${placeModel ? 'le bâtiment 3D' : placeCollection === 'havens' ? 'le havre' : placeCollection === 'undergroundAccess' ? "l'accès souterrain" : 'le lieu'}`}
          {tool === 'line' &&
            `Segment : ${draft.length} point(s) · ${formatDistance(lineLengthM(draft))} — clique près d'un accès ou d'une jonction pour t'y raccorder, double-clic pour terminer`}
          {tool === 'draw' &&
            `${drawTarget === 'plotZone' ? 'Zone de plot' : 'Territoire'} : ${draft.length} sommet(s) — clique le premier sommet ou double-clique pour terminer, Ctrl+Z pour retirer`}
          {tool === 'measure' && `Mesure : ${measureText || 'clique des points'} — double-clic pour figer`}
          {tool === 'area' && `Surface : ${draft.length} sommet(s) — clique le premier sommet ou double-clique pour figer`}
          <button onClick={cancelTool}>{tool === 'measure' ? 'effacer' : 'annuler'}</button>
        </div>
      )}
      {tool === 'idle' && measuredArea && (
        <div className="placement-hint">
          Surface mesurée : {formatArea(ringAreaM2(measuredArea))} · périmètre {formatDistance(lineLengthM(measuredArea))}
          <button onClick={() => setMeasuredArea(undefined)}>effacer</button>
        </div>
      )}
      {tool === 'idle' && draft.length > 1 && (
        <div className="placement-hint">
          Distance mesurée : {measureText}
          <button onClick={cancelTool}>effacer</button>
        </div>
      )}
      {notice && <div className="toast">{notice}</div>}

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onMouseLeave={() => setContextMenu(undefined)}>
          {editMode && (
            <>
              <button onClick={() => (setPending({ kind: 'point', collection: 'locations', coordinate: contextMenu.coordinate }), setContextMenu(undefined))}>
                ◆ Ajouter un lieu ici
              </button>
              <button onClick={() => (setPending({ kind: 'point', collection: 'havens', coordinate: contextMenu.coordinate }), setContextMenu(undefined))}>
                ⌂ Ajouter un havre ici
              </button>
              <button onClick={() => (startTool('draw'), setDraft([contextMenu.coordinate]))}>▱ Territoire depuis ce point</button>
              <button onClick={() => (setPending({ kind: 'plotPing', coordinate: contextMenu.coordinate }), setContextMenu(undefined))}>◈ Ping de plot ici</button>
              <button onClick={() => (startTool('draw', undefined, 'plotZone'), setDraft([contextMenu.coordinate]))}>◈ Zone de plot depuis ici</button>
              <button onClick={() => (setPending({ kind: 'point', collection: 'undergroundAccess', coordinate: contextMenu.coordinate }), setContextMenu(undefined))}>
                ▼ Accès souterrain ici
              </button>
              <button onClick={() => (startTool('line'), setDraft([contextMenu.coordinate]))}>⌇ Segment souterrain depuis ici</button>
            </>
          )}
          <button onClick={() => setRoutePoint('start', contextMenu.coordinate)}>A · Départ ici</button>
          <button onClick={() => setRoutePoint('end', contextMenu.coordinate)}>B · Arrivée ici</button>
          {itinerary && itinerary.length >= 2 && <button onClick={() => setRoutePoint('via', contextMenu.coordinate)}>＋ Ajouter une étape ici</button>}
          <button onClick={() => (setProximity({ center: contextMenu.coordinate, radius: proximity?.radius ?? 500 }), setContextMenu(undefined))}>◌ Autour d'ici</button>
          <button onClick={() => (startTool('measure'), setDraft([contextMenu.coordinate]))}>⟷ Mesurer depuis ici</button>
          <button onClick={() => (startTool('area'), setDraft([contextMenu.coordinate]))}>⬠ Mesurer une surface depuis ici</button>
          <button onClick={() => (setTempMarker(contextMenu.coordinate), setContextMenu(undefined))}>⚑ Marqueur temporaire</button>
          {tempMarker && <button onClick={() => (setTempMarker(undefined), setContextMenu(undefined))}>✕ Retirer le marqueur</button>}
          <button onClick={() => copyCoordinates(contextMenu.coordinate)}>⧉ Copier lat/long</button>
          <button
            onClick={() =>
              copyLink(
                { lng: contextMenu.coordinate[0], lat: contextMenu.coordinate[1], zoom: Math.max(view.current.zoom, 15), marker: true },
                'Lien vers ce point copié (avec marqueur)',
              )
            }
          >
            ⚑ Partager un marqueur ici
          </button>
          <button onClick={() => copyLink({ lng: view.current.center[0], lat: view.current.center[1], zoom: view.current.zoom }, 'Lien vers cette vue copié')}>
            ⧉ Lien vers cette vue
          </button>
        </div>
      )}

      {pending && (
        <div className="modal-backdrop" onMouseDown={() => setPending(undefined)}>
          <form className="entity-form" onSubmit={(event) => void createPending(event)} onMouseDown={(event) => event.stopPropagation()}>
            <div className="form-heading">
              <div>
                <span className="eyebrow">NOUVEL ÉLÉMENT</span>
                <h2>{pending.kind === 'point' && pending.model ? 'Nouveau bâtiment 3D' : pendingTitle[pending.kind === 'point' ? pending.collection : pending.kind]}</h2>
              </div>
              <button type="button" className="close-button" onClick={() => setPending(undefined)}>
                ×
              </button>
            </div>
            <label>
              {pending.kind === 'plotPing' || pending.kind === 'plotZone' ? 'Nom du nouveau plot' : 'Nom'}
              {pending.kind === 'segment' && ' (facultatif)'}
              <input name="name" autoFocus autoComplete="off" defaultValue={pending.kind === 'point' ? pending.name : undefined} />
            </label>
            {(pending.kind === 'plotPing' || pending.kind === 'plotZone') && (
              <label>
                Plot existant
                <select name="plotId" defaultValue="">
                  <option value="">— nouveau plot (nom ci-dessus) —</option>
                  {data.plots.map((plot) => (
                    <option key={plot.id} value={plot.id}>
                      {plot.name}
                      {(pending.kind === 'plotPing' ? plot.pingGeometry : plot.zoneGeometry) ? ' (remplace l’actuel)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {pending.kind === 'point' && (pending.collection === 'locations' || pending.collection === 'havens') && !pending.landmarkKey && (
              <label>
                Bâtiment 3D {pending.model ? '' : '(facultatif)'}
                <select name="model3d" defaultValue={pending.model ?? ''}>
                  <option value="">Aucun</option>
                  {modelPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                <small className="muted">Dimensions et orientation se règlent ensuite dans la fiche.</small>
              </label>
            )}
            {pending.kind === 'territory' && (
              <>
                <fieldset className="swatches">
                  <legend>Couleur</legend>
                  {territoryPalette.map((color, index) => (
                    <label key={color} className="swatch" style={{ ['--swatch' as string]: color }}>
                      <input type="radio" name="color" value={color} defaultChecked={index === data.territories.length % territoryPalette.length} />
                      <span />
                    </label>
                  ))}
                </fieldset>
                <label>
                  Faction
                  <select name="faction" defaultValue="">
                    <option value="">Aucune</option>
                    {data.refs.factions.map((faction) => (
                      <option key={faction.id} value={faction.id}>
                        {faction.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {(pending.kind === 'segment' || (pending.kind === 'point' && pending.collection === 'undergroundAccess')) && (
              <div className="form-grid">
                <label>
                  Type
                  <select name="type" defaultValue={pending.kind === 'segment' ? 'tunnel' : 'stairs'}>
                    {(pending.kind === 'segment' ? segmentTypes : accessTypes).map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Niveau
                  <select name="level" defaultValue={String(undergroundLevel !== 'all' && undergroundLevel < 0 ? undergroundLevel : -1)}>
                    {levelOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
                {pending.kind === 'segment' && (
                  <label>
                    Vers le niveau (connexion verticale)
                    <select name="toLevel" defaultValue="">
                      <option value="">— même niveau —</option>
                      {levelOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Connaissance
                  <select name="knowledge" defaultValue={pending.kind === 'segment' ? 'spotted' : 'confirmed'}>
                    {undergroundKnowledgeLevels.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Origine
                  <select name="origin" defaultValue="chronicle">
                    {undergroundOrigins.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <p className="coordinate-readout">
              {(pending.kind === 'point' || pending.kind === 'plotPing') && formatCoordinate(pending.coordinate)}
              {(pending.kind === 'territory' || pending.kind === 'plotZone') && `${pending.ring.length - 1} sommets · ${formatArea(ringAreaM2(pending.ring))}`}
              {pending.kind === 'segment' &&
                `${pending.coordinates.length} points · ${formatDistance(lineLengthM(pending.coordinates))} · départ : ${pending.start ? (pending.start.accessId ? 'accès' : 'jonction existante') : 'nouvelle jonction'} · arrivée : ${pending.end ? (pending.end.accessId ? 'accès' : 'jonction existante') : 'nouvelle jonction'}`}
            </p>
            {pending.kind === 'point' && pending.landmarkKey && <p className="muted">Le lieu sera rattaché à ce bâtiment 3D : un clic sur le bâtiment ouvrira sa fiche.</p>}
            {pending.kind === 'point' && territoryAt(pending.coordinate) && (
              <p className="muted">Rattaché automatiquement au territoire « {findEntity(data, 'territories', territoryAt(pending.coordinate))?.name} ».</p>
            )}
            <button className="primary-button">Créer et ouvrir la fiche</button>
          </form>
        </div>
      )}
    </section>
  );
}
