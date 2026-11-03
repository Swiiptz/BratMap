import { SheetSection } from '../../components/Collapsible';
import type { ReactNode } from 'react';
import { EntityPicker, Field, NumberInput, RefCombo, Select, TextArea, TextInput } from '../../components/forms';
import { Facts, Importance, LinkChips, SheetFooter } from '../../components/EntitySheet';
import { useEntityDraft } from '../../components/useEntityDraft';
import { useChronicle } from '../../data/ChronicleProvider';
import { entityName, findEntity, refName, type ChronicleData, type EntityRef } from '../../domain/chronicle';
import { formatArea, ringAreaM2 } from '../../domain/geometry';
import { relatedEntities } from '../../domain/focus';
import { saveEntity } from '../../data';
import { undergroundWithin } from '../../domain/underground';
import { entityCollections, knowledgeLevels, type Plot, type Haven, type Location, type Territory, type UndergroundAccess, type UndergroundSegment } from '../../domain/models';
import { Building3dFields, building3dSummary } from './Building3dFields';
import { MarkerAppearance } from './MarkerAppearance';
import { LayerOrderControls } from './LayerOrderControls';
import { ColorPalette, PingPreview } from '../../components/Pickers';
import { resolveIcon } from '../../domain/icons';
import { duplicate, options, refsOf } from './sheetHelpers';
import { AccessSheet, SegmentSheet } from './UndergroundSheets';
import { parseTags } from '../../domain/text';

export type PanelProps = {
  entityRef: EntityRef;
  editMode: boolean;
  onClose: () => void;
  onOpen: (ref: EntityRef) => void;
  onFocus: (ref: EntityRef) => void;
  onSelect: (ref: EntityRef) => void;
  geometryControls?: ReactNode;
  onShowPath: (segmentIds: string[] | undefined) => void;
};

export function EntityPanel(props: PanelProps) {
  const data = useChronicle();
  const { entityRef, onClose } = props;
  const entity = findEntity(data, entityRef.collection, entityRef.id);

  return (
    <aside className="right-panel" aria-label="Fiche de l'élément sélectionné">
      <header className="sheet-header">
        <span className="eyebrow">{entityCollections[entityRef.collection].toUpperCase()}</span>
        <button type="button" className="close-button" onClick={onClose} aria-label="Fermer la fiche">
          ×
        </button>
      </header>
      {!entity ? (
        <p className="sheet-empty">Cet élément n'existe plus ou est dans la corbeille.</p>
      ) : entityRef.collection === 'locations' ? (
        <LocationSheet {...props} data={data} entity={entity as Location} />
      ) : entityRef.collection === 'havens' ? (
        <HavenSheet {...props} data={data} entity={entity as Haven} />
      ) : entityRef.collection === 'territories' ? (
        <TerritorySheet {...props} data={data} entity={entity as Territory} />
      ) : entityRef.collection === 'plots' ? (
        <PlotMapSheet {...props} data={data} entity={entity as Plot} />
      ) : entityRef.collection === 'undergroundAccess' ? (
        <AccessSheet {...props} data={data} entity={entity as UndergroundAccess} />
      ) : entityRef.collection === 'undergroundSegments' ? (
        <SegmentSheet {...props} data={data} entity={entity as UndergroundSegment} />
      ) : null}
    </aside>
  );
}

export const stanceOptions = [
  { id: 'friendly' as const, name: 'Amical' },
  { id: 'neutral' as const, name: 'Neutre' },
  { id: 'hostile' as const, name: 'Hostile' },
];

export type SheetProps<T> = PanelProps & { data: ChronicleData; entity: T };

