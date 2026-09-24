#!/usr/bin/env python3
"""Verify pinned meter sources and current browser evidence; emit agent dispositions."""
from __future__ import annotations

from collections import Counter
from fractions import Fraction
from hashlib import sha256
import json
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
SUITE = ROOT / "converters/fixtures/musicxml-suite"
EVIDENCE = ROOT / "harness/fixtures/musicxml-meter-current-evidence"
OUT = ROOT / "harness/reports/musicxml-meter-current-assessment.json"
suite = json.loads((SUITE / "manifest.json").read_text())
listed = {f["id"]: f for f in suite["fixtures"]}
IDS = tuple(f["id"] for f in suite["fixtures"] if f["id"].startswith("11"))
assert len(IDS) == 12
evidence = json.loads((EVIDENCE / "manifest.json").read_text())
for entry in evidence["files"]:
    assert sha256((EVIDENCE / entry["path"]).read_bytes()).hexdigest() == entry["sha256"]
indexes = {shell: json.loads((EVIDENCE / shell / "index.json").read_text())
           for shell in ("workbench", "studio")}
for shell, index in indexes.items():
    assert index["applicationCommit"] == evidence["applicationCommit"]
    assert index["corpusRevision"] == suite["revision"] == evidence["corpusRevision"]
    assert index["browser"]["product"] == "Chrome/153.0.8010.36"
    assert index["viewport"] == {"width": 1440, "height": 1000, "deviceScaleFactor": 1}
    assert [f["id"] for f in index["fixtures"]] == list(IDS)
    assert index["shell"] == shell

def meter_fraction(time: ET.Element) -> Fraction | None:
    if time.find("senza-misura") is not None:
        return None
    beats = time.findall("beats")
    units = time.findall("beat-type")
    assert len(beats) == len(units) and beats
    return sum((Fraction(sum(int(n) for n in beat.text.split("+")), int(unit.text))
                for beat, unit in zip(beats, units)), Fraction())

def fraction_value(value: Fraction | None) -> list[int] | None:
    return None if value is None else [value.numerator, value.denominator]

fixtures = []
variant_ids: set[str] = set()
for fixture_id in IDS:
    entry = listed[fixture_id]
    source_path = SUITE / entry["path"]
    assert sha256(source_path.read_bytes()).hexdigest() == entry["sha256"]
    xml = ET.parse(source_path).getroot()
    assert not xml.findall(".//staff-tuning") and not xml.findall(".//technical/string")
    parts = xml.findall("part")
    assert len(parts) == 1
    measures = parts[0].findall("measure")
    docs = {shell: json.loads((EVIDENCE / shell / fixture_id / "document.mnx.json").read_text())
            for shell in indexes}
    assert docs["workbench"] == docs["studio"], fixture_id
    mnx = docs["workbench"]
    assert len(mnx["global"]["measures"]) == len(measures)
    if fixture_id == "11b-TimeSignatures-NoTime":
        assert mnx["parts"][0]["staves"] == 2
        assert {sequence["staff"] for sequence in mnx["parts"][0]["measures"][0]["sequences"]} == {1, 2}
    time_rows = []
    for measure_no, (measure, global_measure) in enumerate(zip(measures, mnx["global"]["measures"]), 1):
        for time_no, time in enumerate(measure.findall("attributes/time"), 1):
            variant_id = f"{fixture_id}/p01/m{measure_no:02d}/t{time_no:02d}"
            assert variant_id not in variant_ids
            variant_ids.add(variant_id)
            alternate = time.find("interchangeable")
            source_fraction = meter_fraction(time)
            time_rows.append({
                "id": variant_id, "measure": measure_no, "sourceMeasureNumber": measure.get("number"),
                "staffNumber": time.get("number"), "printObject": time.get("print-object", "yes"),
                "symbol": time.get("symbol"),
                "beats": [b.text for b in time.findall("beats")],
                "beatTypes": [int(b.text) for b in time.findall("beat-type")],
                "sourceDurationWhole": fraction_value(source_fraction),
                "senzaMisura": time.findtext("senza-misura")
                                if time.find("senza-misura") is not None else None,
                "hasSenzaMisura": time.find("senza-misura") is not None,
                "alternate": None if alternate is None else {
                    "beats": [b.text for b in alternate.findall("beats")],
                    "beatTypes": [int(b.text) for b in alternate.findall("beat-type")],
                    "relation": alternate.findtext("time-relation"),
                    "durationWhole": fraction_value(meter_fraction(alternate))},
                "importedGlobalTime": global_measure.get("time"),
            })
            imported = global_measure.get("time")
            if source_fraction is not None:
                assert imported is not None, variant_id
                assert Fraction(imported["count"], imported["unit"]) == source_fraction, variant_id
            else:
                assert imported is None, variant_id
    for shell, index in indexes.items():
        row = next(f for f in index["fixtures"] if f["id"] == fixture_id)
        assert row["sourceSha256"] == entry["sha256"]
        assert row.get("importError") is None and row.get("captureError") is None
        assert row["availableViews"] == ["notation"]
        assert row["editorBound"] is True
        assert row["displayOptions"]["timeSignatures"] == "show"
        assert row["displayOptions"]["clefs"] == "show"
        assert row["consoleErrors"] == []
        if shell == "studio":
            assert row["editingSuspended"] is False and row["viewingOriginal"] is False
        assert len(row["views"]) == 1
        view = row["views"][0]
        assert view["view"] == "notation" and view["staffScale"] == 1 and view["densityH"] == 2
        assert view["renderErrors"] == [] and view["svgCount"] == 1
        assert view["scrollWidth"] <= view["clientWidth"] + 1
        assert view["scrollHeight"] <= view["clientHeight"] + 1
        assert view["screenshots"] == ["notation-0-0.png"]
        for name in ("notation-0.svg", "notation-0-0.png", "document.mnx.json", "observation.json"):
            assert (EVIDENCE / shell / fixture_id / name).exists()
    fixtures.append({
        "id": fixture_id, "sourcePath": entry["path"], "sourceSha256": entry["sha256"],
        "testClass": entry["testClass"], "description": entry["description"],
        "sourceMeasures": len(measures), "sourceDeclaresStrings": False,
        "sourceTimeDeclarations": time_rows,
        "warnings": next(f for f in indexes["workbench"]["fixtures"] if f["id"] == fixture_id)["warnings"],
    })
