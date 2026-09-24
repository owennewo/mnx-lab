#!/usr/bin/env python3
"""Verify 14a source/import/browser evidence and emit agent render dispositions."""
from __future__ import annotations

from fractions import Fraction
from hashlib import sha256
import json
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
SUITE = ROOT / "converters/fixtures/musicxml-suite"
EVIDENCE = ROOT / "harness/fixtures/musicxml-staff-lines-evidence"
OUT = ROOT / "harness/reports/musicxml-staff-lines-assessment.json"
ID = "14a-StaffDetails-LineChanges"
suite = json.loads((SUITE / "manifest.json").read_text())
entry = next(f for f in suite["fixtures"] if f["id"] == ID)
source_path = SUITE / entry["path"]
assert sha256(source_path.read_bytes()).hexdigest() == entry["sha256"]
assert not ET.parse(source_path).getroot().findall(".//staff-tuning")
assert not ET.parse(source_path).getroot().findall(".//technical/string")
evidence = json.loads((EVIDENCE / "manifest.json").read_text())
for file in evidence["files"]:
    assert sha256((EVIDENCE / file["path"]).read_bytes()).hexdigest() == file["sha256"]
indexes = {shell: json.loads((EVIDENCE / shell / "index.json").read_text())
           for shell in ("workbench", "studio")}
docs = {shell: json.loads((EVIDENCE / shell / ID / "document.mnx.json").read_text())
        for shell in indexes}
assert docs["workbench"] == docs["studio"]
mnx = docs["workbench"]
assert len(mnx["parts"]) == 2
assert all(len(p["measures"]) == 4 for p in mnx["parts"])
assert all("staves" not in p and "_x" not in p for p in mnx["parts"])
source = ET.parse(source_path).getroot()
controls = []
notes = []
variant_ids = set()
for part_no, part in enumerate(source.findall("part"), 1):
    divisions = 1
    for measure_no, (measure, imported_measure) in enumerate(
            zip(part.findall("measure"), mnx["parts"][part_no - 1]["measures"]), 1):
        at = Fraction()
        source_note_index = 0
        imported_at = Fraction()
        detail_index = 0
        imported_events = [event for seq in imported_measure.get("sequences", [])
                           for event in seq.get("content", []) if event.get("notes")]
        for child in measure:
            if child.tag == "attributes":
                if child.findtext("divisions") is not None:
                    divisions = int(child.findtext("divisions"))
                for staff in child.findall("staff-details"):
                    detail_index += 1
                    variant = f"{ID}/p{part_no:02d}/m{measure_no:02d}/sd{detail_index:02d}"
                    assert variant not in variant_ids
                    variant_ids.add(variant)
                    lines = []
                    for line_index, line in enumerate(staff.findall("line-detail"), 1):
                        line_id = f"{variant}/ld{line_index:02d}"
                        variant_ids.add(line_id)
                        lines.append({"id": line_id, "line": int(line.get("line")),
                                      "printObject": line.get("print-object", "yes"),
                                      "lineType": line.get("line-type")})
                    controls.append({"id": variant, "part": part_no, "measure": measure_no,
                                     "onsetQuarter": [at.numerator, at.denominator],
                                     "staffLines": int(staff.findtext("staff-lines")),
                                     "staffNumber": staff.get("number", "1"),
                                     "lineDetails": lines,
                                     "importedStaffConfiguration": None})
            elif child.tag == "note":
                source_note_index += 1
                variant = f"{ID}/p{part_no:02d}/m{measure_no:02d}/n{source_note_index:02d}"
                assert variant not in variant_ids
                variant_ids.add(variant)
                imported_event = imported_events[source_note_index - 1]
                pitch = child.find("pitch")
                assert pitch is not None
                source_pitch = {"step": pitch.findtext("step"), "octave": int(pitch.findtext("octave"))}
                assert len(imported_event["notes"]) == 1
                assert imported_event["notes"][0]["pitch"] == source_pitch
                assert imported_event["duration"]["base"] == child.findtext("type")
                assert imported_at == at
                notes.append({"id": variant, "part": part_no, "measure": measure_no,
                              "onsetQuarter": [at.numerator, at.denominator],
                              "pitch": source_pitch, "type": child.findtext("type"),
                              "durationQuarter": [Fraction(int(child.findtext("duration")), divisions).numerator,
                                                  Fraction(int(child.findtext("duration")), divisions).denominator],
                              "importedPitch": imported_event["notes"][0]["pitch"],
                              "importedDuration": imported_event["duration"]})
                at += Fraction(int(child.findtext("duration")), divisions)
                imported_at += {"whole": Fraction(4), "half": Fraction(2)}[imported_event["duration"]["base"]]
        assert source_note_index == len(imported_events)
        assert at == imported_at == 4
