import importlib.util
import pathlib
import unittest

module_path = pathlib.Path(__file__).resolve().parents[1] / 'wissen' / 'prepare_konzept.py'
spec = importlib.util.spec_from_file_location('prepare_konzept', module_path)
knowledge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(knowledge)


class KnowledgePrivacy(unittest.TestCase):
    def test_private_rule_references_are_not_runtime_evidence(self):
        raw = '# Titel\n## Quellen\nPrivater Kunde\n## Regeln\n| ID | Aussage | Art | Fundstelle |\n| R-VOL | Volumen bleibt erhalten | Identität | geheim@example.invalid |\n## Widersprüche\n- W1: Werte widersprechen sich.\n## Referenzfälle\nPrivater Kunde'
        result = knowledge.runtime_projection('regeln', raw)
        self.assertIn('Volumen bleibt erhalten', result)
        self.assertIn('W1: Werte widersprechen sich.', result)
        self.assertNotIn('Privater Kunde', result)
        self.assertNotIn('geheim@', result)

    def test_old_role_and_local_paths_do_not_enter_runtime(self):
        raw = '## Rolle\nNie direkt an Kunden\n## Regeln mit Zahl\nK1: technische Aussage. Quelle `/Users/test/privat.md`\n## Was der Entwurf enthält\nAlte Produktrolle'
        result = knowledge.runtime_projection('wissenskarten', raw)
        self.assertIn('technische Aussage', result)
        self.assertNotIn('/Users/', result)
        self.assertNotIn('Nie direkt', result)
        self.assertNotIn('Alte Produktrolle', result)

    def test_raw_inventory_is_not_exposed_as_read_evidence(self):
        result = knowledge.runtime_projection('literaturinventar', 'Private Zeichnung 123')
        self.assertNotIn('123', result)
        self.assertIn('ersetzt keinen gelesenen Beleg', result)


if __name__ == '__main__':
    unittest.main()
