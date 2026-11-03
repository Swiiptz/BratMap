import { useMemo } from 'react';
import { useChronicle } from '../../data/ChronicleProvider';
import type { UndergroundLevel } from '../../domain/models';
import { levelDepths, levelExamples, levelNames, segmentLevels, undergroundLevels } from '../../domain/underground';
import { categoryStyles, levelColors, type LevelFilter, type TravelFilter, type UndergroundCategory } from './mapData';

type Props = {
  level: LevelFilter;
  onLevelChange: (level: LevelFilter) => void;
  travelFilter: TravelFilter;
  onTravelFilterChange: (filter: TravelFilter) => void;
  onClose: () => void;
  shifted: boolean;
};

const travelFilters: Array<{ id: TravelFilter; label: string; title: string }> = [
  { id: 'all', label: 'Tout', title: 'Tout le réseau connu' },
  { id: 'passable', label: 'Exploitable', title: 'Masque l’impraticable et ce qui ne se parcourt qu’en rampant' },
  { id: 'discreet', label: 'Discret', title: 'Exploitable uniquement, et estompe les tronçons exposés' },
];

/** Sélecteur de niveaux façon ascenseur, visible en vue Souterrain, avec la légende des tracés. */
export function UndergroundDock({ level, onLevelChange, travelFilter, onTravelFilterChange, onClose, shifted }: Props) {
  const { undergroundSegments, undergroundAccess } = useChronicle();
  const counts = useMemo(() => {
    const result = new Map<UndergroundLevel, number>(undergroundLevels.map((item) => [item, 0]));
    undergroundSegments.forEach((segment) => segmentLevels(segment).forEach((item) => result.set(item, (result.get(item) ?? 0) + 1)));
    undergroundAccess.forEach((access) => result.set(access.level, (result.get(access.level) ?? 0) + 1));
    return result;
  }, [undergroundSegments, undergroundAccess]);

  return (
    <aside className={shifted ? 'underground-dock shifted' : 'underground-dock'} aria-label="Niveaux souterrains">
      <header>
        <span className="eyebrow">VUE SOUTERRAINE</span>
        <button className="close-button" onClick={onClose} aria-label="Quitter la vue souterraine">
          ×
        </button>
      </header>
      <div className="level-stack" role="radiogroup" aria-label="Niveau affiché">
        <button role="radio" aria-checked={level === 'all'} className={level === 'all' ? 'level-button active' : 'level-button'} onClick={() => onLevelChange('all')}>
          <span className="level-bar all" />
          <span className="level-name">Tous les niveaux</span>
        </button>
        {undergroundLevels.map((item) => (
          <button
            key={item}
            role="radio"
            aria-checked={level === item}
            className={level === item ? 'level-button active' : 'level-button'}
            onClick={() => onLevelChange(item)}
            style={{ ['--level-color' as string]: levelColors[item] }}
            title={levelExamples[item]}
          >
            <span className="level-bar" />
            <span className="level-value">{item}</span>
            <span className="level-name">
              {levelNames[item]}
              <em>{levelDepths[item]}</em>
            </span>
            <small>{counts.get(item) || ''}</small>
          </button>
        ))}
      </div>
      <div className="travel-filter" role="radiogroup" aria-label="Déplacement">
        {travelFilters.map((filter) => (
          <button
            key={filter.id}
            role="radio"
            aria-checked={travelFilter === filter.id}
            className={travelFilter === filter.id ? 'selected' : ''}
            title={filter.title}
            onClick={() => onTravelFilterChange(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <dl className="dock-legend">
        {(Object.keys(categoryStyles) as UndergroundCategory[]).map((category) => (
          <div key={category}>
            <dt
              className={`legend-line cat-${category}`}
              style={{ borderTopColor: categoryStyles[category].color ?? '#8cc2ec', borderTopWidth: categoryStyles[category].width + 0.5 }}
            />
            <dd>{categoryStyles[category].label}</dd>
          </div>
        ))}
        <div className="legend-styles">
          <dt className="legend-line dashed" />
          <dd>supposé</dd>
          <dt className="legend-line dotted" />
          <dd>vertical</dd>
        </div>
      </dl>
      {undergroundSegments.length === 0 && undergroundAccess.length === 0 && (
        <p className="muted">Aucun réseau connu. Pose un accès ▼ puis trace un segment ⌇ depuis la barre d'outils.</p>
      )}
    </aside>
  );
}
