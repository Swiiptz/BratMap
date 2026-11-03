import { describe, expect, it } from 'vitest';
import { normalizeText, parseTags, slugify } from '../text';

describe('normalisation', () => {
  it('ignore casse, accents et espaces', () => {
    expect(normalizeText('  Élysée   Toréador ')).toBe('elysee toreador');
  });

  it('produit des identifiants stables', () => {
    expect(slugify('Force d’âme')).toBe('force-d-ame');
    expect(slugify('À venir')).toBe('a-venir');
    expect(slugify('!!!')).toBe('item');
  });

  it('dédoublonne les tags sans tenir compte des accents', () => {
    expect(parseTags('Élysée, elysee, , danger ,Danger')).toEqual(['Élysée', 'danger']);
  });
});
