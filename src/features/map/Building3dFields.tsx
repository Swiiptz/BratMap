import { useEffect, useSyncExternalStore } from 'react';
import { modelPresets, type Model3d, type ModelPreset } from '../../domain/models3d';
import type { Building3d } from '../../domain/models';

/** Aperçu en direct de la maquette en cours de réglage (avant enregistrement), lu par la carte. */
export type ModelPreview = { ref: string; model?: Model3d };
let preview: ModelPreview | undefined;
const listeners = new Set<() => void>();
const setPreview = (next: ModelPreview | undefined) => {
  preview = next;
  listeners.forEach((listener) => listener());
};
export const useModelPreview = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => preview,
  );

/** Catalogue des maquettes avec leurs dimensions par défaut. */
export const defaultModel = (preset: ModelPreset, rotation = 0): Model3d | undefined => {
  const defaults = modelPresets.find((item) => item.id === preset)?.defaults;
  return defaults && { preset, rotation, ...defaults };
};

const landmarkLabel = (key: string) => (key.startsWith('way/') ? `Bâtiment OSM ${key}` : key);

/** Résumé lisible du volume 3D d'un lieu (fiche en consultation). */
export function building3dSummary(value: Building3d): string | undefined {
  if (value.landmarkKey) return `${landmarkLabel(value.landmarkKey)} (bâtiment existant)`;
  if (value.model3d) return `${modelPresets.find((preset) => preset.id === value.model3d?.preset)?.name ?? 'Maquette'} · ${value.model3d.height} m`;
  return undefined;
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="slider-field">
      <span>
        {label}{' '}
        <b>
          {value} {unit}
        </b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

/** Volume 3D facultatif : rattachement à un bâtiment existant, ou maquette du catalogue réglable. */
export function Building3dFields({ value, onChange, previewRef }: { value: Building3d; onChange: (patch: Building3d) => void; previewRef?: string }) {
  const model = value.model3d;
  useEffect(() => {
    if (!previewRef) return;
    setPreview({ ref: previewRef, model });
  }, [previewRef, model]);
  useEffect(() => () => setPreview(undefined), [previewRef]);
  const setModel = (patch: Partial<Model3d>) => model && onChange({ model3d: { ...model, ...patch } });
  const choosePreset = (preset: string) => {
    if (!preset) return onChange({ model3d: undefined });
    const next = defaultModel(preset as ModelPreset, model?.rotation ?? 0);
    if (next) onChange({ model3d: next });
  };

  return (
    <fieldset className="field-wide building-fieldset">
      <legend>Bâtiment 3D (facultatif)</legend>
      {value.landmarkKey && (
        <p className="linked-landmark">
          Rattaché à <strong>{landmarkLabel(value.landmarkKey)}</strong>
          <button type="button" className="link-button" onClick={() => onChange({ landmarkKey: undefined })}>
            détacher
          </button>
        </p>
      )}
      <label className="field">
        <span>Maquette</span>
        <select value={model?.preset ?? ''} onChange={(event) => choosePreset(event.target.value)}>
          <option value="">Aucune</option>
          {modelPresets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      </label>
      {model && (
        <div className="slider-grid">
          <Slider label="Largeur" value={model.width} min={4} max={160} unit="m" onChange={(width) => setModel({ width })} />
          <Slider label="Profondeur" value={model.depth} min={4} max={160} unit="m" onChange={(depth) => setModel({ depth })} />
          <Slider label="Hauteur" value={model.height} min={4} max={250} unit="m" onChange={(height) => setModel({ height })} />
          <Slider label="Orientation" value={model.rotation} min={0} max={359} step={5} unit="°" onChange={(rotation) => setModel({ rotation })} />
        </div>
      )}
      {model && <p className="muted">Aperçu en direct sur la carte (vue 3D conseillée) ; « Enregistrer » pour garder la maquette.</p>}
      {!value.landmarkKey && !model && <p className="muted">Choisir une maquette ci-dessus, ou en vue 3D cliquer un bâtiment existant pour le rattacher.</p>}
    </fieldset>
  );
}
