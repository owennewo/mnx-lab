#!/usr/bin/env python3
"""Recheck the pinned clef sources and retained real-browser evidence; write agent verdicts."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
SUITE = ROOT / "converters/fixtures/musicxml-suite"
EVIDENCE = ROOT / "harness/fixtures/musicxml-clef-review-evidence"
OUT = ROOT / "harness/reports/musicxml-clef-assessment.json"
IDS = ("12a-Clefs", "12b-Clefs-NoKeyOrClef")
manifest = json.loads((SUITE / "manifest.json").read_text())
listed = {f["id"]: f for f in manifest["fixtures"]}
capture_manifest = json.loads((EVIDENCE / "manifest.json").read_text())
for item in capture_manifest["files"]:
    file = EVIDENCE / item["path"]
    assert hashlib.sha256(file.read_bytes()).hexdigest() == item["sha256"], file

indexes = {shell: json.loads((EVIDENCE / shell / "index.json").read_text())
           for shell in ("workbench", "studio")}
assert all(index["applicationCommit"] == capture_manifest["applicationCommit"]
           for index in indexes.values())
assert all(index["corpusRevision"] == manifest["revision"] for index in indexes.values())
assert all(index["browser"]["product"] == "Chrome/153.0.8010.36" for index in indexes.values())
assert all(index["viewport"] == {"width": 1440, "height": 1000, "deviceScaleFactor": 1}
           for index in indexes.values())

FEATURES = [
    ("12a.ordinary-clef-lines", "12a-Clefs", [1, 2, 3, 4, 8, 9, 10, 11, 12, 17],
     "G, C and F clefs use the stated staff line; C4 appears at the corresponding height.",
     "correct", [], "All ten ordinary line variants retain their sign and exact MNX staffPosition, and the complete captured scores show the corresponding clefs and C4 noteheads."),
    ("12a.octave-clefs", "12a-Clefs", [6, 7, 13, 14],
     "G2/F4 clefs carry -1 or +1 octave figures and place sounding C4 at the shifted written height.",
     "incorrect", ["importer"], "All four octave changes vanish before MNX; ordinary clef glyphs and unshifted C4 heights are visible. Published MNX clef.octave and the existing renderer support octave clefs."),
    ("12a.percussion-clef", "12a-Clefs", [5],
     "Show the percussion sign while keeping its pitched C4 event local and diagnosing any unsupported placement.",
     "partial", ["MNX representation", "layout/SVG engine"], "The unsupported sign is retained with a source-located warning. A question-mark clef and note placeholder replace the percussion glyph and pitched placement; the rest of the score remains visible."),
    ("12a.tab-clef-without-strings", "12a-Clefs", [15],
     "Represent or explicitly diagnose the source TAB sign. No strings are declared, so a tablature note position is not inferred.",
     "incorrect", ["importer", "MNX representation"], "The importer silently omits TAB, the prior F clef persists visually and C4 is seated under it. Neither shell offers Tab/Both because source strings are unknown."),
    ("12a.none-clef", "12a-Clefs", [16],
     "The deprecated none sign draws no clef; MusicXML specifies treble placement for its notes.",
     "incorrect", ["MNX representation", "layout/SVG engine"], "The importer warns and retains none, but both shells show question marks for clef and C4 instead of a blank clef position and treble-height C4."),
    ("12b.implicit-treble-and-key", "12b-Clefs-NoKeyOrClef", [1, 2],
     "With no key or clef element, display the two C4 whole notes using the default treble clef and no key signature.",
     "correct", [], "Source and MNX both omit key and clef declarations. Both shells show a first-system treble clef, two C4 whole notes and no key-signature accidentals."),
    ("12b.explicit-four-four", "12b-Clefs-NoKeyOrClef", [1],
     "The stated 4/4 meter appears at the first bar when Time signatures is Show.",
     "correct", [], "The imported global meter is 4/4 and the first-system 4/4 mark is visible in both shells."),
]
features = []
fixtures = []
render = []
variant_dispositions = []
unresolved = [
    {"id": "12a-Clefs/m05/percussion-pitch-placement", "featureId": "12a.percussion-clef",
     "reason": "The source gives pitched C4 under a percussion clef without a kit or display-step. The missing sign is clear; a unique note height is not established."},
    {"id": "12a-Clefs/m15/tab-pitch-placement", "featureId": "12a.tab-clef-without-strings",
     "reason": "The source gives a TAB sign and C4 but no string declarations. The silently omitted sign is clear; an intended fret/string position is not."},
]
for fixture_id in IDS:
    entry = listed[fixture_id]
    source = SUITE / entry["path"]
    assert hashlib.sha256(source.read_bytes()).hexdigest() == entry["sha256"]
    root = ET.parse(source).getroot()
    source_measures = root.findall("part/measure")
    assert not root.findall(".//staff-tuning") and not root.findall(".//technical/string")
    docs = {shell: json.loads((EVIDENCE / shell / fixture_id / "document.mnx.json").read_text())
            for shell in indexes}
    assert docs["workbench"] == docs["studio"]
    doc = docs["workbench"]
    assert len(doc["parts"]) == 1
    imported_measures = doc["parts"][0]["measures"]
    assert len(source_measures) == len(imported_measures)
    assert len(doc["global"]["measures"]) == len(source_measures)
    variants = []
    for number, (source_measure, imported) in enumerate(zip(source_measures, imported_measures), 1):
        note = source_measure.find("note")
        assert note is not None and len(source_measure.findall("note")) == 1
        assert (note.findtext("pitch/step"), note.findtext("pitch/octave"), note.findtext("type")) == ("C", "4", "whole")
        imported_note = imported["sequences"][0]["content"][0]["notes"][0]
        assert imported_note["pitch"] == {"step": "C", "octave": 4}
        assert imported["sequences"][0]["content"][0]["duration"] == {"base": "whole"}
        source_clef = source_measure.find("attributes/clef")
        source_info = None if source_clef is None else {
            "sign": source_clef.findtext("sign"),
            "line": int(source_clef.findtext("line")) if source_clef.findtext("line") else None,
            "octaveChange": int(source_clef.findtext("clef-octave-change"))
                            if source_clef.findtext("clef-octave-change") else None,
        }
        imported_clefs = imported.get("clefs", [])
        assert len(imported_clefs) <= 1
        imported_info = imported_clefs[0]["clef"] if imported_clefs else None
        if fixture_id == "12a-Clefs":
            assert source_info is not None
            if source_info["sign"] == "TAB":
                assert imported_info is None
            else:
                assert imported_info is not None and imported_info["sign"] == source_info["sign"]
                if source_info["line"] is not None:
                    assert imported_info["staffPosition"] == 2 * source_info["line"] - 6
                if source_info["octaveChange"] is not None:
                    assert "octave" not in imported_info
        else:
            assert source_info is None and imported_info is None
            assert source_measure.find("attributes/key") is None
            assert "key" not in doc["global"]["measures"][number - 1]
        feature_ids = [fid for fid, owner, numbers, *_ in FEATURES
                       if owner == fixture_id and number in numbers]
        variant_id = f"{fixture_id}/m{number:02d}/clef-context"
        variants.append({"id": variant_id, "featureIds": feature_ids,
                         "source": {"measureNumber": source_measure.get("number"), "clef": source_info,
                                    "note": "C4 whole", "keyPresent": source_measure.find("attributes/key") is not None,
                                    "time": [source_measure.findtext("attributes/time/beats"),
                                             source_measure.findtext("attributes/time/beat-type")]
                                            if source_measure.find("attributes/time") is not None else None},
                         "imported": {"clef": imported_info, "note": imported_note["pitch"],
                                      "global": doc["global"]["measures"][number - 1]}})
    fixtures.append({"id": fixture_id, "sourcePath": entry["path"], "sourceSha256": entry["sha256"],
                     "description": entry["description"], "testClass": entry["testClass"],
                     "sourceMeasures": len(source_measures), "sourceDeclaresStrings": False,
                     "variants": variants})
    for shell, index in indexes.items():
        row = next(r for r in index["fixtures"] if r["id"] == fixture_id)
        view = row["views"]
        assert row.get("importError") is None and row.get("captureError") is None
        assert row["availableViews"] == ["notation"] and row["editorBound"] is True
        assert row["displayOptions"]["clefs"] == "show"
        assert row["displayOptions"]["timeSignatures"] == "show"
        assert len(view) == 1 and view[0]["view"] == "notation" and view[0]["renderErrors"] == []
        assert view[0]["staffScale"] == 1 and view[0]["densityH"] == 2
        assert view[0]["svgCount"] == 1 and view[0]["scrollHeight"] <= view[0]["clientHeight"] + 1
        assert len(view[0]["screenshots"]) == 1
        if shell == "studio":
            assert row["editingSuspended"] is False and row["viewingOriginal"] is False
        if fixture_id == "12a-Clefs":
            assert len(row["warnings"]) == 2
            assert "percussion" in row["warnings"][0] and "none" in row["warnings"][1]
            assert len(view[0]["diagnosticTitles"]) == 4
        else:
            assert row["warnings"] == [] and view[0]["diagnosticTitles"] == []
for fid, fixture_id, numbers, expected, verdict, causes, reason in FEATURES:
    feature_variants = [v["id"] for f in fixtures if f["id"] == fixture_id
                        for v in f["variants"] if int(v["source"]["measureNumber"]) in numbers]
    features.append({"id": fid, "fixture": fixture_id, "sourceDescription": listed[fixture_id]["description"],
                     "expected": expected, "variantIds": feature_variants, "variantCount": len(feature_variants)})
    for shell in indexes:
        capture = f"harness/fixtures/musicxml-clef-review-evidence/{shell}/{fixture_id}/observation.json"
        render.append({"featureId": fid, "shell": shell, "view": "notation", "verdict": verdict,
                       "cause": causes, "reason": reason, "captureEvidence": capture,
                       "sourceImportEvidence": "harness/reports/musicxml-clef-assessment.json"})
    for variant_id in feature_variants:
        variant_dispositions.append({"featureId": fid, "variantId": variant_id,
                                     "shells": ["workbench", "studio"], "view": "notation",
                                     "verdict": verdict, "reason": reason})
assert len({f["id"] for f in features}) == len(features)
assert len({v["id"] for f in fixtures for v in f["variants"]}) == 19
assert len(render) == 2 * len(features)
assert sum(1 for r in render if r["verdict"] == "incorrect") == 6
report = {
    "kind": "implementation-loop agent render assessment; not human verification",
    "applicationCommit": capture_manifest["applicationCommit"],
    "corpusRevision": manifest["revision"],
    "scope": "Two 12-series clef originals, source to browser-imported MNX to complete Notation in both shells",
    "fixtureCount": 2, "featureCount": len(features), "sourceVariantCount": 19,
    "browser": indexes["workbench"]["browser"]["product"],
    "viewport": indexes["workbench"]["viewport"],
    "viewPolicy": "No source strings; Notation only. Clefs and time signatures explicitly Show. Complete score tiles reviewed.",
    "fixtures": fixtures, "features": features, "render": render,
    "renderVariantDispositions": variant_dispositions, "unresolvedCases": unresolved,
    "counts": {"verdicts": {verdict: sum(r["verdict"] == verdict for r in render)
                            for verdict in ("correct", "partial", "incorrect")},
               "renderRows": len(render)},
    "deduplication": {
        "completed22": "Ordinary clef coordinates and local unsupported-clef containment already landed; the percussion/none placeholders are known containment, not a new claim of complete glyph support.",
        "completed23": "Untitled Studio XML promotion works; no title or save-route conclusion follows from this render-only review.",
        "proposed27": "Four lost octave clefs and the silent TAB omission are newly isolated import/representation gaps; retain the none/percussion residuals as known item-22 scope."
    }
}
OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
print(f"{OUT.relative_to(ROOT)}: {len(fixtures)} fixtures, {len(features)} features, 19 source contexts, {len(render)} render rows")
