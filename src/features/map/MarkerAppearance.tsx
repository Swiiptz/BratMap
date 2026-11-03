import { ColorPalette, IconPicker, PingPreview } from '../../components/Pickers';
import { resolveIcon } from '../../domain/icons';
import type { MarkerStyle } from '../../domain/models';

/** Apparence d'un ping : aperçu, couleur (palette + libre), pictogramme et taille. */
export function MarkerAppearance({
  style,
  fallbackIcon,
  square,
  defaultSize,
  onChange,
}: {
  style: MarkerStyle;
  fallbackIcon: string;
  square: boolean;
  defaultSize: number;
  onChange: (style: MarkerStyle) => void;
}) {
  const icon = resolveIcon(style.icon, resolveIcon(fallbackIcon));
  return (
    <fieldset className="field-wide appearance-fieldset">
      <legend>Apparence sur la carte</legend>
      <div className="appearance-head">
        <PingPreview icon={icon} color={style.color} square={square} />
        <label className="size-field">
          Taille
          <input type="range" min={4} max={12} value={style.size || defaultSize} onChange={(event) => onChange({ ...style, size: Number(event.target.value) })} />
        </label>
      </div>
      <ColorPalette value={style.color} onChange={(color) => onChange({ ...style, color })} />
      <IconPicker value={icon} color={style.color} onChange={(next) => onChange({ ...style, icon: next })} />
    </fieldset>
  );
}
