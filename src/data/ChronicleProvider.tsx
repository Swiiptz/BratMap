import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { emptyChronicle, type ChronicleData } from '../domain/chronicle';
import { entityCollections, referentialCollections, type EntityCollection, type Referential, type ReferentialCollection } from '../domain/models';
import { ensureDefaultReferentials, store } from './index';
import { loadPublicUnderground, mergeReference, type PublicUnderground } from './publicUnderground';
import { APP_CONFIG_ID, defaultAppConfig, readAppConfig, type AppConfig } from '../domain/appConfig';

/** Itinéraire enregistré et partagé (points, mode de chaque tronçon). */
export type SavedItinerary = { id: string; name: string; mode: string; points: Array<{ coordinate: [number, number]; label: string; travel?: 'foot' | 'car' }> };
/** `loaded` : toutes les collections d'entités ont répondu une première fois (évite d'afficher l'accueil « base vide » trop tôt). */
type ChronicleState = ChronicleData & { loadError?: string; loaded: boolean; config: AppConfig; itineraries: SavedItinerary[] };
const ChronicleContext = createContext<ChronicleState>({ ...emptyChronicle(), loaded: false, config: defaultAppConfig, itineraries: [] });

const byOrder = (a: Referential, b: Referential) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, 'fr');

/** Un seul abonnement temps réel par collection pour toute l'application. */
export function ChronicleProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ChronicleData>(emptyChronicle);
  const [loadError, setLoadError] = useState<string>();
  const [reference, setReference] = useState<PublicUnderground>({ undergroundAccess: [], undergroundSegments: [] });
  const [trashed, setTrashed] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<AppConfig>(defaultAppConfig);
  const [itineraries, setItineraries] = useState<SavedItinerary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onError = (error: Error) => setLoadError(error.message);
    void ensureDefaultReferentials().catch(onError);
    const pending = new Set<string>(Object.keys(entityCollections));
    const entityUnsubscribes = (Object.keys(entityCollections) as EntityCollection[]).map((collection) =>
      store.subscribe(
        collection,
        (items) => {
          setData((current) => ({ ...current, [collection]: items }));
          if (pending.delete(collection) && pending.size === 0) setLoaded(true);
        },
        onError,
      ),
    );
    const refUnsubscribes = (Object.keys(referentialCollections) as ReferentialCollection[]).map((collection) =>
      store.subscribe(collection, (items) => setData((current) => ({ ...current, refs: { ...current.refs, [collection]: (items as Referential[]).sort(byOrder) } })), onError),
    );
    // Les éléments publics mis à la corbeille doivent rester masqués : on suit aussi les IDs supprimés.
    const trashedByCollection: Record<string, string[]> = {};
    const trashUnsubscribes = (['undergroundAccess', 'undergroundSegments'] as const).map((collection) =>
      store.subscribe(
        collection,
        (items) => {
          trashedByCollection[collection] = items.map((item) => item.id);
          setTrashed(new Set(Object.values(trashedByCollection).flat()));
        },
        onError,
        'only',
      ),
    );
    const configUnsubscribe = store.subscribe(
      'appConfig',
      (items) => setConfig(readAppConfig(items.find((item) => item.id === APP_CONFIG_ID) as Partial<AppConfig> | undefined)),
      onError,
    );
    const itineraryUnsubscribe = store.subscribe(
      'itineraries',
      (items) => setItineraries((items as unknown as SavedItinerary[]).sort((a, b) => a.name.localeCompare(b.name, 'fr'))),
      onError,
    );
    void loadPublicUnderground().then(setReference);
    return () => [...entityUnsubscribes, ...refUnsubscribes, ...trashUnsubscribes, configUnsubscribe, itineraryUnsubscribe].forEach((unsubscribe) => unsubscribe());
  }, []);

  const value = useMemo(
    () => ({
      ...data,
      undergroundAccess: mergeReference(reference.undergroundAccess, data.undergroundAccess, trashed),
      undergroundSegments: mergeReference(reference.undergroundSegments, data.undergroundSegments, trashed),
      loadError,
      loaded,
      config,
      itineraries,
    }),
    [data, reference, trashed, loadError, loaded, config, itineraries],
  );
  return <ChronicleContext.Provider value={value}>{children}</ChronicleContext.Provider>;
}

export const useChronicle = () => useContext(ChronicleContext);
