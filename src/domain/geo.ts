export type PointGeometry = { type: 'Point'; coordinates: [number, number] };
export type LineStringGeometry = { type: 'LineString'; coordinates: Array<[number, number]> };
export type PolygonGeometry = { type: 'Polygon'; coordinates: Array<Array<[number, number]>> };
