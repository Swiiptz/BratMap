/** Ordre d'empilement des zones (territoires, zones de plots) : plus la valeur est haute, plus la zone est au premier plan. */
export type LayerAction = 'front' | 'back' | 'up' | 'down';
type Ordered = { id: string; order?: number | null };

/** Ordre effectif : valeur saisie, sinon rang d'apparition (stable). */
export function effectiveOrders<T extends Ordered>(items: T[]): Map<string, number> {
  return new Map(items.map((item, index) => [item.id, item.order ?? index]));
}

/**
 * Nouvel ordre d'un élément. « Monter » / « Descendre » échangent avec le voisin immédiat ;
 * le résultat liste uniquement les éléments dont l'ordre change.
 */
export function reorder<T extends Ordered>(items: T[], id: string, action: LayerAction): Array<{ id: string; order: number }> {
  const orders = effectiveOrders(items);
  const sorted = [...items].sort((a, b) => (orders.get(a.id) ?? 0) - (orders.get(b.id) ?? 0));
  const index = sorted.findIndex((item) => item.id === id);
  if (index < 0) return [];
  const values = sorted.map((item) => orders.get(item.id) ?? 0);
  if (action === 'front') return index === sorted.length - 1 ? [] : [{ id, order: Math.max(...values) + 1 }];
  if (action === 'back') return index === 0 ? [] : [{ id, order: Math.min(...values) - 1 }];
  const neighbour = sorted[action === 'up' ? index + 1 : index - 1];
  if (!neighbour) return [];
  const mine = values[index];
  const theirs = orders.get(neighbour.id) ?? 0;
  // Ordres égaux (anciennes données) : on écarte pour garantir un échange visible.
  return mine === theirs
    ? [{ id, order: theirs + (action === 'up' ? 1 : -1) }]
    : [
        { id, order: theirs },
        { id: neighbour.id, order: mine },
      ];
}
