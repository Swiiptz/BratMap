import { useMemo, useState, type FormEvent } from 'react';
import { EntityPicker, Field, LeveledList, NumberInput, RefCombo, Select, TextArea, TextInput } from '../../components/forms';
import { Facts, Importance, LinkChips, SheetFooter } from '../../components/EntitySheet';
import { useEntityDraft } from '../../components/useEntityDraft';
import { store } from '../../data';
import { useChronicle } from '../../data/ChronicleProvider';
import { entityName, findEntity, refName, type ChronicleData, type EntityRef } from '../../domain/chronicle';
import { relationTypes, type Character } from '../../domain/models';
import { filterCharacters, type CharacterFilters as Filters } from '../../domain/filters';

type Props = { selectedId?: string; onSelect: (id: string | undefined) => void; onOpen: (ref: EntityRef) => void; onShowOnMap: (ref: EntityRef) => void };

const options = (items: Array<{ id: string; name?: string }>) => items.map((item) => ({ id: item.id, name: item.name || 'Sans nom' }));
const newInfluenceId = () => Math.random().toString(36).slice(2, 10);

export function CharactersPage({ selectedId, onSelect, onOpen, onShowOnMap }: Props) {
  const data = useChronicle();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>({});
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const filtered = useMemo(
    () => filterCharacters(data.characters, query, filters).sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0) || a.name.localeCompare(b.name, 'fr')),
    [data.characters, query, filters],
  );
  const selected = findEntity(data, 'characters', selectedId);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
    if (!name) return;
    const id = await store.create('characters', {
      name,
      statusId: 'active',
      disciplines: [],
      skills: [],
      specialAbilities: [],
      influences: [],
      locationIds: [],
      territoryIds: [],
      plotIds: [],
      relations: [],
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
          <h1>Personnages</h1>
          <p>Les figures connues, leurs liens et leurs empreintes dans le territoire.</p>
        </div>
        <button className="primary-button" onClick={() => setCreating(true)}>
          ＋ Nouveau personnage
        </button>
      </header>
      <div className="module-toolbar">
        <label className="module-search">
          ⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un personnage…" />
        </label>
        <Select value={filters.clanId} options={options(data.refs.clans)} empty="Tous clans" onChange={(clanId) => setFilters({ ...filters, clanId })} />
        <Select value={filters.factionId} options={options(data.refs.factions)} empty="Toutes factions" onChange={(factionId) => setFilters({ ...filters, factionId })} />
        <Select value={filters.statusId} options={options(data.refs.characterStatuses)} empty="Tous statuts" onChange={(statusId) => setFilters({ ...filters, statusId })} />
        <Select value={filters.territoryId} options={options(data.territories)} empty="Tous territoires" onChange={(territoryId) => setFilters({ ...filters, territoryId })} />
        <Select value={filters.domainId} options={options(data.refs.influenceDomains)} empty="Toutes influences" onChange={(domainId) => setFilters({ ...filters, domainId })} />
        <span>
          {filtered.length} entrée{filtered.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="character-layout">
        <div className="character-list">
          {filtered.length === 0 ? (
            <div className="no-data">
              <span>♙</span>
              <h2>Aucun personnage</h2>
              <p>{data.characters.length ? 'Aucun personnage ne correspond aux filtres.' : 'Crée un premier personnage pour commencer.'}</p>
            </div>
          ) : (
            filtered.map((character) => (
              <button className={selectedId === character.id ? 'character-row selected' : 'character-row'} key={character.id} onClick={() => onSelect(character.id)}>
                <span className="avatar" style={{ ['--faction' as string]: data.refs.factions.find((faction) => faction.id === character.factionId)?.color ?? '#658d84' }}>
                  {character.imageUrl ? <img src={character.imageUrl} alt="" /> : character.name.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{character.name}</strong>
                  <small>
                    {[
                      refName(data, 'clans', character.clanId),
                      refName(data, 'factions', character.factionId),
                      character.mainHavenId && entityName(data, { collection: 'havens', id: character.mainHavenId }),
                      character.territoryIds[0] && entityName(data, { collection: 'territories', id: character.territoryIds[0] }),
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Identité non renseignée'}
                  </small>
                </span>
                <Importance value={character.importance} />
                <em className="status-pill" style={{ ['--pill' as string]: data.refs.characterStatuses.find((status) => status.id === character.statusId)?.color ?? '#9aa7ae' }}>
                  {refName(data, 'characterStatuses', character.statusId) ?? 'inconnu'}
                </em>
              </button>
            ))
          )}
        </div>
        <aside className="character-detail">
          {selected ? (
            <CharacterSheet
              key={selected.id}
              data={data}
              character={selected}
              editing={editing}
              onToggleEdit={() => setEditing(!editing)}
              onOpen={onOpen}
              onShowOnMap={onShowOnMap}
            />
          ) : (
            <div className="detail-empty">
              <span>◈</span>
              <p>
                Sélectionne un personnage
                <br />
                pour ouvrir sa fiche.
              </p>
            </div>
          )}
        </aside>
      </div>
      {creating && (
        <div className="modal-backdrop" onMouseDown={() => setCreating(false)}>
          <form className="entity-form" onSubmit={(event) => void create(event)} onMouseDown={(event) => event.stopPropagation()}>
            <div className="form-heading">
              <div>
                <span className="eyebrow">NOUVELLE ENTITÉ</span>
                <h2>Créer un personnage</h2>
              </div>
              <button type="button" className="close-button" onClick={() => setCreating(false)}>
                ×
              </button>
            </div>
            <label>
              Nom
              <input name="name" autoFocus autoComplete="off" placeholder="Nom du personnage" />
            </label>
            <button className="primary-button">Créer et compléter la fiche</button>
          </form>
        </div>
      )}
    </section>
  );
}

function CharacterSheet({
  data,
  character,
  editing,
  onToggleEdit,
  onOpen,
  onShowOnMap,
}: {
  data: ChronicleData;
  character: Character;
  editing: boolean;
  onToggleEdit: () => void;
  onOpen: (ref: EntityRef) => void;
  onShowOnMap: (ref: EntityRef) => void;
}) {
  const draftState = useEntityDraft('characters', character);
  const { draft, update } = draftState;
  if (!draft) return null;
  const ref: EntityRef = { collection: 'characters', id: character.id };
  const names = (target: EntityRef) => entityName(data, target);
  const others = options(data.characters.filter((item) => item.id !== character.id));
  const refList = (collection: 'disciplines' | 'skills' | 'specialAbilities', rows: Array<{ refId: string; level?: number }>) =>
    rows.length ? rows.map((row) => `${refName(data, collection, row.refId)}${row.level !== undefined ? ` ${row.level}` : ''}`).join(' · ') : undefined;

  return (
    <div className="sheet">
      <div className="sheet-toolbar">
        <span className="eyebrow">FICHE PERSONNAGE</span>
        <button type="button" className="ghost-button" onClick={onToggleEdit}>
          {editing ? '◉ Consulter' : '✎ Modifier'}
        </button>
      </div>
      {editing ? (
        <div className="form-grid">
          <Field label="Nom">
            <TextInput value={draft.name} onChange={(name) => update({ name })} />
          </Field>
          <Field label="Surnom">
            <TextInput value={draft.nickname} onChange={(nickname) => update({ nickname })} />
          </Field>
          <Field label="Clan">
            <RefCombo collection="clans" value={draft.clanId} onChange={(clanId) => update({ clanId })} />
          </Field>
          <Field label="Faction">
            <RefCombo collection="factions" value={draft.factionId} onChange={(factionId) => update({ factionId })} />
          </Field>
          <Field label="Coterie">
            <RefCombo collection="coteries" value={draft.coterieId} placeholder="Nom (créée si nouvelle)" onChange={(coterieId) => update({ coterieId })} />
          </Field>
          <Field label="Statut">
            <Select value={draft.statusId} options={options(data.refs.characterStatuses)} empty="—" onChange={(statusId) => update({ statusId })} />
          </Field>
          <Field label="Génération">
            <TextInput value={draft.generation} onChange={(generation) => update({ generation })} />
          </Field>
          <Field label="Importance (0-5)">
            <NumberInput value={draft.importance} max={5} onChange={(importance) => update({ importance })} />
          </Field>
          <Field label="Image (URL)">
            <TextInput value={draft.imageUrl} onChange={(imageUrl) => update({ imageUrl })} />
          </Field>
          <Field label="Description courte" wide>
            <TextArea value={draft.description} onChange={(description) => update({ description })} />
          </Field>
          <Field label="Disciplines" wide>
            <LeveledList
              collection="disciplines"
              rows={draft.disciplines.map((row) => ({ refId: row.disciplineId, level: row.level }))}
              onChange={(rows) => update({ disciplines: rows.map((row) => ({ disciplineId: row.refId, level: row.level ?? 0 })) })}
            />
          </Field>
          <Field label="Compétences" wide>
            <LeveledList
              collection="skills"
              rows={draft.skills.map((row) => ({ refId: row.skillId, level: row.level }))}
              onChange={(rows) => update({ skills: rows.map((row) => ({ skillId: row.refId, level: row.level ?? 0 })) })}
            />
          </Field>
          <Field label="Capacités particulières" wide>
            <LeveledList
              collection="specialAbilities"
              optionalLevel
              rows={draft.specialAbilities.map((row) => ({ refId: row.abilityId, level: row.level }))}
              onChange={(rows) => update({ specialAbilities: rows.map((row) => ({ abilityId: row.refId, ...(row.level !== undefined ? { level: row.level } : {}) })) })}
            />
          </Field>
          <fieldset className="field-wide">
            <legend>Influences</legend>
            {draft.influences.map((influence, index) => {
              const set = (patch: Partial<typeof influence>) => update({ influences: draft.influences.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
              return (
                <div className="influence-row" key={influence.id}>
                  <input value={influence.name} placeholder="Nom (ex. Commissariat du 15e)" onChange={(event) => set({ name: event.target.value })} />
                  <RefCombo collection="influenceDomains" value={influence.domainId} placeholder="Domaine" onChange={(domainId) => set({ domainId: domainId ?? '' })} />
                  <NumberInput value={influence.level} max={5} onChange={(level) => set({ level: level ?? 0 })} />
                  <Select value={influence.locationId} options={options(data.locations)} empty="Lieu —" onChange={(locationId) => set({ locationId })} />
                  <button type="button" className="icon-button" aria-label="Retirer" onClick={() => update({ influences: draft.influences.filter((_, i) => i !== index) })}>
                    ×
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              className="ghost-button"
              onClick={() => update({ influences: [...draft.influences, { id: newInfluenceId(), name: '', domainId: '', level: 1 }] })}
            >
              ＋ Ajouter une influence
            </button>
          </fieldset>
          <Field label="Havre principal">
            <Select value={draft.mainHavenId} options={options(data.havens)} empty="Aucun" onChange={(mainHavenId) => update({ mainHavenId })} />
          </Field>
          <Field label="Autres lieux" wide>
            <EntityPicker collection="locations" ids={draft.locationIds} options={options(data.locations)} onOpen={onOpen} onChange={(locationIds) => update({ locationIds })} />
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
          <Field label="Plots" wide>
            <EntityPicker collection="plots" ids={draft.plotIds} options={options(data.plots)} onOpen={onOpen} onChange={(plotIds) => update({ plotIds })} />
          </Field>
          <fieldset className="field-wide">
            <legend>Relations</legend>
            {draft.relations.map((relation, index) => {
              const set = (patch: Partial<typeof relation>) => update({ relations: draft.relations.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
              return (
                <div className="relation-row" key={`${relation.characterId}-${index}`}>
                  <Select value={relation.characterId} options={others} onChange={(characterId) => characterId && set({ characterId })} />
                  <Select value={relation.type} options={relationTypes} onChange={(type) => set({ type: type ?? 'custom' })} />
                  <input value={relation.note ?? ''} placeholder="Note" onChange={(event) => set({ note: event.target.value })} />
                  <button type="button" className="icon-button" aria-label="Retirer" onClick={() => update({ relations: draft.relations.filter((_, i) => i !== index) })}>
                    ×
                  </button>
                </div>
              );
            })}
            {others.length > 0 && (
              <button type="button" className="ghost-button" onClick={() => update({ relations: [...draft.relations, { characterId: others[0].id, type: 'ally' }] })}>
                ＋ Ajouter une relation
              </button>
            )}
          </fieldset>
          <Field label="Notes" wide>
            <TextArea value={draft.notes} rows={4} onChange={(notes) => update({ notes })} />
          </Field>
        </div>
      ) : (
        <>
          <div className="character-identity">
            {character.imageUrl && <img className="portrait" src={character.imageUrl} alt="" />}
            <div>
              <h2>{character.name}</h2>
              {character.nickname && <p className="nickname">« {character.nickname} »</p>}
              <Importance value={character.importance} />
            </div>
          </div>
          <div className="detail-grid">
            <span>
              Clan<strong>{refName(data, 'clans', character.clanId) ?? '—'}</strong>
            </span>
            <span>
              Faction<strong>{refName(data, 'factions', character.factionId) ?? '—'}</strong>
            </span>
            <span>
              Statut<strong>{refName(data, 'characterStatuses', character.statusId) ?? '—'}</strong>
            </span>
            <span>
              Génération<strong>{character.generation || '—'}</strong>
            </span>
            <span>
              Coterie<strong>{refName(data, 'coteries', character.coterieId) ?? '—'}</strong>
            </span>
          </div>
          {character.description && <p className="detail-description">{character.description}</p>}
          <Facts
            rows={[
              [
                'Disciplines',
                refList(
                  'disciplines',
                  character.disciplines.map((row) => ({ refId: row.disciplineId, level: row.level })),
                ),
              ],
              [
                'Compétences',
                refList(
                  'skills',
                  character.skills.map((row) => ({ refId: row.skillId, level: row.level })),
                ),
              ],
              [
                'Capacités',
                refList(
                  'specialAbilities',
                  character.specialAbilities.map((row) => ({ refId: row.abilityId, level: row.level })),
                ),
              ],
              [
                'Influences',
                character.influences.length ? (
                  <ul className="plain-list">
                    {character.influences.map((influence) => (
                      <li key={influence.id}>
                        {influence.name || refName(data, 'influenceDomains', influence.domainId)}{' '}
                        <small>
                          {refName(data, 'influenceDomains', influence.domainId)} · {influence.level}
                        </small>
                        {influence.locationId && <LinkChips refs={[{ collection: 'locations', id: influence.locationId }]} names={names} onOpen={onOpen} />}
                      </li>
                    ))}
                  </ul>
                ) : undefined,
              ],
              ['Havre principal', character.mainHavenId ? <LinkChips refs={[{ collection: 'havens', id: character.mainHavenId }]} names={names} onOpen={onOpen} /> : undefined],
              ['Lieux', <LinkChips refs={character.locationIds.map((id) => ({ collection: 'locations', id }))} names={names} onOpen={onOpen} />],
              ['Territoires', <LinkChips refs={character.territoryIds.map((id) => ({ collection: 'territories', id }))} names={names} onOpen={onOpen} />],
              ['Plots', <LinkChips refs={character.plotIds.map((id) => ({ collection: 'plots', id }))} names={names} onOpen={onOpen} />],
              [
                'Relations',
                character.relations.length ? (
                  <ul className="plain-list">
                    {character.relations.map((relation, index) => (
                      <li key={index}>
                        <LinkChips refs={[{ collection: 'characters', id: relation.characterId }]} names={names} onOpen={onOpen} />{' '}
                        <small>{relationTypes.find((type) => type.id === relation.type)?.name ?? relation.type}</small> {relation.note}
                      </li>
                    ))}
                  </ul>
                ) : undefined,
              ],
              ['Notes', character.notes],
            ]}
          />
        </>
      )}
      <SheetFooter entityRef={ref} entity={character} draft={draftState} editMode={editing} onFocus={() => onShowOnMap(ref)} />
    </div>
  );
}
