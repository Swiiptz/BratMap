import { useMemo, useState, type FormEvent } from 'react';
import { EntityPicker, Field, NumberInput, Select, TextArea, TextInput } from '../../components/forms';
import { Facts, Importance, LinkChips, SheetFooter } from '../../components/EntitySheet';
import { useEntityDraft } from '../../components/useEntityDraft';
import { store } from '../../data';
import { useChronicle } from '../../data/ChronicleProvider';
import { entityName, findEntity, refName, type ChronicleData, type EntityRef } from '../../domain/chronicle';
import { relatedEntities } from '../../domain/focus';
import type { EntityCollection, Plot } from '../../domain/models';
import { normalizeText } from '../../domain/text';

type Props = { selectedId?: string; onSelect: (id: string | undefined) => void; onOpen: (ref: EntityRef) => void; onShowOnMap: (ref: EntityRef) => void };
const options = (items: Array<{ id: string; name?: string }>) => items.map((item) => ({ id: item.id, name: item.name || 'Sans nom' }));

export function PlotsPage({ selectedId, onSelect, onOpen, onShowOnMap }: Props) {
  const data = useChronicle();
  const [query, setQuery] = useState('');
  const [statusId, setStatusId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const statusOrder = (id: string) => data.refs.plotStatuses.findIndex((status) => status.id === id);
  const filtered = useMemo(
    () =>
      data.plots
        .filter((plot) => (!statusId || plot.statusId === statusId) && normalizeText(`${plot.name} ${plot.description ?? ''}`).includes(normalizeText(query)))
        .sort((a, b) => statusOrder(a.statusId) - statusOrder(b.statusId) || (b.importance ?? 0) - (a.importance ?? 0) || a.name.localeCompare(b.name, 'fr')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.plots, data.refs.plotStatuses, query, statusId],
  );
  const selected = findEntity(data, 'plots', selectedId);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
    if (!name) return;
    const id = await store.create('plots', {
      name,
      statusId: 'upcoming',
      characterIds: [],
      locationIds: [],
      havenIds: [],
      territoryIds: [],
      undergroundAccessIds: [],
      undergroundSegmentIds: [],
    });
    setCreating(false);
    setEditing(true);
    onSelect(id);
  };

  return (
    <section className="module-page">
      <header className="module-header">
        <div>
          <span className="eyebrow">BRATMAP / CHRONIQUE</span>
          <h1>Plots</h1>
          <p>Les fils narratifs actifs et leurs connexions cartographiques.</p>
        </div>
        <button className="primary-button" onClick={() => setCreating(true)}>
          ＋ Nouveau plot
        </button>
      </header>
      <div className="module-toolbar">
        <label className="module-search">
          ⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un plot…" />
        </label>
        <Select value={statusId} options={options(data.refs.plotStatuses)} empty="Tous statuts" onChange={setStatusId} />
        <span>
          {filtered.length} plot{filtered.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className={selected ? 'plot-layout with-detail' : 'plot-layout'}>
        <div className="plot-grid">
          {filtered.length === 0 ? (
            <div className="no-data plot-empty">
              <span>◈</span>
              <h2>Aucun plot</h2>
              <p>{data.plots.length ? 'Aucun plot ne correspond aux filtres.' : 'Crée un premier fil narratif.'}</p>
            </div>
          ) : (
            filtered.map((plot) => {
              const related = relatedEntities(data, { collection: 'plots', id: plot.id });
              const status = data.refs.plotStatuses.find((item) => item.id === plot.statusId);
              return (
                <div
                  role="button"
                  tabIndex={0}
                  className={selectedId === plot.id ? 'plot-card selected' : 'plot-card'}
                  key={plot.id}
                  style={{ ['--status-color' as string]: status?.color ?? '#9dd7c4' }}
                  onClick={() => onSelect(plot.id)}
                  onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && (event.preventDefault(), onSelect(plot.id))}
                >
                  <div className="plot-card-top">
                    <span className="plot-status">{status?.name ?? plot.statusId}</span>
                    <Importance value={plot.importance} />
                  </div>
                  <h2>{plot.name}</h2>
                  <p>{plot.description || 'Aucune description renseignée.'}</p>
                  <footer>
                    <span>
                      {related.characters.size} personnages · {related.locations.size + related.havens.size} lieux · {related.territories.size} territoires
                    </span>
                    {(plot.pingGeometry || plot.zoneGeometry) && (
                      <button
                        type="button"
                        className="on-map"
                        title="Afficher ce plot sur la carte"
                        onClick={(event) => {
                          event.stopPropagation();
                          onShowOnMap({ collection: 'plots', id: plot.id });
                        }}
                      >
                        ◈ Sur la carte
                      </button>
                    )}
                  </footer>
                </div>
              );
            })
          )}
        </div>
        {selected && (
          <aside className="character-detail plot-detail">
            <PlotSheet
              key={selected.id}
              data={data}
              plot={selected}
              editing={editing}
              onToggleEdit={() => setEditing(!editing)}
              onClose={() => onSelect(undefined)}
              onOpen={onOpen}
              onShowOnMap={onShowOnMap}
            />
          </aside>
        )}
      </div>
      {creating && (
        <div className="modal-backdrop" onMouseDown={() => setCreating(false)}>
          <form className="entity-form" onSubmit={(event) => void create(event)} onMouseDown={(event) => event.stopPropagation()}>
            <div className="form-heading">
              <div>
                <span className="eyebrow">NOUVELLE ENTITÉ</span>
                <h2>Créer un plot</h2>
              </div>
              <button type="button" className="close-button" onClick={() => setCreating(false)}>
                ×
              </button>
            </div>
            <label>
              Nom
              <input name="name" autoFocus autoComplete="off" placeholder="Nom du plot" />
            </label>
            <button className="primary-button">Créer et compléter</button>
          </form>
        </div>
      )}
    </section>
  );
}

