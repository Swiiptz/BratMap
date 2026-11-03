import type { LineStringGeometry, PointGeometry, PolygonGeometry } from './geo';
import type { Model3d } from './models3d';

/** Firestore Timestamp, epoch millis (local store) ou null selon l'origine du document. */
export type StoredDate = unknown;

/** `reference` : donnée publique importée, servie en lecture seule tant qu'elle n'a pas été modifiée dans la chronique. */
export type EntityMeta = { id: string; createdAt?: StoredDate; updatedAt?: StoredDate; deletedAt?: StoredDate | null; version?: number; reference?: boolean };
export type MarkerStyle = { icon?: string; color: string; size: number };
export type SourceRef = {
  type: 'IDFM' | 'OSM' | 'PARIS_OPEN_DATA' | 'MANUAL' | 'CHRONICLE' | string;
  label?: string;
  url?: string;
  externalId?: string;
  reliability?: 'low' | 'medium' | 'high';
};
export type UndergroundLevel = 0 | -1 | -2 | -3;
export type UndergroundOrigin = 'public' | 'chronicle' | 'discovered';
export type Passability = 'upright' | 'stooped' | 'crawl' | 'impassable' | 'unknown';
export type Exposure = 'discreet' | 'neutral' | 'exposed';

export type Location = EntityMeta & {
  name: string;
  typeId: string;
  address?: string;
  description?: string;
  importance?: number;
  knowledgeLevel?: string;
  tags: string[];
  territoryId?: string;
  characterIds: string[];
  plotIds: string[];
  notes?: string;
  source?: SourceRef;
  markerStyle: MarkerStyle;
  geometry: PointGeometry;
} & Building3d;

/** Volume 3D facultatif d'un lieu : bâtiment réel existant (repère OSM) ou maquette posée depuis le catalogue. */
export type Building3d = { landmarkKey?: string; model3d?: Model3d };

export type Haven = EntityMeta & {
  name: string;
  address?: string;
  description?: string;
  ownerCharacterIds: string[];
  /** Propriétaire collectif (CDC §6 : un personnage, plusieurs, une coterie ou inconnu). */
  ownerCoterieId?: string;
  residentCharacterIds: string[];
  territoryId?: string;
  securityLevel?: number;
  state?: string;
  tags: string[];
  plotIds: string[];
  notes?: string;
  markerStyle: MarkerStyle;
  geometry: PointGeometry;
} & Building3d;

export type TraditionRule = { traditionId: string; active: boolean; note?: string };
export type TerritoryStyle = { fillColor: string; strokeColor: string; opacity: number; outlineOnly: boolean };

export type Territory = EntityMeta & {
  name: string;
  description?: string;
  ownerCharacterIds: string[];
  factionId?: string;
  importance?: number;
  characterIds: string[];
  locationIds: string[];
  havenIds: string[];
  plotIds: string[];
  traditionRules: TraditionRule[];
  notes?: string;
  hidden?: boolean;
  /** Attitude envers les personnages joueurs : utilisée par le mode d'itinéraire discret. */
  stance?: 'friendly' | 'neutral' | 'hostile';
  /** Ordre d'empilement : plus haut = au premier plan (voir domain/layering.ts). */
  order?: number;
  style: TerritoryStyle;
  geometry: PolygonGeometry;
};

export type Plot = EntityMeta & {
  name: string;
  description?: string;
  statusId: string;
  importance?: number;
  characterIds: string[];
  locationIds: string[];
  havenIds: string[];
  territoryIds: string[];
  undergroundAccessIds: string[];
  undergroundSegmentIds: string[];
  notes?: string;
  /** Représentation cartographique facultative (CDC §8) : ping et/ou zone du plot. */
  pingGeometry?: PointGeometry;
  zoneGeometry?: PolygonGeometry;
  /** Ordre d'empilement de la zone parmi les zones de plots. */
  order?: number;
};

export type LeveledRef = { refId: string; level?: number };
export type Influence = { id: string; name: string; domainId: string; level: number; locationId?: string };
export type CharacterRelation = { characterId: string; type: string; note?: string };

export type Character = EntityMeta & {
  name: string;
  nickname?: string;
  imageUrl?: string;
  clanId?: string;
  factionId?: string;
  coterieId?: string;
  generation?: string;
  statusId?: string;
  importance?: number;
  description?: string;
  disciplines: Array<{ disciplineId: string; level: number }>;
  skills: Array<{ skillId: string; level: number }>;
  specialAbilities: Array<{ abilityId: string; level?: number }>;
  influences: Influence[];
  mainHavenId?: string;
  locationIds: string[];
  territoryIds: string[];
  plotIds: string[];
  relations: CharacterRelation[];
  notes?: string;
};

