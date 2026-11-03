import { beforeEach, describe, expect, it } from 'vitest';
import { clearHistory, recordHistory, redo, undo } from '../history';

describe('historique d’annulation', () => {
  let value = 0;
  const entry = (from: number, to: number) => ({ label: `${from}→${to}`, undo: async () => void (value = from), redo: async () => void (value = to) });
  beforeEach(() => {
    clearHistory();
    value = 0;
  });

  it('annule puis rétablit dans l’ordre', async () => {
    value = 1;
    recordHistory(entry(0, 1));
    value = 2;
    recordHistory(entry(1, 2));
    expect(await undo()).toBe('1→2');
    expect(value).toBe(1);
    expect(await undo()).toBe('0→1');
    expect(value).toBe(0);
    expect(await undo()).toBeUndefined();
    expect(await redo()).toBe('0→1');
    expect(value).toBe(1);
  });

  it('une nouvelle action efface ce qui pouvait être rétabli, et l’annulation ne s’enregistre pas elle-même', async () => {
    recordHistory({ label: 'a', undo: async () => recordHistory(entry(9, 9)), redo: async () => undefined });
    await undo();
    recordHistory(entry(0, 3));
    expect(await redo()).toBeUndefined();
    expect(await undo()).toBe('0→3');
    expect(await undo()).toBeUndefined();
  });
});
