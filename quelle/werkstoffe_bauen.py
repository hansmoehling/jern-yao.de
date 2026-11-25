"""Build a source-bound material catalogue without inventing flow curves.

The first 14 positions stay stable for historical references. Only explicitly
approved, sourced curves with a defined delivery condition enter Manual choices.
Tensile strength is not converted to a flow curve or a wire certificate value.
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
    flow = json.loads((Q / "fliesskurven.json").read_text(encoding="utf-8"))
    supplements = json.loads((Q / "werkstoffe-ergaenzungen.json").read_text(encoding="utf-8"))["materials"]
    assert flow["schemaVersion"] == 1
    sources = {item["id"]: item for item in flow["sources"]}
    approved = [curve for curve in flow["curves"] if curve.get("eligible") is True]
    assert len({curve["id"] for curve in approved}) == len(approved), "Duplicate curve ID"
    for curve in approved:
        assert curve.get("approval") in {"literature", "proxy"}, curve["id"]
        if curve["approval"] == "proxy":
            assert curve.get("proxy", {}).get("rationale") and curve.get("proxy", {}).get("sourceMaterial"), curve["id"]
        assert curve.get("state") and curve.get("temperature") and curve.get("sourceIds"), curve["id"]
        assert all(source_id in sources for source_id in curve["sourceIds"]), curve["id"]
        assert curve.get("model") in {"tabulated", "hollomon", "swift"}, curve["id"]
        if curve["model"] == "swift":
            assert curve["C"] > 0 and curve["n"] >= 0 and curve["epsilon0"] > 0, curve["id"]
        assert 0 <= curve["phiMin"] < curve["phiMax"], curve["id"]
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
        entry.update(legacyParameters={key: old.get(key) for key in ["C", "n", "Rm"]},
                     C=None, n=None, Rm=None, curveStatus="missing",
                     curveSource="Historische Parameter archiviert; keine freigegebene Fließkurve",
                     rmStatus="missing", densityStatus="legacy-estimate")
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
    # Additional source identities are deliberately outside the 58-grade catalogue.
    # They cannot inherit an EN curve through a similar name or chemical composition.
    for item in supplements:
        assert not any(norm(item["id"]) == norm(m["id"]) for m in materials), item["id"]
        assert not item.get("number"), "Supplemental identities need an explicit grade mapping, not an inferred EN number"
        entry = copy.deepcopy(item)
        entry.update(C=None, n=None, Rm=None, rho=None, grp="unbekannt", rmStatus="missing",
                     densityStatus="missing", densitySource=None, properties=[],
                     hinweis="Lieferzustand und Fließkurve ausdrücklich wählen")
        materials.append(entry)
    # An explicit group reference may fill a missing density only. It is never
    # promoted to a grade/condition-specific property or a flow-curve approval.
    for entry in materials:
        if isinstance(entry.get("rho"), (int, float)) and entry["rho"] > 0:
            continue
        references = [reference for reference in research.get("densityReferences", [])
                      if entry.get("number") in reference.get("materialNumbers", [])
                      or entry["id"] in reference.get("materialIds", [])]
        assert len(references) <= 1, "Ambiguous density reference: " + entry["id"]
        if references:
            reference = references[0]
            assert reference["status"] == "group-reference-approximation" and reference.get("sourceUrl")
            rho, source = density({"properties": [reference]})
            assert rho is not None
            entry.update(rho=rho, densityStatus="reference-steel-density", densitySource=copy.deepcopy(source))
            entry["materialNotes"].append("Gewicht mit Stahl-Bezugsdichte 7,85 g/cm³; Näherungswert, keine belegte Chargendichte.")
    assigned = set()
    for entry in materials:
        matches = [copy.deepcopy(curve) for curve in approved
                   if entry.get("number") and entry["number"] in curve.get("materialNumbers", [])
                   or entry["id"] in curve.get("materialIds", [])]
        for curve in matches:
            curve["sourceRefs"] = [copy.deepcopy(sources[source_id]) for source_id in curve["sourceIds"]]
            assigned.add(curve["id"])
        approvals = {curve["approval"] for curve in matches}
        entry.update(flowCurves=matches, manualEligible=bool(matches),
                     curveStatus=next(iter(approvals)) if len(approvals) == 1 else "curated" if matches else "missing")
        if matches:
            entry["curveSource"] = "; ".join(curve["id"] for curve in matches)
            entry["hinweis"] = "Lieferzustand und Fließkurve ausdrücklich wählen"
    assert assigned == {curve["id"] for curve in approved}, "Approved curve has no exact catalogue identity"
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
    print(f"{len(rows)} material identities; {sum(row['manualEligible'] for row in rows)} Manual choices; all 58 catalogue identities included")
