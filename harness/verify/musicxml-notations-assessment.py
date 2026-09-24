#!/usr/bin/env python3
"""Rebuild/verify the source-control verdicts for the six 32-series originals."""
from __future__ import annotations

from collections import Counter, defaultdict
from hashlib import sha256
import json
from pathlib import Path
import subprocess
import sys
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
SUITE = ROOT / "converters/fixtures/musicxml-suite"
EVIDENCE = ROOT / "harness/fixtures/musicxml-notations-evidence"
REPORT = ROOT / "harness/reports/musicxml-notations-assessment.json"
MANIFEST = EVIDENCE / "manifest.json"
SHELLS = ("workbench", "studio")
IDS = (
    "32a-Notations", "32b-Articulations-Texts", "32c-MultipleNotationChildren",
    "32d-Arpeggio", "32e-Arpeggios-Cross", "32e-Fermatas",
)
CONTAINERS = {"articulations", "ornaments", "technical", "dynamics"}
PUBLISHED_MARKINGS = {"accent", "breath-mark", "caesura", "soft-accent", "spiccato",
                      "staccatissimo", "staccato", "stress", "strong-accent", "tenuto",
                      "unstress"}
EXPECTED_CLASSES = {
    "32a-Notations": {"fermata": 0, "arpeggio": 0, "non-arpeggio": 0,
                      "articulation": 0, "technique-harmonic": 16,
                      "technique-hammerPull": 2, "technique-bend": 3,
                      "dynamic": 2},
    "32b-Articulations-Texts": {"direction": 7},
    "32c-MultipleNotationChildren": {"articulation": 0},
    "32d-Arpeggio": {"arpeggio": 0, "non-arpeggio": 0},
    "32e-Arpeggios-Cross": {"arpeggio": 0},
    "32e-Fermatas": {"fermata": 0},
}


def digest(data: bytes) -> str:
    return sha256(data).hexdigest()


def tree(element: ET.Element) -> dict:
    return {"tag": element.tag, "text": (element.text or "").strip(),
            "attributes": dict(element.attrib), "children": [tree(c) for c in element]}


def source_pitch(note: ET.Element) -> dict | None:
    pitch = note.find("pitch")
    if pitch is None:
        return None
    result = {"step": pitch.findtext("step"), "octave": int(pitch.findtext("octave"))}
    if pitch.findtext("alter") is not None:
        result["alter"] = int(pitch.findtext("alter"))
    return result


def imported_note_order(measure: dict) -> list[tuple[dict, dict | None, dict]]:
    out = []
    for sequence in measure.get("sequences", []):
        for event in sequence["content"]:
            if "notes" in event:
                out.extend((event, note, sequence) for note in event["notes"])
            elif "rest" in event:
                out.append((event, None, sequence))
    return out


def control_feature(fixture: str, group: str, tag: str) -> str:
    return f"{fixture}.{group}.{tag}"


def observed_data(mark: dict, event: dict | None, note: dict | None, measure: dict) -> dict:
    group, tag = mark["group"], mark["tag"]
    if group == "direction":
        return {"directions": measure.get("directions", [])}
    if tag in ("arpeggiate", "non-arpeggiate"):
        return {"arpeggios": measure.get("arpeggios", []),
                "nonArpeggios": measure.get("nonArpeggios", [])}
    if group == "dynamics":
        return {"dynamics": measure.get("dynamics", [])}
    if group == "technical":
        return {"noteExtension": (note or {}).get("_x"),
                "targetNoteId": (note or {}).get("id")}
    return {"eventFermata": (event or {}).get("fermata"),
            "eventMarkings": (event or {}).get("markings"),
            "noteExtension": (note or {}).get("_x")}


