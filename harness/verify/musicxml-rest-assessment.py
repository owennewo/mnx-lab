"""Rebuild the reviewed 02a–02f source/import inventory and render verdicts.

Run after musicxml-editor-capture.mjs in both shells. The verdict table is an
agent review of the retained captures, not an inference from successful import.
"""

import hashlib
import json
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SUITE = ROOT / "converters/fixtures/musicxml-suite"
EVIDENCE = ROOT / "harness/fixtures/musicxml-rest-evidence"
REPORT = ROOT / "harness/reports/musicxml-rest-assessment.json"
manifest = json.loads((SUITE / "manifest.json").read_text())
fixtures = [f for f in manifest["fixtures"] if f["id"][:3] in {"02a", "02b", "02c", "02d", "02e", "02f"}]


def ids(prefix, measure, note):
    if prefix == "02a":
        return (["02a.multimeasure-rest"] if measure == 1 else []) + (
            ["02a.short-rest-durations"] if measure in (4, 5) else []) + (
            ["02a.timed-full-bar-rest"] if measure == 6 else [])
    if prefix == "02b":
        return ["02b.default-rest-position"] if measure == 1 and note == 1 else ["02b.explicit-rest-position"]
    if prefix == "02c":
        return ["02c.multimeasure-ranges"] + (["02c.use-symbols"] if measure >= 32 else [])
    if prefix == "02d":
        return ["02d.meter-scaled-multimeasure-rests"] if measure < 10 else []
    if prefix == "02e":
        return ["02e.untyped-rest"] if measure == 1 and note == 2 else (
            ["02e.unstaffed-voice-note"] if measure == 2 and note == 2 else [])
    return (["02f.short-rest-durations"] if measure in (2, 4) else []) + (
        ["02f.explicit-rest-position"] if measure in (3, 4) else []) + ["02f.clef-context"]


# These are source-feature judgments after reviewing the complete original-file
# notation PNG/SVG and browser-imported MNX in BOTH shells at this commit.
# Variant-specific mixed outcomes are recorded below, not hidden by a feature pass.
FEATURES = {
    "02a.multimeasure-rest": ("The first two bars collapse to a numbered 2-bar rest; the third is an ordinary whole-bar rest.", "incorrect", ["importer"], "The score has three separate whole-rest bars; source <multiple-rest> 2 is absent from imported scores[].multimeasureRests. Published MNX and notation layout support collapsed ranges."),
    "02a.short-rest-durations": ("The plain and dotted ladders distinguish half through 1024th rests, including dotted 256th, 512th and 1024th symbols.", "partial", ["importer"], "Through 128th, written values and dots survive; all 256th/512th/1024th values become 128th, and their dots disappear. Both shells repeat 128th glyphs and show spurious bar-overfill badges. Published MNX and the engine name the original values."),
    "02a.timed-full-bar-rest": ("The final 3/2 bar has a dotted whole rest with measure=no, as a timed rest rather than a generic full-bar glyph.", "correct", [], "Imported whole+dots:1 survives; the last bar shows a dotted whole rest. MNX does not retain the measure=no source flag, but no separate visible distinction is requested beyond the dot."),
    "02b.default-rest-position": ("The first quarter rest uses the default staff position.", "correct", [], "The unpositioned source rest imports as rest:{} and appears at the default middle-staff position in both shells."),
    "02b.explicit-rest-position": ("Four quarter rests occupy E4, F5, A3 and C6 staff positions; the final full-measure rest is positioned at G4 in its C clef.", "incorrect", ["importer"], "Every imported rest is {}, without staffPosition. Five quarter glyphs sit on one line and the final rest uses the default full-bar position. The MusicXML display step/octave never reaches MNX although published rest.staffPosition and layout support it."),
    "02c.multimeasure-ranges": ("The 34 measures display five rest groups of 3, 15, 1, 12 and 3 bars, with appropriate counts.", "incorrect", ["importer"], "All 34 bars remain separate whole-rest bars, without numbered H-bars; no multimeasureRests ranges enter the score. The one-bar group is visually ordinary, but the four longer groups are lost."),
    "02c.use-symbols": ("The final 3-bar range uses the requested 1/2/4-bar rest-symbol style instead of a single H-bar.", "incorrect", ["importer", "MNX representation"], "The final three bars are ordinary separate whole rests. No range or use-symbols choice is imported; published multimeasureRests has duration/start/label but no style field."),
    "02d.meter-scaled-multimeasure-rests": ("Ranges of 2, 3, 2 and 2 bars collapse while 4/4, 3/4, 2/4 and 4/4 rest durations match their meters.", "partial", ["importer"], "Imported whole, dotted-half and half durations match the changing meters, and both shells show the meters after the Show preference. All four requested collapses and counts are lost."),
    "02e.untyped-rest": ("The voice-2 quarter rest without <type> occupies one beat on the lower staff.", "correct", [], "The importer derives quarter from duration/divisions, assigns staff 2, and both shells display it on the bass staff. The underfill badge flags the deliberately incomplete pickup rather than a missing rest."),
    "02e.unstaffed-voice-note": ("The voice-2 E3 whole note with no <staff> appears on the upper staff despite its low ledger position.", "correct", [], "The imported voice-2 sequence has no staff assignment; both shells draw E3 below the upper treble staff, exactly the source's stated default placement. This is judged separately from the untyped rest."),
    "02f.short-rest-durations": ("Both clef contexts distinguish the plain half-to-1024th rest ladder.", "partial", ["importer"], "The source's 256th, 512th and 1024th types become 128th in bars 2 and 4, with repeated glyphs and spurious overfill badges. The shorter types and both clefs survive."),
    "02f.explicit-rest-position": ("The treble-clef bar places the whole rest at G4 and its ladder from G4 through D4, including positions in spaces.", "incorrect", ["importer"], "All 12 explicit display-step/octave positions import as rest:{}; both shells put the ladder glyphs at their duration defaults. Staff-space choices never reach the renderer."),
    "02f.clef-context": ("The first ladder is under F clef and the positioned ladder under G clef.", "correct", [], "Imported F clef on line 4 then G clef on line 2 and the two visible clefs match the source. Rest-position loss is judged separately."),
}

