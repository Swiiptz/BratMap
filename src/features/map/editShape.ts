import { insertVertex, moveVertex, removeVertex, type Coordinate } from '../../domain/geometry';

/** Forme en cours d'édition : anneau fermé (territoire) ou ligne ouverte (segment souterrain). */
export type EditShape = { kind: 'ring' | 'line'; coordinates: Coordinate[] };

export function moveShapeVertex(shape: EditShape, index: number, coordinate: Coordinate): EditShape {
  if (shape.kind === 'ring') return { ...shape, coordinates: moveVertex(shape.coordinates, index, coordinate) };
  return { ...shape, coordinates: shape.coordinates.map((point, current) => (current === index ? coordinate : point)) };
}

export function insertShapeVertex(shape: EditShape, afterIndex: number, coordinate: Coordinate): EditShape {
  return { ...shape, coordinates: insertVertex(shape.coordinates, afterIndex, coordinate) };
}

/** Une ligne garde au moins deux points et ses extrémités (nœuds du graphe) ; un anneau reste un triangle au minimum. */
export function removeShapeVertex(shape: EditShape, index: number): EditShape {
  if (shape.kind === 'ring') return { ...shape, coordinates: removeVertex(shape.coordinates, index) };
  if (index <= 0 || index >= shape.coordinates.length - 1) return shape;
  return { ...shape, coordinates: shape.coordinates.filter((_, current) => current !== index) };
}
