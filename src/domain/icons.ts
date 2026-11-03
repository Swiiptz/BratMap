/**
 * Pictogrammes des pings : tracés vectoriels (grille 24×24, trait arrondi) dessinés sur la carte et dans l'interface.
 * Volontairement sobres et lisibles à petite taille (CDC design : « pictogrammes sobres »).
 */
export type PingIcon = { id: string; name: string; path: string };

export const pingIcons: PingIcon[] = [
  { id: 'pin', name: 'Lieu', path: 'M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z M12 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0' },
  { id: 'diamond', name: "Point d'intérêt", path: 'M12 3l8 9-8 9-8-9z' },
  { id: 'house', name: 'Havre', path: 'M4 11l8-7 8 7 M6 9.5V20h12V9.5 M10 20v-5h4v5' },
  { id: 'crown', name: 'Elyseum', path: 'M4 18h16 M4 18L3 8l5 4 4-7 4 7 5-4-1 10' },
  { id: 'star', name: 'Important', path: 'M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6z' },
  {
    id: 'meeting',
    name: 'Rencontre',
    path: 'M8 9m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M16 9m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M3 20c0-3 2.5-5 5-5s5 2 5 5 M11 20c0-3 2.5-5 5-5s5 2 5 5',
  },
  { id: 'warning', name: 'Danger', path: 'M12 3l10 18H2z M12 10v5 M12 18v.5' },
  {
    id: 'skull',
    name: 'Mort',
    path: 'M12 3a7 7 0 0 0-7 7c0 3 1.5 4.5 3 5.5V19h8v-3.5c1.5-1 3-2.5 3-5.5a7 7 0 0 0-7-7z M9.5 11m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0 M14.5 11m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0 M10 19v2 M14 19v2',
  },
  { id: 'drop', name: 'Sang / ressource', path: 'M12 3c3 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-6.5 6-11z' },
  { id: 'eye', name: 'Surveillance', path: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0' },
  { id: 'camera', name: 'Caméra', path: 'M3 8h3l2-3h8l2 3h3v12H3z M12 13.5m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0' },
  { id: 'mask', name: 'Masque / secret', path: 'M3 6c3 0 6 1 9 1s6-1 9-1c0 7-3 12-9 12S3 13 3 6z M8 11h2.5 M13.5 11H16' },
  { id: 'key', name: 'Clé / accès', path: 'M8 14m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M11 11l9-9 M17 5l2 2 M15 7l2 2' },
  { id: 'door', name: 'Entrée', path: 'M6 21V4h12v17 M3 21h18 M14 12.5h.5' },
  { id: 'stairs', name: 'Souterrain', path: 'M3 20h5v-5h5v-5h5V5h3' },
  { id: 'moon', name: 'Nuit / refuge', path: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z' },
  { id: 'flame', name: 'Feu / Brujah', path: 'M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .5 2 1.5 3 2.5 3 0-3-1-5 0-8z' },
  { id: 'swords', name: 'Combat', path: 'M5 5l14 14 M19 5L5 19 M3 8l5-5 M16 3l5 5' },
  { id: 'shield', name: 'Police / protection', path: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z' },
  { id: 'bank', name: 'Finance', path: 'M3 9l9-5 9 5 M5 9v8 M10 9v8 M14 9v8 M19 9v8 M3 20h18' },
  { id: 'cup', name: 'Bar / club', path: 'M6 4h12l-1.5 7a4.5 4.5 0 0 1-9 0z M12 15.5V20 M8 20h8' },
  { id: 'music', name: 'Musique / culture', path: 'M9 18V5l11-2v13 M9 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M17 16m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0' },
  { id: 'book', name: 'Savoir / archives', path: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 19V5' },
  { id: 'church', name: 'Église', path: 'M12 2v6 M9 5h6 M5 21V12l7-4 7 4v9z M10 21v-4h4v4' },
  { id: 'medical', name: 'Hôpital', path: 'M4 4h16v16H4z M12 8v8 M8 12h8' },
  { id: 'building', name: 'Bâtiment', path: 'M5 21V4h9v17 M14 9h5v12 M3 21h18 M8 8h2 M8 12h2 M8 16h2' },
  { id: 'tree', name: 'Parc', path: 'M12 3l6 9h-3l4 6H5l4-6H6z M12 18v3' },
  { id: 'car', name: 'Véhicule', path: 'M4 16v-4l2-5h12l2 5v4z M4 16v2 M20 16v2 M7.5 13.5h.5 M16 13.5h.5' },
  { id: 'dot', name: 'Autre', path: 'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0' },
];

/** Pictogrammes de l'interface (navigation, outils), même grammaire que les pings. */
export const uiIcons: Record<string, string> = {
  map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15',
  users: 'M9 8m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M2 21c0-3.5 3-6 7-6s7 2.5 7 6 M16 4.5a3.5 3.5 0 0 1 0 7 M18 15.5c2.3.6 4 2.7 4 5.5',
  plot: 'M12 3l9 9-9 9-9-9z M12 8.5l3.5 3.5-3.5 3.5-3.5-3.5z',
  sliders: 'M4 6h16 M4 12h16 M4 18h16 M8 4v4 M16 10v4 M10 16v4',
  undo: 'M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5 M20 9H10a6 6 0 0 0 0 12h3',
  plus: 'M12 5v14 M5 12h14',
  route: 'M6 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M18 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7',
  ruler: 'M3 17L17 3l4 4L7 21z M7 13l2 2 M10 10l2 2 M13 7l2 2',
  area: 'M4 8l6-5 9 4-2 11-11 3z',
  target: 'M12 12m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0 M12 2v4 M12 18v4 M2 12h4 M18 12h4',
  cube: 'M12 2l9 5v10l-9 5-9-5V7z M12 22V12 M21 7l-9 5-9-5',
  expand: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
  collapse: 'M9 4v5H4 M15 4v5h5 M9 20v-5H4 M15 20v-5h5',
  layers: 'M12 3l9 5-9 5-9-5z M3 13l9 5 9-5',
  polygon: 'M4 7l7-4 9 5-3 12-12-2z',
  radius: 'M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0 M12 12h8 M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
  chevron: 'M6 9l6 6 6-6',
  download: 'M12 4v11 M7 10l5 5 5-5 M5 20h14',
  search: 'M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0 M21 21l-5-5',
};

/** Anciens glyphes Unicode des types de pings → pictogrammes. */
const legacyGlyphs: Record<string, string> = { '◆': 'diamond', '⌂': 'house', '✦': 'crown', '▼': 'stairs', '◉': 'drop', '⚠': 'warning', '◎': 'meeting', '•': 'dot' };

export function resolveIcon(value: string | undefined | null, fallback = 'pin'): string {
  if (!value) return fallback;
  if (pingIcons.some((icon) => icon.id === value)) return value;
  return legacyGlyphs[value] ?? fallback;
}

export const iconPath = (id: string) => uiIcons[id] ?? pingIcons.find((icon) => icon.id === id)?.path ?? pingIcons[0].path;

/** Palette pensée pour le fond sombre : teintes distinctes, saturation modérée. */
export const colorPalette = ['#87c6b2', '#7fd0d8', '#8fb3d9', '#9d8fe0', '#c9a5e0', '#e894b8', '#e07a6f', '#c98a5a', '#dba866', '#e3c86b', '#9fd27f', '#b8bec4'];
