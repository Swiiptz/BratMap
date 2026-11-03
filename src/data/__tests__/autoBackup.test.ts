import { describe, expect, it, vi } from 'vitest';

vi.mock('../index', () => ({ exportBackup: vi.fn() }));

describe('sauvegardes automatiques', () => {
  it('ne garde que les plus récentes', async () => {
    const { backupsToPrune } = await import('../autoBackup');
    const backups = Array.from({ length: 9 }, (_, day) => ({ id: `j${day}`, createdAt: day }));
    expect(backupsToPrune(backups, 7)).toEqual(['j1', 'j0']);
    expect(backupsToPrune(backups.slice(0, 3), 7)).toEqual([]);
  });
});
