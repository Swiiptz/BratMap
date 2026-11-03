import { useEffect, useMemo, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import { useChronicle } from '../../data/ChronicleProvider';
import { entityName, type EntityRef } from '../../domain/chronicle';
import { formatDistance, type Coordinate } from '../../domain/geometry';
import {
  analyzeLegs,
  createOsrmProvider,
  planUnderground,
  straightLineProvider,
  suggestParking,
  undergroundPathLine,
  type ParkingSuggestion,
  type RouteAnalysis,
  type RouteMode,
  type SurfaceRoute,
  type TravelProfile,
} from '../../domain/routing';
import { store } from '../../data';
import { levelNames } from '../../domain/underground';
import { stanceOptions } from './EntityPanel';

/** Point d'itinéraire ; `travel` = mode du tronçon qui part de ce point (voiture / à pied). */
export type RoutePoint = { coordinate: Coordinate; label: string; travel?: TravelProfile };
type Candidate = {
  id: string;
  label: string;
  distanceM: number;
  durationMin: number;
  analysis: RouteAnalysis;
  lines: Array<{ coordinates: Coordinate[]; kind: 'surface' | 'underground'; travel?: TravelProfile }>;
  underground?: { entry: string; exit: string; lengthM: number; levels: number[]; risk: string; transitLines?: string[] };
};

const provider = createOsrmProvider(import.meta.env.VITE_ROUTING_URL || undefined);
const riskRank = { faible: 0, moyen: 1, élevé: 2, 'très élevé': 3 } as const;
const riskClass: Record<string, string> = { faible: 'risk-low', moyen: 'risk-medium', élevé: 'risk-high', 'très élevé': 'risk-critical' };
const modes: Array<{ id: RouteMode; label: string; title: string }> = [
  { id: 'fast', label: 'Rapide', title: 'Le plus rapide par les rues' },
  { id: 'discreet', label: 'Discret', title: 'Compare les variantes et évite territoires hostiles et zones dangereuses' },
  { id: 'underground', label: 'Souterrain', title: 'Rejoint le réseau souterrain le plus utile, puis ressort au plus près' },
];
const pointLabel = (index: number, count: number) => (index === 0 ? 'Départ' : index === count - 1 ? 'Arrivée' : `Étape ${index}`);
const formatDuration = (minutes: number) =>
  minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, '0')}` : `${Math.max(1, Math.round(minutes))} min`;

type Props = {
  points: RoutePoint[];
  onPointsChange: (points: RoutePoint[]) => void;
  mode: RouteMode;
  onModeChange: (mode: RouteMode) => void;
  profile: TravelProfile;
  onProfileChange: (profile: TravelProfile) => void;
  onRouteChange: (route: FeatureCollection | undefined) => void;
  onOpen: (ref: EntityRef) => void;
  onClose: () => void;
};

/** Itinéraires (CDC §12) : modes Rapide, Discret et Souterrain, comparaison des variantes, lecture narrative du trajet. */
export function ItineraryPanel({ points, onPointsChange, mode, onModeChange, profile, onProfileChange, onRouteChange, onOpen, onClose }: Props) {
  const data = useChronicle();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [allowManholes, setAllowManholes] = useState(true);
  const coordinates = useMemo(() => points.map((point) => point.coordinate), [points]);
  const legsKey = points.map((point) => point.travel ?? '').join(',');
  const [parking, setParking] = useState<ParkingSuggestion[]>();
  const [saveName, setSaveName] = useState('');
  const places = useMemo(
    () =>
      [
        ...data.locations.map((item) => ({ id: `l:${item.id}`, name: item.name, coordinate: item.geometry?.coordinates })),
        ...data.havens.map((item) => ({ id: `h:${item.id}`, name: `⌂ ${item.name}`, coordinate: item.geometry?.coordinates })),
        ...data.undergroundAccess.filter((item) => !item.minor).map((item) => ({ id: `a:${item.id}`, name: `▼ ${item.name}`, coordinate: item.geometry?.coordinates })),
      ]
        .filter((item) => item.coordinate)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [data.locations, data.havens, data.undergroundAccess],
  );

  useEffect(() => {
    if (coordinates.length < 2) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    const surface = async (route: Coordinate[], travel: TravelProfile): Promise<SurfaceRoute[]> => {
      try {
        return await provider.route(route, travel);
      } catch (error) {
        setMessage(`${error instanceof Error ? error.message : 'Moteur indisponible.'} Repli en ligne droite.`);
        return straightLineProvider.route(route, travel);
      }
    };
    const run = async () => {
      setStatus('loading');
      setMessage('');
      let result: Candidate[] = [];
      if (mode === 'underground') {
        const planned = planUnderground(data, coordinates[0], coordinates[coordinates.length - 1], { allowManholes });
        if (!('plan' in planned)) {
          setMessage(
            planned.reason === 'no-access'
              ? 'Aucun accès ni réseau discret praticable à moins de 1,5 km du départ ou de l’arrivée.'
              : 'Des accès existent près du départ et de l’arrivée, mais le réseau connu ne les relie pas (les lignes se rejoignent souvent dans Paris, hors zone). Trace une liaison avec l’outil ⌇ ou autorise les regards supposés.',
          );
        } else {
          const { plan } = planned;
          const nameOf = (point: typeof plan.entry) => (point.accessId ? (data.undergroundAccess.find((item) => item.id === point.accessId)?.name ?? 'Accès') : 'Regard supposé');
          const [walkIn] = await surface([coordinates[0], plan.entry.coordinate], 'foot');
          const [walkOut] = await surface([plan.exit.coordinate, coordinates[coordinates.length - 1]], 'foot');
          const underground = undergroundPathLine(data, plan.path);
          // Tunnels de lignes réelles empruntés (données IDFM), dans l'ordre du trajet.
          const transitLines = [
            ...new Set(plan.path.segmentIds.flatMap((id) => data.undergroundSegments.find((segment) => segment.id === id)?.transitLines?.map((line) => line.name) ?? [])),
          ];
          result = [
            {
              id: 'underground',
              label: 'Par les souterrains',
              distanceM: walkIn.distanceM + plan.path.lengthM + walkOut.distanceM,
              durationMin: walkIn.durationMin + plan.path.durationMin + walkOut.durationMin,
              analysis: analyzeLegs(data, [
                { line: walkIn.geometry, travel: 'foot' },
                { line: walkOut.geometry, travel: 'foot' },
              ]),
              lines: [
                { coordinates: walkIn.geometry, kind: 'surface', travel: 'foot' },
                { coordinates: underground, kind: 'underground' },
                { coordinates: walkOut.geometry, kind: 'surface', travel: 'foot' },
              ],
              underground: { entry: nameOf(plan.entry), exit: nameOf(plan.exit), lengthM: plan.path.lengthM, levels: plan.path.levels, risk: plan.path.risk, transitLines },
            },
          ];
        }
      } else {
        const legTravel = points.slice(0, -1).map((point) => point.travel ?? profile);
        if (legTravel.every((travel) => travel === legTravel[0])) {
          // Un seul mode : une requête, avec variantes quand il n'y a pas d'étape.
          const routes = await surface(coordinates, legTravel[0]);
          result = routes.map((route, index) => ({
            id: `r${index}`,
            label: index === 0 ? 'Trajet principal' : `Variante ${index}`,
            distanceM: route.distanceM,
            durationMin: route.durationMin,
            analysis: analyzeLegs(data, [{ line: route.geometry, travel: legTravel[0] }]),
            lines: [{ coordinates: route.geometry, kind: 'surface' as const, travel: legTravel[0] }],
          }));
        } else {
          // Multimodal (ex. voiture jusqu'au parking puis à pied) : un calcul par tronçon, mis bout à bout.
          const legs = await Promise.all(legTravel.map(async (travel, index) => ({ travel, route: (await surface([coordinates[index], coordinates[index + 1]], travel))[0] })));
          result = [
            {
              id: 'multimodal',
              label: 'Voiture + à pied',
              distanceM: legs.reduce((total, leg) => total + leg.route.distanceM, 0),
              durationMin: legs.reduce((total, leg) => total + leg.route.durationMin, 0),
              analysis: analyzeLegs(
                data,
                legs.map((leg) => ({ line: leg.route.geometry, travel: leg.travel })),
              ),
              lines: legs.map((leg) => ({ coordinates: leg.route.geometry, kind: 'surface' as const, travel: leg.travel })),
            },
          ];
        }
      }
      if (cancelled) return;
      // Discret : la variante la moins risquée d'abord, puis la plus courte.
      if (mode === 'discreet') result.sort((a, b) => riskRank[a.analysis.risk] - riskRank[b.analysis.risk] || a.distanceM - b.distanceM);
      setCandidates(result);
      setSelected(0);
      setStatus('idle');
    };
    void run().catch((error) => {
      if (!cancelled) {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Calcul impossible.');
      }
    });
    return () => {
      cancelled = true;
    };
    // `data` est lu au moment du calcul ; on ne recalcule que si l'itinéraire demandé change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinates, legsKey, mode, profile, allowManholes]);

  // Tracé sur la carte : variante choisie en avant, autres variantes en retrait.
  useEffect(() => {
    if (candidates.length === 0) return onRouteChange(undefined);
    onRouteChange({
      type: 'FeatureCollection',
      features: candidates.flatMap((candidate, index) =>
        candidate.lines.map((line) => ({
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: line.coordinates },
          properties: { selected: index === selected, kind: line.kind, travel: line.travel ?? 'foot' },
        })),
      ),
    });
  }, [candidates, selected, onRouteChange]);
  useEffect(() => () => onRouteChange(undefined), [onRouteChange]);

  const current = candidates[selected];
  const setPoint = (index: number, value: string) => {
    const place = places.find((item) => item.id === value);
    if (!place?.coordinate) return;
    onPointsChange(points.map((point, i) => (i === index ? { coordinate: place.coordinate as Coordinate, label: place.name } : point)));
  };

  return (
    <aside className="floating-panel itinerary-panel" aria-label="Itinéraire">
      <header>
        <span className="eyebrow">ITINÉRAIRE</span>
        <button className="close-button" onClick={onClose} aria-label="Fermer l'itinéraire">
          ×
        </button>
      </header>
      <div className="segmented route-mode" role="radiogroup" aria-label="Mode">
        {modes.map((item) => (
          <button
            key={item.id}
            role="radio"
            aria-checked={mode === item.id}
            title={item.title}
            className={mode === item.id ? 'selected' : ''}
            onClick={() => onModeChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {mode !== 'underground' && (
        <div className="segmented" role="radiogroup" aria-label="Mode par défaut des tronçons" title="Mode par défaut ; chaque tronçon peut être changé ci-dessous">
          <button role="radio" aria-checked={profile === 'foot'} className={profile === 'foot' ? 'selected' : ''} onClick={() => onProfileChange('foot')}>
            À pied
          </button>
          <button role="radio" aria-checked={profile === 'car'} className={profile === 'car' ? 'selected' : ''} onClick={() => onProfileChange('car')}>
            En voiture
          </button>
        </div>
      )}

      <ol className="route-points">
        {points.map((point, index) => (
          <li key={index}>
            <span className={`route-pin ${index === 0 ? 'start' : index === points.length - 1 ? 'end' : ''}`}>{index === 0 ? 'A' : index === points.length - 1 ? 'B' : index}</span>
            <div>
              <small>{pointLabel(index, points.length)}</small>
              <select value="" onChange={(event) => setPoint(index, event.target.value)} aria-label={`${pointLabel(index, points.length)} : choisir un lieu`}>
                <option value="">{point.label}</option>
                {places.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.name}
                  </option>
                ))}
              </select>
            </div>
            {points.length > 2 && index > 0 && index < points.length - 1 && (
              <button className="icon-button" aria-label="Retirer l'étape" onClick={() => onPointsChange(points.filter((_, i) => i !== index))}>
                ×
              </button>
            )}
            {index < points.length - 1 && mode !== 'underground' && (
              <div className="leg-travel" role="radiogroup" aria-label="Mode du tronçon suivant">
                {(['car', 'foot'] as const).map((travel) => (
                  <button
                    key={travel}
                    role="radio"
                    aria-checked={(point.travel ?? profile) === travel}
                    className={(point.travel ?? profile) === travel ? 'selected' : ''}
                    onClick={() => onPointsChange(points.map((item, i) => (i === index ? { ...item, travel } : item)))}
                  >
                    {travel === 'car' ? '🚗 voiture' : '🚶 à pied'}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      {points.length < 2 && <p className="muted">Clic droit sur la carte : « Départ ici », « Arrivée ici », « Ajouter une étape ».</p>}
      {mode === 'underground' && (
        <label
          className="checkbox manhole-toggle"
          title="Hypothèse narrative : entrer ou sortir du réseau discret (égouts, rivières) par une jonction proche, comme par un regard."
        >
          <input type="checkbox" checked={allowManholes} onChange={(event) => setAllowManholes(event.target.checked)} /> Autoriser les regards supposés (égouts, rivières)
        </label>
      )}
      {mode === 'underground' && points.length > 2 && <p className="muted">Le mode souterrain relie le départ à l'arrivée ; les étapes ne sont pas prises en compte.</p>}
      {points.length >= 2 && mode !== 'underground' && (
        <div className="parking-tools">
          <button type="button" className="ghost-button" onClick={() => setParking(suggestParking(data, points[points.length - 1].coordinate))}>
            🅿 Stationnement stratégique avant l'arrivée
          </button>
          {parking && parking.length === 0 && (
            <p className="muted">Aucun parking connu à moins de 1,2 km. Marque un lieu avec le tag « parking » pour l'ajouter aux suggestions.</p>
          )}
          {parking?.map((place) => (
            <button
              key={`${place.coordinate.join(',')}`}
              className="result-row"
              onClick={() => {
                // Voiture jusqu'au parking, puis à pied jusqu'à l'arrivée.
                const before = points.slice(0, -1).map((point, i) => (i === points.length - 2 ? { ...point, travel: 'car' as const } : point));
                onPointsChange([...before, { coordinate: place.coordinate, label: `🅿 ${place.name}`, travel: 'foot' }, points[points.length - 1]]);
                setParking(undefined);
              }}
            >
              <span>🅿 {place.name}</span>
              <small>
                {place.reason} · {formatDistance(place.walkM)} à pied
              </small>
            </button>
          ))}
        </div>
      )}
      {status === 'loading' && <p className="muted">Calcul en cours…</p>}
      {message && <p className="muted hint">{message}</p>}

      {candidates.length > 1 && (
        <div className="route-candidates" role="radiogroup" aria-label="Variantes">
          {candidates.map((candidate, index) => (
            <button
              key={candidate.id}
              role="radio"
              aria-checked={selected === index}
              className={selected === index ? 'route-card selected' : 'route-card'}
              onClick={() => setSelected(index)}
            >
              <strong>{candidate.label}</strong>
              <span>
                {formatDistance(candidate.distanceM)} · {formatDuration(candidate.durationMin)}
              </span>
              <span className={`risk-badge ${riskClass[candidate.analysis.risk]}`}>{candidate.analysis.risk}</span>
            </button>
          ))}
        </div>
      )}

      {current && (
        <div className="route-summary">
          <div className="route-headline">
            <span
              className={`risk-badge ${riskClass[current.underground ? (riskRank[current.underground.risk as keyof typeof riskRank] > riskRank[current.analysis.risk] ? current.underground.risk : current.analysis.risk) : current.analysis.risk]}`}
            >
              Risque{' '}
              {current.underground && riskRank[current.underground.risk as keyof typeof riskRank] > riskRank[current.analysis.risk]
                ? current.underground.risk
                : current.analysis.risk}
            </span>
            <strong>{formatDistance(current.distanceM)}</strong>
            <span>· {formatDuration(current.durationMin)}</span>
          </div>
          {current.underground && (
            <p className="route-line">
              ▼ Entrée <b>{current.underground.entry}</b> → sortie <b>{current.underground.exit}</b> · {formatDistance(current.underground.lengthM)} sous terre ·{' '}
              {current.underground.levels.map((level) => `${level} (${levelNames[level as 0 | -1 | -2 | -3]})`).join(' → ')}
              {Boolean(current.underground.transitLines?.length) && <> · le long de {current.underground.transitLines?.join(', ')}</>}
            </p>
          )}
          <h3>Territoires traversés</h3>
          {current.analysis.territories.length === 0 && <p className="muted">Aucun territoire défini sur ce trajet.</p>}
          {current.analysis.territories.map((crossing) => (
            <div key={crossing.territoryId} className={`crossing ${crossing.stance ?? ''}`}>
              <button className="link-button" onClick={() => onOpen({ collection: 'territories', id: crossing.territoryId })}>
                {crossing.name}
              </button>
              <small>
                {formatDistance(crossing.distanceM)}
                {crossing.stance && ` · ${stanceOptions.find((option) => option.id === crossing.stance)?.name.toLowerCase()}`}
              </small>
              {crossing.traditions.length > 0 && <p>{crossing.traditions.map((tradition) => `${tradition.name}${tradition.note ? ` : ${tradition.note}` : ''}`).join(' · ')}</p>}
            </div>
          ))}
          {current.analysis.dangers.length > 0 && (
            <>
              <h3>Zones à risque</h3>
              {current.analysis.dangers.map((danger) => (
                <button key={danger.id} className="result-row" onClick={() => onOpen(danger)}>
                  <span>⚠ {danger.name}</span>
                  <small>à {formatDistance(danger.distanceM)}</small>
                </button>
              ))}
            </>
          )}
          {current.analysis.places.length > 0 && (
            <>
              <h3>Lieux importants proches</h3>
              {current.analysis.places.slice(0, 6).map((place) => (
                <button key={`${place.collection}/${place.id}`} className="result-row" onClick={() => onOpen(place)}>
                  <span>{entityName(data, place)}</span>
                  <small>à {formatDistance(place.distanceM)}</small>
                </button>
              ))}
            </>
          )}
          <p className="sheet-dates">
            Rues : {provider.label}. Le risque ne repose que sur les données de la chronique ; en voiture, un territoire hostile expose moins qu'à pied.
          </p>
        </div>
      )}

      <section className="saved-routes">
        <h3>Itinéraires enregistrés</h3>
        {points.length >= 2 && (
          <form
            className="save-route"
            onSubmit={(event) => {
              event.preventDefault();
              if (!saveName.trim()) return;
              void store.create('itineraries', {
                name: saveName.trim(),
                mode,
                points: points.map((point) => ({ coordinate: point.coordinate, label: point.label, travel: point.travel ?? null })),
              });
              setSaveName('');
            }}
          >
            <input value={saveName} placeholder="Nom (ex. Havre → Elyseum, discret)" onChange={(event) => setSaveName(event.target.value)} />
            <button className="ghost-button">Enregistrer</button>
          </form>
        )}
        {data.itineraries.length === 0 && <p className="muted">Aucun itinéraire enregistré. Ils sont partagés avec l'autre joueur.</p>}
        {data.itineraries.map((saved) => (
          <div key={saved.id} className="saved-route">
            <button
              className="result-row"
              onClick={() => {
                onModeChange(saved.mode as RouteMode);
                onPointsChange(saved.points.map((point) => ({ coordinate: point.coordinate, label: point.label, travel: point.travel ?? undefined })));
              }}
            >
              <span>{saved.name}</span>
              <small>
                {modes.find((item) => item.id === saved.mode)?.label} · {saved.points.length} points
              </small>
            </button>
            <button className="icon-button" aria-label={`Supprimer ${saved.name}`} onClick={() => void store.remove('itineraries', saved.id)}>
              ×
            </button>
          </div>
        ))}
      </section>
    </aside>
  );
}
