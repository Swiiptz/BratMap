import { isValidElement, type ReactNode } from 'react';
import { useFavorites } from '../app/favorites';
import { shareUrl, routeForEntity } from '../app/router';
import { trashEntity } from '../data';
import { formatDate } from '../data/store';
import type { EntityRef } from '../domain/chronicle';
import type { EntityMeta } from '../domain/models';
import { ConfirmButton } from './forms';

/** Valeur sans contenu à afficher, y compris des puces ou une jauge sans données. */
function isEmptyValue(value: ReactNode): boolean {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return true;
  if (!isValidElement<{ refs?: unknown[]; value?: number }>(value)) return false;
  if (value.type === LinkChips) return !value.props.refs?.length;
  if (value.type === Importance) return !value.props.value;
  return false;
}

/** Ligne de lecture « libellé / valeur » des fiches en mode consultation. */
export function Facts({ rows }: { rows: Array<[string, ReactNode]> }) {
  const visible = rows.filter(([, value]) => !isEmptyValue(value));
  if (visible.length === 0) return null;
  return (
    <dl className="facts">
      {visible.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LinkChips({ refs, names, onOpen }: { refs: EntityRef[]; names: (ref: EntityRef) => string; onOpen: (ref: EntityRef) => void }) {
  if (refs.length === 0) return null;
  return (
    <span className="link-chips">
      {refs.map((ref) => (
        <button type="button" className="chip-label chip" key={`${ref.collection}/${ref.id}`} onClick={() => onOpen(ref)}>
          {names(ref)}
        </button>
      ))}
    </span>
  );
}

export function Importance({ value, max = 5 }: { value?: number; max?: number }) {
  if (!value) return null;
  return (
    <span className="importance" aria-label={`${value} sur ${max}`}>
      {'●'.repeat(value)}
      <i>{'●'.repeat(Math.max(0, max - value))}</i>
    </span>
  );
}

type DraftState = { dirty: boolean; saving: boolean; error: string; remoteChanged: boolean; lockedElsewhere?: boolean; save: () => void; reset: () => void };

/** Barre d'actions commune : enregistrement, conflit, focus, partage, duplication, corbeille, dates. */
export function SheetFooter({
  entityRef,
  entity,
  draft,
  editMode,
  onFocus,
  onDuplicate,
  extra,
}: {
  entityRef: EntityRef;
  entity: EntityMeta;
  draft: DraftState;
  editMode: boolean;
  onFocus?: () => void;
  onDuplicate?: () => void;
  extra?: ReactNode;
}) {
  const favorites = useFavorites();
  const favorite = favorites.isFavorite(entityRef);
  return (
    <footer className="sheet-footer">
      {draft.lockedElsewhere && <p className="lock-banner">✎ Fiche en cours de modification sur un autre poste : attendez son enregistrement pour éviter un conflit.</p>}
      {draft.remoteChanged && (
        <p className="conflict-banner">
          Mis à jour par ailleurs pendant ton édition.{' '}
          <button type="button" onClick={draft.reset}>
            Recharger la version distante
          </button>
        </p>
      )}
      {draft.error && <p className="form-error">{draft.error}</p>}
      {editMode && draft.dirty && (
        <div className="sheet-actions">
          <button type="button" className="primary-button" disabled={draft.saving} onClick={draft.save}>
            {draft.saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button type="button" className="ghost-button" onClick={draft.reset}>
            Annuler
          </button>
        </div>
      )}
      <div className="sheet-actions secondary">
        <button type="button" className={favorite ? 'ghost-button favorite active' : 'ghost-button favorite'} aria-pressed={favorite} onClick={() => favorites.toggle(entityRef)}>
          {favorite ? '★ Favori' : '☆ Favori'}
        </button>
        {onFocus && (
          <button type="button" className="ghost-button" onClick={onFocus}>
            ◎ Voir tout ce qui est lié
          </button>
        )}
        <button type="button" className="ghost-button" onClick={() => void navigator.clipboard?.writeText(shareUrl(routeForEntity(entityRef)))}>
          ⧉ Copier le lien
        </button>
        {extra}
        {editMode && onDuplicate && (
          <button type="button" className="ghost-button" onClick={onDuplicate}>
            ⎘ Dupliquer
          </button>
        )}
        {editMode && <ConfirmButton label="Mettre à la corbeille" confirmLabel="Confirmer la suppression" onConfirm={() => void trashEntity(entityRef.collection, entity)} />}
      </div>
      <p className="sheet-dates">
        {entity.reference
          ? 'Donnée publique importée — une modification la copie dans la chronique.'
          : `Créé ${formatDate(entity.createdAt)} · modifié ${formatDate(entity.updatedAt)}`}
      </p>
    </footer>
  );
}