by_id = {f["id"]: f for f in fixtures}
assert [len(f["sourceTimeDeclarations"]) for f in fixtures] == [11, 3, 2, 2, 2, 2, 1, 1, 2, 2, 2, 6]
for fixture_id in IDS:
    wb = next(f for f in indexes["workbench"]["fixtures"] if f["id"] == fixture_id)
    st = next(f for f in indexes["studio"]["fixtures"] if f["id"] == fixture_id)
    assert wb["warnings"] == st["warnings"]

def times(fixture: str, measures: tuple[int, ...] | None = None,
          staff: str | None = None) -> list[str]:
    return [row["id"] for row in by_id[fixture]["sourceTimeDeclarations"]
            if (measures is None or row["measure"] in measures)
            and (staff is None or row["staffNumber"] == staff)]

def context(fixture: str, suffix: str) -> str:
    variant_id = f"{fixture}/p01/{suffix}"
    assert variant_id not in variant_ids
    variant_ids.add(variant_id)
    return variant_id

def feature(feature_id: str, fixture: str, variants: list[str], expected: str,
            verdict: str, cause: list[str], reason: str) -> dict:
    assert variants and all(v in variant_ids for v in variants)
    return {"id": feature_id, "fixture": fixture, "variantIds": variants,
            "sourceDescription": listed[fixture]["description"], "expected": expected,
            "verdict": verdict, "cause": cause, "reason": reason}

