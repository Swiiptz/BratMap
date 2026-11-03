"""
Génère public/data/public-underground.json : infrastructures souterraines publiques (OSM, ODbL) de la zone.

Entrée : extraction Overpass (`out body geom`) contenant tunnels ferrés/routiers/piétons, gares, bouches de métro
et parkings souterrains. Usage : python3 -I scripts/build-public-underground.py extraction.json src/assets/main-zone.json > public/data/public-underground.json

Seuls les éléments situés dans la zone jouable (92, Saint-Denis, Saint-Ouen ; Paris exclu) sont conservés.

Règles (PUBLIC_DATA_SOURCES.md) : source et identifiant externe conservés, `layer` OSM normalisé vers 0/-1/-2/-3
sans conversion directe, aucun accès technique non public (égouts, carrières, accès privés exclus par la requête).
"""
import json, math, sys
from collections import defaultdict

SOURCE = "© OpenStreetMap contributors (ODbL)"
ROAD = {"motorway", "trunk", "primary", "secondary", "tertiary", "motorway_link", "trunk_link", "primary_link", "secondary_link", "unclassified", "residential", "service"}
WALK = {"footway", "corridor", "pedestrian", "steps"}

elements = json.load(open(sys.argv[1]))["elements"]
zone_ring = next(f for f in json.load(open(sys.argv[2]))["features"] if f["properties"]["kind"] == "zone")["geometry"]["coordinates"][0]

def in_zone(point):
    inside, j = False, len(zone_ring) - 1
    for i in range(len(zone_ring)):
        (xi, yi), (xj, yj) = zone_ring[i], zone_ring[j]
        if (yi > point[1]) != (yj > point[1]) and point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi: inside = not inside
        j = i
    return inside
nodes = {e["id"]: e for e in elements if e["type"] == "node"}
ways = [e for e in elements if e["type"] == "way"]

def layer_of(tags):
    """`layer` OSM le plus profond (les valeurs multiples « -1;-2 » marquent une rampe) ; None si absent."""
    values = []
    for part in str(tags.get("layer", "")).split(";"):
        try: values.append(int(part))
        except ValueError: pass
    return min(values) if values else None

DEEP_LINES = ("grand paris express", "ligne 15", "ligne 16", "ligne 17", "ligne 18", "métro 15", "métro 16", "métro 17", "métro 18", "rer e")

def depth_level(mode, layer, name):
    """
    Normalisation par type d'infrastructure (jamais layer → niveau en direct, cf. PUBLIC_DATA_SOURCES.md) :
    -1 peu profond, -2 intermédiaire, -3 profond.
    """
    name = (name or "").lower()
    if any(line in name for line in DEEP_LINES): return -3 if layer is None or layer <= -3 else -2
    if layer is None: layer = -1
    if mode == "subway":
        level = -1 if layer >= -2 else -2 if layer >= -4 else -3
        return min(level, -2) if "14" in name else level  # ligne 14 : tunnel profond, jamais sous la chaussée
    if mode in ("rail", "disused"): return -1 if layer >= -1 else -2 if layer >= -3 else -3
    if mode == "road": return -1 if layer >= -1 else -2 if layer >= -3 else -3
    return -1 if layer >= -1 else -2

def coord(lon, lat): return [round(lon, 6), round(lat, 6)]

def metres(a, b):
    dx = (a[0] - b[0]) * 111320 * math.cos(math.radians(b[1])); dy = (a[1] - b[1]) * 110540
    return math.hypot(dx, dy)

def classify(way):
    t = way.get("tags", {}); rw, hw = t.get("railway"), t.get("highway"); layer = layer_of(t); name = t.get("name")
    if t.get("amenity") == "parking": return None
    if rw == "subway": return {"type": "rail", "level": depth_level("subway", layer, name), "mode": "subway"}
    if rw in ("rail", "light_rail"): return {"type": "rail", "level": depth_level("rail", layer, name), "mode": "rail"}
    if rw in ("disused", "abandoned"): return {"type": "rail", "level": depth_level("disused", layer, name), "mode": "disused", "state": "Désaffecté"}
    if hw in ROAD: return {"type": "tunnel", "level": depth_level("road", layer, name), "mode": "road"}
    if hw in WALK: return {"type": "corridor", "level": depth_level("walk", layer, name), "mode": "walk", "layerKnown": layer is not None}
    return None

tracks = [(w, classify(w)) for w in ways]
tracks = [(w, c) for w, c in tracks if c and len(w.get("nodes", [])) >= 2 and any(in_zone([p["lon"], p["lat"]]) for p in w["geometry"])]
track_vertices = defaultdict(list)  # mode -> [(coord, node id, way)]
for way, cls in tracks:
    for node_id, point in zip(way["nodes"], way["geometry"]):
        track_vertices[cls["mode"]].append((coord(point["lon"], point["lat"]), node_id, way))