function LocationSheet({ data, entity, editMode, onOpen, onFocus, onSelect }: SheetProps<Location>) {
  const draftState = useEntityDraft('locations', entity);
  const { draft, update } = draftState;
  if (!draft) return null;
  const names = (ref: EntityRef) => entityName(data, ref);
  const typeOptions = options(data.refs.markerTypes);

  return (
    <div className="sheet">
      {editMode ? (
        <div className="sheet-sections">
          <SheetSection id="identity" title="Identité">
            <Field label="Nom" wide>
              <TextInput value={draft.name} onChange={(name) => update({ name })} />
            </Field>
            <Field label="Type">
              <Select
                value={draft.typeId}
                options={typeOptions}
                onChange={(typeId) =>
                  update({
                    typeId: typeId ?? 'place',
                    markerStyle: { ...draft.markerStyle, color: data.refs.markerTypes.find((type) => type.id === typeId)?.color ?? draft.markerStyle.color },
                  })
                }
              />
            </Field>
            <Field label="Connaissance">
              <Select value={draft.knowledgeLevel} options={knowledgeLevels} empty="—" onChange={(knowledgeLevel) => update({ knowledgeLevel })} />
            </Field>
            <Field label="Adresse" wide>
              <TextInput value={draft.address} onChange={(address) => update({ address })} />
            </Field>
            <Field label="Description" wide>
              <TextArea value={draft.description} onChange={(description) => update({ description })} />
            </Field>
            <Field label="Importance (0-5)">
              <NumberInput value={draft.importance} max={5} onChange={(importance) => update({ importance })} />
            </Field>
            <Field label="Tags (séparés par des virgules)" wide>
              <TextInput value={draft.tags.join(', ')} onChange={(value) => update({ tags: parseTags(value) })} />
            </Field>
          </SheetSection>
          <SheetSection id="links" title="Liens">
            <Field label="Territoire" wide>
              <Select value={draft.territoryId} options={options(data.territories)} empty="Aucun" onChange={(territoryId) => update({ territoryId })} />
            </Field>
            <Field label="Personnages associés" wide>
              <EntityPicker
                collection="characters"
                ids={draft.characterIds}
                options={options(data.characters)}
                onOpen={onOpen}
                onChange={(characterIds) => update({ characterIds })}
              />
            </Field>
            <Field label="Plots associés" wide>
              <EntityPicker collection="plots" ids={draft.plotIds} options={options(data.plots)} onOpen={onOpen} onChange={(plotIds) => update({ plotIds })} />
            </Field>
          </SheetSection>
          <SheetSection id="appearance" title="Apparence">
            <MarkerAppearance
              style={draft.markerStyle}
              fallbackIcon={data.refs.markerTypes.find((type) => type.id === draft.typeId)?.icon ?? 'diamond'}
              square={false}
              defaultSize={6}
              onChange={(markerStyle) => update({ markerStyle })}
            />
          </SheetSection>
          <SheetSection id="building-3d" title="Bâtiment 3D">
            <Building3dFields value={draft} onChange={update} previewRef={`locations/${entity.id}`} />
          </SheetSection>
          <SheetSection id="notes" title="Notes">
            <Field label="Notes" wide>
              <TextArea value={draft.notes} rows={4} onChange={(notes) => update({ notes })} />
            </Field>
          </SheetSection>
        </div>
      ) : (
        <>
          <h2>
            <PingPreview
              icon={resolveIcon(entity.markerStyle?.icon ?? data.refs.markerTypes.find((type) => type.id === entity.typeId)?.icon, 'diamond')}
              color={entity.markerStyle?.color ?? '#87c6b2'}
            />
            {entity.name}
          </h2>
          <p className="sheet-subtitle">
            {refName(data, 'markerTypes', entity.typeId)} <Importance value={entity.importance} />
          </p>
          {entity.description && <p className="sheet-text">{entity.description}</p>}
          <Facts
            rows={[
              ['Adresse', entity.address],
              ['Connaissance', knowledgeLevels.find((level) => level.id === entity.knowledgeLevel)?.name],
              ['Territoire', <LinkChips refs={refsOf('territories', [entity.territoryId])} names={names} onOpen={onOpen} />],
              ['Personnages', <LinkChips refs={refsOf('characters', entity.characterIds)} names={names} onOpen={onOpen} />],
              ['Plots', <LinkChips refs={refsOf('plots', entity.plotIds)} names={names} onOpen={onOpen} />],
              ['Tags', entity.tags.join(', ')],
              ['Source', entity.source ? (entity.source.label ?? entity.source.type) : undefined],
              ['Bâtiment 3D', building3dSummary(entity)],
              ['Notes', entity.notes],
            ]}
          />
        </>
      )}
      <SheetFooter
        entityRef={{ collection: 'locations', id: entity.id }}
        entity={entity}
        draft={draftState}
        editMode={editMode}
        onFocus={() => onFocus({ collection: 'locations', id: entity.id })}
        onDuplicate={() => void duplicate('locations', entity, onSelect)}
      />
    </div>
  );
}

