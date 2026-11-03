import { useEffect, useRef, useState } from 'react';
import { saveEntity } from '../data';
import { useEditLock } from '../data/editLocks';
import type { EntityMeta, EntityCollection } from '../domain/models';

const META_KEYS = new Set(['id', 'createdAt', 'updatedAt', 'deletedAt', 'version', 'reference']);
/** Les champs vidés passent à null pour être réellement effacés par une mise à jour partielle. */
const stripMeta = (entity: object) =>
  Object.fromEntries(
    Object.entries(entity)
      .filter(([key]) => !META_KEYS.has(key))
      .map(([key, value]) => [key, value === undefined ? null : value]),
  );

/**
 * Brouillon d'édition d'une fiche avec protection contre l'écrasement silencieux (CDC §21) :
 * si le document change ailleurs pendant l'édition, `remoteChanged` passe à vrai et l'enregistrement est refusé par le store.
 */
export function useEntityDraft<T extends EntityMeta>(collection: EntityCollection, entity: T | undefined) {
  const [draft, setDraft] = useState<T | undefined>(entity);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const baseVersion = useRef(entity?.version ?? 0);
  const entityId = entity?.id;

  useEffect(() => {
    setDraft(entity);
    setDirty(false);
    setError('');
    baseVersion.current = entity?.version ?? 0;
    // Le brouillon ne se réinitialise que lorsqu'on change d'entité.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  // Mise à jour distante sans modification locale : on suit silencieusement la dernière version.
  useEffect(() => {
    if (!entity || dirty) return;
    setDraft(entity);
    baseVersion.current = entity.version ?? 0;
  }, [entity, dirty]);

  const remoteChanged = Boolean(entity && dirty && (entity.version ?? 0) !== baseVersion.current);
  // Verrou indicatif tant que la fiche a des modifications non enregistrées.
  const lockedElsewhere = useEditLock(collection, entity?.id, dirty);

  const update = (patch: Partial<T>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setDirty(true);
  };

  const save = async () => {
    if (!draft || !entity) return;
    setSaving(true);
    setError('');
    try {
      await saveEntity(collection, entity, stripMeta(draft), baseVersion.current);
      setDirty(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Échec de sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setDraft(entity);
    setDirty(false);
    setError('');
    baseVersion.current = entity?.version ?? 0;
  };

  return { draft, update, save, reset, dirty, saving, error, remoteChanged, lockedElsewhere };
}
