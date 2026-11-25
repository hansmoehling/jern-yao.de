"""Baut index.html aus vorlage.html, engine.js, ui.js und maschinen.json. Aufruf: python3 quelle/bauen.py"""
import json, pathlib
Q = pathlib.Path(__file__).resolve().parent
UMAMI = 'b50ac41f-f69c-4005-b9da-eae7ef84e8e9'
v = (Q / 'vorlage.html').read_text(encoding='utf-8')
daten = json.dumps(json.loads((Q / 'maschinen.json').read_text(encoding='utf-8')), ensure_ascii=False, separators=(',', ':'))
assert '</script' not in daten
v = v.replace('data-website-id="b50ac41f-for-jernyao"', 'data-website-id="%s"' % UMAMI)
praxis = json.dumps(json.loads((Q / 'praxis.json').read_text(encoding='utf-8')), ensure_ascii=False, separators=(',', ':'))
for ph, val in (('/*PRAXIS*/', praxis), ('/*DATEN*/', daten), ('/*ENGINE*/', (Q / 'engine.js').read_text(encoding='utf-8')), ('/*UI*/', (Q / 'ui.js').read_text(encoding='utf-8'))):
    assert ph in v, ph
    v = v.replace(ph, val)
(Q.parent / 'index.html').write_text(v, encoding='utf-8')
print('index.html', len(v) // 1024, 'KB')
