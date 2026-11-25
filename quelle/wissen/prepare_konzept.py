"""Prepare a private, versioned knowledge snapshot. Never place it in the public repo.
python prepare_konzept.py --source /private/Konzept --output /private/konzept-cache.json
"""
import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
FILES = {'regeln': 'regeln.md', 'wissenskarten': 'wissenskarten.md',
         'literaturinventar': 'Literaturinventar.md'}


def runtime_projection(key, content):
    """Keep engineering evidence, not raw paths, correspondence or old product roles."""
    if key == 'regeln':
        content = content[content.index('## Regeln'):]
        content = content.split('## Referenzfälle')[0]
        lines = []
        in_rules = True
        for line in content.splitlines():
            if line.startswith('## ') and line != '## Regeln':
                in_rules = False
            if in_rules and line.startswith('|'):
                cells = line.split('|')
                line = '|'.join(cells[:4]) + '|'
            lines.append(line)
        content = '\n'.join(lines)
    elif key == 'wissenskarten':
        content = content[content.index('## Regeln mit Zahl'):]
        content = content.split('## Was der Entwurf enthält')[0]
    else:
        # A source catalogue is a locator, not evidence that every PDF was read.
        content = ('# Literaturzugang\nDie Literatursammlung liegt im privaten Projekt Konzept. '
                   'Ausgewertete Inhalte sind durch R-, K- und W-Kennungen im Regelwerk erfasst. '
                   'Ein inventarisierter Titel ersetzt keinen gelesenen Beleg. '
                   'Fehlende Belege als Wissenslücke melden; keine Fundstelle erfinden.\n')
    content = re.sub(r'`[^`]*(?:/|\\|\.xlsx|\.docx|\.csv)[^`]*`', '[interne Quelle]', content)
    content = re.sub(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', '[interner Kontakt]', content)
    content = re.sub(r'https://(?:drive|docs)\.google\.com/\S+', '[interne Quelle]', content)
    return content.strip() + '\n'


def prepare(source, output):
    source, output = Path(source).resolve(), Path(output).resolve()
    if output == REPO or REPO in output.parents:
        raise ValueError('Private Wissensdatei darf nicht im öffentlichen Repository liegen.')
    texts, sources = {}, []
    for key, name in FILES.items():
        raw = (source / name).read_bytes()
        content = raw.decode('utf-8-sig').replace('\r\n', '\n')
        if len(content) < 100:
            raise ValueError('Quelle leer oder unvollständig: ' + name)
        projected = runtime_projection(key, content)
        texts[key] = projected
        sources.append({'key': key, 'title': name,
                        'originalSha256': hashlib.sha256(content.encode()).hexdigest(),
                        'sha256': hashlib.sha256(projected.encode()).hexdigest()})
    version = hashlib.sha256(json.dumps(sources, sort_keys=True).encode()).hexdigest()[:20]
    snapshot = {'version': version, 'createdAt': datetime.now(timezone.utc).isoformat(),
                'sources': sources, 'texts': texts,
                'keys': {key: f'konzept:{version}:{key}' for key in texts}}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'version': version, 'sources': len(sources), 'output': str(output)}))
    return snapshot


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', required=True)
    p.add_argument('--output', required=True)
    args = p.parse_args()
    prepare(args.source, args.output)