a, b, cc, cs, dc, ds, ec, es, f, g, h, i = IDS
features = [
    feature("11a.numeric-duration", a, times(a), "The 11 source meters retain their exact durations and numeric values.", "correct", [],
            "All 11 values survive as MNX time; the full sequence is visible across the score in both shells, including 12/8."),
    feature("11a.compatible-common", a, times(a, (2,)), "The 4/4 common sign prints as C.", "correct", [],
            "The source common symbol survives as MNX display common and is visibly C."),
    feature("11a.inconsistent-first-symbol", a, times(a, (1,)), "Resolve whether source common 2/2 should use a numeric sign or the description's alla breve glyph.", "unresolved", ["source/reference ambiguity"],
            "XML says common on 2/2, but the manifest says alla breve. Import warns and prints numeric 2/2; duration is correct, exact glyph policy unresolved."),
    feature("11b.absent-initial-meter", b, [context(b, "m01/no-time")], "No source time declaration starts the score; an omitted initial glyph is allowed.", "not applicable", ["source/reference ambiguity"],
            "The source explicitly permits application-dependent initial display. No initial MNX time or glyph exists; implicit duration semantics are assessed separately."),
    feature("11b.hidden-meter-ink", b, times(b, (2,)) + times(b, (3,), "2"), "The 2/2 change on both staves and staff-2 4/4 change are not printed.", "incorrect", ["importer", "MNX representation"],
            "Visibility is discarded; both shells print 2/2 and 4/4 on both staves."),
    feature("11b.staff-local-scope", b, times(b, (3,)), "Separate third-bar staff declarations keep their scope.", "incorrect", ["importer", "MNX representation"],
            "Both staff declarations collapse into one global 4/4. The current independent piano staves remain present."),
    feature("11b.visible-upper-meter", b, times(b, (3,), "1"), "The upper staff's third-bar 4/4 change is visible.", "correct", [],
            "The global 4/4 is printed on the upper staff; the simultaneous lower-staff print is separately incorrect."),
    feature("11b.piano-staff-context", b, [context(b, "m01/two-staves")], "The piano part keeps independent treble and bass staves.", "correct", [],
            "Current imported MNX has two staff tracks and both shells show treble/bass rows; this is item 22's landed fix."),
]
for fixture, prefix, expected_values in (
    (cc, "11c.complex", "5/8 and 9/4"),
    (cs, "11c.compound-simple", "5/8 and 9/4"),
    (dc, "11d.complex-multiple", "11/8 and 21/8"),
    (ds, "11d.compound-multiple", "11/8 and 21/8"),
    (ec, "11e.complex-mixed", "11/8"),
    (es, "11e.compound-mixed", "11/8"),
):
    features.extend([
        feature(prefix + ".total-duration", fixture, times(fixture),
                f"Equivalent numeric meter duration {expected_values} survives.", "correct", [],
                f"The imported exact total {expected_values} is visible in both shells; item 22 fixed the earlier truncation."),
        feature(prefix + ".grouped-spelling", fixture, times(fixture),
                "The source's additive groups and separate fraction terms remain visibly distinct.", "missing",
                ["importer", "MNX representation"],
                "Import warns that grouping is flattened to one numeric fraction; neither shell can print the source spelling."),
    ])
features.extend([
    feature("11f.numeric-duration", f, times(f), "3/8 and the 1/8+2/4 total of 5/8 retain exact duration.", "correct", [],
            "Both numeric totals survive in MNX and are visible."),
    feature("11f.inconsistent-cut-symbol", f, times(f, (1,)), "Choose a glyph for source cut on 3/8 despite semantic inconsistency.", "unresolved",
            ["source/reference ambiguity"], "The manifest explicitly says display is application-dependent. Import warns and prints numeric 3/8."),
    feature("11f.single-number-display", f, times(f, (2,)), "The second source meter uses a numerator-only display.", "missing",
            ["importer", "MNX representation"], "Single-number is warned and replaced by a 5/8 stacked fraction."),
    feature("11f.separate-fraction-spelling", f, times(f, (2,)), "The 1/8+2/4 expression remains visibly grouped.", "missing",
            ["importer", "MNX representation"], "The compound expression is flattened to 5/8."),
    feature("11g.numeric-duration", g, times(g), "3/8 and (3+2)/8 retain their durations.", "correct", [],
            "Both imported totals 3/8 and 5/8 are visibly distinct."),
    feature("11g.single-number-display", g, times(g), "Both bars show only their numerator parts.", "missing",
            ["importer", "MNX representation"], "Both single-number controls are warned and shown as stacked fractions."),
    feature("11g.additive-numerator", g, times(g, (2,)), "The second numerator retains 3+2 spelling.", "missing",
            ["importer", "MNX representation"], "The additive numerator becomes a plain 5."),
    feature("11h.unmetered-state", h, times(h), "The empty and X markers establish unmetered bars without metric underfill diagnostics.", "incorrect",
            ["importer", "MNX representation"], "Neither marker survives; layout applies a default 4/4 and reports metric underfills in the first, third and fourth bars."),
    feature("11h.explicit-X-symbol", h, times(h, (3,)), "The nonempty senza-misura X is visible according to an application-defined interpretation.", "missing",
            ["importer", "MNX representation"], "The source X is discarded and no corresponding mark appears; exact placement remains open."),
    feature("11h.full-measure-rest-context", h, [context(h, "m02/rest01")], "The dotted-half full-measure rest has its own source duration and measure flag.", "unresolved",
            ["not yet isolated"], "The full-measure rest is visible, but its duration and unmetered semantics need a separate rest-family comparison."),
    feature("11h.two-voice-context", h, [context(h, "m03-m04/two-voices")], "The two voices and eighth-note runs remain independently readable.", "unresolved",
            ["not yet isolated"], "Notes are visible in both bars; this meter slice does not settle voice identity or timing."),
    feature("11i.primary-meters", i, times(i), "All six primary meters print in source order.", "correct", [],
            "The six primary values survive in MNX and are visible in both shells."),
    feature("11i.alternate-meters", i, times(i), "Six alternate values, including 7/8+1/8, print beside the primaries.", "missing",
            ["importer", "MNX representation"], "All six alternate expressions are warned and absent."),
    feature("11i.relations-and-enclosures", i, times(i), "Parentheses, bracket, equals, hyphen, slash and space relations print in source order.", "missing",
            ["importer", "MNX representation"], "All six source relation/enclosure controls are discarded and absent."),
])
assert len({row["id"] for row in features}) == len(features)
assert set.union(*(set(row["variantIds"]) for row in features)) == variant_ids
render = []
for feat in features:
    for shell in indexes:
        row = next(r for r in indexes[shell]["fixtures"] if r["id"] == feat["fixture"])
        render.append({
            "featureId": feat["id"], "shell": shell, "view": "notation",
            "verdict": feat["verdict"], "cause": feat["cause"], "reason": feat["reason"],
            "observationEvidence": f"harness/fixtures/musicxml-meter-current-evidence/{shell}/{feat['fixture']}/observation.json",
            "documentEvidence": f"harness/fixtures/musicxml-meter-current-evidence/{shell}/{feat['fixture']}/document.mnx.json",
            "svgEvidence": f"harness/fixtures/musicxml-meter-current-evidence/{shell}/{feat['fixture']}/notation-0.svg",
            "screenshotEvidence": f"harness/fixtures/musicxml-meter-current-evidence/{shell}/{feat['fixture']}/notation-0-0.png",
            "diagnosticTitles": row["views"][0]["diagnosticTitles"],
        })
