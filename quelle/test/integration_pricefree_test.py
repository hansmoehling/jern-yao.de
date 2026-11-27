"""Price-free packaging keeps technical data and removes inactive price translations."""
import importlib.util
import json
from pathlib import Path
import re
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('integration_bauen', SOURCE / 'integration_bauen.py')
integration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(integration)


class PriceFreeExport(unittest.TestCase):
    def test_real_pages_keep_nonprice_translation_entries(self):
        for name in ('index.html', 'manual/konfigurator-v1.html'):
            original = (SOURCE.parent / name).read_text(encoding='utf-8')
            rendered = integration.price_free_translations(original)
            pattern = r'const catalog=(\{.*?\});\s*const supported='
            before = json.loads(re.search(pattern, original, re.S)[1])
            after = json.loads(re.search(pattern, rendered, re.S)[1])
            self.assertTrue(any('Richtpreis' in key for key in before))
            self.assertFalse(any('richtpreis' in key.casefold() for key in after))
            self.assertEqual(after, {key: value for key, value in before.items() if 'richtpreis' not in key.casefold()})
            self.assertEqual(integration.price_free_translations(rendered), rendered)

    def test_complete_export_keeps_all_languages_and_catalogue_without_prices(self):
        with tempfile.TemporaryDirectory() as destination:
            integration.build(destination)
            for folder in ('auslegung', 'konfigurator'):
                text = (Path(destination) / folder / 'index.html').read_text(encoding='utf-8')
                self.assertIn('window.JY_SHOW_PRICES = false', text)
                machines = json.loads(re.search(r'<script id="daten" type="application/json">(.*?)</script>', text, re.S)[1])
                self.assertEqual(len(machines), 329)
                self.assertTrue(all(not {'rp', 'lo', 'hi'} & item.keys() for item in machines))
                catalog = json.loads(re.search(r'const catalog=(\{.*?\});\s*const supported=', text, re.S)[1])
                key = 'Stadienfolge, Presskraft, Werkzeuggröße und Auswerferwege grob ausgelegt, dazu die passenden Jern-Yao-Modelle.'
                self.assertEqual(len(catalog[key]), 4)
                self.assertTrue(all(catalog[key]))
                self.assertFalse(any('richtpreis' in key.casefold() for key in catalog))


if __name__ == '__main__':
    unittest.main()