def assert_projection(mark: dict) -> None:
    """Fail if a claimed source-to-import state changes under the saved captures."""
    group, tag, imported = mark["group"], mark["tag"], mark["imported"]
    if tag in ("arpeggiate", "non-arpeggiate"):
        assert imported == {"arpeggios": [], "nonArpeggios": []}
    elif tag == "fermata":
        assert imported["eventFermata"] is None
    elif group in ("articulations", "ornaments"):
        assert imported["eventMarkings"] is None
        assert imported["eventFermata"] is None
    elif group == "technical":
        extension = (imported["noteExtension"] or {}).get("mnxLab", {})
        technique = extension.get("tab", {}).get("technique", {})
        if tag == "harmonic":
            harmonic = technique.get("harmonic")
            assert harmonic and set(harmonic) == {"type"}
            assert harmonic["type"] == ("artificial" if any(
                c["tag"] == "artificial" for c in mark["source"]["children"]) else "natural")
        elif tag in ("hammer-on", "pull-off"):
            assert bool(technique.get("hammerPull")) == (mark["source"]["attributes"].get("type") == "start")
        elif tag == "bend":
            expected = {(19, 3): [0, 4], (19, 4): [0, -3],
                        (20, 1): [0.5, 0.5], (20, 2): [0, -3.5]}
            assert [p["alter"] for p in technique["bend"]["points"]] == expected[(mark["measure"], mark["noteOrdinal"])]
        else:
            assert not extension, (mark["id"], extension)
    elif group == "direction":
        direction = imported["directions"][mark["directionOrdinal"] - 1]
        assert direction["text"] == mark["source"]["text"]
        assert direction["orient"] == mark["placement"]
        assert not set(direction) & {"defaultX", "defaultY", "fontSize", "fontWeight", "color"}


def verdict(mark: dict) -> tuple[str, list[str], str]:
    fixture, group, tag = mark["fixture"], mark["group"], mark["tag"]
    bar, ordinal = mark.get("measure"), mark.get("noteOrdinal")
    if tag == "score-structure":
        return "correct", [], "Source note/rest order, pitches, written values, lyric labels and staff assignments survive the browser import and display."
    if fixture == "32b-Articulations-Texts":
        if bar == 3 and mark["directionOrdinal"] in (2, 3):
            return "incorrect", ["importer", "representation", "layout/SVG engine"], "Text and below side survive, but exact x/y, size, weight and color do not; the last two labels run beyond the visible score card in both shells."
        return "partial", ["importer", "representation", "layout/SVG engine"], "The words and above/below side survive, but source default-x/y, font size and weight are replaced by one italic default."
    if fixture == "32a-Notations" and group == "technical":
        if tag == "harmonic":
            role = next((c["tag"] for c in mark["source"]["children"]
                         if c["tag"] in ("base-pitch", "touching-pitch", "sounding-pitch")), None)
            if role:
                return "partial", ["importer", "representation"], f"Natural/artificial type and circle survive; source {role} role disappears, so chord members receive undifferentiated circles."
            return "correct", [], "Harmonic type survives in the extension and the circle (with A.H. for artificial) draws over the source note."
        if tag in ("hammer-on", "pull-off"):
            return "partial", ["importer", "representation"], "The start/stop pair resolves to a visible curve, but hammer versus pull identity and its H/P label disappear."
        if tag == "bend":
            if (bar, ordinal) == (19, 3):
                return "correct", [], "The four-semitone upward bend survives as a visible curved arrow with a two-step label."
            if (bar, ordinal) == (20, 1):
                return "incorrect", ["importer"], "Source pre-bend is -0.5 semitone; imported curve is +0.5 and draws an upward quarter-step arrow."
            if bar == 19:
                return "missing", ["layout/SVG engine", "importer"], "A release curve survives in MNX with a negative terminal alter, but has no visible curve; the 19th-bar with-bar detail also disappears."
            return "missing", ["layout/SVG engine"], "The 3.5-semitone release survives in MNX as -3.5 but has no visible curve."
    if fixture == "32a-Notations" and group == "dynamics" and tag in ("f", "sfp"):
        return "correct", [], "The source dynamic is imported at the note's beat and draws in both shells."
    if tag in ("arpeggiate", "non-arpeggiate"):
        return "missing", ["importer"], "Source chord-span control is absent from imported MNX, and the notation SVG has no arpeggio/bracket ink."
    if tag == "fermata":
        return "missing", ["importer"], "Source fermata shape/orientation is absent from the imported event, so the visible note or rest has no fermata."
    if group == "articulations":
        causes = ["importer"] + ([] if tag in PUBLISHED_MARKINGS else ["representation"])
        return "missing", causes, "Source articulation is absent from imported event markings; the visible note has no corresponding mark."
    if group == "ornaments":
        causes = ["importer"] if tag == "tremolo" else ["importer", "representation"]
        return "missing", causes, "Source ornament or attached accidental is absent from imported MNX and has no visible ink."
    if group == "technical":
        if tag in ("up-bow", "down-bow"):
            causes = ["importer", "layout/SVG engine"]
        elif tag == "fingering" and bar == 15 and ordinal in (2, 3, 4, 5):
            causes = ["importer"]
        elif tag == "pluck" and bar == 16 and ordinal == 3:
            causes = ["importer"]
        else:
            causes = ["importer", "representation"]
        return "missing", causes, "Source technical mark is absent from the imported note; the lyric label, where present, is only a reference caption."
    if group == "dynamics":
        return "missing", ["importer"], "The source other-dynamic is omitted with a source-located converter warning."
    return "missing", ["importer", "representation"], "The source notation is absent from imported MNX and from visible ink."


