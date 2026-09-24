#!/usr/bin/env python3
"""Recheck source keys, current browser imports/captures, and agent render dispositions."""
from __future__ import annotations

from fractions import Fraction
from hashlib import sha256
import json
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
SUITE = ROOT / "converters/fixtures/musicxml-suite"
EVIDENCE = ROOT / "harness/fixtures/musicxml-key-evidence"
OUT = ROOT / "harness/reports/musicxml-key-assessment.json"
IDS = (
    "13a-KeySignatures",
    "13b-KeySignatures-ChurchModes",
    "13c-KeySignatures-NonTraditional",
    "13d-KeySignatures-Microtones",
    "13e-KeySignatures-Cancel",
    "13e-KeySignatures-MidMeasure-Change",
    "13f-KeySignatures-Visible",
)
suite = json.loads((SUITE / "manifest.json").read_text())
listed = {f["id"]: f for f in suite["fixtures"]}
evidence = json.loads((EVIDENCE / "manifest.json").read_text())
for file in evidence["files"]:
    assert sha256((EVIDENCE / file["path"]).read_bytes()).hexdigest() == file["sha256"]
indexes = {shell: json.loads((EVIDENCE / shell / "index.json").read_text())
           for shell in ("workbench", "studio")}
assert all(x["applicationCommit"] == evidence["applicationCommit"] for x in indexes.values())
assert all(x["corpusRevision"] == suite["revision"] for x in indexes.values())
assert all(x["browser"]["product"] == "Chrome/153.0.8010.36" for x in indexes.values())
assert all(x["viewport"] == {"width": 1440, "height": 1000, "deviceScaleFactor": 1}
           for x in indexes.values())

def source_pitch(note: ET.Element) -> dict:
    pitch = note.find("pitch")
    if pitch is None:
        return {"rest": True}
    result = {"step": pitch.findtext("step"), "octave": int(pitch.findtext("octave"))}
    if pitch.findtext("alter") is not None:
        result["alter"] = int(pitch.findtext("alter"))
    return result

def key_info(key: ET.Element) -> dict:
    cancel = key.find("cancel")
    alterations = []
    steps = key.findall("key-step")
    alters = key.findall("key-alter")
    accidentals = key.findall("key-accidental")
    assert len(steps) == len(alters)
    assert not accidentals or len(accidentals) == len(steps)
    for i, (step, alter) in enumerate(zip(steps, alters), 1):
        alterations.append({"index": i, "step": step.text,
                            "alter": alter.text,
                            "accidental": accidentals[i - 1].text if accidentals else None})
    return {"fifths": int(key.findtext("fifths")) if key.findtext("fifths") is not None else None,
            "mode": key.findtext("mode"),
            "printObject": key.get("print-object", "yes"),
            "cancel": None if cancel is None else
                      {"value": int(cancel.text), "location": cancel.get("location", "left")},
            "alterations": alterations,
            "octaves": [{"number": int(x.get("number")), "octave": int(x.text)}
                        for x in key.findall("key-octave")]}

