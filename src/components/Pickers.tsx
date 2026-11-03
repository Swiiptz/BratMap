import { colorPalette, iconPath, pingIcons, resolveIcon, uiIcons } from '../domain/icons';

export function Icon({ id, size = 16, className }: { id: string; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={iconPath(id in uiIcons ? id : resolveIcon(id))} />
    </svg>
  );
}

/** Aperçu d'un ping tel qu'il apparaît sur la carte. */
export function PingPreview({ icon, color, square = false, diamond = false }: { icon: string; color: string; square?: boolean; diamond?: boolean }) {
  return (
    <span className={diamond ? 'ping-preview diamond' : square ? 'ping-preview square' : 'ping-preview'} style={{ color, borderColor: color }}>
      <Icon id={icon} size={diamond ? 12 : 15} />
    </span>
  );
}

export function IconPicker({ value, onChange, color = '#cfe0e6' }: { value: string | undefined; onChange: (icon: string) => void; color?: string }) {
  const current = resolveIcon(value);
  return (
    <div className="icon-picker" role="radiogroup" aria-label="Icône">
      {pingIcons.map((icon) => (
        <button
          key={icon.id}
          type="button"
          role="radio"
          aria-checked={current === icon.id}
          title={icon.name}
          className={current === icon.id ? 'selected' : ''}
          style={current === icon.id ? { color, borderColor: color } : undefined}
          onClick={() => onChange(icon.id)}
        >
          <Icon id={icon.id} size={16} />
        </button>
      ))}
    </div>
  );
}

export function ColorPalette({ value, onChange }: { value: string | undefined; onChange: (color: string) => void }) {
  return (
    <div className="color-palette" role="radiogroup" aria-label="Couleur">
      {colorPalette.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          title={color}
          className={value === color ? 'selected' : ''}
          style={{ ['--swatch' as string]: color }}
          onClick={() => onChange(color)}
        />
      ))}
      <label className="custom-color" title="Couleur libre">
        <input type="color" value={value ?? '#87c6b2'} onChange={(event) => onChange(event.target.value)} />
        <span>+</span>
      </label>
    </div>
  );
}