suite = json.loads((SUITE / "manifest.json").read_text())
entries = {f["id"]: f for f in suite["fixtures"]}
assert tuple(f["id"] for f in suite["fixtures"] if f["id"].startswith("32")) == IDS
indexes = {shell: json.loads((EVIDENCE / shell / "index.json").read_text()) for shell in SHELLS}
app_commit = indexes["workbench"]["applicationCommit"]
captured_script = subprocess.check_output(
    ["git", "show", f"{app_commit}:harness/verify/musicxml-editor-capture.mjs"], cwd=ROOT)
script_hash = digest(captured_script)
fixtures = []
variants = []
unique_ids = set()

for fixture in IDS:
    entry = entries[fixture]
    source_file = SUITE / entry["path"]
    assert digest(source_file.read_bytes()) == entry["sha256"]
    source = ET.parse(source_file).getroot()
    assert source.tag == "score-partwise"
    assert not source.findall(".//staff-tuning"), fixture
    docs = {shell: json.loads((EVIDENCE / shell / fixture / "document.mnx.json").read_text())
            for shell in SHELLS}
    assert docs["workbench"] == docs["studio"], fixture
    doc = docs["workbench"]
    assert len(source.findall("part")) == len(doc["parts"])
    capture_rows = {}
    for shell in SHELLS:
        index = indexes[shell]
        assert index["applicationCommit"] == app_commit
        assert index["corpusRevision"] == suite["revision"]
        assert index["captureScriptSha256"] == script_hash
        assert index["viewport"] == {"width": 1440, "height": 1000, "deviceScaleFactor": 1}
        assert index["browser"]["product"] == "Chrome/153.0.8010.36"
        assert [row["id"] for row in index["fixtures"]] == list(IDS)
        row = next(r for r in index["fixtures"] if r["id"] == fixture)
        capture_rows[shell] = row
        assert row["sourceSha256"] == entry["sha256"]
        assert not row.get("importError") and not row.get("captureError")
        assert row["editorBound"] and not row.get("editingSuspended")
        assert not row.get("viewingOriginal") and not row.get("makeCurrentError")
        assert not row["consoleErrors"]
        assert row["availableViews"] == ["notation"]
        assert row["displayOptions"]["lyrics"] == "all"
        assert row["displayOptions"]["clefs"] == "show"
        assert row["displayOptions"]["timeSignatures"] == "show"
        assert len(row["views"]) == 1
        view = row["views"][0]
        assert view["view"] == "notation" and view["staffScale"] == 1 and view["densityH"] == 2
        assert view["svgCount"] == 1 and not view["renderErrors"]
        assert view["scrollWidth"] <= view["clientWidth"] + 1
        assert view["screenshots"]
        bottom = max(int(name.rsplit("-", 1)[1][:-4]) for name in view["screenshots"])
        assert bottom + view["visibleHeight"] >= view["scrollHeight"] - 2, (fixture, shell)
        svg = ET.parse(EVIDENCE / shell / fixture / "notation-0.svg").getroot()
        classes = Counter(word for node in svg.iter()
                          for word in node.get("class", "").split())
        for name, count in EXPECTED_CLASSES[fixture].items():
            assert classes[name] == count, (fixture, shell, name, classes[name])
        if shell == "studio":
            assert "Make current" in row["entryPath"]
        if fixture == "32a-Notations":
            assert row["warnings"] == ['measure 23: dynamic "sfffz" has no MNX equivalent and was not imported.']
        else:
            assert not row["warnings"]
    counts = Counter()
    for part_no, (part, imported_part) in enumerate(zip(source.findall("part"), doc["parts"]), 1):
        bars = part.findall("measure")
        assert len(bars) == len(imported_part["measures"])
        for measure_no, (bar, imported_bar) in enumerate(zip(bars, imported_part["measures"]), 1):
            source_notes = bar.findall("note")
            imported_order = imported_note_order(imported_bar)
            assert len(source_notes) == len(imported_order), (fixture, measure_no)
            source_lyrics = []
            imported_lyrics = []
            for note_no, (xml_note, (event, mnx_note, sequence)) in enumerate(zip(source_notes, imported_order), 1):
                pitch = source_pitch(xml_note)
                assert pitch == (mnx_note or {}).get("pitch"), (fixture, measure_no, note_no)
                assert (xml_note.find("rest") is not None) == (mnx_note is None)
                assert xml_note.findtext("type") == event["duration"]["base"]
                assert len(xml_note.findall("dot")) == event["duration"].get("dots", 0)
                if fixture == "32e-Arpeggios-Cross":
                    assert int(xml_note.findtext("staff")) == sequence["staff"]
                    assert "v" + xml_note.findtext("voice") == sequence["voice"]
                source_lyrics += [(lyric.get("number"), lyric.findtext("text"))
                                  for lyric in xml_note.findall("lyric")]
                note_id = f"{fixture}/p{part_no:02d}/m{measure_no:02d}/n{note_no:02d}"
                for nt_no, notation in enumerate(xml_note.findall("notations"), 1):
                    for group_no, group in enumerate(notation, 1):
                        marks = list(group) if group.tag in CONTAINERS else [group]
                        for control_no, control in enumerate(marks, 1):
                            path = (f"/nt{nt_no:02d}/{group.tag}{group_no:02d}"
                                    + (f"/{control.tag}{control_no:02d}" if group.tag in CONTAINERS else ""))
                            variant_id = note_id + path
                            assert variant_id not in unique_ids
                            unique_ids.add(variant_id)
                            group_name = group.tag if group.tag in CONTAINERS else "notations"
                            mark = {"id": variant_id, "featureId": control_feature(fixture, group_name, control.tag),
                                    "fixture": fixture, "part": part_no, "measure": measure_no,
                                    "noteOrdinal": note_no, "group": group_name, "tag": control.tag,
                                    "source": tree(control),
                                    "imported": observed_data({"group": group_name, "tag": control.tag},
                                                              event, mnx_note, imported_bar)}
                            variants.append(mark)
                            counts["controls"] += 1
            for sequence in imported_bar.get("sequences", []):
                for event in sequence["content"]:
                    imported_lyrics += [(number, line["text"]) for number, line in
                                        event.get("lyrics", {}).get("lines", {}).items()]
            assert sorted(source_lyrics) == sorted(imported_lyrics), (fixture, measure_no)
            counts["notes"] += len(source_notes)
            counts["lyrics"] += len(source_lyrics)
            directions = bar.findall("direction")
            for direction_no, direction in enumerate(directions, 1):
                for type_no, dtype in enumerate(direction.findall("direction-type"), 1):
                    for control_no, control in enumerate(dtype, 1):
                        variant_id = (f"{fixture}/p{part_no:02d}/m{measure_no:02d}"
                                      f"/d{direction_no:02d}/t{type_no:02d}/{control.tag}{control_no:02d}")
                        assert variant_id not in unique_ids
                        unique_ids.add(variant_id)
                        mark = {"id": variant_id,
                                "featureId": control_feature(fixture, "direction", control.tag),
                                "fixture": fixture, "part": part_no, "measure": measure_no,
                                "directionOrdinal": direction_no, "group": "direction", "tag": control.tag,
                                "placement": direction.get("placement"), "source": tree(control),
                                "imported": observed_data({"group": "direction", "tag": control.tag},
                                                          None, None, imported_bar)}
                        variants.append(mark)
                        counts["controls"] += 1
            if directions:
                assert len(imported_bar.get("directions", [])) == len(directions)
    score_id = f"{fixture}/score-structure"
    assert score_id not in unique_ids
    unique_ids.add(score_id)
    variants.append({"id": score_id, "featureId": f"{fixture}.score-structure",
                     "fixture": fixture, "group": "score", "tag": "score-structure",
                     "source": {"noteCount": counts["notes"], "lyricCount": counts["lyrics"],
                                "measureCount": len(doc["parts"][0]["measures"])},
                     "imported": {"pitchValueOrder": "exact", "restOrder": "exact",
                                  "lyricTextMultisetByMeasure": "exact"}})
    fixtures.append({"id": fixture, "path": entry["path"], "sha256": entry["sha256"],
                     "description": entry["description"], "testClass": entry["testClass"],
                     "sourceNotes": counts["notes"], "sourceLyrics": counts["lyrics"],
                     "sourceControls": counts["controls"],
                     "capture": {shell: {"observation": f"{shell}/{fixture}/observation.json",
                                         "importedMnx": f"{shell}/{fixture}/document.mnx.json",
                                         "svg": f"{shell}/{fixture}/notation-0.svg",
                                         "screenshots": capture_rows[shell]["views"][0]["screenshots"]}
                                 for shell in SHELLS}})