fixtures = []
all_variants = set()
for fixture_id in IDS:
    entry = listed[fixture_id]
    original = SUITE / entry["path"]
    assert sha256(original.read_bytes()).hexdigest() == entry["sha256"]
    xml = ET.parse(original).getroot()
    assert not xml.findall(".//staff-tuning") and not xml.findall(".//technical/string")
    measures = xml.findall("part/measure")
    docs = {shell: json.loads((EVIDENCE / shell / fixture_id / "document.mnx.json").read_text())
            for shell in indexes}
    assert docs["workbench"] == docs["studio"]
    mnx = docs["workbench"]
    assert len(mnx["parts"]) == 1
    assert len(mnx["global"]["measures"]) == len(measures)
    assert len(mnx["parts"][0]["measures"]) == len(measures)
    key_rows, note_rows = [], []
    divisions = 1
    for measure_no, (measure, global_measure, part_measure) in enumerate(
            zip(measures, mnx["global"]["measures"], mnx["parts"][0]["measures"]), 1):
        at = Fraction()
        key_index = 0
        note_index = 0
        imported_notes = [n for sequence in part_measure.get("sequences", [])
                          for event in sequence.get("content", [])
                          for n in event.get("notes", [])]
        for child in measure:
            if child.tag == "attributes":
                if child.findtext("divisions") is not None:
                    divisions = int(child.findtext("divisions"))
                for key in child.findall("key"):
                    key_index += 1
                    base = f"{fixture_id}/m{measure_no:02d}/k{key_index:02d}"
                    source = key_info(key)
                    entries = []
                    for alt in source["alterations"]:
                        variant = f"{base}/a{alt['index']:02d}"
                        entries.append({"id": variant, **alt})
                        all_variants.add(variant)
                    octaves = []
                    for oct_index, octave in enumerate(source["octaves"], 1):
                        variant = f"{base}/o{oct_index:02d}"
                        octaves.append({"id": variant, **octave})
                        all_variants.add(variant)
                    cancellation = None
                    if source["cancel"] is not None:
                        cancellation = {"id": f"{base}/cancel", **source["cancel"]}
                        all_variants.add(cancellation["id"])
                    key_rows.append({"id": base, "measure": measure_no,
                                     "onsetQuarter": [at.numerator, at.denominator],
                                     "source": source, "alterationVariants": entries,
                                     "octaveVariants": octaves, "cancelVariant": cancellation,
                                     "importedGlobalKey": global_measure.get("key")})
                    all_variants.add(base)
            elif child.tag == "note":
                note_index += 1
                variant = f"{fixture_id}/m{measure_no:02d}/n{note_index:02d}"
                assert note_index <= len(imported_notes), (fixture_id, measure_no)
                note_rows.append({"id": variant, "measure": measure_no,
                                  "onsetQuarter": [at.numerator, at.denominator],
                                  "sourcePitch": source_pitch(child),
                                  "importedPitch": imported_notes[note_index - 1].get("pitch"),
                                  "type": child.findtext("type"),
                                  "lyric": child.findtext("lyric/text")})
                all_variants.add(variant)
                if child.find("chord") is None and child.find("grace") is None:
                    at += Fraction(int(child.findtext("duration")), divisions)
            elif child.tag == "forward":
                at += Fraction(int(child.findtext("duration")), divisions)
            elif child.tag == "backup":
                at -= Fraction(int(child.findtext("duration")), divisions)
        assert note_index == len(imported_notes)
    assert all(note["sourcePitch"] == note["importedPitch"] for note in note_rows)
    for shell, index in indexes.items():
        row = next(f for f in index["fixtures"] if f["id"] == fixture_id)
        assert not row.get("importError") and not row.get("captureError")
        assert row["availableViews"] == ["notation"] and row["editorBound"] is True
        assert row["displayOptions"]["timeSignatures"] == "show"
        assert row["displayOptions"]["clefs"] == "show"
        view = row["views"]
        assert len(view) == 1 and view[0]["view"] == "notation"
        assert view[0]["staffScale"] == 1 and view[0]["densityH"] == 2
        assert view[0]["renderErrors"] == [] and view[0]["svgCount"] == 1
        assert view[0]["screenshots"]
        if shell == "studio":
            assert row["editingSuspended"] is False and row["viewingOriginal"] is False
        if fixture_id == IDS[0]:
            assert len(view[0]["screenshots"]) == (2 if shell == "workbench" else 1)
        else:
            assert len(view[0]["screenshots"]) == 1
        if fixture_id == IDS[0]:
            assert len(row["warnings"]) == 1 and "incompatible time symbol" in row["warnings"][0]
        else:
            assert row["warnings"] == []
    fixtures.append({"id": fixture_id, "sourcePath": entry["path"],
                     "sourceSha256": entry["sha256"], "testClass": entry["testClass"],
                     "description": entry["description"], "sourceMeasures": len(measures),
                     "sourceDeclaresStrings": False, "keys": key_rows, "notes": note_rows})
by_id = {f["id"]: f for f in fixtures}
assert [len(f["keys"]) for f in fixtures] == [46, 10, 2, 1, 5, 4, 2]
assert [len(f["notes"]) for f in fixtures] == [46, 10, 2, 1, 5, 4, 5]
assert len(all_variants) == 167

# Each selection is derived from source contexts above. IDs survive recaptures and UI changes.
def keys(fixture: str, predicate=lambda key: True) -> list[str]:
    return [key["id"] for key in by_id[fixture]["keys"] if predicate(key)]

def notes(fixture: str, predicate=lambda note: True) -> list[str]:
    return [note["id"] for note in by_id[fixture]["notes"] if predicate(note)]

