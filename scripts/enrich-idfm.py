#!/usr/bin/env python3
"""Enrichit public/data/public-underground.json avec les lignes Île-de-France Mobilités (IDFM).

Sources (open data IDFM, ODbL) :
  - traces-du-reseau-ferre-idf : tracés des lignes, couleurs officielles ;
  - emplacement-des-gares-idf : gares et stations par ligne.

Croisement purement spatial avec les données OSM déjà importées :
  - un tunnel dont le nom OSM désigne une ligne (« Métro 13 », « RER A ») reçoit cette ligne ;
  - sinon il reçoit les lignes dont le tracé longe l'essentiel de ses sommets (< 15 m) ;
  - une station ou une bouche reçoit les lignes des gares IDFM proches (métro, RER, Transilien, tram, VAL).
Les horaires (GTFS) ne sont pas importés.

Usage : python3 scripts/enrich-idfm.py   (à relancer après build-public-underground.py / build-extra-underground.py)
"""
import gzip
import json
import math
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'public' / 'data' / 'public-underground.json'
CACHE = ROOT / 'scripts' / '.cache' / 'idfm'
API = 'https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets/{}/exports/geojson'
TRACES, GARES = 'traces-du-reseau-ferre-idf', 'emplacement-des-gares-idf'

MODES = {'METRO': 'metro', 'RER': 'rer', 'TRAIN': 'train', 'TRAMWAY': 'tram', 'NAVETTE': 'val', 'VAL': 'val'}
SEGMENT_TYPES = {'rail', 'tunnel'}
TRACE_TOLERANCE_M = 15
STATION_RADIUS_M = {'station': 220, 'metro-entrance': 160}

LAT0 = 48.86
M_LAT = 110_540
M_LNG = 111_320 * math.cos(math.radians(LAT0))


def xy(coord):
    return coord[0] * M_LNG, coord[1] * M_LAT


def load(dataset):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f'{dataset}.geojson'
    if not path.exists():
        with urllib.request.urlopen(API.format(dataset), timeout=120) as response:
            raw = response.read()
        if raw[:2] == b'\x1f\x8b':
            raw = gzip.decompress(raw)
        path.write_bytes(raw)
    return json.loads(path.read_text())['features']


def line_name(mode, res_com):
    code = res_com.split(' ', 1)[1] if ' ' in res_com else res_com
    if mode == 'METRO':
        return f'Métro {code}'
    if mode == 'TRAIN':
        return f'Transilien {code}'
    if mode == 'TRAMWAY':
        return f'Tram T{code}'
    if mode in ('NAVETTE', 'VAL'):
        return 'Orlyval' if 'ORLY' in res_com.upper() else res_com.title()
    return res_com  # RER A…


def line_of(props):
    mode, res_com = props.get('mode'), props.get('res_com') or ''
    if mode not in MODES or res_com.upper().startswith(('TER', 'FUNICULAIRE', 'CDGVAL', 'CABLE')):
        return None
    color = props.get('colourweb_hexa')
    return {'name': line_name(mode, res_com), 'mode': MODES[mode], **({'color': f'#{color.lower()}'} if color else {})}


def normalize(text):
    import unicodedata

    return ''.join(c for c in unicodedata.normalize('NFD', text.lower()) if unicodedata.category(c) != 'Mn').strip()


def point_segment_distance(p, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    length2 = dx * dx + dy * dy
    t = 0 if length2 == 0 else max(0, min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / length2))
    return math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy))


def main():
    CELL = 200
    grid = defaultdict(list)  # cellule -> [(a, b, clé de ligne)]
    lines = {}
    for feature in load(TRACES):
        line = line_of(feature['properties'])
        if not line or not feature.get('geometry'):
            continue
        lines[line['name']] = {**lines.get(line['name'], {}), **line}
        coords = [xy(c) for c in feature['geometry']['coordinates']]
        for a, b in zip(coords, coords[1:]):
            for cx in range(int(min(a[0], b[0]) // CELL) - 1, int(max(a[0], b[0]) // CELL) + 2):
                for cy in range(int(min(a[1], b[1]) // CELL) - 1, int(max(a[1], b[1]) // CELL) + 2):
                    grid[(cx, cy)].append((a, b, line['name']))

    def lines_near(point, tolerance):
        p = xy(point)
        found = set()
        for a, b, name in grid.get((int(p[0] // CELL), int(p[1] // CELL)), ()):
            if name not in found and point_segment_distance(p, a, b) <= tolerance:
                found.add(name)
        return found

    stations = []
    for feature in load(GARES):
        line = line_of(feature['properties'])
        if line and feature.get('geometry'):
            lines.setdefault(line['name'], line)
            stations.append((xy(feature['geometry']['coordinates']), line['name']))

    # Noms OSM usuels (« Métro 13 », « RER A », « Ligne 13 du métro de Paris ») -> nom de ligne IDFM.
    by_osm_name = {}
    for name, line in lines.items():
        by_osm_name[normalize(name)] = name
        code = name.split(' ', 1)[-1]
        if line['mode'] == 'metro':
            by_osm_name[normalize(f'Ligne {code} du métro de Paris')] = name
            by_osm_name[normalize(f'Métro ligne {code}')] = name

    data = json.loads(DATA.read_text())
    order = lambda names: sorted(names, key=lambda n: (['metro', 'rer', 'train', 'tram', 'val'].index(lines[n]['mode']), len(n), n))
    segment_count = access_count = 0

    for segment in data['segments']:
        segment.pop('transitLines', None)
        if segment.get('type') not in SEGMENT_TYPES:
            continue
        named = by_osm_name.get(normalize(segment.get('name') or ''))
        if named:
            segment['transitLines'] = [lines[named]]
            segment_count += 1
            continue
        coords = segment['geometry']['coordinates']
        # Sommets intermédiaires densifiés : un tunnel court n'a parfois que deux points.
        samples = [[a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] for a, b in zip(coords, coords[1:]) for t in (0, 0.5)] + [coords[-1]]
        votes = defaultdict(int)
        for point in samples:
            for name in lines_near(point, TRACE_TOLERANCE_M):
                votes[name] += 1
        matched = [name for name, count in votes.items() if count >= 0.8 * len(samples)]
        # Un tram qui longe une voie ferrée lourde (T2 à Puteaux) n'emprunte pas son tunnel.
        if any(lines[name]['mode'] != 'tram' for name in matched):
            matched = [name for name in matched if lines[name]['mode'] != 'tram']
        if matched:
            segment['transitLines'] = [lines[name] for name in order(matched)]
            segment_count += 1

    for access in data['accesses']:
        access.pop('transitLines', None)
        radius = STATION_RADIUS_M.get(access.get('type'))
        if not radius:
            continue
        p = xy(access['geometry']['coordinates'])
        matched = {name for q, name in stations if math.hypot(p[0] - q[0], p[1] - q[1]) <= radius}
        # Une bouche de métro ne mène qu'au réseau souterrain : on écarte tram et Transilien de surface.
        if access['type'] == 'metro-entrance':
            matched = {name for name in matched if lines[name]['mode'] in ('metro', 'rer', 'val')}
        if matched:
            access['transitLines'] = [lines[name] for name in order(matched)]
            access_count += 1

    data['attribution'] = '© OpenStreetMap contributors (ODbL) · Île-de-France Mobilités (ODbL) · Département des Hauts-de-Seine (Licence Ouverte)'
    DATA.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    print(f'{segment_count} segments et {access_count} accès rattachés à {len(lines)} lignes IDFM')


if __name__ == '__main__':
    main()