rows = []
for fixture in fixtures:
    source = SUITE / fixture["path"]
    assert hashlib.sha256(source.read_bytes()).hexdigest() == fixture["sha256"]
    xml = ET.parse(source).getroot()
    measures = xml.findall("./part/measure")
    shells = {}
    for shell in ("workbench", "studio"):
        directory = EVIDENCE / shell / fixture["id"]
        document = json.loads((directory / "document.mnx.json").read_text())
        observation = json.loads((directory / "observation.json").read_text())
        assert not observation.get("importError") and not observation.get("captureError")
        assert [v["view"] for v in observation["views"]] == ["notation"]
        assert observation["displayOptions"]["timeSignatures"] == "show"
        assert observation["availableViews"] == ["notation"]
        assert observation["views"][0]["renderErrors"] == []
        assert observation["views"][0]["screenshots"]
        if shell == "studio":
            assert observation["editorBound"] and not observation["editingSuspended"]
        assert len(document["parts"][0]["measures"]) == len(measures)
        shells[shell] = (document, observation)
    assert shells["workbench"][0] == shells["studio"][0], fixture["id"]
    imported = shells["workbench"][0]
    variants = []
    for measure_no, measure in enumerate(measures, 1):
        source_notes = measure.findall("note")
        mnx_measure = imported["parts"][0]["measures"][measure_no - 1]
        mnx_events = [event for seq in mnx_measure.get("sequences", []) for event in seq.get("content", []) if "duration" in event]
        assert len(source_notes) == len(mnx_events), (fixture["id"], measure_no)
        for note_no, (note, event) in enumerate(zip(source_notes, mnx_events), 1):
            rest = note.find("rest")
            assert (rest is not None) == ("rest" in event)
            variants.append({
                "id": f"{fixture['id']}/m{measure_no:02}/n{note_no:02}",
                "featureIds": ids(fixture["id"][:3], measure_no, note_no),
                "source": {"measureNumber": measure.get("number"), "kind": "rest" if rest is not None else "note",
                    "duration": note.findtext("duration"), "type": note.findtext("type"), "dots": len(note.findall("dot")),
                    "staff": note.findtext("staff"), "voice": note.findtext("voice"),
                    "restAttributes": rest.attrib if rest is not None else None,
                    "displayStep": rest.findtext("display-step") if rest is not None else None,
                    "displayOctave": rest.findtext("display-octave") if rest is not None else None},
                "imported": {"duration": event["duration"], "rest": event.get("rest"),
                    "staff": next((seq.get("staff") for seq in mnx_measure.get("sequences", []) if event in seq.get("content", [])), None)},
            })
    ranges = []
    for measure_no, measure in enumerate(measures, 1):
        multiple = measure.find("./attributes/measure-style/multiple-rest")
        if multiple is not None:
            ranges.append({"id": f"{fixture['id']}/m{measure_no:02}/multi", "startMeasure": measure_no,
                "count": int(multiple.text), "useSymbols": multiple.get("use-symbols")})
    rows.append({"id": fixture["id"], "description": fixture["description"], "testClass": fixture["testClass"],
        "sourcePath": fixture["path"], "sourceSha256": fixture["sha256"], "sourceMeasures": len(measures),
        "sourceDeclaresStrings": bool(xml.findall(".//staff-tuning")), "variants": variants, "multiRestRanges": ranges,
        "importedScoreMultiRestRanges": imported.get("scores", [{}])[0].get("multimeasureRests", []),
        "warnings": shells["workbench"][1].get("warnings", []),
        "workbenchDocumentSha256": shells["workbench"][1]["importedDocumentSha256"],
        "studioDocumentSha256": shells["studio"][1]["importedDocumentSha256"]})