def additions(fixture: str, name: str) -> list[str]:
    return [variant["id"] for key in by_id[fixture]["keys"] for variant in key[name]]

def cancels(fixture: str) -> list[str]:
    return [key["cancelVariant"]["id"] for key in by_id[fixture]["keys"]
            if key["cancelVariant"] is not None]

def feature(feature_id: str, fixture: str, variants: list[str], expected: str,
            verdict: str, causes: list[str], reason: str) -> dict:
    assert variants and all(v in all_variants for v in variants)
    return {"id": feature_id, "fixture": fixture, "variantIds": variants,
            "variantCount": len(variants), "sourceDescription": listed[fixture]["description"],
            "expected": expected, "verdict": verdict, "cause": causes, "reason": reason}

a, b, c, d, e, mid, f = IDS
features = [
    feature("13a.conventional-fifths", a,
            keys(a, lambda k: abs(k["source"]["fifths"]) <= 7),
            "All -7 through +7 traditional fifth counts show their complete key-signature ink in both major and minor bars.",
            "correct", [], "All 30 conventional source values survive as MNX fifths and their complete flat/sharp or zero-key display is visible."),
    feature("13a.extreme-fifths", a,
            keys(a, lambda k: abs(k["source"]["fifths"]) > 7),
            "All -11 through -8 and +8 through +11 fifth counts remain visibly distinct and complete.",
            "incorrect", ["layout/SVG engine"], "All 16 source values survive in MNX but layout draws no more than seven key symbols. Each extreme pair is visually reduced to its seven-sign counterpart."),
    feature("13a.major-minor-values", a, keys(a),
            "Major/minor mode metadata is retained for later semantic and authoring use; the mode itself has no separate key-signature glyph.",
            "not applicable", ["importer"], "Both source modes use the same visible fifths. MNX discards mode, which is a semantic import loss, not an additional visible rendering pass."),
    feature("13b.two-sharp-ink", b, keys(b),
            "All ten mode changes share the same two-sharp visible signature.",
            "correct", [], "The two-sharp signature and ten G4 notes remain visible; a mode-only change does not request different accidental ink."),
    feature("13b.mode-values", b, keys(b),
            "All ten named modes remain semantically identifiable, with no distinct mode glyph.",
            "not applicable", ["importer"], "MNX retains only the first two-sharp value and drops all mode values. Mode is nonvisual here; the lyrics provide visible labels separately."),
    feature("13b.mode-labels", b, notes(b),
            "The source lyric under each note names its mode.",
            "correct", [], "All ten mode-name lyrics are visible beneath their respective G4 notes in both shells."),
    feature("13c.nontraditional-alterations", c, keys(c) + additions(c, "alterationVariants"),
            "The three-component and five-component signatures show their ordered named alterations.",
            "missing", ["importer", "MNX representation"], "Neither source key is represented in MNX; both shells draw no key symbols and issue no warning."),
    feature("13c.explicit-key-octaves", c, additions(c, "octaveVariants"),
            "The second key locates its five alterations in explicitly numbered octaves 2 through 6.",
            "missing", ["importer", "MNX representation"], "All five key-octave controls disappear with the nontraditional key; the corresponding visual heights cannot be recovered."),
    feature("13d.microtonal-alterations", d, keys(d) + additions(d, "alterationVariants"),
            "All seven fractional and integer key alterations are visible, or unsupported ones are explicitly diagnosed.",
            "missing", ["importer", "MNX representation"], "The seven-component signature disappears entirely, including four fractional values, with no import warning."),
    feature("13e.cancel.new-fifths", e, keys(e),
            "The five new traditional fifth counts are shown at their bars.",
            "correct", [], "All five fifth counts survive in MNX and their new flat/sharp signatures appear in both shells."),
    feature("13e.cancel.explicit-natural-placement", e, cancels(e),
            "Four cancellation values show naturals left, right or before the barline as stated, including the deliberately mismatched final value 4.",
            "incorrect", ["importer", "MNX representation"], "The importer drops every cancel value/location. The new signatures appear without the source-requested natural runs."),
    feature("13e.midmeasure.initial-key", mid, keys(mid, lambda k: k["onsetQuarter"] == [0, 1]),
            "The opening two-sharp signature appears before the first note.",
            "correct", [], "The first key survives in MNX and is shown in both shells."),
    feature("13e.midmeasure.later-keys", mid, keys(mid, lambda k: k["onsetQuarter"] != [0, 1]),
            "Two flats, zero, then seven sharps appear at quarters 2, 3 and 4 of the same bar.",
            "missing", ["importer", "MNX representation"], "The three later source key declarations disappear; the opening two sharps remain throughout, despite visible lyric labels naming the intended changes."),
    feature("13f.hidden-key-ink", f, keys(f, lambda k: k["source"]["printObject"] == "no"),
            "The second bar's four-flat key takes effect but produces no printed key symbols.",
            "incorrect", ["importer", "MNX representation"], "The hidden flag is dropped; both shells visibly print four flats at bar 2."),
    feature("13f.hidden-key-note-context", f, notes(f, lambda n: n["measure"] == 2),
            "D-flat, E-flat, A-flat and B-flat retain their pitches and need no individual flat signs under the effective hidden key.",
            "correct", [], "All four altered pitches survive in MNX and no redundant note accidentals appear; this does not excuse the visible hidden key."),
]
assert len({x["id"] for x in features}) == len(features)
render = []
variant_dispositions = []
for feat in features:
    for shell in indexes:
        row = next(r for r in indexes[shell]["fixtures"] if r["id"] == feat["fixture"])
        render.append({"featureId": feat["id"], "shell": shell, "view": "notation",
                       "verdict": feat["verdict"], "cause": feat["cause"],
                       "reason": feat["reason"],
                       "captureEvidence": f"harness/fixtures/musicxml-key-evidence/{shell}/{feat['fixture']}/observation.json",
                       "diagnosticTitles": row["views"][0]["diagnosticTitles"]})
    for variant in feat["variantIds"]:
        variant_dispositions.append({"featureId": feat["id"], "variantId": variant,
                                     "shells": ["workbench", "studio"], "view": "notation",
                                     "verdict": feat["verdict"], "reason": feat["reason"]})
