import { useMemo, useState } from 'react';
import { EntityPicker, Field, NumberInput, Select, TextArea, TextInput } from '../../components/forms';
import { Facts, LinkChips, SheetFooter } from '../../components/EntitySheet';
import { useEntityDraft } from '../../components/useEntityDraft';
import { entityName, type EntityRef } from '../../domain/chronicle';
import { formatDistance, lineLengthM } from '../../domain/geometry';
import type { TransitLine, UndergroundAccess, UndergroundLevel, UndergroundSegment } from '../../domain/models';
import {
  accessTypes,
  buildUndergroundGraph,
  connectedSegmentIds,
  effectiveExposure,
  effectivePassability,
  exposureOptions,
  levelNames,
  levelOptions,
  networkOf,
  passabilityOptions,
  segmentLevels,
  segmentsAtNode,
  segmentTypes,
  shortestPath,
  undergroundKnowledgeLevels,
  undergroundOrigins,
  type RouteMode,
} from '../../domain/underground';
import type { SheetProps } from './EntityPanel';
import { levelColors } from './mapData';
import { options, refsOf } from './sheetHelpers';

const nameOf = (list: ReadonlyArray<{ id: string; name: string }>, id: string | undefined) => list.find((item) => item.id === id)?.name ?? id;
const riskClass: Record<string, string> = { faible: 'risk-low', moyen: 'risk-medium', élevé: 'risk-high', 'très élevé': 'risk-critical' };

function LevelBadge({ levels }: { levels: UndergroundLevel[] }) {
  return (
    <span className="level-badges">
      {levels.map((level, index) => (
        <span key={`${level}-${index}`} className="level-badge" style={{ ['--level-color' as string]: levelColors[level] }} title={levelNames[level]}>
          {index > 0 && <i>→</i>}
          {level}
        </span>
      ))}
    </span>
  );
}

/** Niveau saisi via un <select> textuel : conversion sûre vers 0 / -1 / -2 / -3. */
const levelSelect = (value: UndergroundLevel | undefined | null, onChange: (level: UndergroundLevel | undefined) => void, empty?: string) => (
  <Select
    value={value === undefined || value === null ? undefined : String(value)}
    options={levelOptions}
    empty={empty}
    onChange={(next) => onChange(next === undefined ? undefined : (Number(next) as UndergroundLevel))}
  />
);

/** Pastilles des lignes de transport (couleurs officielles IDFM). */
function TransitLines({ lines }: { lines?: TransitLine[] }) {
  if (!lines?.length) return null;
  return (
    <p className="transit-lines" title="Lignes Île-de-France Mobilités (open data, ODbL)">
      {lines.map((line) => (
        <span key={line.name} className={`transit-line ${line.mode}`} style={{ ['--line' as string]: line.color ?? '#9aa7ae' }}>
          {line.name}
        </span>
      ))}
    </p>
  );
}

