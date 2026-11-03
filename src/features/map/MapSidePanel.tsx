import { forwardRef, useEffect, useMemo, useState } from 'react';
import { useChronicle } from '../../data/ChronicleProvider';
import { entityName, type EntityRef } from '../../domain/chronicle';
import { focusSize, type FocusSet } from '../../domain/focus';
import { entityCollections, type EntityCollection } from '../../domain/models';
import { searchChronicle } from '../../domain/search';
import type { LayerKey, LayerState, LayerVisibility } from './mapData';
import type { MapFilters } from '../../domain/mapFilters';
import { MapFiltersPanel } from './MapFiltersPanel';
import { Collapsible } from '../../components/Collapsible';
import { createBanGeocoder, type AddressHit } from '../../domain/geocoding';

const searchAddresses = createBanGeocoder();
import { useFavorites } from '../../app/favorites';

const layerItems: Array<{ key: LayerKey; label: string; swatch: string }> = [
  { key: 'locations', label: 'Lieux', swatch: '#87c6b2' },
  { key: 'havens', label: 'Havres', swatch: '#dba866' },
  { key: 'territories', label: 'Territoires', swatch: '#be8ec6' },
  { key: 'plots', label: 'Plots (ping et zone)', swatch: '#9dd7c4' },
  { key: 'underground', label: 'Réseau souterrain', swatch: '#70a8d8' },
  { key: 'undergroundAccess', label: 'Accès souterrains', swatch: '#8c8ff0' },
  { key: 'sewers', label: 'Égouts (CD92)', swatch: '#a07c4a' },
  { key: 'landmarks', label: 'Repères 3D', swatch: '#5d5647' },
  { key: 'realPois', label: 'POI réels', swatch: '#818b91' },
];
const visibilityCycle: Record<LayerVisibility, LayerVisibility> = { visible: 'dimmed', dimmed: 'hidden', hidden: 'visible' };
const visibilityLabel: Record<LayerVisibility, string> = { visible: '●', dimmed: '◐', hidden: '○' };
const visibilityTitle: Record<LayerVisibility, string> = { visible: 'Affichée', dimmed: 'Atténuée', hidden: 'Masquée' };

type Props = {
  open: boolean;
  onToggle: () => void;
  layers: LayerState;
  onLayersChange: (layers: LayerState) => void;
  focus?: EntityRef;
  focusSet?: FocusSet;
  onClearFocus: () => void;
  onOpen: (ref: EntityRef) => void;
  fadeIntensity: number;
  onFadeChange: (value: number) => void;
  plotsAbove: boolean;
  onPlotsAboveChange: (value: boolean) => void;
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
  onAddress: (hit: AddressHit) => void;
};