assert len(features) == 15 and len(render) == 30
report = {
    "kind": "implementation-loop agent render assessment; not human verification",
    "applicationCommit": evidence["applicationCommit"], "corpusRevision": suite["revision"],
    "scope": "Seven 13-series key-signature originals, source to current browser-imported MNX to complete Notation in both shells",
    "fixtureCount": len(fixtures), "featureCount": len(features), "sourceKeyCount": 70,
    "sourceNoteCount": 73, "sourceVariantCount": len(all_variants),
    "browser": indexes["workbench"]["browser"]["product"],
    "viewport": indexes["workbench"]["viewport"],
    "viewPolicy": "No source strings; Notation only. Clefs and time signatures Show. Workbench 13a has two overlapping scroll tiles; all other scores fit one tile.",
    "fixtures": fixtures, "features": [{k: v for k, v in feat.items()
                                      if k not in ("verdict", "cause", "reason")} for feat in features],
    "render": render, "renderVariantDispositions": variant_dispositions,
    "unresolvedCases": [
        {"id": "13a.extreme-fifths/exact-glyph-policy", "scope": "Precise >7 accidental glyph and position design",
         "reason": "The source specifies fifth counts through +/-11, and truncation to seven is wrong. This review does not choose the exact double-accidental engraving sequence."},
        {"id": "13d.microtonal-alterations/accidental-glyphs", "scope": "Exact microtonal signature glyph selection",
         "reason": "The source supplies key-alter fractions but no key-accidental overrides. Missing all seven symbols is a definite loss; exact glyph selection needs a carrier and reference policy."}
    ],
    "counts": {"renderRows": len(render),
               "verdicts": {v: sum(row["verdict"] == v for row in render)
                            for v in ("correct", "incorrect", "missing", "not applicable")}},
    "deduplication": {
        "completed22": "Its fractional note-pitch diagnostics and ordinary clef/meter repairs do not preserve fractional KEY alterations, extreme fifth engraving or hidden/positioned keys.",
        "completed23": "Studio title workflow succeeds; no edit or GP persistence claim follows.",
        "proposed28": "Bounded follow-up owns traditional extreme fifths, explicit cancel/visibility losses, midmeasure diagnostics, and the carrier decision/diagnostic for nontraditional keys."
    }
}
OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
print(f"{OUT.relative_to(ROOT)}: {len(fixtures)} fixtures, {len(features)} features, {len(all_variants)} variants, {len(render)} rows")
