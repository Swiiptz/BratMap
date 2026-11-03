"""
Complète public/data/public-underground.json avec les souterrains « non ferroviaires » (dont les égouts, en segments cliquables).

Usage (après build-public-underground.py) :
  python3 -I scripts/build-extra-underground.py <osm_insolite.json> <collecteurs_cd92.geojson> <bassins_cd92.geojson> src/assets/main-zone.json [communes_92.geojson]

Sources :
- OpenStreetMap (ODbL) : rivières et aqueducs enterrés nommés, sites de carrières et abris nommés.
- Département des Hauts-de-Seine, Licence Ouverte : collecteurs d'assainissement, bassins de rétention.

Règle PUBLIC_DATA_SOURCES.md n°6 : carrières et abris sont des *sites* marqués « accès non public » (usage narratif) ;
les entrées techniques sans nom (galeries, puits d'ouvrage) et les regards d'égout ne sont pas repris.
"""
import json, math, sys
from collections import defaultdict

osm_path, sewers_path, basins_path, zone_path = sys.argv[1:5]
OUT_DATA = "public/data/public-underground.json"
communes = {}
if len(sys.argv) > 5:
    for f in json.load(open(sys.argv[5]))["features"]: communes[f["properties"]["code"]] = f["properties"]["nom"]
zone = next(f for f in json.load(open(zone_path))["features"] if f["properties"]["kind"] == "zone")["geometry"]["coordinates"][0]

def in_zone(p):
    inside, j = False, len(zone) - 1
    for i in range(len(zone)):
        (xi, yi), (xj, yj) = zone[i], zone[j]
        if (yi > p[1]) != (yj > p[1]) and p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi: inside = not inside
        j = i
    return inside

def simplify(points, tol):
    if len(points) < 3: return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1; norm = math.hypot(dx, dy) or 1e-12
    idx, dmax = 0, 0
    for i in range(1, len(points) - 1):
        d = abs(dy * points[i][0] - dx * points[i][1] + x2 * y1 - y2 * x1) / norm
        if d > dmax: idx, dmax = i, d
    if dmax <= tol: return [points[0], points[-1]]
    return simplify(points[: idx + 1], tol)[:-1] + simplify(points[idx:], tol)

def merge_lines(lines, digits=6):
    """Fusionne les tronçons qui se prolongent (extrémité commune, au plus 2 tronçons par nœud)."""
    key = lambda p: (round(p[0], digits), round(p[1], digits))
    ends = defaultdict(list)
    for i, line in enumerate(lines): ends[key(line[0])].append(i); ends[key(line[-1])].append(i)
    used, merged = set(), []
    for i in range(len(lines)):
        if i in used: continue
        used.add(i); chain = list(lines[i])
        for forward in (True, False):
            while True:
                tip = key(chain[-1] if forward else chain[0])
                nxt = [j for j in ends[tip] if j not in used]
                if len(ends[tip]) != 2 or not nxt: break
                j = nxt[0]; used.add(j); seg = lines[j]
                if key(seg[0]) != tip: seg = seg[::-1]
                chain = chain + seg[1:] if forward else seg[::-1][:-1] + chain if False else (chain + seg[1:] if forward else list(reversed(seg))[:-1] + chain)
        merged.append(chain)
    return merged

r6 = lambda p: [round(p[0], 6), round(p[1], 6)]
node_id = lambda p: f"j-geo-{round(p[0], 5)}_{round(p[1], 5)}"
data = json.load(open(OUT_DATA))
data["accesses"] = [a for a in data["accesses"] if not a["id"].startswith("x-")]
data["segments"] = [s for s in data["segments"] if not s["id"].startswith("x-")]

# --- Rivières et aqueducs enterrés (OSM) ------------------------------------------------------------------
osm = json.load(open(osm_path))["elements"]
by_name = defaultdict(list)
for e in osm:
    t = e.get("tags", {})
    if e["type"] != "way" or "waterway" not in t or not t.get("name"): continue
    if t["waterway"] not in ("river", "stream", "canal", "pressurised"): continue
    line = [r6([p["lon"], p["lat"]]) for p in e["geometry"]]
    if any(in_zone(p) for p in line): by_name[(t["name"], t["waterway"])].append(line)
MAJOR_RIVERS = ("la bièvre", "le croult", "ru de la vieille mer")