function HavenSheet({ data, entity, editMode, onOpen, onFocus, onSelect }: SheetProps<Haven>) {
  const draftState = useEntityDraft('havens', entity);
  const { draft, update } = draftState;
  if (!draft) return null;
  const names = (ref: EntityRef) => entityName(data, ref);
  const characters = options(data.characters);

  return (
    <div className="sheet">
      {editMode ? (
        <div className="sheet-sections">
          <SheetSection id="identity" title="Identité">
            <Field label="Nom" wide>
              <TextInput value={draft.name} onChange={(name) => update({ name })} />
            </Field>
            <Field label="Adresse" wide>
              <TextInput value={draft.address} onChange={(address) => update({ address })} />
            </Field>
            <Field label="Description" wide>
              <TextArea value={draft.description} onChange={(description) => update({ description })} />
            </Field>
            <Field label="Sécurité (0-5)">
              <NumberInput value={draft.securityLevel} max={5} onChange={(securityLevel) => update({ securityLevel })} />
            </Field>
            <Field label="État">
              <TextInput value={draft.state} placeholder="Occupé, abandonné, compromis…" onChange={(state) => update({ state })} />
            </Field>
            <Field label="Tags (séparés par des virgules)" wide>
              <TextInput value={draft.tags.join(', ')} onChange={(value) => update({ tags: parseTags(value) })} />
            </Field>
          </SheetSection>
          <SheetSection id="links" title="Propriété et liens">
            <Field label="Propriétaire(s) — vide si inconnu" wide>
              <EntityPicker
                collection="characters"
                ids={draft.ownerCharacterIds}
                options={characters}
                onOpen={onOpen}
                onChange={(ownerCharacterIds) => update({ ownerCharacterIds })}
              />
            </Field>
            <Field label="Ou coterie propriétaire" wide>
              <RefCombo
                collection="coteries"
                value={draft.ownerCoterieId}
                placeholder="Nom de la coterie (créée si nouvelle)"
                onChange={(ownerCoterieId) => update({ ownerCoterieId })}
              />
            </Field>
            <Field label="Autres résidents" wide>
              <EntityPicker
                collection="characters"
                ids={draft.residentCharacterIds}
                options={characters}
                onOpen={onOpen}
                onChange={(residentCharacterIds) => update({ residentCharacterIds })}
              />
            </Field>
            <Field label="Territoire" wide>
              <Select value={draft.territoryId} options={options(data.territories)} empty="Aucun" onChange={(territoryId) => update({ territoryId })} />
            </Field>
            <Field label="Plots associés" wide>
              <EntityPicker collection="plots" ids={draft.plotIds} options={options(data.plots)} onOpen={onOpen} onChange={(plotIds) => update({ plotIds })} />
            </Field>
          </SheetSection>
          <SheetSection id="appearance" title="Apparence">
            <MarkerAppearance style={draft.markerStyle} fallbackIcon={'house'} square={true} defaultSize={7} onChange={(markerStyle) => update({ markerStyle })} />
          </SheetSection>
          <SheetSection id="building-3d" title="Bâtiment 3D">
            <Building3dFields value={draft} onChange={update} previewRef={`havens/${entity.id}`} />
          </SheetSection>
          <SheetSection id="notes" title="Notes">
            <Field label="Notes" wide>
              <TextArea value={draft.notes} rows={4} onChange={(notes) => update({ notes })} />
            </Field>
          </SheetSection>
        </div>
      ) : (
        <>
          <h2>
            <PingPreview icon={resolveIcon(entity.markerStyle?.icon, 'house')} color={entity.markerStyle?.color ?? '#dba866'} square />
            {entity.name}
          </h2>
          <p className="sheet-subtitle">Havre {entity.state ? `· ${entity.state}` : ''}</p>
          {entity.description && <p className="sheet-text">{entity.description}</p>}
          <Facts
            rows={[
              ['Adresse', entity.address],
              [
                'Propriétaire',
                entity.ownerCharacterIds.length ? (
                  <LinkChips refs={refsOf('characters', entity.ownerCharacterIds)} names={names} onOpen={onOpen} />
                ) : entity.ownerCoterieId ? undefined : (
                  'Inconnu'
                ),
              ],
              ['Coterie', entity.ownerCoterieId ? `${refName(data, 'coteries', entity.ownerCoterieId)} (coterie)` : undefined],
              ['Résidents', <LinkChips refs={refsOf('characters', entity.residentCharacterIds)} names={names} onOpen={onOpen} />],
              ['Territoire', <LinkChips refs={refsOf('territories', [entity.territoryId])} names={names} onOpen={onOpen} />],
              ['Sécurité', <Importance value={entity.securityLevel} />],
              ['Plots', <LinkChips refs={refsOf('plots', entity.plotIds)} names={names} onOpen={onOpen} />],
              ['Tags', entity.tags.join(', ')],
              ['Bâtiment 3D', building3dSummary(entity)],
              ['Notes', entity.notes],
            ]}
          />
        </>
      )}
      <SheetFooter
        entityRef={{ collection: 'havens', id: entity.id }}
        entity={entity}
        draft={draftState}
        editMode={editMode}
        onFocus={() => onFocus({ collection: 'havens', id: entity.id })}
        onDuplicate={() => void duplicate('havens', entity, onSelect)}
      />
    </div>
  );
}