assert len(controls) == 5 and len(notes) == 10 and len(variant_ids) == 17
assert [(c["part"], c["measure"], c["onsetQuarter"], c["staffLines"],
         [(l["line"], l["printObject"]) for l in c["lineDetails"]]) for c in controls] == [
    (1, 1, [0, 1], 1, []),
    (2, 1, [0, 1], 5, []),
    (2, 2, [0, 1], 4, []),
    (2, 3, [2, 1], 3, []),
    (2, 4, [0, 1], 5, [(2, "no"), (4, "no")]),
]
for shell, index in indexes.items():
    assert index["applicationCommit"] == evidence["applicationCommit"]
    assert index["corpusRevision"] == suite["revision"] == evidence["corpusRevision"]
    assert index["browser"]["product"] == "Chrome/153.0.8010.36"
    assert index["viewport"] == {"width": 1440, "height": 1000, "deviceScaleFactor": 1}
    assert [f["id"] for f in index["fixtures"]] == [ID]
    row = index["fixtures"][0]
    assert row["sourceSha256"] == entry["sha256"]
    assert not row.get("importError") and not row.get("captureError")
    assert row["availableViews"] == ["notation"] and row["editorBound"] is True
    assert row["displayOptions"]["clefs"] == "show"
    assert row["displayOptions"]["timeSignatures"] == "show"
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
    assert row["warnings"] == [
        "part P1, measure 1, staff 1: unsupported staff configuration (1 staff lines); not represented in MNX.",
        "part P2, measure 2, staff 1: unsupported staff configuration (4 staff lines); not represented in MNX.",
        "part P2, measure 3, staff 1: unsupported staff configuration (3 staff lines); not represented in MNX.",
        "part P2, measure 4, staff 1: unsupported staff configuration (line-detail visibility/style); not represented in MNX.",
    ]

def control(part: int, measure: int) -> str:
    return next(c["id"] for c in controls if c["part"] == part and c["measure"] == measure)

def feature(fid: str, variants: list[str], expected: str,
            verdict: str, cause: list[str], reason: str) -> dict:
    assert variants and all(v in variant_ids for v in variants)
    return {"id": fid, "fixture": ID, "variantIds": variants, "expected": expected,
            "verdict": verdict, "cause": cause, "reason": reason}