function PlotSheet({
  data,
  plot,
  editing,
  onToggleEdit,
  onClose,
  onOpen,
  onShowOnMap,
}: {
  data: ChronicleData;
  plot: Plot;
  editing: boolean;
  onToggleEdit: () => void;
  onClose: () => void;
  onOpen: (ref: EntityRef) => void;
  onShowOnMap: (ref: EntityRef) => void;
}) {
  const draftState = useEntityDraft('plots', plot);
  const { draft, update } = draftState;
  if (!draft) return null;
  const ref: EntityRef = { collection: 'plots', id: plot.id };
  const names = (target: EntityRef) => entityName(data, target);
  const related = relatedEntities(data, ref);
  const chips = (collection: EntityCollection) => <LinkChips refs={[...related[collection]].map((id) => ({ collection, id }))} names={names} onOpen={onOpen} />;

  return (
    <div className="sheet">
      <div className="sheet-toolbar">
        <span className="eyebrow">FICHE PLOT</span>
        <span>
          <button type="button" className="ghost-button" onClick={onToggleEdit}>
            {editing ? '◉ Consulter' : '✎ Modifier'}
          </button>
          <button type="button" className="close-button" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </span>
      </div>
      {editing ? (
        <div className="form-grid">
          <Field label="Nom" wide>
            <TextInput value={draft.name} onChange={(name) => update({ name })} />
          </Field>
          <Field label="Statut">
            <Select value={draft.statusId} options={options(data.refs.plotStatuses)} onChange={(statusId) => update({ statusId: statusId ?? 'upcoming' })} />
          </Field>
          <Field label="Importance (0-5)">
            <NumberInput value={draft.importance} max={5} onChange={(importance) => update({ importance })} />
          </Field>
          <Field label="Courte description" wide>
            <TextArea value={draft.description} onChange={(description) => update({ description })} />
          </Field>
          <Field label="Personnages" wide>
            <EntityPicker
              collection="characters"
              ids={draft.characterIds}
              options={options(data.characters)}
              onOpen={onOpen}
              onChange={(characterIds) => update({ characterIds })}
            />
          </Field>
          <Field label="Lieux" wide>
            <EntityPicker collection="locations" ids={draft.locationIds} options={options(data.locations)} onOpen={onOpen} onChange={(locationIds) => update({ locationIds })} />
          </Field>
          <Field label="Havres" wide>
            <EntityPicker collection="havens" ids={draft.havenIds} options={options(data.havens)} onOpen={onOpen} onChange={(havenIds) => update({ havenIds })} />
          </Field>
          <Field label="Territoires" wide>
            <EntityPicker
              collection="territories"
              ids={draft.territoryIds}
              options={options(data.territories)}
              onOpen={onOpen}
              onChange={(territoryIds) => update({ territoryIds })}
            />
          </Field>
          <Field label="Accès souterrains" wide>
            <EntityPicker
              collection="undergroundAccess"
              ids={draft.undergroundAccessIds}
              options={options(data.undergroundAccess)}
              onOpen={onOpen}
              onChange={(undergroundAccessIds) => update({ undergroundAccessIds })}
            />
          </Field>
          <Field label="Segments souterrains" wide>
            <EntityPicker
              collection="undergroundSegments"
              ids={draft.undergroundSegmentIds}
              options={data.undergroundSegments.map((item) => ({ id: item.id, name: entityName(data, { collection: 'undergroundSegments', id: item.id }) }))}
              onOpen={onOpen}
              onChange={(undergroundSegmentIds) => update({ undergroundSegmentIds })}
            />
          </Field>
          <Field label="Notes" wide>
            <TextArea value={draft.notes} rows={5} onChange={(notes) => update({ notes })} />
          </Field>
        </div>
      ) : (
        <>
          <h2>{plot.name}</h2>
          <p className="sheet-subtitle">
            {refName(data, 'plotStatuses', plot.statusId)} <Importance value={plot.importance} />
          </p>
          {plot.description && <p className="detail-description">{plot.description}</p>}
          <Facts
            rows={[
              ['Personnages', chips('characters')],
              ['Lieux', chips('locations')],
              ['Havres', chips('havens')],
              ['Territoires', chips('territories')],
              ['Accès souterrains', chips('undergroundAccess')],
              ['Segments souterrains', chips('undergroundSegments')],
              ['Notes', plot.notes],
            ]}
          />
          <p className="muted">Les liens déclarés depuis les fiches de lieux, havres ou personnages apparaissent aussi ici.</p>
        </>
      )}
      <SheetFooter entityRef={ref} entity={plot} draft={draftState} editMode={editing} onFocus={() => onShowOnMap(ref)} />
    </div>
  );
}
