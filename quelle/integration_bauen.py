"""Export price-free modules for the existing jernyao.de GitHub Pages site.

Run bauen.py first, then this script with the main site's docs directory.
The original jern-yao.de output is kept separate and retains its prices.
"""
from pathlib import Path
import argparse
import json
import re
import shutil

Q = Path(__file__).resolve().parent


def replace_once(text, old, new):
    assert text.count(old) == 1, f"Expected exactly one integration marker: {old[:100]}"
    return text.replace(old, new, 1)


def technical_catalog(text):
    pattern = r'(<script id="daten" type="application/json">)(.*?)(</script>)'
    match = re.search(pattern, text, flags=re.S)
    assert match, 'Machine catalogue missing'
    machines = json.loads(match[2])
    # Preserve the engine's stable price-based order without exporting the prices.
    machines.sort(key=lambda machine: machine.get('rp') or 9e9)
    for machine in machines:
        for key in ('rp', 'lo', 'hi'):
            machine.pop(key, None)
    content = json.dumps(machines, ensure_ascii=False, separators=(',', ':'))
    return text[:match.start(2)] + content + text[match.end(2):]


def build(destination):
    destination = Path(destination).resolve()
    for name in ('endteil_chrom.png', 'Stadie.jpg', 'zeichnung.png'):
        source_asset = Q.parent / 'assets' / 'konfigurator' / name
        target_asset = destination / 'assets' / 'konfigurator' / name
        target_asset.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_asset, target_asset)
    config = (Q.parent / 'site-config.js').read_text(encoding='utf-8')
    assert 'window.JY_API_BASE' in config
    for source, folder in [('index.html', 'auslegung'), ('manual/konfigurator-v1.html', 'konfigurator')]:
        text = technical_catalog((Q.parent / source).read_text(encoding='utf-8'))
        text = replace_once(text, '<head>', '<head>\n<script>window.JY_SHOW_PRICES = false;</script>')
        text = replace_once(text, '<script src="/site-config.js"></script>', '<script>' + config + '</script>')
        if folder == 'auslegung':
            text = text.replace('href="/manual/konfigurator-v1.html"', 'href="/konfigurator/"')
            text = text.replace('>Manual · Manuelle Auslegung</a>', '>Konfigurator für Experten</a>')
            text = replace_once(text, '</head>', '<style>' + (Q / 'integration-embed.css').read_text(encoding='utf-8') + '</style>\n</head>')
            text = replace_once(text, '</body>', '<script>' + (Q / 'integration-embed.js').read_text(encoding='utf-8') + '</script>\n</body>')
        else:
            replacements = {
                'Manuelle Auslegung: Stadienfolge, Werkzeuggröße und passende Jern-Yao-Mehrstufenpressen mit Richtpreis 2026.': 'Manuelle Auslegung: Stadienfolge, Werkzeuggröße und passende Jern-Yao-Mehrstufenpressen.',
                'Stadienfolge, Presskraft, Werkzeuggröße und Auswerferwege grob ausgelegt, dazu die passenden Jern-Yao-Modelle mit Richtpreis 2026.': 'Stadienfolge, Presskraft, Werkzeuggröße und Auswerferwege grob ausgelegt, dazu die passenden Jern-Yao-Modelle.',
                '<h2>Angebot anfragen</h2>': '<h2>Maschinenangebot anfragen</h2>',
                'href="/"': 'href="/#auslegung"',
            }
            # These strings also occur in the embedded translation catalogue; only
            # alter the markup before any runtime/catalogue scripts.
            markup, scripts = text.split('<script id="daten"', 1)
            for old, new in replacements.items():
                assert old in markup, old
                markup = markup.replace(old, new)
            markup, count = re.subn(r'\s*<p class="klein" id="preisnote">.*?</p>', '', markup, flags=re.S)
            assert count == 1
            text = markup + '<script id="daten"' + scripts
        target = destination / folder / 'index.html'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding='utf-8')
        print(str(target), len(text.encode('utf-8')), 'bytes')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination', help='docs directory of the jernyao.de checkout')
    build(parser.parse_args().destination)
