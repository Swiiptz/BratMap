import { Select } from '../../components/forms';
import { Collapsible } from '../../components/Collapsible';
import { useChronicle } from '../../data/ChronicleProvider';
import { activeFilterCount, type MapFilters } from '../../domain/mapFilters';
import { knowledgeLevels } from '../../domain/models';
import { undergroundOrigins } from '../../domain/underground';

const options = (items: Array<{ id: string; name?: string }>) =>
  items.map((item) => ({ id: item.id, name: item.name || 'Sans nom' })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

/** Filtres combinables de la carte : chaque critère ne restreint que les éléments qu'il concerne. */
export function MapFiltersPanel({ filters, onChange }: { filters: MapFilters; onChange: (filters: MapFilters) => void }) {
  const data = useChronicle();
  const count = activeFilterCount(filters);
  const set = (patch: MapFilters) => onChange({ ...filters, ...patch });
  const rows: Array<[string, keyof MapFilters, Array<{ id: string; name: string }>, string]> = [
    ['Type de ping', 'markerTypeId', options(data.refs.markerTypes), 'lieux'],
    ['Connaissance', 'knowledgeLevel', [...knowledgeLevels], 'lieux'],
    ['Territoire', 'territoryId', options(data.territories), 'tout ce qui y est rattaché'],
    ['Plot', 'plotId', options(data.plots), 'tout ce qui y est lié'],
    ['Propriétaire', 'ownerId', options(data.characters), 'havres et territoires'],
    ['Faction', 'factionId', options(data.refs.factions), 'territoires'],
    ['Tradition active', 'traditionId', options(data.refs.traditions), 'territoires'],
    ['Statut de plot', 'plotStatusId', options(data.refs.plotStatuses), 'plots'],
    ['Origine', 'origin', [...undergroundOrigins], 'souterrains'],
  ];

  return (
    <Collapsible id="filters" title="Filtres" defaultOpen={false} forceOpen={count > 0} badge={count > 0 ? <span className="filter-count">{count}</span> : undefined}>
      {count > 0 && (
        <button className="link-button reset-filters" onClick={() => onChange({})}>
          Réinitialiser les filtres
        </button>
      )}
      <div className="filter-grid">
        {rows.map(([label, key, values, scope]) => (
          <label key={key} className={filters[key] ? 'filter-row active' : 'filter-row'} title={`S'applique aux ${scope}`}>
            <span>{label}</span>
            <Select value={filters[key]} options={values} empty="Tous" onChange={(value) => set({ [key]: value })} />
          </label>
        ))}
      </div>
    </Collapsible>
  );
}
