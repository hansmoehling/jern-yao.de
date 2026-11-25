"""Build a source-bound material catalogue without inventing flow curves.

The first 14 positions stay stable for saved V1 examples. Manufacturer properties
remain reference data with their condition/product restrictions. Tensile strength
is deliberately not converted to a flow curve or a wire certificate value.
"""
import copy
import json
import pathlib
import re

Q = pathlib.Path(__file__).resolve().parent


def norm(value):
    return re.sub(r"[\s()_-]", "", str(value)).casefold()


def group(item):
    name = norm(item["name"])
    standard = str(item.get("standard", ""))
    if name.startswith("cuzn"):
        return "messing"
    if name.startswith(("cu", "e-cu", "ecu")):
        return "kupfer" if name in {"cuetp", "ecu57", "ecu58"} else "unbekannt"
    if name.startswith("al"):
        return "alu"
    if "10263-5" in standard or name.startswith("x"):
        return "rostfrei"
    if "10263-2" in standard:
        return "gut"
    if "10263-3" in standard:
        return "schwerer"
    if "10263-4" in standard:
        return "schwerer" if "b" in name else "schwer"
    return "unbekannt"


def density(item):
    for prop in item.get("properties", []):
        if str(prop.get("property", "")).lower() not in {"density", "rho", "dichte"}:
            continue
        value = prop.get("value")
        unit = str(prop.get("unit", "")).replace("³", "3").replace(" ", "").lower()
        if not isinstance(value, (int, float)) or not 0 < value < 100000:
            continue
        if unit in {"g/cm3", "kg/dm3"}:
            return value, prop
        if unit == "kg/m3":
            return value / 1000, prop
    return None, None


def build():
    legacy = json.loads((Q / "werkstoffe-bestand.json").read_text(encoding="utf-8"))["materials"]
    research = json.loads((Q / "werkstoffe-recherche.json").read_text(encoding="utf-8"))
    catalogue = research["materials"]
    assert len(catalogue) == 58, "Moehling source inventory must contain all 58 identities"
    used = set()
    materials = []
    for old in legacy:
        bare = old["id"].split(" (")[0]
        candidates = [(i, item) for i, item in enumerate(catalogue)
                      if norm(bare) in {norm(item["name"]), norm(item.get("number", ""))}]
        assert len(candidates) <= 1, "Ambiguous legacy identity: " + old["id"]
        entry = copy.deepcopy(old)
        entry.update(curveStatus="legacy-estimate", curveSource="Bestandsmodell V1.1; nicht als chargenspezifische Fließkurve validiert",
                     rmStatus="legacy-estimate", densityStatus="legacy-estimate")
        if candidates:
            i, item = candidates[0]
            used.add(i)
            entry.update(sourceName=item["name"], number=item.get("number"), standard=item.get("standard"),
                         aliases=item.get("aliases", []), properties=item.get("properties", []),
                         materialNotes=item.get("notes", []), catalogueSource=research.get("catalogueUrl", "https://moehling.com/de/produkte/materialien.html"))
            rho, source = density(item)
            if rho is not None:
                entry.update(rho=rho, densityStatus="sourced", densitySource=source)
        else:
            entry.update(sourceName=old["id"], aliases=[], properties=[], materialNotes=[], standard="Bestandsmodell")
        materials.append(entry)
    for i, item in enumerate(catalogue):
        if i in used:
            continue
        rho, source = density(item)
        entry = dict(id=item["name"], sourceName=item["name"], number=item.get("number"),
                     standard=item.get("standard"), aliases=item.get("aliases", []),
                     Rm=None, C=None, n=None, rho=rho, grp=group(item),
                     hinweis="Fließkurve für den Lieferzustand offen", curveStatus="missing", rmStatus="missing",
                     densityStatus="sourced" if source else "missing", densitySource=source,
                     properties=item.get("properties", []), materialNotes=item.get("notes", []),
                     catalogueSource=research.get("catalogueUrl", "https://moehling.com/de/produkte/materialien.html"))
        materials.append(entry)
    identities = {(m["sourceName"], m.get("number")) for m in materials}
    assert all((m["name"], m.get("number")) in identities for m in catalogue)
    # Independent public metadata, also embedded in the standalone engine.
    (Q / "werkstoffe.json").write_text(json.dumps(materials, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    engine = (Q / "engine.js").read_text(encoding="utf-8")
    payload = json.dumps(materials, ensure_ascii=False, separators=(",", ":"))
    assert "</script" not in payload.lower()
    replacement = "  const WERKSTOFFE = /*MATERIALS_BEGIN*/" + payload + "/*MATERIALS_END*/;"
    if "/*MATERIALS_BEGIN*/" in engine:
        engine, count = re.subn(r"  const WERKSTOFFE = /\*MATERIALS_BEGIN\*/.*?/\*MATERIALS_END\*/;", lambda _: replacement, engine, flags=re.S)
    else:
        engine, count = re.subn(r"  const WERKSTOFFE = \[.*?\n  \];", lambda _: replacement, engine, count=1, flags=re.S)
    assert count == 1
    (Q / "engine.js").write_text(engine, encoding="utf-8")
    return materials


if __name__ == "__main__":
    rows = build()
    print(f"{len(rows)} material choices; all 58 Moehling catalogue identities included")
