import { describe, expect, it } from 'vitest';
import { reorder } from '../layering';

const zones = [
  { id: 'a', order: 0 },
  { id: 'b', order: 1 },
  { id: 'c', order: 2 },
];

describe('ordre des zones', () => {
  it('passe une zone au premier plan ou à l’arrière-plan', () => {
    expect(reorder(zones, 'a', 'front')).toEqual([{ id: 'a', order: 3 }]);
    expect(reorder(zones, 'c', 'back')).toEqual([{ id: 'c', order: -1 }]);
    expect(reorder(zones, 'c', 'front')).toEqual([]);
  });

  it('échange avec la zone voisine pour monter ou descendre', () => {
    expect(reorder(zones, 'a', 'up')).toEqual([
      { id: 'a', order: 1 },
      { id: 'b', order: 0 },
    ]);
    expect(reorder(zones, 'b', 'down')).toEqual([
      { id: 'b', order: 0 },
      { id: 'a', order: 1 },
    ]);
    expect(reorder(zones, 'a', 'down')).toEqual([]);
  });

  it('utilise le rang d’apparition quand aucun ordre n’est saisi', () => {
    expect(reorder([{ id: 'x' }, { id: 'y' }], 'x', 'front')).toEqual([{ id: 'x', order: 2 }]);
  });
});