/** Ligne de transport en commun (Île-de-France Mobilités) : nom usuel, couleur officielle. */
export type TransitLine = { name: string; mode: 'metro' | 'rer' | 'train' | 'tram' | 'val'; color?: string };

export type UndergroundAccess = EntityMeta & {
  name: string;
  type: string;
  level: UndergroundLevel;
  approximateDepthM?: number;
  state?: string;
  knowledgeLevel?: string;
  origin: UndergroundOrigin;
  source?: SourceRef;
  /** Dérivé du graphe (voir `domain/underground.ts`) : conservé pour compatibilité, non maintenu. */
  segmentIds: string[];
  /** Accès secondaire (bouche, parking) : affiché seulement à fort zoom. */
  minor?: boolean;
  /** Lignes desservies (stations et bouches, données IDFM). */
  transitLines?: TransitLine[];
  locationId?: string;
  territoryId?: string;
  plotIds: string[];
  notes?: string;
  geometry: PointGeometry;
};

export type UndergroundSegment = EntityMeta & {
  name?: string;
  type: string;
  level: UndergroundLevel;
  approximateDepthM?: number;
  state?: string;
  knowledgeLevel?: string;
  origin: UndergroundOrigin;
  source?: SourceRef;
  /** Nœuds du graphe : ID d'accès souterrain si l'extrémité est un accès, sinon ID de jonction (`j-…`). */
  startNodeId: string;
  endNodeId: string;
  /** Connexion verticale : niveau atteint à l'extrémité d'arrivée (escalier, puits…). */
  toLevel?: UndergroundLevel;
  /** Peut-on y circuler, et comment ? Absent : valeur par défaut selon le type (voir domain/underground.ts). */
  passability?: Passability;
  /** Justification de la praticabilité : « Sourcé : … » ou « Estimé : … » (données importées). */
  passabilityNote?: string;
  /** Risque d'être vu en l'empruntant (personnel, rames, caméras narratives…). Absent : défaut selon le type. */
  exposure?: Exposure;
  /** Lignes qui circulent dans ce tunnel (données IDFM). */
  transitLines?: TransitLine[];
  /** Dérivé du graphe (voir `domain/underground.ts`) : conservé pour compatibilité, non maintenu. */
  connectedSegmentIds: string[];
  plotIds: string[];
  notes?: string;
  geometry: LineStringGeometry;
};

export type Referential = EntityMeta & { name: string; order?: number; color?: string; icon?: string; active: boolean };

export const referentialCollections = {
  markerTypes: 'Types de pings',
  clans: 'Clans',
  factions: 'Factions',
  traditions: 'Traditions',
  disciplines: 'Disciplines',
  skills: 'Compétences',
  specialAbilities: 'Capacités',
  influenceDomains: "Domaines d'influence",
  characterStatuses: 'Statuts personnages',
  plotStatuses: 'Statuts plots',
  coteries: 'Coteries',
} as const;
export type ReferentialCollection = keyof typeof referentialCollections;

export const entityCollections = {
  locations: 'Lieux',
  havens: 'Havres',
  territories: 'Territoires',
  plots: 'Plots',
  characters: 'Personnages',
  undergroundAccess: 'Accès souterrains',
  undergroundSegments: 'Segments souterrains',
} as const;
export type EntityCollection = keyof typeof entityCollections;
/** Collections techniques : configuration partagée et verrous d'édition. */
export type SystemCollection = 'appConfig' | 'editLocks' | 'itineraries';
export type CollectionName = EntityCollection | ReferentialCollection | SystemCollection;

export type EntityByCollection = {
  locations: Location;
  havens: Haven;
  territories: Territory;
  plots: Plot;
  characters: Character;
  undergroundAccess: UndergroundAccess;
  undergroundSegments: UndergroundSegment;
};

export const knowledgeLevels = [
  { id: 'unknown', name: 'Inconnu' },
  { id: 'rumor', name: 'Rumeur' },
  { id: 'spotted', name: 'Repéré' },
  { id: 'known', name: 'Connu' },
  { id: 'documented', name: 'Bien documenté' },
] as const;

export const relationTypes = [
  { id: 'ally', name: 'Allié' },
  { id: 'enemy', name: 'Ennemi' },
  { id: 'superior', name: 'Supérieur' },
  { id: 'subordinate', name: 'Subordonné' },
  { id: 'debt', name: 'Dette' },
  { id: 'coterie', name: 'Même coterie' },
  { id: 'custom', name: 'Personnalisé' },
] as const;