export const MapSidePanel = forwardRef<HTMLInputElement, Props>(function MapSidePanel(
  {
    open,
    onToggle,
    layers,
    onLayersChange,
    focus,
    focusSet,
    onClearFocus,
    onOpen,
    fadeIntensity,
    onFadeChange,
    plotsAbove,
    onPlotsAboveChange,
    filters,
    onFiltersChange,
    onAddress,
  },
  searchRef,
) {
  const data = useChronicle();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchChronicle(data, query), [data, query]);
  const favorites = useFavorites();
  const [addresses, setAddresses] = useState<AddressHit[]>([]);
  // Adresses réelles : interrogées après une courte pause de frappe.
  useEffect(() => {
    setAddresses([]);
    if (query.trim().length < 4) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchAddresses(query)
        .then((hits) => !cancelled && setAddresses(hits))
        .catch(() => undefined);
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <aside className={open ? 'left-panel' : 'left-panel collapsed'}>
      <button className="panel-toggle" onClick={onToggle} aria-label={open ? 'Replier le panneau' : 'Déplier le panneau'}>
        {open ? '‹' : '›'}
      </button>
      {open && (
        <div className="panel-content">
          <label className="search-field">
            <span>⌕</span>
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === 'Escape' && (setQuery(''), event.currentTarget.blur())}
              placeholder="Rechercher…  ( / )"
            />
          </label>
          {query && (
            <div className="search-results">
              {results.length === 0 && addresses.length === 0 && <p className="muted">Aucun résultat.</p>}
              {results.map((group) => (
                <section key={group.collection}>
                  <h3>{group.label}</h3>
                  {group.hits.map((hit) => (
                    <button key={hit.id} className="result-row" onClick={() => onOpen(hit)}>
                      <span>{hit.name}</span>
                      {hit.detail && <small>{hit.detail}</small>}
                    </button>
                  ))}
                </section>
              ))}
              {addresses.length > 0 && (
                <section>
                  <h3>Adresses</h3>
                  {addresses.map((hit) => (
                    <button key={`${hit.label}-${hit.coordinate.join(',')}`} className="result-row" onClick={() => onAddress(hit)}>
                      <span>⌖ {hit.label}</span>
                      <small>{hit.context}</small>
                    </button>
                  ))}
                </section>
              )}
            </div>
          )}

          {focus && focusSet && (
            <div className="panel-section focus-section">
              <div className="section-title">
                Focus actif
                <button className="link-button" onClick={onClearFocus}>
                  quitter
                </button>
              </div>
              <button className="focus-title" onClick={() => onOpen(focus)}>
                {entityName(data, focus)} <small>{entityCollections[focus.collection]}</small>
              </button>
              <p className="muted">{focusSize(focusSet) - 1} élément(s) relié(s)</p>
              <div className="focus-list">
                {(Object.keys(focusSet) as EntityCollection[])
                  .flatMap((collection) => [...focusSet[collection]].map((id) => ({ collection, id })))
                  .filter((ref) => !(ref.collection === focus.collection && ref.id === focus.id))
                  .map((ref) => (
                    <button key={`${ref.collection}/${ref.id}`} className="result-row" onClick={() => onOpen(ref)}>
                      <span>{entityName(data, ref)}</span>
                      <small>{entityCollections[ref.collection]}</small>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {favorites.refs.length > 0 && (
            <Collapsible id="favorites" title="Favoris" badge={<span className="section-count">{favorites.refs.length}</span>}>
              {favorites.refs.map((ref) => (
                <button key={`${ref.collection}/${ref.id}`} className="result-row" onClick={() => onOpen(ref)}>
                  <span>★ {entityName(data, ref)}</span>
                  <small>{entityCollections[ref.collection]}</small>
                </button>
              ))}
            </Collapsible>
          )}

          <Collapsible id="layers" title="Couches">
            {layerItems.map((item) => (
              <button
                type="button"
                className={`layer-row ${layers[item.key]}`}
                key={item.key}
                title={`${visibilityTitle[layers[item.key]]} — cliquer : affichée → atténuée → masquée`}
                onClick={() => onLayersChange({ ...layers, [item.key]: visibilityCycle[layers[item.key]] })}
              >
                <span className="layer-swatch" style={{ background: item.swatch }} />
                <span className="layer-name">{item.label}</span>
                <span className="layer-state" aria-label={visibilityTitle[layers[item.key]]}>
                  {visibilityLabel[layers[item.key]]}
                </span>
              </button>
            ))}
          </Collapsible>

          <MapFiltersPanel filters={filters} onChange={onFiltersChange} />

          <Collapsible id="display" title="Affichage" defaultOpen={false}>
            <div className="section-subtitle">Ordre des zones</div>
            <div className="segmented" role="radiogroup" aria-label="Ordre des zones">
              <button role="radio" aria-checked={plotsAbove} className={plotsAbove ? 'selected' : ''} onClick={() => onPlotsAboveChange(true)}>
                Plots au-dessus
              </button>
              <button role="radio" aria-checked={!plotsAbove} className={!plotsAbove ? 'selected' : ''} onClick={() => onPlotsAboveChange(false)}>
                Territoires au-dessus
              </button>
            </div>
            <div className="section-subtitle">Fondu hors zone</div>
            <CommitSlider value={fadeIntensity} onCommit={onFadeChange} label="Intensité du fondu hors zone principale" />
            <small className="muted">Réglage partagé avec l'autre joueur.</small>
          </Collapsible>

          <div className="panel-section counts">
            <span>{data.locations.length} lieux</span>
            <span>{data.havens.length} havres</span>
            <span>{data.territories.length} territoires</span>
          </div>
        </div>
      )}
    </aside>
  );
});

/** Curseur qui n'enregistre qu'au relâchement (une seule écriture partagée par réglage). */
function CommitSlider({ value, onCommit, label }: { value: number; onCommit: (value: number) => void; label: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => draft !== value && onCommit(draft);
  return (
    <input
      className="range"
      type="range"
      min={0}
      max={1}
      step={0.05}
      value={draft}
      aria-label={label}
      onChange={(event) => setDraft(Number(event.target.value))}
      onPointerUp={commit}
      onKeyUp={commit}
      onBlur={commit}
    />
  );
}