function TerritorySheet({ data, entity, editMode, onOpen, onFocus, onSelect, geometryControls }: SheetProps<Territory>) {
  const draftState = useEntityDraft('territories', entity);
  const { draft, update } = draftState;
  if (!draft) return null;
  const names = (ref: EntityRef) => entityName(data, ref);
  const characters = options(data.characters);
  const area = entity.geometry?.coordinates?.[0] ? formatArea(ringAreaM2(entity.geometry.coordinates[0])) : undefined;
  const rule = (traditionId: string) => draft.traditionRules.find((item) => item.traditionId === traditionId);
  const setRule = (traditionId: string, patch: { active?: boolean; note?: string }) => {
    const existing = rule(traditionId) ?? { traditionId, active: false };
    const next = { ...existing, ...patch };
    update({ traditionRules: [...draft.traditionRules.filter((item) => item.traditionId !== traditionId), next].filter((item) => item.active || item.note) });
  };
  const activeRules = entity.traditionRules.filter((item) => item.active);
  const underground = undergroundWithin(entity.geometry, data.undergroundAccess, data.undergroundSegments);
  const stationIds = underground.accessIds.filter((id) => data.undergroundAccess.find((access) => access.id === id)?.type === 'station');
  const otherAccessCount = underground.accessIds.length - stationIds.length;

  return (
    <div className="sheet">
      {editMode ? (
        <div className="sheet-sections">
          <SheetSection id="territory-identity" title="Identité">
            <Field label="Nom" wide>
              <TextInput value={draft.name} onChange={(name) => update({ name })} />
            </Field>
            <Field label="Description" wide>
              <TextArea value={draft.description} onChange={(description) => update({ description })} />
            </Field>
            <Field label="Faction">
              <Select value={draft.factionId} options={options(data.refs.factions)} empty="Aucune" onChange={(factionId) => update({ factionId })} />
            </Field>
            <Field label="Importance (0-5)">
              <NumberInput value={draft.importance} max={5} onChange={(importance) => update({ importance })} />
            </Field>
            <Field label="Attitude envers les PJ (itinéraires discrets)" wide>
              <Select value={draft.stance} options={stanceOptions} empty="Non renseignée (neutre)" onChange={(stance) => update({ stance })} />
            </Field>
          </SheetSection>
          <SheetSection id="links" title="Liens">
            <Field label="Propriétaire / responsable" wide>
              <EntityPicker
                collection="characters"
                ids={draft.ownerCharacterIds}
                options={characters}
                onOpen={onOpen}
                onChange={(ownerCharacterIds) => update({ ownerCharacterIds })}
              />
            </Field>
            <Field label="Personnages présents" wide>
              <EntityPicker collection="characters" ids={draft.characterIds} options={characters} onOpen={onOpen} onChange={(characterIds) => update({ characterIds })} />
            </Field>
            <Field label="Plots associés" wide>
              <EntityPicker collection="plots" ids={draft.plotIds} options={options(data.plots)} onOpen={onOpen} onChange={(plotIds) => update({ plotIds })} />
            </Field>
          </SheetSection>
          <SheetSection id="territory-appearance" title="Apparence et forme">
            <div className="field-wide geometry-controls">{geometryControls}</div>
            <fieldset className="field-wide style-fieldset">
              <legend>Apparence</legend>
              <div className="field-wide palette-row">
                <span>Remplissage</span>
                <ColorPalette value={draft.style.fillColor} onChange={(fillColor) => update({ style: { ...draft.style, fillColor } })} />
              </div>
              <div className="field-wide palette-row">
                <span>Bordure</span>
                <ColorPalette value={draft.style.strokeColor} onChange={(strokeColor) => update({ style: { ...draft.style, strokeColor } })} />
              </div>
              <label>
                Opacité{' '}
                <input
                  type="range"
                  min={0}
                  max={0.6}
                  step={0.02}
                  value={draft.style.opacity}
                  onChange={(event) => update({ style: { ...draft.style, opacity: Number(event.target.value) } })}
                />
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={draft.style.outlineOnly} onChange={(event) => update({ style: { ...draft.style, outlineOnly: event.target.checked } })} /> Contour
                uniquement
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={Boolean(draft.hidden)} onChange={(event) => update({ hidden: event.target.checked })} /> Masqué en consultation
              </label>
            </fieldset>
            <div className="field-wide">
              <LayerOrderControls collection="territories" items={data.territories} id={entity.id} />
            </div>
          </SheetSection>
          <SheetSection id="traditions" title="Traditions" defaultOpen={false}>
            <fieldset className="field-wide traditions-fieldset">
              <legend>Traditions actives</legend>
              {data.refs.traditions.map((tradition) => (
                <div className="tradition-row" key={tradition.id}>
                  <label className="checkbox">
                    <input type="checkbox" checked={Boolean(rule(tradition.id)?.active)} onChange={(event) => setRule(tradition.id, { active: event.target.checked })} />{' '}
                    {tradition.name}
                  </label>
                  {rule(tradition.id)?.active && (
                    <input
                      placeholder="Règle locale (facultatif)"
                      value={rule(tradition.id)?.note ?? ''}
                      onChange={(event) => setRule(tradition.id, { note: event.target.value })}
                    />
                  )}
                </div>
              ))}
            </fieldset>
          </SheetSection>
          <SheetSection id="notes" title="Notes">
            <Field label="Notes" wide>
              <TextArea value={draft.notes} rows={4} onChange={(notes) => update({ notes })} />
            </Field>
          </SheetSection>
        </div>
      ) : (
        <>
          <h2>
            <span className="territory-swatch" style={{ background: entity.style.fillColor, borderColor: entity.style.strokeColor }} />
            {entity.name}
          </h2>
          <p className="sheet-subtitle">
            {refName(data, 'factions', entity.factionId) ?? 'Sans faction'} {area && `· ${area}`} <Importance value={entity.importance} />
          </p>
          {entity.description && <p className="sheet-text">{entity.description}</p>}
          <Facts
            rows={[
              ['Attitude', stanceOptions.find((option) => option.id === entity.stance)?.name],
              ['Responsable', <LinkChips refs={refsOf('characters', entity.ownerCharacterIds)} names={names} onOpen={onOpen} />],
              ['Personnages', <LinkChips refs={refsOf('characters', entity.characterIds)} names={names} onOpen={onOpen} />],
              [
                'Lieux',
                <LinkChips
                  refs={refsOf(
                    'locations',
                    data.locations.filter((item) => item.territoryId === entity.id).map((item) => item.id),
                  )}
                  names={names}
                  onOpen={onOpen}
                />,
              ],
              [
                'Havres',
                <LinkChips
                  refs={refsOf(
                    'havens',
                    data.havens.filter((item) => item.territoryId === entity.id).map((item) => item.id),
                  )}
                  names={names}
                  onOpen={onOpen}
                />,
              ],
              ['Plots', <LinkChips refs={refsOf('plots', entity.plotIds)} names={names} onOpen={onOpen} />],
              ['Stations', <LinkChips refs={refsOf('undergroundAccess', stationIds)} names={names} onOpen={onOpen} />],
              [
                'Souterrains',
                [
                  underground.segmentIds.length && `${underground.segmentIds.length} segment${underground.segmentIds.length > 1 ? 's' : ''}`,
                  otherAccessCount && `${otherAccessCount} accès`,
                ]
                  .filter(Boolean)
                  .join(' · ') || undefined,
              ],
              ['Notes', entity.notes],
            ]}
          />
          {activeRules.length > 0 && (
            <section className="traditions-list">
              <h3>Traditions actives</h3>
              {activeRules.map((item) => (
                <p key={item.traditionId}>
                  <strong>{refName(data, 'traditions', item.traditionId)}</strong>
                  {item.note && <span>{item.note}</span>}
                </p>
              ))}
            </section>
          )}
        </>
      )}
      <SheetFooter
        entityRef={{ collection: 'territories', id: entity.id }}
        entity={entity}
        draft={draftState}
        editMode={editMode}
        onFocus={() => onFocus({ collection: 'territories', id: entity.id })}
        onDuplicate={() => void duplicate('territories', entity, onSelect)}
      />
    </div>
  );
}