def water_passability(name, kind):
    """Praticabilité des ouvrages d'eau : sourcée quand un gabarit est publié, sinon estimée et signalée comme telle."""
    lower = name.lower()
    if kind == "pressurised" and "aqueduc" in lower: return "impassable", "Siphon : tronçon d'aqueduc en charge, entièrement noyé (OSM waterway=pressurised)."
    if kind == "pressurised" or "conduite forcée" in lower: return "impassable", "Conduite en charge, entièrement noyée."
    if "avre" in lower: return "upright", "Sourcé : galerie de 1,8 m de diamètre (Structurae, aqueduc de l'Avre)."
    if "aqueduc" in lower: return "stooped", "Estimé : grande galerie maçonnée d'aqueduc, gabarit non publié."
    if any(river in lower for river in MAJOR_RIVERS): return "stooped", "Estimé : rivière majeure canalisée en collecteur, gabarit non publié."
    return "crawl", "Estimé : petit ru ou rigole busé, gabarit non publié."

rivers = 0
for (name, kind), lines in by_name.items():
    for k, line in enumerate(merge_lines(lines)):
        line = simplify(line, 0.00002)
        aqueduct = kind == "pressurised" or "aqueduc" in name.lower()
        passability, note = water_passability(name, kind)
        data["segments"].append({"id": f"x-water-{len(data['segments'])}", "name": name, "type": "aqueduct" if aqueduct else "river", "level": -1, "passability": passability, "passabilityNote": note, "startNodeId": node_id(line[0]), "endNodeId": node_id(line[-1]), "osm": "waterway", "notes": "Cours d'eau canalisé sous la ville (tracé OSM).", "geometry": {"type": "LineString", "coordinates": line}})
        rivers += 1

# --- Sites de carrières et abris (OSM, nommés uniquement) ---------------------------------------------------
sites = 0
for e in osm:
    t = e.get("tags", {}); name = t.get("name")
    if e["type"] != "node" or not name: continue
    point = r6([e["lon"], e["lat"]])
    if not in_zone(point): continue
    text = " ".join(t.values()).lower()
    if t.get("military") == "bunker" or t.get("building") == "bunker": kind, note = "bunker", "Abri souterrain signalé dans OSM."
    elif any(w in text for w in ("carri", "plâtri", "platri", "mine")) or t.get("natural") == "cave_entrance": kind, note = "quarry", "Ancienne carrière signalée dans OSM. Site fermé et dangereux : usage narratif uniquement."
    else: continue
    data["accesses"].append({"id": f"x-osm-n{e['id']}", "name": name, "type": kind, "level": -2, "state": "Accès non public", "knowledgeLevel": "spotted", "notes": note, "osm": f"node/{e['id']}", "geometry": {"type": "Point", "coordinates": point}})
    sites += 1

# --- Ouvrages d'assainissement du Département (Licence Ouverte) --------------------------------------------
basins = 0
for f in json.load(open(basins_path))["features"]:
    p = f["properties"]; point = r6(f["geometry"]["coordinates"])
    if "ETANG" in p["nomexplo"].upper() or not in_zone(point): continue  # plans d'eau à ciel ouvert exclus
    data["accesses"].append({"id": f"x-cd92-{p['numero']}", "cd92set": "bassins", "name": p["nomexplo"].title().replace("D'", "d'").replace("Du ", "du ").replace("De ", "de ").replace("Des ", "des "), "type": "chamber", "level": -2, "knowledgeLevel": "confirmed", "notes": "Ouvrage du réseau départemental d'assainissement (bassin, stockage ou tunnel).", "cd92": p["numero"], "geometry": {"type": "Point", "coordinates": point}})
    basins += 1

# --- Égouts du Département : segments souterrains (cliquables, rattachables à un plot) -----------------------
# Topologie : nœuds partagés par position (~1 m) toutes communes et tous réseaux confondus, et collecteur coupé là où une
# branche le rejoint en cours de tracé (jonction en T). Sans cela, le réseau se fragmente en centaines de morceaux isolés.
NETWORK_NAMES = {"UN": "Collecteur unitaire", "EU": "Collecteur d'eaux usées", "EP": "Collecteur d'eaux pluviales"}

def metres_len(line):
    return sum(math.hypot((a[0] - b[0]) * 111320 * math.cos(math.radians(a[1])), (a[1] - b[1]) * 110540) for a, b in zip(line, line[1:]))

