import { useState } from 'react';
import { saveEntity, trashEntity } from '../../data';
import { entityName, findEntity, type ChronicleData, type EntityRef } from '../../domain/chronicle';
import { geometryBounds, type AnyGeometry, type Coordinate } from '../../domain/geometry';
import type { EntityCollection, Plot } from '../../domain/models';

/** Champ de liaison d'un plot pour chaque famille cartographique. */
const plotField: Partial<Record<EntityCollection, keyof Plot>> = {
  locations: 'locationIds',
  havens: 'havenIds',
  territories: 'territoryIds',
  undergroundAccess: 'undergroundAccessIds',
  undergroundSegments: 'undergroundSegmentIds',
};

const collectionLabel: Partial<Record<EntityCollection, string>> = {
  locations: 'Lieu',
  havens: 'Refuge',
  territories: 'Territoire',
  plots: 'Plot',
  undergroundAccess: 'Accès',
  undergroundSegments: 'Souterrain',
};

/** Emprise commune des éléments sélectionnés (pour cadrer la carte). */
export function selectionBounds(data: ChronicleData, refs: EntityRef[]): [Coordinate, Coordinate] | undefined {
  const bounds = refs
    .map((ref) => findEntity(data, ref.collection, ref.id) as { geometry?: AnyGeometry; zoneGeometry?: AnyGeometry; pingGeometry?: AnyGeometry } | undefined)
    .map((entity) => entity?.geometry ?? entity?.zoneGeometry ?? entity?.pingGeometry)
    .filter((geometry): geometry is AnyGeometry => Boolean(geometry))
    .map(geometryBounds);
  if (bounds.length === 0) return undefined;
  return [
    [Math.min(...bounds.map((b) => b[0][0])), Math.min(...bounds.map((b) => b[0][1]))],
    [Math.max(...bounds.map((b) => b[1][0])), Math.max(...bounds.map((b) => b[1][1]))],
  ];
}

/** Sélection multiple (CDC §17) : liste compacte et actions groupées. */
export function SelectionTray({
  data,
  refs,
  editMode,
  onOpen,
  onRemove,
  onClear,
  onFrame,
  onDone,
}: {
  data: ChronicleData;
  refs: EntityRef[];
  editMode: boolean;
  onOpen: (ref: EntityRef) => void;
  onRemove: (ref: EntityRef) => void;
  onClear: () => void;
  onFrame: () => void;
  onDone: (message: string) => void;
}) {
  const [plotId, setPlotId] = useState('');
  const [busy, setBusy] = useState(false);
  const linkable = refs.filter((ref) => plotField[ref.collection]);
  const deletable = refs;

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    try {
      onDone(await action());
    } catch (error) {
      onDone(error instanceof Error ? error.message : 'Échec de l’action groupée.');
    } finally {
      setBusy(false);
    }
  };

  const linkToPlot = () =>
    run(async () => {
      const plot = findEntity(data, 'plots', plotId);
      if (!plot) return 'Plot introuvable.';
      const patch: Record<string, string[]> = {};
      for (const ref of linkable) {
        const field = plotField[ref.collection]!;
        const current = (patch[field] ?? (plot[field] as string[] | undefined) ?? []) as string[];
        if (!current.includes(ref.id)) patch[field] = [...current, ref.id];
      }
      if (Object.keys(patch).length === 0) return `Déjà liés à « ${plot.name} ».`;
      await saveEntity('plots', plot, patch);
      return `${linkable.length} élément(s) liés à « ${plot.name} ».`;
    });

  const trashAll = () => {
    if (!window.confirm(`Mettre ${deletable.length} élément(s) à la corbeille ?`)) return;
    void run(async () => {
      for (const ref of deletable) {
        const entity = findEntity(data, ref.collection, ref.id);
        if (entity) await trashEntity(ref.collection, entity);
      }
      onClear();
      return `${deletable.length} élément(s) mis à la corbeille.`;
    });
  };

  return (
    <aside className="floating-panel selection-tray" aria-label="Sélection multiple">
      <header>
        <span className="eyebrow">
          SÉLECTION · {refs.length} élément{refs.length > 1 ? 's' : ''}
        </span>
        <button className="close-button" onClick={onClear} aria-label="Vider la sélection" title="Vider la sélection (Échap)">
          ×
        </button>
      </header>
      <p className="muted selection-hint">Maj+clic : ajouter / retirer · Maj+glisser : rectangle</p>
      <ul>
        {refs.map((ref) => (
          <li key={`${ref.collection}/${ref.id}`}>
            <button type="button" className="link-button" onClick={() => onOpen(ref)}>
              <small>{collectionLabel[ref.collection] ?? ref.collection}</small> {entityName(data, ref)}
            </button>
            <button type="button" className="close-button" title="Retirer de la sélection" aria-label="Retirer de la sélection" onClick={() => onRemove(ref)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <footer>
        <button type="button" onClick={onFrame}>
          Cadrer
        </button>
        {editMode && linkable.length > 0 && data.plots.length > 0 && (
          <span className="selection-link">
            <select value={plotId} onChange={(event) => setPlotId(event.target.value)} aria-label="Plot à lier">
              <option value="">Lier à un plot…</option>
              {data.plots.map((plot) => (
                <option key={plot.id} value={plot.id}>
                  {plot.name}
                </option>
              ))}
            </select>
            <button type="button" disabled={!plotId || busy} onClick={() => void linkToPlot()}>
              Lier
            </button>
          </span>
        )}
        {editMode && deletable.length > 0 && (
          <button type="button" className="danger-button" disabled={busy} onClick={trashAll}>
            Corbeille
          </button>
        )}
      </footer>
    </aside>
  );
}
