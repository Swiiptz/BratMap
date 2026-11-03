import { useMemo } from 'react';
import { useChronicle } from '../../data/ChronicleProvider';
import type { EntityRef } from '../../domain/chronicle';
import { formatDistance, type Coordinate } from '../../domain/geometry';
import { entityCollections } from '../../domain/models';
import { nearby } from '../../domain/proximity';

export const PROXIMITY_RADII = [250, 500, 1000, 2000];

/** « Autour d'ici » : éléments dans un rayon, du plus proche au plus loin. */
export function ProximityPanel({
  center,
  radius,
  onRadiusChange,
  onOpen,
  onClose,
}: {
  center: Coordinate;
  radius: number;
  onRadiusChange: (radius: number) => void;
  onOpen: (ref: EntityRef) => void;
  onClose: () => void;
}) {
  const data = useChronicle();
  const hits = useMemo(
    () => nearby(data, center, radius).filter((hit) => !(hit.collection === 'undergroundAccess' && data.undergroundAccess.find((item) => item.id === hit.id)?.minor)),
    [data, center, radius],
  );
  return (
    <aside className="floating-panel proximity-panel" aria-label="Autour d'ici">
      <header>
        <span className="eyebrow">AUTOUR D'ICI</span>
        <button className="close-button" onClick={onClose} aria-label="Fermer">
          ×
        </button>
      </header>
      <div className="segmented radius" role="radiogroup" aria-label="Rayon">
        {PROXIMITY_RADII.map((value) => (
          <button key={value} role="radio" aria-checked={radius === value} className={radius === value ? 'selected' : ''} onClick={() => onRadiusChange(value)}>
            {formatDistance(value)}
          </button>
        ))}
      </div>
      <div className="proximity-list">
        {hits.length === 0 && <p className="muted">Rien de connu dans ce rayon.</p>}
        {hits.map((hit) => (
          <button key={`${hit.collection}/${hit.id}`} className="result-row" onClick={() => onOpen(hit)}>
            <span>{hit.name}</span>
            <small>
              {entityCollections[hit.collection]} · {hit.inside ? 'ici' : formatDistance(hit.distanceM)}
            </small>
          </button>
        ))}
      </div>
    </aside>
  );
}