for mark in variants:
    if mark["tag"] != "score-structure":
        assert_projection(mark)
    v, causes, reason = verdict(mark)
    mark["viewRows"] = [{"shell": shell, "view": "notation", "verdict": v,
                         "causes": causes, "reason": reason,
                         "observation": f"{shell}/{mark['fixture']}/observation.json",
                         "svg": f"{shell}/{mark['fixture']}/notation-0.svg",
                         "screenshots": capture_rows[shell]["views"][0]["screenshots"]}
                        for shell in SHELLS]
features = defaultdict(list)
for mark in variants:
    features[mark["featureId"]].append(mark)
feature_entries = []
for feature, marks in sorted(features.items()):
    view_rows = []
    for shell in SHELLS:
        rows = [mark["viewRows"][SHELLS.index(shell)] for mark in marks]
        breakdown = Counter(row["verdict"] for row in rows)
        if "incorrect" in breakdown:
            overall = "incorrect"
        elif "missing" in breakdown and len(breakdown) > 1:
            overall = "partial"
        elif "missing" in breakdown:
            overall = "missing"
        elif "partial" in breakdown:
            overall = "partial"
        else:
            overall = "correct"
        view_rows.append({"shell": shell, "view": "notation", "verdict": overall,
                          "variantVerdicts": dict(sorted(breakdown.items())),
                          "causes": sorted({cause for row in rows for cause in row["causes"]}),
                          "reason": "Aggregate of the explicit source-variant rows; inspect mixed variants individually."})
    feature_entries.append({"id": feature, "variantIds": [mark["id"] for mark in marks],
                            "viewRows": view_rows})