features = [
    feature("14a.upper-one-line-staff", [control(1, 1)],
            "Part 1 uses a single line throughout four measures.", "incorrect",
            ["importer", "MNX representation"],
            "The one-line declaration is warned and discarded; both shells draw five lines in all four bars."),
    feature("14a.lower-initial-five-lines", [control(2, 1)],
            "Part 2 begins with five ordinary visible lines.", "correct", [],
            "Five lines are the source default and remain visible in the first bar."),
    feature("14a.lower-four-line-change", [control(2, 2)] +
            [n["id"] for n in notes if n["part"] == 2 and
             (n["measure"] == 2 or (n["measure"] == 3 and n["onsetQuarter"] == [0, 1]))],
            "Part 2 has four lines from the start of bar 2 through the first half of bar 3.",
            "incorrect", ["importer", "MNX representation"],
            "The four-line declaration disappears; five lines remain through this span."),
    feature("14a.lower-midmeasure-three-lines", [control(2, 3)] +
            [n["id"] for n in notes if n["part"] == 2 and n["measure"] == 3 and n["onsetQuarter"] == [2, 1]],
            "Part 2 changes to three lines after the first half note in bar 3.",
            "incorrect", ["importer", "MNX representation"],
            "The half-bar change disappears; both halves of the bar show five lines."),
    feature("14a.lower-five-line-reset", [control(2, 4)],
            "Part 2 returns to a five-line geometry in bar 4.", "correct", [],
            "The fallback five-line staff matches the source line count in this bar alone."),
    feature("14a.lower-hidden-inner-lines",
            [line["id"] for c in controls if c["part"] == 2 and c["measure"] == 4
             for line in c["lineDetails"]],
            "Lines 2 and 4 are hidden while the five-line positions remain.",
            "incorrect", ["importer", "MNX representation"],
            "Both print-object=no controls disappear; all five lines are visible."),
    feature("14a.pitched-note-data", [n["id"] for n in notes],
            "Ten G4 pitches and their whole/half durations survive, with two parts and four measures.",
            "correct", [], "All ten source pitches and durations match imported MNX, and all notes are visible."),
    feature("14a.staff-relative-note-placement",
            [n["id"] for n in notes if not (n["part"] == 2 and n["measure"] == 1)],
            "G4 note positions should be judged against the nondefault or hidden-line source configurations.",
            "blocked", ["importer", "MNX representation"],
            "The target one-, four-, three- and selectively hidden-line geometry is absent from MNX; visible note positions on the five-line fallback cannot establish source-relative placement."),
]
assert len({f["id"] for f in features}) == len(features)
assert set.union(*(set(f["variantIds"]) for f in features)) == variant_ids
render = []
for feat in features:
    for shell in indexes:
        render.append({"featureId": feat["id"], "shell": shell, "view": "notation",
                       "verdict": feat["verdict"], "cause": feat["cause"], "reason": feat["reason"],
                       "observationEvidence": f"harness/fixtures/musicxml-staff-lines-evidence/{shell}/{ID}/observation.json",
                       "documentEvidence": f"harness/fixtures/musicxml-staff-lines-evidence/{shell}/{ID}/document.mnx.json",
                       "svgEvidence": f"harness/fixtures/musicxml-staff-lines-evidence/{shell}/{ID}/notation-0.svg",
                       "screenshotEvidence": f"harness/fixtures/musicxml-staff-lines-evidence/{shell}/{ID}/notation-0-0.png"})
report = {
    "kind": "implementation-loop agent render assessment; not human verification",
    "applicationCommit": evidence["applicationCommit"], "corpusRevision": suite["revision"],
    "scope": "14a original staff configuration, source to current browser-imported MNX to complete Notation in both desktop shells",
    "fixtureCount": 1, "featureCount": len(features), "sourceStaffDetailCount": len(controls),
    "sourceLineDetailCount": 2, "sourceNoteCount": len(notes), "sourceVariantCount": len(variant_ids),
    "renderRowCount": len(render), "browser": indexes["workbench"]["browser"]["product"],
    "viewport": indexes["workbench"]["viewport"],
    "viewPolicy": "No declared source strings; Notation only. Clefs and time signatures Show. The complete score fits one viewport tile per shell.",
    "fixture": {"id": ID, "sourcePath": entry["path"], "sourceSha256": entry["sha256"],
                "testClass": entry["testClass"], "description": entry["description"],
                "sourceDeclaresStrings": False, "staffDetails": controls, "notes": notes},
    "features": [{k: v for k, v in f.items() if k not in ("verdict", "cause", "reason")} for f in features],
    "render": render,
    "renderVariantDispositions": [
        {"featureId": f["id"], "variantId": variant, "shells": ["workbench", "studio"],
         "view": "notation", "verdict": f["verdict"], "reason": f["reason"]}
        for f in features for variant in f["variantIds"]],
    "verdictCounts": {v: sum(r["verdict"] == v for r in render)
                      for v in ("correct", "incorrect", "blocked")},
    "unresolvedCases": [
        {"featureId": "14a.staff-relative-note-placement",
         "reason": "The intended variable-line coordinate system is missing on import; exact original-relative note placement is blocked by that prerequisite."}
    ],
    "deduplication": {
        "completed22": "Source-located warnings for the four unsupported configurations are the completed item 22 containment. Full variable/hidden staff-line carrier and engraving were explicitly deferred there.",
        "completed23": "The untitled Studio XML version is now editable after the title repair; no authoring or GP persistence pass is inferred.",
        "newProposal": "None: the observed line geometry loss and carrier dependency repeat item 22's documented deferral.",
    },
}
OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
print(f"{OUT.relative_to(ROOT)}: 1 fixture, {len(features)} features, {len(variant_ids)} variants, {len(render)} rows")
