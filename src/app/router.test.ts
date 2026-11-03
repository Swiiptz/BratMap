import { describe, expect, it } from 'vitest';
import { formatRoute, parseRoute } from './router';

describe('routes partageables', () => {
  it('fait un aller-retour pour chaque forme de lien', () => {
    for (const hash of ['#/map', '#/characters/abc', '#/plots', '#/map/locations/l1', '#/map/focus/plots/p1', '#/settings']) {
      expect(formatRoute(parseRoute(hash))).toBe(hash);
    }
  });

  it('retombe sur la carte pour un lien inconnu', () => {
    expect(parseRoute('#/nimporte/quoi')).toEqual({ view: 'map' });
    expect(parseRoute('#/map/inconnu/x')).toEqual({ view: 'map' });
  });
});

describe('positions partageables', () => {
  it('encode et relit une position, avec ou sans marqueur', () => {
    const route = parseRoute('#/map/@2.300000,48.860000,15.50,m');
    expect(route).toEqual({ view: 'map', position: { lng: 2.3, lat: 48.86, zoom: 15.5, marker: true } });
    expect(formatRoute(route)).toBe('#/map/@2.300000,48.860000,15.50,m');
    expect(parseRoute('#/map/@abc,def,1')).toEqual({ view: 'map' });
  });
});
