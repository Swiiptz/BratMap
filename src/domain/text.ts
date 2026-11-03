/** Minuscule, sans accents ni espaces superflus : base commune de la recherche et du dédoublonnage. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[\u2019']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(value: string): string {
  return (
    normalizeText(value)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item'
  );
}

export function parseTags(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = normalizeText(tag);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
