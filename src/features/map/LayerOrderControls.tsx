import { saveEntity } from '../../data';
import { reorder, type LayerAction } from '../../domain/layering';
import type { EntityMeta } from '../../domain/models';

const actions: Array<{ id: LayerAction; label: string; title: string }> = [
  { id: 'front', label: '⤒', title: 'Premier plan' },
  { id: 'up', label: '↑', title: 'Monter d’un cran' },
  { id: 'down', label: '↓', title: 'Descendre d’un cran' },
  { id: 'back', label: '⤓', title: 'Arrière-plan' },
];

/** Boutons de superposition d'une zone parmi les zones de même famille (territoires, ou zones de plots). */
export function LayerOrderControls<T extends EntityMeta & { order?: number | null }>({ collection, items, id }: { collection: 'territories' | 'plots'; items: T[]; id: string }) {
  const apply = (action: LayerAction) => {
    for (const change of reorder(items, id, action)) {
      const entity = items.find((item) => item.id === change.id);
      if (entity) void saveEntity(collection, entity, { order: change.order });
    }
  };
  return (
    <div className="layer-order">
      <span>Superposition</span>
      <div className="layer-order-buttons" role="group" aria-label="Superposition">
        {actions.map((action) => (
          <button key={action.id} type="button" title={action.title} aria-label={action.title} onClick={() => apply(action.id)}>
            {action.label}
          </button>
        ))}
      </div>
      <small>Astuce : recliquer sur une zone sélectionne celle du dessous.</small>
    </div>
  );
}