cell = lambda p: (round(p[0], 5), round(p[1], 5))  # même arrondi que node_id()
raw = []
for f in json.load(open(sewers_path))["features"]:
    coords = [r6(p) for p in f["geometry"]["coordinates"]]
    props = f["properties"]
    if len(coords) >= 2 and any(in_zone(p) for p in coords): raw.append((props.get("reseau") or "UN", props.get("codinsee") or "", coords))

end_cells = defaultdict(int)
for _, _, coords in raw:
    end_cells[cell(coords[0])] += 1
    end_cells[cell(coords[-1])] += 1
split = []
for network, insee, coords in raw:
    current = [coords[0]]
    for point in coords[1:-1]:
        current.append(point)
        if end_cells.get(cell(point)):  # une autre canalisation aboutit sur ce sommet : jonction en T
            split.append((network, insee, current))
            current = [point]
    current.append(coords[-1])
    split.append((network, insee, current))

# Fusion des tronçons qui se prolongent sans bifurcation (même réseau), y compris d'une commune à l'autre.
incidence = defaultdict(list)
for index, (_, _, coords) in enumerate(split):
    incidence[cell(coords[0])].append(index)
    incidence[cell(coords[-1])].append(index)
used, pieces = set(), []
for index in range(len(split)):
    if index in used: continue
    used.add(index)
    network, insee, chain = split[index][0], split[index][1], list(split[index][2])
    for forward in (True, False):
        while True:
            tip = cell(chain[-1] if forward else chain[0])
            nxt = [j for j in incidence[tip] if j not in used]
            if len(incidence[tip]) != 2 or not nxt or split[nxt[0]][0] != network: break
            j = nxt[0]
            used.add(j)
            seg = split[j][2]
            if cell(seg[0]) != tip: seg = seg[::-1]
            chain = chain + seg[1:] if forward else seg[::-1][:-1] + chain
    line = [[round(x, 6), round(y, 6)] for x, y in simplify(chain, 0.00003)]
    if len(line) >= 2 and line[0] != line[-1]: pieces.append((network, insee, line, metres_len(line)))

# Praticabilité estimée des égouts, par réseau : le réseau unitaire (grandes galeries historiques) représente ~69 % du
# linéaire, cohérent avec ~66 % de linéaire visitable publié (≥ 1,60 m ; 350 km sur 530 km, NOVATECH 2007).
# Une règle par réseau garde la continuité du réseau praticable (pas de rupture à chaque jonction).
NETWORK_PASSABILITY = {"UN": "upright", "EU": "stooped", "EP": "crawl"}
SEWER_NOTES = {
    "upright": "Estimé : réseau unitaire (grandes galeries). Le réseau unitaire fait ~69 % du linéaire, proche des ~66 % visitables (≥ 1,60 m) publiés par le Département.",
    "stooped": "Estimé : réseau séparatif eaux usées, canalisations généralement plus étroites que l'unitaire.",
    "crawl": "Estimé : réseau d'eaux pluviales, souvent en conduites de petit diamètre.",
}

sewers = 0
for index, (network, insee, line, length) in enumerate(pieces):
    commune = communes.get(insee)
    passability = NETWORK_PASSABILITY.get(network, "stooped")
    name = NETWORK_NAMES.get(network, "Collecteur") + (f" · {commune}" if commune else "")
    data["segments"].append({"id": f"x-sewer-{sewers}", "name": name, "type": "sewer", "level": -1, "network": network, "passability": passability, "passabilityNote": SEWER_NOTES[passability], "startNodeId": node_id(line[0]), "endNodeId": node_id(line[-1]), "cd92": insee or "92", "cd92set": "collecteurs", "geometry": {"type": "LineString", "coordinates": line}})
    sewers += 1
from collections import Counter as _Counter
share = _Counter()
for network, insee, line, length in pieces: share[NETWORK_PASSABILITY.get(network, "stooped")] += length
print("égouts — linéaire par praticabilité (km):", {k: round(v / 1000) for k, v in share.items()}, file=sys.stderr)

json.dump(data, open(OUT_DATA, "w"), separators=(",", ":"), ensure_ascii=False)
print(f"rivières/aqueducs {rivers} · sites {sites} · ouvrages {basins} · égouts {sewers} segments", file=sys.stderr)