for fixture in rows:
    prefix = fixture["id"][:3]
    assert not fixture["sourceDeclaresStrings"] and not fixture["warnings"]
    assert fixture["workbenchDocumentSha256"] == fixture["studioDocumentSha256"]
    if prefix in ("02a", "02c", "02d"):
        assert not fixture["importedScoreMultiRestRanges"]
    if prefix in ("02a", "02f"):
        for variant in fixture["variants"]:
            if prefix + ".short-rest-durations" not in variant["featureIds"]:
                continue
            source, imported = variant["source"], variant["imported"]
            lost = source["type"] in ("256th", "512th", "1024th")
            assert imported["duration"]["base"] == ("128th" if lost else source["type"])
            assert imported["duration"].get("dots", 0) == (0 if lost else source["dots"])
    if prefix in ("02b", "02f"):
        assert all(variant["imported"]["rest"] == {} for variant in fixture["variants"]
            if prefix + ".explicit-rest-position" in variant["featureIds"])

feature_rows, render_rows, variant_dispositions = [], [], []
for feature_id, (expected, verdict, causes, reason) in FEATURES.items():
    fixture = next(row for row in rows if row["id"].startswith(feature_id[:3] + "-"))
    variants = [v["id"] for v in fixture["variants"] if feature_id in v["featureIds"]]
    if feature_id in ("02a.multimeasure-rest", "02c.multimeasure-ranges", "02c.use-symbols", "02d.meter-scaled-multimeasure-rests"):
        variants += [r["id"] for r in fixture["multiRestRanges"] if feature_id != "02c.use-symbols" or r["useSymbols"]]
    assert variants, feature_id
    feature_rows.append({"id": feature_id, "fixture": fixture["id"], "expected": expected,
        "variantIds": variants, "variantCount": len(variants), "sourceDescription": fixture["description"]})
    for shell in ("workbench", "studio"):
        obs = json.loads((EVIDENCE / shell / fixture["id"] / "observation.json").read_text())
        render_rows.append({"featureId": feature_id, "shell": shell, "view": "notation", "verdict": verdict,
            "cause": causes, "reason": reason,
            "importEvidence": "harness/reports/musicxml-rest-assessment.json",
            "captureEvidence": f"harness/fixtures/musicxml-rest-evidence/{shell}/{fixture['id']}/observation.json",
            "diagnosticTitles": obs["views"][0]["diagnosticTitles"]})

# The feature verdicts for the two ladders are partial. Pin the exact boundary
# so a later reader cannot promote the whole source from the surviving values.
for fixture in rows:
    if fixture["id"][:3] not in ("02a", "02f"):
        continue
    feature_id = fixture["id"][:3] + ".short-rest-durations"
    for variant in fixture["variants"]:
        if feature_id not in variant["featureIds"]:
            continue
        lost = variant["source"]["type"] in ("256th", "512th", "1024th")
        variant_dispositions.append({"featureId": feature_id, "variantId": variant["id"],
            "shells": ["workbench", "studio"], "view": "notation",
            "verdict": "incorrect" if lost else "correct",
            "reason": "Imported as undotted 128th with repeated glyph and false overfill" if lost else "Written value and dot match the source"})

result = {"kind": "implementation-loop agent render assessment; not human verification",
    "applicationCommit": json.loads((EVIDENCE / "workbench/index.json").read_text())["applicationCommit"],
    "corpusRevision": manifest["revision"], "scope": "Six 02a–02f original rest fixtures, source → browser-imported MNX → complete notation in both shells",
    "fixtureCount": len(rows), "featureCount": len(feature_rows),
    "sourceVariantCount": sum(len(f["variants"]) + len(f["multiRestRanges"]) for f in rows),
    "browser": json.loads((EVIDENCE / "workbench/index.json").read_text())["browser"]["product"],
    "viewport": {"width": 1440, "height": 1000, "deviceScaleFactor": 1},
    "viewPolicy": "No source strings: Notation only in both shells; Tab/Both inapplicable. Time signatures explicitly Show. Full scroll tiled.",
    "fixtures": rows, "features": feature_rows, "render": render_rows,
    "renderVariantDispositions": variant_dispositions,
    "counts": {"renderRows": len(render_rows), "renderVerdicts": dict(Counter(row["verdict"] for row in render_rows))},
    "deduplication": {"22": "Meter import/display fixes already landed; these sources retain exact 4/4, 3/4 and 2/4 meters. No duplicate meter proposal.",
        "23": "Studio title promotion already landed; all six XML versions were made current with bound desktop editors.",
        "24": "Accidental fidelity and GP losses are separate. This slice proposes only rest-family import/render fidelity."}}
REPORT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
print(f"{len(rows)} fixtures, {len(feature_rows)} features, {len(render_rows)} render rows → {REPORT}")
