# bratMap - Modele de donnees Firestore

Ce modele est une base de travail. Codex peut l'ajuster si une decision technique l'exige, sans supprimer de fonctionnalites du CDC.

## Collections principales

### `locations`

```ts
{
  id: string,
  name: string,
  typeId: string,
  address?: string,
  description?: string,
  importance?: number,
  knowledgeLevel?: string,
  tags: string[],
  territoryId?: string,
  characterIds: string[],
  plotIds: string[],
  notes?: string,
  source?: SourceRef,
  markerStyle: MarkerStyle,
  geometry: GeoJSON.Point,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  deletedAt?: Timestamp
}
```

### `havens`

```ts
{
  id: string,
  name: string,
  address?: string,
  description?: string,
  ownerCharacterIds: string[],
  residentCharacterIds: string[],
  territoryId?: string,
  securityLevel?: number,
  state?: string,
  tags: string[],
  plotIds: string[],
  notes?: string,
  markerStyle: MarkerStyle,
  geometry: GeoJSON.Point,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  deletedAt?: Timestamp
}
```

### `territories`

```ts
{
  id: string,
  name: string,
  description?: string,
  ownerCharacterIds: string[],
  factionId?: string,
  importance?: number,
  characterIds: string[],
  locationIds: string[],
  havenIds: string[],
  plotIds: string[],
  traditionRules: Array<{
    traditionId: string,
    active: boolean,
    note?: string
  }>,
  notes?: string,
  style: {
    fillColor: string,
    strokeColor: string,
    opacity: number,
    outlineOnly: boolean
  },
  geometry: GeoJSON.Polygon,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  deletedAt?: Timestamp
}
```

### `plots`

```ts
{
  id: string,
  name: string,
  description?: string,
  statusId: string,
  importance?: number,
  characterIds: string[],
  locationIds: string[],
  havenIds: string[],
  territoryIds: string[],
  undergroundAccessIds: string[],
  undergroundSegmentIds: string[],
  notes?: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  deletedAt?: Timestamp
}
```

### `characters`

```ts
{
  id: string,
  name: string,
  nickname?: string,
  imageUrl?: string,
  clanId?: string,
  factionId?: string,
  generation?: string,
  statusId?: string,
  description?: string,
  disciplines: Array<{ disciplineId: string, level: number }>,
  skills: Array<{ skillId: string, level: number }>,
  specialAbilities: Array<{ abilityId: string, level?: number }>,
  influences: Array<{
    id: string,
    name: string,
    domainId: string,
    level: number,
    locationId?: string
  }>,
  mainHavenId?: string,
  locationIds: string[],
  territoryIds: string[],
  plotIds: string[],
  relations: Array<{
    characterId: string,
    type: string,
    note?: string
  }>,
  notes?: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  deletedAt?: Timestamp
}
```

### `undergroundAccess`

```ts
{
  id: string,
  name: string,
  type: string,
  level: 0 | -1 | -2 | -3,
  approximateDepthM?: number,
  state?: string,
  knowledgeLevel?: string,
  origin: 'public' | 'chronicle' | 'discovered',
  source?: SourceRef,
  segmentIds: string[],
  locationId?: string,
  territoryId?: string,
  plotIds: string[],
  notes?: string,
  geometry: GeoJSON.Point,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  deletedAt?: Timestamp
}
```

### `undergroundSegments`

```ts
{
  id: string,
  name?: string,
  type: string,
  level: 0 | -1 | -2 | -3,
  approximateDepthM?: number,
  state?: string,
  knowledgeLevel?: string,
  origin: 'public' | 'chronicle' | 'discovered',
  source?: SourceRef,
  startNodeId: string,
  endNodeId: string,
  connectedSegmentIds: string[],
  plotIds: string[],
  notes?: string,
  geometry: GeoJSON.LineString,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  deletedAt?: Timestamp
}
```

## Note d'implementation (graphe souterrain)

`startNodeId` / `endNodeId` portent le graphe : ID d'acces si l'extremite est un acces, sinon ID de jonction (`j-...`) partage entre segments. `connectedSegmentIds` (segments) et `segmentIds` (acces) se deduisent de ces noeuds et ne sont pas maintenus. Champ ajoute : `toLevel` (connexion verticale).

## Referentiels

Collections configurables :
- `markerTypes`
- `disciplines`
- `skills`
- `specialAbilities`
- `influenceDomains`
- `traditions`
- `factions`
- `clans`
- `characterStatuses`
- `plotStatuses`

Chaque document de referentiel :

```ts
{
  id: string,
  name: string,
  order?: number,
  color?: string,
  icon?: string,
  active: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## Types partages

```ts
type SourceRef = {
  type: 'IDFM' | 'OSM' | 'PARIS_OPEN_DATA' | 'MANUAL' | 'CHRONICLE' | string,
  label?: string,
  url?: string,
  externalId?: string,
  reliability?: 'low' | 'medium' | 'high'
}

type MarkerStyle = {
  icon?: string,
  color: string,
  size: number
}
```

## Configuration globale

Collection `appConfig` ou document unique :
- fade intensity ;
- default marker size ;
- territory opacity ;
- labels density ;
- underground style ;
- map center ;
- default zoom ;
- feature flags si necessaire.

## Corbeille

Preferer un soft-delete (`deletedAt`) avant suppression definitive.
