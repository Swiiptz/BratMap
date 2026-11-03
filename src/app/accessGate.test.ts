import { describe, expect, it } from 'vitest';
import { sha256 } from './AccessGate';

describe('code d’accès', () => {
  it('compare des empreintes SHA-256 hexadécimales', async () => {
    expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
