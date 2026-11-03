import { ringCentroid, type Coordinate } from './geometry';

/**
 * Bâtiments 3D « maquette » : des volumes extrudés empilés (murs, toiture en gradins, flèches).
 * Pas de modèles texturés : on reste dans le langage visuel de la carte et sans dépendance de licence.
 */
export type ModelPreset = 'manoir' | 'chateau' | 'tour' | 'immeuble' | 'eglise' | 'entrepot' | 'rotonde';
export type ModelRole = 'wall' | 'roof' | 'accent';
export type ModelPart = { ring: Coordinate[]; base: number; height: number; role: ModelRole };
export type Model3d = { preset: ModelPreset; width: number; depth: number; height: number; rotation: number };

export const modelPresets: Array<{ id: ModelPreset; name: string; defaults: Omit<Model3d, 'preset' | 'rotation'> }> = [
  { id: 'manoir', name: 'Manoir / hôtel particulier', defaults: { width: 26, depth: 14, height: 16 } },
  { id: 'chateau', name: 'Château', defaults: { width: 60, depth: 20, height: 24 } },
  { id: 'tour', name: 'Tour', defaults: { width: 30, depth: 30, height: 120 } },
  { id: 'immeuble', name: 'Immeuble', defaults: { width: 30, depth: 14, height: 24 } },
  { id: 'eglise', name: 'Église / chapelle', defaults: { width: 18, depth: 45, height: 40 } },
  { id: 'entrepot', name: 'Entrepôt / hangar', defaults: { width: 50, depth: 30, height: 10 } },
  { id: 'rotonde', name: 'Rotonde / pavillon', defaults: { width: 20, depth: 20, height: 14 } },
];

const M_PER_DEG_LAT = 110_540;
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

/** Convertit des décalages en mètres (x vers l'est, y vers le nord) autour d'un centre, avec rotation en degrés. */
function toLngLat(center: Coordinate, rotation: number, points: Array<[number, number]>): Coordinate[] {
  const angle = (rotation * Math.PI) / 180;
  const ring = points.map(([x, y]): Coordinate => {
    const rx = x * Math.cos(angle) - y * Math.sin(angle);
    const ry = x * Math.sin(angle) + y * Math.cos(angle);
    return [center[0] + rx / mPerDegLng(center[1]), center[1] + ry / M_PER_DEG_LAT];
  });
  return [...ring, ring[0]];
}

const rect = (cx: number, cy: number, w: number, d: number): Array<[number, number]> => [
  [cx - w / 2, cy - d / 2],
  [cx + w / 2, cy - d / 2],
  [cx + w / 2, cy + d / 2],
  [cx - w / 2, cy + d / 2],
];
const circle = (r: number, sides = 20): Array<[number, number]> =>
  Array.from({ length: sides }, (_, i) => [r * Math.cos((2 * Math.PI * i) / sides), r * Math.sin((2 * Math.PI * i) / sides)]);

/** Réduit un anneau vers son centroïde (facteur 0..1). */
export function scaleRing(ring: Coordinate[], factor: number): Coordinate[] {
  const [cx, cy] = ringCentroid(ring);
  return ring.map(([x, y]): Coordinate => [cx + (x - cx) * factor, cy + (y - cy) * factor]);
}

/** Toiture en gradins : une suite de couches de plus en plus étroites qui suggère un toit à pans ou un dôme. */
export function steppedRoof(ring: Coordinate[], base: number, top: number, steps = 4, minScale = 0.3, role: ModelRole = 'roof'): ModelPart[] {
  return Array.from({ length: steps }, (_, i) => {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    return { ring: scaleRing(ring, 1 - (1 - minScale) * t0), base: base + (top - base) * t0, height: base + (top - base) * t1, role };
  });
}

/** Volume d'un bâtiment existant (emprise réelle) : murs puis toiture en gradins. */
export function buildingOnFootprint(ring: Coordinate[], wallHeight: number, roofTop: number, steps = 4): ModelPart[] {
  return [{ ring, base: 0, height: wallHeight, role: 'wall' }, ...steppedRoof(ring, wallHeight, roofTop, steps, 0.35)];
}

/** Génère les volumes d'un modèle posé sur un point. */
export function buildModel(center: Coordinate, model: Model3d): ModelPart[] {
  const { width: w, depth: d, height: h, rotation } = model;
  const shape = (points: Array<[number, number]>) => toLngLat(center, rotation, points);
  switch (model.preset) {
    case 'manoir':
      return buildingOnFootprint(shape(rect(0, 0, w, d)), h * 0.6, h);
    case 'chateau': {
      const pavilion = Math.min(w, d) * 0.7;
      const parts = buildingOnFootprint(shape(rect(0, 0, w * 0.7, d)), h * 0.5, h * 0.88);
      for (const side of [-1, 1]) parts.push(...buildingOnFootprint(shape(rect((side * (w - pavilion)) / 2, 0, pavilion, d * 1.15)), h * 0.58, h, 5));
      return parts;
    }
    case 'tour': {
      const body = shape(rect(0, 0, w, d));
      return [
        { ring: body, base: 0, height: h * 0.94, role: 'wall' },
        { ring: scaleRing(body, 0.82), base: h * 0.94, height: h, role: 'accent' },
      ];
    }
    case 'immeuble':
      return [
        { ring: shape(rect(0, 0, w, d)), base: 0, height: h, role: 'wall' },
        { ring: shape(rect(0, 0, w * 0.92, d * 0.8)), base: h, height: h + 2.5, role: 'roof' },
      ];
    case 'eglise': {
      const nave = buildingOnFootprint(shape(rect(0, -d * 0.1, w, d * 0.8)), h * 0.35, h * 0.55, 3);
      const towerRing = shape(rect(0, d * 0.38, w * 0.45, w * 0.45));
      return [...nave, { ring: towerRing, base: 0, height: h * 0.7, role: 'wall' }, ...steppedRoof(towerRing, h * 0.7, h, 5, 0.1, 'accent')];
    }
    case 'entrepot':
      return [{ ring: shape(rect(0, 0, w, d)), base: 0, height: h, role: 'wall' }, ...steppedRoof(shape(rect(0, 0, w, d)), h, h + 3, 2, 0.85)];
    case 'rotonde': {
      const ring = shape(circle(w / 2));
      return [{ ring, base: 0, height: h * 0.65, role: 'wall' }, ...steppedRoof(ring, h * 0.65, h, 5, 0.2)];
    }
  }
}
