import { useCallback, useSyncExternalStore } from 'react';
import type { EntityRef } from '../domain/chronicle';
import { entityCollections, type EntityCollection } from '../domain/models';

export type AppView = 'map' | 'characters' | 'plots' | 'settings';
/** Position de carte partageable ; `marker` pose un marqueur temporaire au centre. */
export type MapPosition = { lng: number; lat: number; zoom: number; marker?: boolean };
export type Route = { view: AppView; id?: string; select?: EntityRef; focus?: EntityRef; position?: MapPosition };

const views: AppView[] = ['map', 'characters', 'plots', 'settings'];
const isCollection = (value: string | undefined): value is EntityCollection => Boolean(value && value in entityCollections);

/**
 * Routage par hash, suffisant pour des liens partageables et l'historique navigateur :
 * `#/characters/<id>`, `#/plots/<id>`, `#/map/<collection>/<id>`, `#/map/focus/<collection>/<id>`,
 * `#/map/@<lng>,<lat>,<zoom>` (position) et `#/map/@<lng>,<lat>,<zoom>,m` (position + marqueur partagé).
 */
export function parseRoute(hash: string): Route {
  const [rawView, ...rest] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const view = views.includes(rawView as AppView) ? (rawView as AppView) : 'map';
  if (view !== 'map') return { view, id: rest[0] || undefined };
  if (rest[0]?.startsWith('@')) {
    const [lng, lat, zoom, marker] = rest[0].slice(1).split(',');
    const position = { lng: Number(lng), lat: Number(lat), zoom: Number(zoom) || 15, marker: marker === 'm' };
    if (Number.isFinite(position.lng) && Number.isFinite(position.lat)) return { view, position };
  }
  if (rest[0] === 'focus' && isCollection(rest[1]) && rest[2]) return { view, focus: { collection: rest[1], id: rest[2] } };
  if (isCollection(rest[0]) && rest[1]) return { view, select: { collection: rest[0], id: rest[1] } };
  return { view };
}

export function formatRoute(route: Route): string {
  const parts: string[] = [route.view];
  if (route.view === 'map' && route.position)
    return `#/map/@${route.position.lng.toFixed(6)},${route.position.lat.toFixed(6)},${route.position.zoom.toFixed(2)}${route.position.marker ? ',m' : ''}`;
  if (route.view === 'map' && route.focus) parts.push('focus', route.focus.collection, route.focus.id);
  else if (route.view === 'map' && route.select) parts.push(route.select.collection, route.select.id);
  else if (route.id) parts.push(route.id);
  return `#/${parts.map(encodeURIComponent).join('/')}`;
}

/** Route d'ouverture d'une fiche : page dédiée pour personnages et plots, carte pour le reste. */
export function routeForEntity(ref: EntityRef): Route {
  if (ref.collection === 'characters') return { view: 'characters', id: ref.id };
  if (ref.collection === 'plots') return { view: 'plots', id: ref.id };
  return { view: 'map', select: ref };
}

const subscribe = (listener: () => void) => {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
};

export function useRoute(): [Route, (route: Route, replace?: boolean) => void] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  const navigate = useCallback((route: Route, replace = false) => {
    const next = formatRoute(route);
    if (next === window.location.hash) return;
    if (replace) {
      window.history.replaceState(null, '', next);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else window.location.hash = next;
  }, []);
  return [parseRoute(hash), navigate];
}

export const shareUrl = (route: Route) => `${window.location.origin}${window.location.pathname}${formatRoute(route)}`;