# --- Accès : gares souterraines, bouches de métro, parkings -------------------------------------------------
accesses, access_by_node = {}, {}
def add_access(access_id, osm_node, **values):
    if not in_zone(values["geometry"]["coordinates"]): return
    accesses[access_id] = {"id": access_id, "origin": "public", "knowledgeLevel": "confirmed", **values}
    if osm_node: access_by_node[osm_node] = access_id

def nearest(point, mode, radius):
    best = None
    for vertex, node_id, way in track_vertices.get(mode, []):
        d = metres(vertex, point)
        if d <= radius and (not best or d < best[0]): best = (d, vertex, node_id, way)
    return best

stations = {}
for node in nodes.values():
    t = node.get("tags", {})
    if t.get("railway") not in ("station", "halt"): continue
    point = coord(node["lon"], node["lat"])
    if t.get("station") == "subway" or t.get("subway") == "yes": mode = "subway"
    elif nearest(point, "rail", 90): mode = "rail"
    else: continue  # gare de surface : hors périmètre souterrain
    # Niveau de la station : la ligne souterraine la plus proche de la surface qu'elle dessert.
    served = [classify(way)["level"] for m in ("subway", "rail") for vertex, _, way in track_vertices.get(m, []) if metres(vertex, point) <= 160]
    level = max(served) if served else (-1 if mode == "subway" else -2)
    name = t.get("name") or "Station"
    if not in_zone(point): continue
    add_access(f"osm-n{node['id']}", node["id"], name=name, type="station", level=level, source={"type": "OSM", "label": SOURCE, "externalId": f"node/{node['id']}"}, geometry={"type": "Point", "coordinates": point})
    stations[node["id"]] = (point, level, mode, name)

def nearest_station(point, radius):
    best = None
    for node_id, (spoint, level, mode, name) in stations.items():
        d = metres(point, spoint)
        if d <= radius and (not best or d < best[0]): best = (d, node_id, level, name)
    return best

for node in nodes.values():
    t = node.get("tags", {})
    if t.get("railway") != "subway_entrance": continue
    point = coord(node["lon"], node["lat"]); station = nearest_station(point, 300)
    label = t.get("name") or (f"Accès {t['ref']}" if t.get("ref") else "Bouche de métro")
    name = f"{label} · {station[3]}" if station and station[3] not in label else label
    add_access(f"osm-n{node['id']}", node["id"], name=name, type="metro-entrance", level=station[2] if station else -1, minor=True, source={"type": "OSM", "label": SOURCE, "externalId": f"node/{node['id']}"}, geometry={"type": "Point", "coordinates": point})

for element in elements:
    t = element.get("tags", {})
    if t.get("amenity") != "parking" or t.get("parking") != "underground": continue
    if element["type"] == "node": point = coord(element["lon"], element["lat"])
    else:
        geometry = element.get("geometry") or []
        if not geometry: continue
        point = coord(sum(p["lon"] for p in geometry) / len(geometry), sum(p["lat"] for p in geometry) / len(geometry))
    access_id = f"osm-{element['type'][0]}{element['id']}"
    add_access(access_id, element["id"] if element["type"] == "node" else None, name=t.get("name") or "Parking souterrain", type="parking", level=-1, minor=True, source={"type": "OSM", "label": SOURCE, "externalId": f"{element['type']}/{element['id']}"}, geometry={"type": "Point", "coordinates": point})

# --- Liaisons station → voies : un raccord par ligne proche (correspondances) ------------------------------
split_nodes, links = set(), []
for node_id, (point, level, mode, name) in stations.items():
    candidates = {}
    for vertex, vertex_node, way in track_vertices.get(mode, []):
        d = metres(vertex, point)
        if d > 160: continue
        line = way.get("tags", {}).get("name") or way.get("tags", {}).get("ref") or way["id"]
        if line not in candidates or d < candidates[line][0]: candidates[line] = (d, vertex, vertex_node)
    for m in ("subway", "rail"):
        if m == mode: continue
        for vertex, vertex_node, way in track_vertices.get(m, []):
            d = metres(vertex, point)
            if d > 160: continue
            line = way.get("tags", {}).get("name") or way.get("tags", {}).get("ref") or way["id"]
            if line not in candidates or d < candidates[line][0]: candidates[line] = (d, vertex, vertex_node)
    for _, vertex, vertex_node in sorted(candidates.values())[:6]:
        if vertex_node in access_by_node: continue
        split_nodes.add(vertex_node)
        line_level = next(classify(way)["level"] for m in ("subway", "rail") for v, n, way in track_vertices.get(m, []) if n == vertex_node)
        links.append((f"osm-n{node_id}", vertex_node, point, vertex, level, line_level))