row_counts = Counter(row["verdict"] for mark in variants for row in mark["viewRows"])
feature_row_counts = Counter(row["verdict"] for feature in feature_entries
                             for row in feature["viewRows"])
report = {"kind": "agent source-to-MNX and current both-shell render assessment",
          "scope": "six original 32-series fixtures; no authoring or persistence verdicts",
          "suiteRevision": suite["revision"], "applicationCommit": app_commit,
          "browser": indexes["workbench"]["browser"]["product"],
          "viewPolicy": "Notation only: no source declares tuned strings; Show clefs/meters and All verses",
          "fixtures": fixtures,
          "features": feature_entries,
          "variants": variants,
          "totals": {"originals": len(fixtures), "sourceNotes": sum(f["sourceNotes"] for f in fixtures),
                     "sourceLyrics": sum(f["sourceLyrics"] for f in fixtures),
                     "sourceControls": sum(f["sourceControls"] for f in fixtures),
                     "featureIds": len(features), "sourceVariants": len(variants),
                     "featureViewRows": sum(len(feature["viewRows"]) for feature in feature_entries),
                     "featureVerdicts": dict(sorted(feature_row_counts.items())),
                     "viewRows": sum(len(v["viewRows"]) for v in variants),
                     "verdicts": dict(sorted(row_counts.items()))}}
assert report["totals"]["sourceControls"] == 187
assert report["totals"]["sourceVariants"] == 193

evidence_files = sorted(path for path in EVIDENCE.rglob("*") if path.is_file() and path != MANIFEST)
evidence_manifest = {"kind": "retained original-file browser evidence",
                     "suiteRevision": suite["revision"], "applicationCommit": app_commit,
                     "captureScriptSha256": script_hash,
                     "files": [{"path": path.relative_to(EVIDENCE).as_posix(),
                                "sha256": digest(path.read_bytes())} for path in evidence_files]}
if "--write" in sys.argv:
    MANIFEST.write_text(json.dumps(evidence_manifest, indent=2, ensure_ascii=False) + "\n")
    REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
else:
    assert json.loads(MANIFEST.read_text()) == evidence_manifest
    assert json.loads(REPORT.read_text()) == report
print(report["totals"])