export function AccessSheet({ data, entity, editMode, onOpen, onFocus, onShowPath }: SheetProps<UndergroundAccess>) {
  const draftState = useEntityDraft('undergroundAccess', entity);
  const { draft, update } = draftState;
  const graph = useMemo(() => buildUndergroundGraph(data.undergroundAccess, data.undergroundSegments), [data.undergroundAccess, data.undergroundSegments]);
  const [targetId, setTargetId] = useState<string>();
  const [mode, setMode] = useState<RouteMode>('discreet');
  const network = useMemo(() => networkOf(graph, { nodeId: entity.id }), [graph, entity.id]);
  // Destinations : stations d'abord, puis accès principaux, puis bouches et parkings.
  const rank = (item: UndergroundAccess) => (item.type === 'station' ? 0 : item.minor ? 2 : 1);
  const reachable = data.undergroundAccess
    .filter((item) => item.id !== entity.id && network.accessIds.has(item.id))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'fr'));
  const path = useMemo(() => (targetId ? shortestPath(graph, entity.id, targetId, mode) : undefined), [graph, entity.id, targetId, mode]);
  if (!draft) return null;
  const names = (ref: EntityRef) => entityName(data, ref);
  const segments = segmentsAtNode(graph, entity.id);
  // Au-delà de quelques segments (grande station), un résumé par type est plus lisible que des dizaines de puces.
  const segmentSummary =
    segments.length > 8
      ? Object.entries(
          segments.reduce<Record<string, number>>((counts, id) => {
            const label = entityName(data, { collection: 'undergroundSegments', id });
            counts[label] = (counts[label] ?? 0) + 1;
            return counts;
          }, {}),
        )
          .map(([label, count]) => `${label} ×${count}`)
          .join(' · ')
      : undefined;

  const choosePath = (id: string | undefined, nextMode = mode) => {
    setTargetId(id);
    setMode(nextMode);
    onShowPath(id ? shortestPath(graph, entity.id, id, nextMode)?.segmentIds : undefined);
  };

  return (
    <div className="sheet">
      {editMode ? (
        <div className="form-grid">
          <Field label="Nom" wide>
            <TextInput value={draft.name} onChange={(name) => update({ name })} />
          </Field>
          <Field label="Type">
            <Select value={draft.type} options={accessTypes} onChange={(type) => update({ type: type ?? 'other' })} />
          </Field>
          <Field label="Niveau desservi">{levelSelect(draft.level, (level) => update({ level: level ?? -1 }))}</Field>
          <Field label="Profondeur approx. (m)">
            <NumberInput value={draft.approximateDepthM} max={200} onChange={(approximateDepthM) => update({ approximateDepthM })} />
          </Field>
          <Field label="État">
            <TextInput value={draft.state} placeholder="Ouvert, condamné, gardé…" onChange={(state) => update({ state })} />
          </Field>
          <Field label="Connaissance">
            <Select value={draft.knowledgeLevel} options={undergroundKnowledgeLevels} empty="—" onChange={(knowledgeLevel) => update({ knowledgeLevel })} />
          </Field>
          <Field label="Origine">
            <Select value={draft.origin} options={undergroundOrigins} onChange={(origin) => update({ origin: origin ?? 'chronicle' })} />
          </Field>
          <Field label="Lieu associé">
            <Select value={draft.locationId} options={options(data.locations)} empty="Aucun" onChange={(locationId) => update({ locationId })} />
          </Field>
          <Field label="Territoire">
            <Select value={draft.territoryId} options={options(data.territories)} empty="Aucun" onChange={(territoryId) => update({ territoryId })} />
          </Field>
          <Field label="Plots associés" wide>
            <EntityPicker collection="plots" ids={draft.plotIds} options={options(data.plots)} onOpen={onOpen} onChange={(plotIds) => update({ plotIds })} />
          </Field>
          <Field label="Notes" wide>
            <TextArea value={draft.notes} rows={4} onChange={(notes) => update({ notes })} />
          </Field>
        </div>
      ) : (
        <>
          <h2>{entity.name}</h2>
          <p className="sheet-subtitle">
            {nameOf(accessTypes, entity.type)} <LevelBadge levels={[0, entity.level]} />
          </p>
          <TransitLines lines={entity.transitLines} />
          <Facts
            rows={[
              ['Profondeur', entity.approximateDepthM ? `≈ ${entity.approximateDepthM} m` : undefined],
              ['État', entity.state],
              ['Connaissance', nameOf(undergroundKnowledgeLevels, entity.knowledgeLevel)],
              ['Origine', nameOf(undergroundOrigins, entity.origin)],
              ['Source', entity.source ? (entity.source.label ?? entity.source.type) : undefined],
              ['Lieu', <LinkChips refs={refsOf('locations', [entity.locationId])} names={names} onOpen={onOpen} />],
              ['Territoire', <LinkChips refs={refsOf('territories', [entity.territoryId])} names={names} onOpen={onOpen} />],
              ['Segments', segmentSummary ?? <LinkChips refs={refsOf('undergroundSegments', segments)} names={names} onOpen={onOpen} />],
              ['Plots', <LinkChips refs={refsOf('plots', entity.plotIds)} names={names} onOpen={onOpen} />],
              ['Notes', entity.notes],
            ]}
          />
        </>
      )}

      <section className="path-finder">
        <h3>Trajet souterrain</h3>
        {reachable.length === 0 ? (
          <p className="muted">
            {segments.length === 0 ? "Aucun segment ne part de cet accès. Trace-en un avec l'outil ⌇ en partant de ce point." : 'Aucun autre accès relié à ce réseau.'}
          </p>
        ) : (
          <>
            <div className="route-modes" role="group" aria-label="Mode de trajet">
              <button
                type="button"
                className={mode === 'discreet' ? 'selected' : ''}
                onClick={() => choosePath(targetId, 'discreet')}
                title="Évite les tronçons exposés (rames, personnel, couloirs fréquentés)"
              >
                ◐ Discret
              </button>
              <button
                type="button"
                className={mode === 'short' ? 'selected' : ''}
                onClick={() => choosePath(targetId, 'short')}
                title="Le plus rapide parmi les tronçons praticables"
              >
                ⟶ Plus court
              </button>
            </div>
            <Select value={targetId} options={options(reachable)} empty="Vers l'accès…" onChange={(id) => choosePath(id)} />
            {targetId && !path && <p className="muted">Aucun trajet praticable : un tronçon impraticable coupe le réseau.</p>}
            {path && (
              <div className="path-summary">
                <span className={`risk-badge ${riskClass[path.risk]}`}>Risque {path.risk}</span>
                <strong>{formatDistance(path.lengthM)}</strong> · ≈ {Math.max(1, Math.round(path.durationMin))} min · {path.segmentIds.length} segment(s)
                <LevelBadge levels={path.levels} />
                <p className="muted">
                  {path.exposedM > 0 ? `${formatDistance(path.exposedM)} exposés` : 'Aucun tronçon exposé'}
                  {path.uncertainM > 0 && ` · ${formatDistance(path.uncertainM)} de praticabilité inconnue`}
                </p>
                {mode === 'discreet' && path.exposedM > path.lengthM * 0.5 && (
                  <p className="muted hint">
                    Pas d'alternative discrète connue. Pour en créer une, relie un réseau discret (égouts, rivière, carrière) à cet accès avec l'outil ⌇ : l'accrochage fonctionne
                    sur les jonctions en mode édition.
                  </p>
                )}
                {path.accessIds.length > 2 && (
                  <p className="muted">
                    Passe par :{' '}
                    {path.accessIds
                      .slice(1, -1)
                      .map((id) => entityName(data, { collection: 'undergroundAccess', id }))
                      .join(', ')}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <SheetFooter
        entityRef={{ collection: 'undergroundAccess', id: entity.id }}
        entity={entity}
        draft={draftState}
        editMode={editMode}
        onFocus={() => onFocus({ collection: 'undergroundAccess', id: entity.id })}
      />
    </div>
  );
}

export function SegmentSheet({ data, entity, editMode, onOpen, onFocus, geometryControls }: SheetProps<UndergroundSegment>) {
  const draftState = useEntityDraft('undergroundSegments', entity);
  const { draft, update } = draftState;
  const graph = useMemo(() => buildUndergroundGraph(data.undergroundAccess, data.undergroundSegments), [data.undergroundAccess, data.undergroundSegments]);
  if (!draft) return null;
  const names = (ref: EntityRef) => entityName(data, ref);
  const endpoint = (nodeId: string) =>
    data.undergroundAccess.some((access) => access.id === nodeId) ? (
      <LinkChips refs={[{ collection: 'undergroundAccess', id: nodeId }]} names={names} onOpen={onOpen} />
    ) : (
      `Jonction (${segmentsAtNode(graph, nodeId).length} segment·s)`
    );
  const length = entity.geometry?.coordinates ? formatDistance(lineLengthM(entity.geometry.coordinates)) : undefined;

  return (
    <div className="sheet">
      {editMode ? (
        <div className="form-grid">
          <Field label="Nom (facultatif)" wide>
            <TextInput value={draft.name} onChange={(name) => update({ name })} />
          </Field>
          <Field label="Type">
            <Select value={draft.type} options={segmentTypes} onChange={(type) => update({ type: type ?? 'tunnel' })} />
          </Field>
          <Field label="Niveau">{levelSelect(draft.level, (level) => update({ level: level ?? -1 }))}</Field>
          <Field label="Vers le niveau (vertical)">
            {levelSelect(draft.toLevel, (toLevel) => update({ toLevel: toLevel === draft.level ? undefined : toLevel }), '— même niveau —')}
          </Field>
          <Field label="Profondeur approx. (m)">
            <NumberInput value={draft.approximateDepthM} max={200} onChange={(approximateDepthM) => update({ approximateDepthM })} />
          </Field>
          <Field label="État">
            <TextInput value={draft.state} placeholder="Praticable, inondé, effondré…" onChange={(state) => update({ state })} />
          </Field>
          <Field label="Connaissance">
            <Select value={draft.knowledgeLevel} options={undergroundKnowledgeLevels} empty="—" onChange={(knowledgeLevel) => update({ knowledgeLevel })} />
          </Field>
          <Field label="Origine">
            <Select value={draft.origin} options={undergroundOrigins} onChange={(origin) => update({ origin: origin ?? 'chronicle' })} />
          </Field>
          <Field label="Praticabilité">
            <Select
              value={draft.passability}
              options={passabilityOptions}
              empty={`Par défaut (${nameOf(passabilityOptions, effectivePassability({ ...draft, passability: undefined }))})`}
              onChange={(passability) => update({ passability, passabilityNote: undefined })}
            />
          </Field>
          <Field label="Discrétion">
            <Select
              value={draft.exposure}
              options={exposureOptions}
              empty={`Par défaut (${nameOf(exposureOptions, effectiveExposure({ ...draft, exposure: undefined }))})`}
              onChange={(exposure) => update({ exposure })}
            />
          </Field>
          <Field label="Plots associés" wide>
            <EntityPicker collection="plots" ids={draft.plotIds} options={options(data.plots)} onOpen={onOpen} onChange={(plotIds) => update({ plotIds })} />
          </Field>
          <Field label="Notes" wide>
            <TextArea value={draft.notes} rows={4} onChange={(notes) => update({ notes })} />
          </Field>
          <div className="field-wide geometry-controls">{geometryControls}</div>
        </div>
      ) : (
        <>
          <h2>{entity.name || nameOf(segmentTypes, entity.type)}</h2>
          <p className="sheet-subtitle">
            {nameOf(segmentTypes, entity.type)} {length && `· ${length}`} <LevelBadge levels={segmentLevels(entity)} />
          </p>
          <TransitLines lines={entity.transitLines} />
          <Facts
            rows={[
              [
                'Déplacement',
                `${nameOf(passabilityOptions, effectivePassability(entity))} · ${(nameOf(exposureOptions, effectiveExposure(entity)) ?? '').toLowerCase()}${entity.passability || entity.exposure ? '' : ' (par défaut)'}`,
              ],
              ['Justification', entity.passabilityNote],
              ['Départ', endpoint(entity.startNodeId)],
              ['Arrivée', endpoint(entity.endNodeId)],
              ['Profondeur', entity.approximateDepthM ? `≈ ${entity.approximateDepthM} m` : undefined],
              ['État', entity.state],
              ['Connaissance', nameOf(undergroundKnowledgeLevels, entity.knowledgeLevel)],
              ['Origine', nameOf(undergroundOrigins, entity.origin)],
              ['Source', entity.source ? (entity.source.label ?? entity.source.type) : undefined],
              [
                'Connexions',
                <LinkChips
                  refs={refsOf('undergroundSegments', connectedSegmentIds(graph, entity.id))}
                  names={(ref) =>
                    data.undergroundSegments.find((item) => item.id === ref.id)?.name ||
                    nameOf(segmentTypes, data.undergroundSegments.find((item) => item.id === ref.id)?.type) ||
                    'Segment'
                  }
                  onOpen={onOpen}
                />,
              ],
              ['Plots', <LinkChips refs={refsOf('plots', entity.plotIds)} names={names} onOpen={onOpen} />],
              ['Notes', entity.notes],
            ]}
          />
        </>
      )}
      <SheetFooter
        entityRef={{ collection: 'undergroundSegments', id: entity.id }}
        entity={entity}
        draft={draftState}
        editMode={editMode}
        onFocus={() => onFocus({ collection: 'undergroundSegments', id: entity.id })}
      />
    </div>
  );
}
