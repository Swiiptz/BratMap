import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Pickers';
import type { MapTool } from './MapCanvas';

type PlaceTarget = 'locations' | 'havens' | 'undergroundAccess';
type DrawTarget = 'territory' | 'plotZone';
export type CreateAction = { kind: 'place'; target: PlaceTarget; model?: boolean } | { kind: 'draw'; target: DrawTarget } | { kind: 'line' };

const createItems: Array<{ action: CreateAction; icon: string; label: string; hint: string }> = [
  { action: { kind: 'place', target: 'locations' }, icon: 'diamond', label: 'Lieu', hint: "Point d'intérêt" },
  { action: { kind: 'place', target: 'havens' }, icon: 'house', label: 'Havre', hint: 'Refuge, propriétaire, sécurité' },
  { action: { kind: 'place', target: 'locations', model: true }, icon: 'cube', label: 'Bâtiment 3D', hint: 'Lieu avec maquette : château, tour, église…' },
  { action: { kind: 'draw', target: 'territory' }, icon: 'polygon', label: 'Territoire', hint: 'Zone, Traditions, attitude' },
  { action: { kind: 'draw', target: 'plotZone' }, icon: 'plot', label: 'Zone de plot', hint: 'Périmètre d’une intrigue' },
  { action: { kind: 'place', target: 'undergroundAccess' }, icon: 'stairs', label: 'Accès souterrain', hint: 'Entrée vers le réseau' },
  { action: { kind: 'line' }, icon: 'route', label: 'Segment souterrain', hint: 'Tunnel tracé point par point' },
];

type Props = {
  tool: MapTool;
  placeTarget: PlaceTarget;
  placeModel: boolean;
  drawTarget: DrawTarget;
  itineraryOpen: boolean;
  tilt: boolean;
  fullscreen: boolean;
  shifted: boolean;
  onCreate: (action: CreateAction) => void;
  onMeasure: (tool: 'measure' | 'area') => void;
  onItinerary: () => void;
  onRecenter: () => void;
  onTilt: () => void;
  onFullscreen: () => void;
};

const isActive = (action: CreateAction, tool: MapTool, placeTarget: PlaceTarget, drawTarget: DrawTarget, placeModel: boolean) =>
  (action.kind === 'place' && tool === 'place' && placeTarget === action.target && Boolean(action.model) === placeModel) ||
  (action.kind === 'draw' && tool === 'draw' && drawTarget === action.target) ||
  (action.kind === 'line' && tool === 'line');

/** Dock d'outils de la carte : actions regroupées et nommées (créer, itinéraire, mesurer, vue). */
export function MapToolDock(props: Props) {
  const { tool, placeTarget, drawTarget, placeModel } = props;
  const [menu, setMenu] = useState<'create' | 'measure'>();
  const dock = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !dock.current?.contains(event.target as Node)) setMenu(undefined);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [menu]);
  const creating = createItems.find((item) => isActive(item.action, tool, placeTarget, drawTarget, placeModel));
  const measuring = tool === 'measure' || tool === 'area';

  return (
    <div ref={dock} className={props.shifted ? 'tool-dock shifted' : 'tool-dock'} role="toolbar" aria-label="Outils de la carte">
      <div className="dock-group">
        <button
          className={creating || menu === 'create' ? 'dock-button active' : 'dock-button'}
          aria-haspopup="menu"
          aria-expanded={menu === 'create'}
          onClick={() => setMenu(menu === 'create' ? undefined : 'create')}
        >
          <Icon id={creating?.icon ?? 'plus'} size={18} />
          <span>{creating ? creating.label : 'Créer'}</span>
          <Icon id="chevron" size={12} className="dock-chevron" />
        </button>
        {menu === 'create' && (
          <div className="dock-menu" role="menu">
            {createItems.map((item) => (
              <button
                key={item.label}
                role="menuitem"
                className={isActive(item.action, tool, placeTarget, drawTarget, placeModel) ? 'active' : ''}
                onClick={() => {
                  props.onCreate(item.action);
                  setMenu(undefined);
                }}
              >
                <Icon id={item.icon} size={17} />
                <span>
                  {item.label}
                  <small>{item.hint}</small>
                </span>
              </button>
            ))}
          </div>
        )}
        <button className={props.itineraryOpen ? 'dock-button active' : 'dock-button'} aria-pressed={props.itineraryOpen} onClick={props.onItinerary}>
          <Icon id="route" size={18} />
          <span>Itinéraire</span>
        </button>
        <button
          className={measuring || menu === 'measure' ? 'dock-button active' : 'dock-button'}
          aria-haspopup="menu"
          aria-expanded={menu === 'measure'}
          onClick={() => setMenu(menu === 'measure' ? undefined : 'measure')}
        >
          <Icon id={tool === 'area' ? 'area' : 'ruler'} size={18} />
          <span>Mesurer</span>
          <Icon id="chevron" size={12} className="dock-chevron" />
        </button>
        {menu === 'measure' && (
          <div className="dock-menu measure" role="menu">
            {(
              [
                ['measure', 'ruler', 'Distance', 'Tracé multi-points'],
                ['area', 'area', 'Surface', 'Polygone, aire et périmètre'],
              ] as const
            ).map(([id, icon, label, hint]) => (
              <button
                key={id}
                role="menuitem"
                className={tool === id ? 'active' : ''}
                onClick={() => {
                  props.onMeasure(id);
                  setMenu(undefined);
                }}
              >
                <Icon id={icon} size={17} />
                <span>
                  {label}
                  <small>{hint}</small>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <span className="dock-separator" />
      <div className="dock-group compact">
        <button className="dock-button icon-only" title="Recentrer sur la zone" aria-label="Recentrer sur la zone" onClick={props.onRecenter}>
          <Icon id="target" size={18} />
        </button>
        <button
          className={props.tilt ? 'dock-button icon-only active' : 'dock-button icon-only'}
          title="Vue 3D inclinée"
          aria-label="Vue 3D"
          aria-pressed={props.tilt}
          onClick={props.onTilt}
        >
          <Icon id="cube" size={18} />
        </button>
        <button className="dock-button icon-only" title="Plein écran (F)" aria-label="Plein écran" onClick={props.onFullscreen}>
          <Icon id={props.fullscreen ? 'collapse' : 'expand'} size={18} />
        </button>
      </div>
    </div>
  );
}