# --- Découpage des voies aux jonctions --------------------------------------------------------------------
usage = defaultdict(int)
for way, _ in tracks:
    for node_id in set(way["nodes"]): usage[node_id] += 1
node_key = lambda node_id: access_by_node.get(node_id) or f"j-osm-{node_id}"

def simplify(points, tolerance=0.00002):
    if len(points) < 3: return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1; norm = math.hypot(dx, dy) or 1e-12
    index, dmax = 0, 0
    for i in range(1, len(points) - 1):
        d = abs(dy * points[i][0] - dx * points[i][1] + x2 * y1 - y2 * x1) / norm
        if d > dmax: index, dmax = i, d
    if dmax <= tolerance: return [points[0], points[-1]]
    return simplify(points[: index + 1], tolerance)[:-1] + simplify(points[index:], tolerance)

segments = []
for way, cls in tracks:
    tags = way.get("tags", {})
    ids, geometry = way["nodes"], [coord(p["lon"], p["lat"]) for p in way["geometry"]]
    cuts = [0] + [i for i in range(1, len(ids) - 1) if usage[ids[i]] > 1 or ids[i] in access_by_node or ids[i] in split_nodes] + [len(ids) - 1]
    level = cls["level"]
    if cls["mode"] == "walk" and not cls.get("layerKnown"):
        station = nearest_station(geometry[0], 200)
        if station: level = station[2]
    for k, (a, b) in enumerate(zip(cuts, cuts[1:])):
        points = simplify(geometry[a : b + 1])
        if len(points) < 2 or points[0] == points[-1] and len(points) == 2 or not any(in_zone(p) for p in points): continue
        segment = {"id": f"osm-w{way['id']}-{k}", "type": cls["type"], "level": level, "origin": "public", "knowledgeLevel": "confirmed", "startNodeId": node_key(ids[a]), "endNodeId": node_key(ids[b]), "source": {"type": "OSM", "label": SOURCE, "externalId": f"way/{way['id']}"}, "geometry": {"type": "LineString", "coordinates": points}}
        name = tags.get("name") or tags.get("tunnel:name")
        if name: segment["name"] = name
        if cls.get("state"): segment["state"] = cls["state"]
        segments.append(segment)

seen_links = set()
for station_id, vertex_node, point, vertex, level, line_level in links:
    if (station_id, vertex_node) in seen_links: continue  # un même quai peut être trouvé par la recherche métro et RER
    seen_links.add((station_id, vertex_node))
    link = {"id": f"osm-link-{station_id}-{vertex_node}", "name": "Liaison quais", "type": "corridor", "level": level, "origin": "public", "knowledgeLevel": "supposed", "startNodeId": station_id, "endNodeId": node_key(vertex_node), "notes": "Raccord déduit automatiquement entre la station et la voie la plus proche.", "geometry": {"type": "LineString", "coordinates": [point, vertex]}}
    if line_level != level: link.update({"name": "Correspondance", "type": "vertical", "toLevel": line_level})
    segments.append(link)

# Bouches → station : connexion verticale déduite (surface → niveau de la station).
for access in list(accesses.values()):
    if access["type"] != "metro-entrance": continue
    station = nearest_station(access["geometry"]["coordinates"], 300)
    if not station: continue
    station_id = f"osm-n{station[1]}"
    segments.append({"id": f"osm-link-{access['id']}", "name": "Descente", "type": "vertical", "level": 0, "toLevel": station[2], "origin": "public", "knowledgeLevel": "supposed", "startNodeId": access["id"], "endNodeId": station_id, "notes": "Liaison déduite entre la bouche et la station la plus proche.", "geometry": {"type": "LineString", "coordinates": [access["geometry"]["coordinates"], accesses[station_id]["geometry"]["coordinates"]]}})

def compact(item):
    """Format compact : origine « public », connaissance « confirmé » et libellé de source sont restitués au chargement."""
    item = dict(item)
    item.pop("origin", None)
    if item.get("knowledgeLevel") == "confirmed": item.pop("knowledgeLevel")
    source = item.pop("source", None)
    if source: item["osm"] = source["externalId"]
    return item

json.dump({"generatedFrom": "OpenStreetMap via Overpass", "attribution": SOURCE, "accesses": [compact(a) for a in accesses.values()], "segments": [compact(s) for s in segments]}, sys.stdout, separators=(",", ":"), ensure_ascii=False)
from collections import Counter
print("accès", len(accesses), Counter(a["type"] for a in accesses.values()), "segments", len(segments), Counter(s["type"] for s in segments), file=sys.stderr)
