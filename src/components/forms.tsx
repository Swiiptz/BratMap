import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { store } from '../data';
import { useChronicle } from '../data/ChronicleProvider';
import type { EntityRef } from '../domain/chronicle';
import type { ReferentialCollection } from '../domain/models';
import { referentialId } from '../domain/referentials';
import { normalizeText } from '../domain/text';

export function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? 'field field-wide' : 'field'}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return <input value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoFocus={autoFocus} />;
}

export function TextArea({ value, onChange, rows = 3 }: { value: string | undefined; onChange: (value: string) => void; rows?: number }) {
  return <textarea value={value ?? ''} rows={rows} onChange={(event) => onChange(event.target.value)} />;
}

export function NumberInput({ value, onChange, min = 0, max = 10 }: { value: number | undefined; onChange: (value: number | undefined) => void; min?: number; max?: number }) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value === '' ? undefined : Math.max(min, Math.min(max, Number(event.target.value))))}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  empty,
}: {
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  options: ReadonlyArray<{ id: T; name: string }>;
  empty?: string;
}) {
  return (
    <select value={value ?? ''} onChange={(event) => onChange((event.target.value || undefined) as T | undefined)}>
      {empty !== undefined && <option value="">{empty}</option>}
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );
}

/** Retrouve un élément de référentiel par son nom normalisé, ou le crée : évite « Animalisme » / « animalisme » en double. */
export async function resolveReferential(collection: ReferentialCollection, existing: Array<{ id: string; name: string }>, name: string): Promise<string | undefined> {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const match = existing.find((item) => normalizeText(item.name) === normalizeText(trimmed));
  if (match) return match.id;
  let id = referentialId(trimmed);
  while (existing.some((item) => item.id === id)) id = `${id}-${Math.random().toString(36).slice(2, 5)}`;
  await store.create(collection, { name: trimmed, active: true, order: existing.length }, id);
  return id;
}

/** Autocomplétion sur un référentiel (CDC §10) avec ajout à la volée d'un élément absent. */
export function RefCombo({
  collection,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  collection: ReferentialCollection;
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { refs } = useChronicle();
  const items = refs[collection];
  const listId = useId();
  const currentName = items.find((item) => item.id === value)?.name ?? value ?? '';
  const [text, setText] = useState(currentName);
  useEffect(() => setText(currentName), [currentName]);

  const committing = useRef(false);

  // Entrée puis perte de focus déclenchent tous deux la validation : un seul appel à la fois.
  const commit = async () => {
    if (committing.current) return;
    if (normalizeText(text) === normalizeText(currentName)) {
      if (!text.trim()) onChange(undefined);
      return;
    }
    committing.current = true;
    try {
      onChange(await resolveReferential(collection, items, text));
    } finally {
      committing.current = false;
    }
  };

  return (
    <>
      <input
        list={listId}
        value={text}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), void commit())}
      />
      <datalist id={listId}>
        {items
          .filter((item) => item.active !== false)
          .map((item) => (
            <option key={item.id} value={item.name} />
          ))}
      </datalist>
    </>
  );
}

/** Liens par IDs vers d'autres entités : puces cliquables (navigation croisée) + sélecteur d'ajout. */
export function EntityPicker({
  ids,
  onChange,
  options,
  onOpen,
  collection,
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
  options: Array<{ id: string; name: string }>;
  onOpen?: (ref: EntityRef) => void;
  collection: EntityRef['collection'];
}) {
  const available = options.filter((option) => !ids.includes(option.id)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  if (ids.length === 0 && available.length === 0) return <p className="muted picker-empty">Aucun élément disponible pour l'instant.</p>;
  return (
    <div className="picker">
      {ids.map((id) => (
        <span className="chip" key={id}>
          <button type="button" className="chip-label" onClick={() => onOpen?.({ collection, id })}>
            {options.find((option) => option.id === id)?.name ?? 'Élément supprimé'}
          </button>
          <button type="button" className="chip-remove" aria-label="Retirer" onClick={() => onChange(ids.filter((current) => current !== id))}>
            ×
          </button>
        </span>
      ))}
      {available.length > 0 && (
        <select className="picker-add" value="" onChange={(event) => event.target.value && onChange([...ids, event.target.value])}>
          <option value="">＋ Ajouter…</option>
          {available.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/** Lignes « élément de référentiel + niveau » (disciplines, compétences, capacités). */
export function LeveledList({
  collection,
  rows,
  onChange,
  optionalLevel = false,
}: {
  collection: ReferentialCollection;
  rows: Array<{ refId: string; level?: number }>;
  onChange: (rows: Array<{ refId: string; level?: number }>) => void;
  optionalLevel?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="leveled-list">
      {rows.map((row, index) => (
        <div className="leveled-row" key={`${row.refId}-${index}`}>
          <RefCombo collection={collection} value={row.refId} onChange={(refId) => refId && onChange(rows.map((current, i) => (i === index ? { ...current, refId } : current)))} />
          <NumberInput
            value={row.level}
            min={0}
            max={10}
            onChange={(level) => onChange(rows.map((current, i) => (i === index ? { ...current, level: level ?? (optionalLevel ? undefined : 0) } : current)))}
          />
          <button type="button" className="icon-button" aria-label="Retirer" onClick={() => onChange(rows.filter((_, i) => i !== index))}>
            ×
          </button>
        </div>
      ))}
      {adding ? (
        <div className="leveled-row">
          <RefCombo
            collection={collection}
            value={undefined}
            placeholder="Nom…"
            autoFocus
            onChange={(refId) => {
              setAdding(false);
              if (refId && !rows.some((row) => row.refId === refId)) onChange([...rows, { refId, level: optionalLevel ? undefined : 1 }]);
            }}
          />
        </div>
      ) : (
        <button type="button" className="ghost-button" onClick={() => setAdding(true)}>
          ＋ Ajouter
        </button>
      )}
    </div>
  );
}

/** Suppression en deux temps (CDC §17 : « Suppr avec confirmation »). */
export function ConfirmButton({
  label,
  confirmLabel = 'Confirmer ?',
  onConfirm,
  className = 'danger-button',
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 3500);
    return () => window.clearTimeout(timer);
  }, [armed]);
  return (
    <button type="button" className={armed ? `${className} armed` : className} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? confirmLabel : label}
    </button>
  );
}
