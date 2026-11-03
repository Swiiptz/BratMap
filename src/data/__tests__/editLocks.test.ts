import { describe, expect, it, vi } from 'vitest';

vi.mock('../index', () => ({ store: {} }));

describe('verrou d’édition', () => {
  it('ne signale que les verrous d’un autre poste encore frais', async () => {
    const { isForeignLock, LOCK_TTL_MS } = await import('../editLocks');
    const now = 1_000_000;
    expect(isForeignLock(undefined, 'moi', now)).toBe(false);
    expect(isForeignLock({ sessionId: 'moi', heartbeat: now }, 'moi', now)).toBe(false);
    expect(isForeignLock({ sessionId: 'autre', heartbeat: now - 5_000 }, 'moi', now)).toBe(true);
    expect(isForeignLock({ sessionId: 'autre', heartbeat: now - LOCK_TTL_MS - 1 }, 'moi', now)).toBe(false);
  });
});