counts = Counter(row["verdict"] for row in render)
report = {
    "kind": "implementation-loop agent render assessment; not human verification",
    "applicationCommit": evidence["applicationCommit"], "corpusRevision": suite["revision"],
    "scope": "Twelve 11-series meter originals, source to current browser-imported MNX to complete Notation in both desktop shells",
    "fixtureCount": len(fixtures), "featureCount": len(features),
    "sourceTimeDeclarationCount": sum(len(f["sourceTimeDeclarations"]) for f in fixtures),
    "sourceVariantCount": len(variant_ids), "renderRowCount": len(render),
    "browser": "Chrome/153.0.8010.36", "viewport": indexes["workbench"]["viewport"],
    "viewPolicy": "No declared source strings; Notation only. Time signatures and clefs Show. Every score fits one viewport tile per shell.",
    "fixtures": fixtures,
    "features": [{k: v for k, v in feat.items() if k not in ("verdict", "cause", "reason")} for feat in features],
    "render": render, "verdictCounts": dict(sorted(counts.items())),
    "unresolvedCases": [
        {"featureId": "11a.inconsistent-first-symbol", "reason": "Source common 2/2 conflicts with manifest alla breve."},
        {"featureId": "11f.inconsistent-cut-symbol", "reason": "Source cut 3/8 is explicitly application-dependent."},
        {"featureId": "11h.full-measure-rest-context", "reason": "Rest duration and unmetered semantics need separate comparison."},
        {"featureId": "11h.two-voice-context", "reason": "Voice identity and timing need separate comparison."},
        {"featureId": "11h.explicit-X-symbol", "reason": "Exact interpretation and placement of X remain application-dependent; omission is a definite loss."},
    ],
    "deduplication": {
        "completed22": "Exact numeric totals, compatible common display and independent piano staves are credited to completed item 22. Grouping, hidden/local, alternate, single-number and unmetered controls remain its documented carrier/display deferrals; no new proposal is filed from these repeated observations.",
        "completed23": "Current Studio imported versions are editable after title repair. This render slice does not grant authoring, undo/redo or GP persistence passes.",
        "item19": "The old bounded Workbench meter command probe and later representable-range fix remain distinct from full feature-task and save-route assessment.",
    },
}
OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
print(f"{OUT.relative_to(ROOT)}: {len(fixtures)} fixtures, {len(features)} features, {len(variant_ids)} variants, {len(render)} rows, {dict(counts)}")