/** Fiche compacte d'un plot sur la carte : résumé, liens vers la fiche complète, gestion du ping et de la zone. */
function PlotMapSheet({ data, entity, editMode, onOpen, onFocus, geometryControls }: SheetProps<Plot>) {
  const status = data.refs.plotStatuses.find((item) => item.id === entity.statusId);
  const related = relatedEntities(data, { collection: 'plots', id: entity.id });
  const ref: EntityRef = { collection: 'plots', id: entity.id };
  const clear = (field: 'pingGeometry' | 'zoneGeometry') => void saveEntity('plots', entity, { [field]: null });
  return (
    <div className="sheet">
      <h2>
        <PingPreview icon="star" color={status?.color ?? '#9dd7c4'} diamond />
        {entity.name}
      </h2>
      <p className="sheet-subtitle">
        {status?.name ?? entity.statusId} <Importance value={entity.importance} />
      </p>
      {entity.description && <p className="sheet-text">{entity.description}</p>}
      <Facts
        rows={[
          ['Liens', `${related.characters.size} personnage(s) · ${related.locations.size + related.havens.size} lieu(x) · ${related.territories.size} territoire(s)`],
          [
            'Sur la carte',
            [entity.pingGeometry && 'ping', entity.zoneGeometry && `zone de ${formatArea(ringAreaM2(entity.zoneGeometry.coordinates[0]))}`].filter(Boolean).join(' · ') ||
              undefined,
          ],
        ]}
      />
      <div className="sheet-actions">
        <button type="button" className="primary-button" onClick={() => onOpen(ref)}>
          Fiche complète du plot
        </button>
        <button type="button" className="ghost-button" onClick={() => onFocus(ref)}>
          ◎ Afficher ce plot
        </button>
      </div>
      {editMode && (
        <div className="geometry-controls plot-geometry">
          {geometryControls}
          {entity.zoneGeometry && <LayerOrderControls collection="plots" items={data.plots.filter((plot) => plot.zoneGeometry)} id={entity.id} />}
          <p className="muted">Glisse le ping pour le déplacer. Clic droit sur la carte : « Ping de plot ici » ou « Zone de plot depuis ici » pour en ajouter.</p>
          <div className="sheet-actions">
            {entity.pingGeometry && (
              <button type="button" className="ghost-button" onClick={() => clear('pingGeometry')}>
                Retirer le ping
              </button>
            )}
            {entity.zoneGeometry && (
              <button type="button" className="ghost-button" onClick={() => clear('zoneGeometry')}>
                Retirer la zone
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
