#!/usr/bin/env python3
"""Verify source-derived 31-series direction IDs and retained desktop render evidence."""
from __future__ import annotations

from collections import Counter
from fractions import Fraction
from hashlib import sha256
import json
from pathlib import Path
import subprocess
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
SUITE = ROOT / "converters/fixtures/musicxml-suite"
EVIDENCE = ROOT / "harness/fixtures/musicxml-directions-evidence"
OUT = ROOT / "harness/reports/musicxml-directions-assessment.json"
suite = json.loads((SUITE / "manifest.json").read_text())
entries = {f["id"]: f for f in suite["fixtures"]}
IDS = tuple(f["id"] for f in suite["fixtures"] if f["id"].startswith("31"))
assert IDS == ("31a-Directions", "31b-Directions-Order", "31c-MetronomeMarks",
               "31d-Directions-Compounds", "31f-Direction-Multiline-Compounds")
evidence = json.loads((EVIDENCE / "manifest.json").read_text())
for item in evidence["files"]:
    assert sha256((EVIDENCE / item["path"]).read_bytes()).hexdigest() == item["sha256"]
indexes = {shell: json.loads((EVIDENCE / shell / "index.json").read_text())
           for shell in ("workbench", "studio")}
captured_script = subprocess.check_output(
    ["git", "show", f"{evidence['applicationCommit']}:harness/verify/musicxml-editor-capture.mjs"],
    cwd=ROOT)
captured_script_sha = sha256(captured_script).hexdigest()
for shell, index in indexes.items():
    runs = [json.loads((EVIDENCE / shell / name).read_text())
            for name in ("capture-index-31a-d.json", "capture-index-31f.json")]
    assert index["fixtures"] == runs[0]["fixtures"] + runs[1]["fixtures"]


def fraction(value: Fraction) -> list[int]:
    return [value.numerator, value.denominator]


def pitch_of(note: ET.Element) -> dict | None:
    pitch = note.find("pitch")
    if pitch is None:
        return None
    result = {"step": pitch.findtext("step"), "octave": int(pitch.findtext("octave"))}
    if pitch.findtext("alter") is not None:
        result["alter"] = int(pitch.findtext("alter"))
    return result


def descendants(element: ET.Element) -> list[dict]:
    return [{"tag": child.tag, "text": child.text or "", "attributes": dict(child.attrib),
             "children": descendants(child)} for child in element]


def class_nodes(svg: ET.Element, name: str) -> list[ET.Element]:
    return [node for node in svg.iter() if name in node.get("class", "").split()]


def retained_svg(fixture: str, shell: str) -> ET.Element:
    return ET.parse(EVIDENCE / shell / fixture / "notation-0.svg").getroot()


variant_ids: set[str] = set()
fixtures: list[dict] = []
for fixture_id in IDS:
    entry = entries[fixture_id]
    source = SUITE / entry["path"]
    assert sha256(source.read_bytes()).hexdigest() == entry["sha256"]
    xml = ET.parse(source).getroot()
    assert not xml.findall(".//staff-tuning") and not xml.findall(".//technical/string")
    parts = xml.findall("part")
    docs = {shell: json.loads((EVIDENCE / shell / fixture_id / "document.mnx.json").read_text())
            for shell in indexes}
    assert docs["workbench"] == docs["studio"], fixture_id
    assert len(parts) == len(docs["workbench"]["parts"])
    notes: list[dict] = []
    directions: list[dict] = []
    for part_no, (part, imported_part) in enumerate(zip(parts, docs["workbench"]["parts"]), 1):
        bars = part.findall("measure")
        imported_bars = imported_part["measures"]
        assert len(bars) == len(imported_bars)
        divisions = 1
        for measure_no, (bar, imported_bar) in enumerate(zip(bars, imported_bars), 1):
            cursor = Fraction()
            bar_notes: list[dict] = []
            bar_directions: list[dict] = []
            for child in bar:
                if child.tag == "attributes":
                    if child.findtext("divisions") is not None:
                        divisions = int(child.findtext("divisions"))
                elif child.tag == "note":
                    ordinal = len(bar_notes) + 1
                    nid = f"{fixture_id}/p{part_no:02d}/m{measure_no:02d}/n{ordinal:02d}"
                    variant_ids.add(nid)
                    lyrics = []
                    for lyric_no, lyric in enumerate(child.findall("lyric"), 1):
                        lid = nid + f"/l{lyric_no:02d}"
                        variant_ids.add(lid)
                        lyrics.append({"id": lid, "number": lyric.get("number"),
                                       "text": lyric.findtext("text"),
                                       "syllabic": lyric.findtext("syllabic")})
                    duration = (Fraction(child.findtext("duration")) / divisions
                                if child.findtext("duration") is not None else Fraction())
                    note = {"id": nid, "part": part_no, "measure": measure_no,
                            "ordinal": ordinal, "onsetQuarter": fraction(cursor),
                            "pitch": pitch_of(child), "rest": child.find("rest") is not None,
                            "type": child.findtext("type"), "dots": len(child.findall("dot")),
                            "durationQuarter": fraction(duration), "lyrics": lyrics}
                    notes.append(note)
                    bar_notes.append(note)
                    if child.find("chord") is None and child.find("grace") is None:
                        cursor += duration
                elif child.tag == "direction":
                    ordinal = len(bar_directions) + 1
                    did = f"{fixture_id}/p{part_no:02d}/m{measure_no:02d}/d{ordinal:02d}"
                    variant_ids.add(did)
                    offset = Fraction(child.findtext("offset") or "0")
                    controls = []
                    for type_el in child.findall("direction-type"):
                        for mark in type_el:
                            cid = did + f"/c{len(controls) + 1:02d}"
                            variant_ids.add(cid)
                            controls.append({"id": cid, "tag": mark.tag,
                                             "text": mark.text or "",
                                             "attributes": dict(mark.attrib),
                                             "children": descendants(mark)})
                    direction = {"id": did, "part": part_no, "measure": measure_no,
                                 "ordinal": ordinal, "onsetQuarter": fraction(cursor),
                                 "offsetDivisions": fraction(offset),
                                 "visualQuarter": fraction(cursor + offset / divisions),
                                 "placement": child.get("placement"),
                                 "controls": controls,
                                 "xmlSha256": sha256(ET.tostring(child)).hexdigest()}
                    directions.append(direction)
                    bar_directions.append(direction)
                elif child.tag == "backup":
                    cursor -= Fraction(child.findtext("duration")) / divisions
                elif child.tag == "forward":
                    cursor += Fraction(child.findtext("duration")) / divisions
            imported_events = [item for sequence in imported_bar.get("sequences", [])
                               for item in sequence["content"]]
            source_pitches = [n["pitch"] for n in bar_notes if n["pitch"] is not None]
            imported_pitches = [n["pitch"] for event in imported_events
                                for n in event.get("notes", [])]
            assert source_pitches == imported_pitches, (fixture_id, part_no, measure_no)
            source_values = [(n["type"], n["dots"]) for n in bar_notes if n["pitch"] is not None]
            imported_values = [(event["duration"]["base"], event["duration"].get("dots", 0))
                               for event in imported_events for _ in event.get("notes", [])]
            assert source_values == imported_values, (fixture_id, part_no, measure_no)
            source_lyrics = [[v["text"] for v in n["lyrics"]] for n in bar_notes]
            imported_lyrics = [[line["text"] for _, line in
                                sorted(event.get("lyrics", {}).get("lines", {}).items(),
                                       key=lambda pair: int(pair[0]))]
                               for event in imported_events]
            assert source_lyrics == imported_lyrics, (fixture_id, part_no, measure_no)
    for shell, index in indexes.items():
        assert index["applicationCommit"] == evidence["applicationCommit"]
        assert index["corpusRevision"] == suite["revision"] == evidence["corpusRevision"]
        assert index["captureScriptSha256"] == captured_script_sha
        assert index["browser"]["product"] == "Chrome/153.0.8010.36"
        assert index["viewport"] == {"width": 1440, "height": 1000, "deviceScaleFactor": 1}
        assert index["captureRuns"] == ["capture-index-31a-d.json", "capture-index-31f.json"]
        assert [row["id"] for row in index["fixtures"]] == list(IDS)
        row = next(row for row in index["fixtures"] if row["id"] == fixture_id)
        assert row["sourceSha256"] == entry["sha256"]
        assert not row.get("importError") and not row.get("captureError")
        assert row["editorBound"] and row["consoleErrors"] == []
        assert row["warnings"] == ([
            'measure 8: dynamic "ffz" has no MNX equivalent and was not imported.'
        ] if fixture_id == IDS[0] else [])
        assert row["availableViews"] == ["notation"]
        assert row["displayOptions"]["lyrics"] == "all"
        assert row["displayOptions"]["clefs"] == "show"
        assert row["displayOptions"]["timeSignatures"] == "show"
        assert len(row["views"]) == 1
        view = row["views"][0]
        assert view["view"] == "notation" and view["staffScale"] == 1 and view["densityH"] == 2
        assert view["svgCount"] == 1 and view["renderErrors"] == []
        assert view["scrollWidth"] <= view["clientWidth"] + 1
        last_y = max(int(name.removesuffix(".png").split("-")[-1]) for name in view["screenshots"])
        assert last_y >= view["scrollHeight"] - view["clientHeight"]
        if shell == "studio":
            assert row["editingSuspended"] is False and row["viewingOriginal"] is False
    fixtures.append({"id": fixture_id, "sourcePath": entry["path"],
                     "sourceSha256": entry["sha256"], "testClass": entry["testClass"],
                     "description": entry["description"], "sourceDeclaresStrings": False,
                     "sourceNotes": notes, "sourceDirections": directions})

assert [len(f["sourceDirections"]) for f in fixtures] == [57, 5, 4, 12, 1]
assert [len(f["sourceNotes"]) for f in fixtures] == [57, 2, 12, 12, 1]
assert not (SUITE / "xmlFiles/nestedboxes.png").exists()
by_id = {f["id"]: f for f in fixtures}

# The source and imported object assertions below anchor high-impact verdicts.
def doc(fixture: str) -> dict:
    return json.loads((EVIDENCE / "workbench" / fixture / "document.mnx.json").read_text())


a = doc(IDS[0])
assert a["global"]["measures"][0]["rehearsal"] == {"label": "A"}
assert [len(a["parts"][0]["measures"][m]["dynamics"]) for m in range(2, 8)] == [4, 4, 4, 4, 4, 3]
assert a["parts"][0]["measures"][3]["dynamics"][1]["orient"] == "above"
assert a["parts"][0]["measures"][4]["dynamics"][3]["orient"] == "above"
assert a["parts"][0]["measures"][8]["dynamics"][0]["end"]["position"]["fraction"] == [1, 4]
assert len(a["parts"][0]["measures"][9]["ottavas"]) == 1
assert a["global"]["measures"][11]["tempos"][0]["bpm"] == 60
b = doc(IDS[1])
assert b["global"]["measures"][0]["section"]["label"] == "Lento"
assert b["global"]["measures"][0]["tempos"][0] == {"bpm": 56, "value": {"base": "quarter"}}
assert b["parts"][0]["measures"][1]["dynamics"][1]["position"]["fraction"] == [1, 4]
assert b["parts"][0]["measures"][1]["dynamics"][1]["end"]["position"]["fraction"] == [1, 1]
c = doc(IDS[2])
assert [len(g.get("tempos", [])) for g in c["global"]["measures"]] == [1, 0, 1]
assert c["global"]["measures"][0]["tempos"][0]["value"] == {"base": "quarter", "dots": 1}
assert c["global"]["measures"][2]["tempos"][0]["value"] == {"base": "quarter", "dots": 1}
d = doc(IDS[3])
assert not d["global"]["measures"][0].get("tempos")
assert len(d["parts"][0]["measures"][2]["dynamics"]) == 3
assert d["global"]["measures"][4]["rehearsal"] == {"label": "12"}
f = doc(IDS[4])
assert f["parts"][0]["measures"][0]["directions"][0]["text"] == "text\nin\na small box"
assert f["parts"][0]["measures"][0]["dynamics"][0]["orient"] == "above"
for shell in indexes:
    svg_a = retained_svg(IDS[0], shell)
    svg_b = retained_svg(IDS[1], shell)
    svg_c = retained_svg(IDS[2], shell)
    svg_d = retained_svg(IDS[3], shell)
    svg_f = retained_svg(IDS[4], shell)
    assert len(class_nodes(svg_a, "dynamic")) == 23
    dyn_a = class_nodes(svg_a, "dynamic")
    assert dyn_a[5].get("y") == dyn_a[4].get("y")  # m4 source above versus below
    assert dyn_a[11].get("y") == dyn_a[8].get("y")  # m5 source above versus below
    assert len(class_nodes(svg_a, "rehearsal-label")) == 1
    assert len(class_nodes(svg_a, "hairpin")) == 2
    assert len(class_nodes(svg_a, "ottava-label")) == 1
    assert len(class_nodes(svg_b, "hairpin")) == 0
    assert len(class_nodes(svg_c, "tempo")) == 6
    assert sum(node.text == "\uecb7" for node in class_nodes(svg_c, "tempo")) == 2
    assert len(class_nodes(svg_d, "hairpin")) == 2
    assert len(class_nodes(svg_d, "rehearsal-label")) == 1
    assert len(class_nodes(svg_f, "direction")) == 1
    assert len(class_nodes(svg_f, "dynamic")) == 1
    assert class_nodes(svg_f, "direction")[0].text == "text\nin\na small box"
    assert not list(class_nodes(svg_f, "direction")[0])
    assert float(class_nodes(svg_f, "dynamic")[0].get("y")) > float(
        class_nodes(svg_f, "direction")[0].get("y")) + 50


outcomes: dict[str, tuple[str, list[str], str]] = {}


def mark(short: str, measure: int, ordinal: int, verdict: str,
         cause: list[str], reason: str) -> None:
    key = f"{short}.p01.m{measure:02d}.d{ordinal:02d}"
    assert key not in outcomes
    outcomes[key] = (verdict, cause, reason)


visible = "The source control is retained in MNX and its mark or paired endpoint is visible in both complete Notation captures."
for measure in range(3, 9):
    for ordinal in range(1, 5):
        if (measure, ordinal) in ((4, 2), (5, 4), (8, 4)):
            continue
        mark("31a", measure, ordinal, "correct", [], visible)
for measure, ordinal in ((2, 1), (9, 1), (9, 2), (10, 3), (10, 4), (12, 1)):
    mark("31a", measure, ordinal, "correct", [], visible)
mark("31a", 1, 1, "missing", ["importer", "MNX representation"],
     "The source scordatura tuning diagram is absent from MNX and both views; no import warning names it.")
mark("31a", 1, 2, "incorrect", ["importer", "MNX representation", "layout/SVG engine"],
     "The A rehearsal label survives, but its explicit below placement is lost and the box draws above the staff.")
for ordinal, label in ((3, "B"), (4, "Test"), (5, "Crc")):
    mark("31a", 1, ordinal, "missing", ["importer", "MNX representation"],
         f"The source {label} rehearsal mark shares bar 1 with A; the importer keeps only A and neither shell draws this label.")
mark("31a", 2, 2, "missing", ["importer", "MNX representation"],
     "The source coda symbol has no imported object or visible glyph.")
mark("31a", 2, 3, "partial", ["importer", "MNX representation"],
     "The words retain their text and above placement, but the requested oval enclosure is lost in MNX and both views.")
mark("31a", 2, 4, "missing", ["importer", "MNX representation"],
     "The source SMuFL cClef symbol is absent from imported MNX and both views.")
for measure, ordinal in ((4, 2), (5, 4)):
    mark("31a", measure, ordinal, "incorrect", ["layout/SVG engine"],
         "MNX retains orient=above, but this dynamic draws at the same below-staff y as its below-placed neighbors.")
mark("31a", 8, 4, "missing", ["importer", "MNX representation"],
     "The source other-dynamics ffz is absent; both shells retain the source-located converter warning.")
for ordinal in (3, 4):
    mark("31a", 9, ordinal, "missing", ["importer", "MNX representation"],
         "The source dashed-line start/stop is absent from MNX and both complete views.")
for ordinal in (1, 2):
    mark("31a", 10, ordinal, "missing", ["importer", "MNX representation"],
         "The below-staff bracket start/stop is absent from MNX and both complete views.")
for ordinal in (1, 2, 3):
    mark("31a", 11, ordinal, "missing", ["importer", "MNX representation"],
         "The source pedal-line start/change/stop control is absent from MNX and both views.")
for measure, ordinal, label in (
    (12, 2, "harp-pedals"), (12, 3, "damp"), (12, 4, "damp-all"),
    (13, 1, "accordion-registration"), (13, 2, "string-mute on"),
    (13, 3, "string-mute off"), (13, 4, "eyeglasses"),
    (14, 1, "percussion timpani"), (14, 2, "staff-divide"),
    (14, 3, "principal-voice start"), (14, 4, "principal-voice stop")):
    mark("31a", measure, ordinal, "missing", ["importer", "MNX representation"],
         f"The source {label} direction has no imported carrier or visible glyph; no specific warning is emitted.")
mark("31a", 15, 1, "blocked", ["source/reference ambiguity", "importer"],
     "The source references nestedboxes.png, which is absent from the pinned suite. Image ink cannot be judged; import gives no missing-resource diagnostic.")

mark("31b", 1, 1, "correct", [],
     "Bold Lento appears above the first bar. Import stores it as a section label; that semantic classification is separate from this visible-text verdict.")
mark("31b", 1, 2, "incorrect", ["importer", "MNX representation", "layout/SVG engine"],
     "The quarter=56 mark is visible, but its positive offset and parentheses are lost; it stacks below Lento instead of following it horizontally.")
mark("31b", 2, 1, "missing", ["layout/SVG engine", "importer"],
     "The diminuendo start imports with a quarter-beat offset (source 8.1 divisions is truncated to 8), but no hairpin ink is drawn.")
mark("31b", 2, 2, "correct", [],
     "The forte direction has no offset, imports at the bar's first beat and draws below the staff.")
mark("31b", 2, 3, "missing", ["layout/SVG engine"],
     "The source end-of-bar wedge stop resolves to MNX fraction 1/1, yet the paired hairpin has no ink.")

mark("31c", 1, 1, "correct", [],
     "The first dotted-quarter=100 tempo retains dots=1 in MNX and both SVGs contain the dotted-quarter SMuFL mark and 100.")
mark("31c", 1, 2, "missing", ["importer", "MNX representation"],
     "The second bar-1 quarter-double-dot=half-dot metric relation is dropped: import keeps only the first tempo in a measure.")
mark("31c", 2, 1, "missing", ["importer", "MNX representation"],
     "The parenthesized quarter-dot=half-double-dot metric relation has no imported tempo and no visible mark.")
mark("31c", 3, 1, "partial", ["importer", "MNX representation"],
     "Dotted-quarter=77 survives and the dot is visible, but the explicit parentheses are absent from MNX and both views.")

mark("31d", 1, 1, "missing", ["importer"],
     "Adagio plus long=100 is absent from directions and tempos because the importer skips words beside a metronome and reads only the first direction-type for tempo. Only source lyric labels remain visible.")
mark("31d", 1, 2, "incorrect", ["importer", "MNX representation", "layout/SVG engine"],
     "Molto and f survive as separate objects but draw vertically over one another rather than as one inline compound; the source's missing xml:space leaves the exact space unresolved.")
mark("31d", 2, 1, "incorrect", ["importer", "MNX representation", "layout/SVG engine"],
     "The p and preserved-space subito survive separately but overlap at one x position instead of reading as p subito.")
mark("31d", 2, 2, "incorrect", ["importer", "MNX representation", "layout/SVG engine"],
     "Molto appears above, while f is below; the requested rectangle and same-line compound are lost.")
for ordinal in (1, 2):
    mark("31d", 3, ordinal, "correct", [],
         "The ppp-to-fff dynamics and paired crescendo hairpin retain their endpoints and show in both views.")
mark("31d", 4, 1, "partial", ["importer", "MNX representation"],
     "Cresc. is visible above the staff, but its attached dashed-line start is absent.")
mark("31d", 4, 2, "incorrect", ["importer", "MNX representation", "layout/SVG engine"],
     "The dashed-line stop is absent; meno is above, but its attached f draws below instead of making the requested above-staff compound.")
mark("31d", 5, 1, "partial", ["importer", "MNX representation"],
     "The 12 rehearsal box appears, but its second bis text and italic treatment are lost.")
mark("31d", 5, 2, "incorrect", ["importer", "MNX representation", "layout/SVG engine"],
     "Bold and italic words survive as separate text directions and draw on different lines, losing the source's adjacent no-space font contrast.")
mark("31d", 6, 1, "correct", [], "The source segno has an MNX target and a visible symbol in both shells.")
mark("31d", 6, 2, "missing", ["importer", "MNX representation"],
     "Neither of the two source coda symbols appears in MNX or the visible result.")

mark("31f", 1, 1, "incorrect", ["importer", "MNX representation", "layout/SVG engine"],
     "The p survives with orient=above in MNX but draws below; the preserved separator space is dropped. MNX retains the three text lines but both SVG text nodes collapse them to one unboxed line, losing rectangle and middle alignment.")

direction_ids = {f"{f['id'][:3]}.p{d['part']:02d}.m{d['measure']:02d}.d{d['ordinal']:02d}"
                 for f in fixtures for d in f["sourceDirections"]}
assert set(outcomes) == direction_ids


def feature(fid: str, fixture: str, variants: list[str], expected: str,
            verdict: str, cause: list[str], reason: str) -> dict:
    assert variants and all(v in variant_ids for v in variants)
    return {"id": fid, "fixture": fixture, "variantIds": sorted(set(variants)),
            "sourceDescription": entries[fixture]["description"], "expected": expected,
            "verdict": verdict, "cause": cause, "reason": reason}


features = []
for fixture in fixtures:
    short = fixture["id"][:3]
    features.append(feature(
        short + ".notes-and-lyric-oracle", fixture["id"],
        [n["id"] for n in fixture["sourceNotes"]] +
        [lyric["id"] for n in fixture["sourceNotes"] for lyric in n["lyrics"]],
        "The source pitched-note order, written values and any lyric reference labels survive.",
        "correct", [],
        "Source pitches, written values and per-note lyric text match browser-imported MNX. All noteheads and applicable all-verse lyric labels are visible in the complete captures; the direction ink is judged separately."))
    for direction in fixture["sourceDirections"]:
        fid = f"{short}.p{direction['part']:02d}.m{direction['measure']:02d}.d{direction['ordinal']:02d}"
        verdict, cause, reason = outcomes[fid]
        control_summary = ", ".join(mark["tag"] for mark in direction["controls"])
        expected = (f"Source direction controls {control_summary} at quarter position "
                    f"{direction['visualQuarter']} with placement {direction['placement']!r}, "
                    "including each child value and requested visual treatment.")
        features.append(feature(fid, fixture["id"],
                                [direction["id"]] + [mark["id"] for mark in direction["controls"]],
                                expected, verdict, cause, reason))
features.extend([
    feature("31b.m01.offset-order", IDS[1],
            [d["id"] for d in by_id[IDS[1]]["sourceDirections"] if d["measure"] == 1],
            "Lento is followed horizontally by a parenthesized quarter=56 at positive offset.",
            "incorrect", ["importer", "MNX representation", "layout/SVG engine"],
            "Both marks appear, but they stack at one horizontal position. The offset and parentheses do not survive."),
    feature("31b.m02.wedge-order", IDS[1],
            [d["id"] for d in by_id[IDS[1]]["sourceDirections"] if d["measure"] == 2],
            "A no-offset f precedes a positively offset diminuendo extending to the final barline.",
            "missing", ["importer", "layout/SVG engine"],
            "F appears; the 8.1-division start is truncated to 8 and the imported wedge has no visible line."),
])
assert len({f["id"] for f in features}) == len(features)
assert set.union(*(set(f["variantIds"]) for f in features)) == variant_ids

render = []
for feat in features:
    for shell, index in indexes.items():
        row = next(f for f in index["fixtures"] if f["id"] == feat["fixture"])
        base = f"harness/fixtures/musicxml-directions-evidence/{shell}/{feat['fixture']}"
        render.append({"featureId": feat["id"], "shell": shell, "view": "notation",
                       "verdict": feat["verdict"], "cause": feat["cause"],
                       "reason": feat["reason"], "observationEvidence": base + "/observation.json",
                       "documentEvidence": base + "/document.mnx.json",
                       "svgEvidence": base + "/notation-0.svg",
                       "screenshotEvidence": [base + "/" + name for name in row["views"][0]["screenshots"]],
                       "diagnosticTitles": row["views"][0]["diagnosticTitles"]})
counts = Counter(row["verdict"] for row in render)
report = {
    "kind": "implementation-loop agent render assessment; not human verification",
    "applicationCommit": evidence["applicationCommit"], "corpusRevision": suite["revision"],
    "captureScriptSha256": captured_script_sha,
    "captureScriptSourceCommit": evidence["applicationCommit"],
    "scope": "Five original 31a/31b/31c/31d/31f MusicXML files through current Workbench and editable Studio, source to imported MNX to complete Notation",
    "fixtureCount": len(fixtures), "featureCount": len(features),
    "sourceNoteCount": sum(len(f["sourceNotes"]) for f in fixtures),
    "sourceDirectionCount": sum(len(f["sourceDirections"]) for f in fixtures),
    "sourceVariantCount": len(variant_ids), "renderRowCount": len(render),
    "verdictCounts": dict(sorted(counts.items())),
    "browser": indexes["workbench"]["browser"]["product"],
    "viewport": indexes["workbench"]["viewport"],
    "viewPolicy": "No original declares known strings: Notation only. Clefs/time signatures Show, lyrics All verses. 31a uses three Workbench and two Studio scroll tiles; others fit one.",
    "fixtures": fixtures,
    "features": [{k: v for k, v in item.items() if k not in ("verdict", "cause", "reason")}
                 for item in features],
    "render": render,
    "unresolvedCases": [
        {"featureId": "31a.p01.m15.d01", "reason": "nestedboxes.png is referenced but absent from the pinned corpus; image ink is blocked, while the absence of a source-located importer diagnostic is observed."},
        {"featureId": "31d.p01.m01.d02", "reason": "The first molto omits xml:space; the manifest expressly leaves exact spacing to application interpretation. Compound grouping is still judged."},
    ],
    "captureNotes": ["The first combined Workbench capture stalled before 31f produced an observation. A separate bounded Workbench capture and separate Studio capture completed it; both original run indexes are retained. The 31f feature verdict uses the successful captures."],
    "deduplication": {
        "completed17": "Ordinary immediate dynamics and hairpins that already render are credited; this slice exposes above-placement, offset and compound-direction gaps beyond that implementation.",
        "completed22": "Ordinary meter and clef rendering is not refiled. Missing direction signs and style/ordering are separate.",
        "completed23": "Studio XML versions were made editable through the completed title workflow; no direct authoring or GP storage pass is inferred.",
        "proposed32": "Grace-local zero-time dynamic anchoring is distinct from these timed direction placement, tempo and compound-formatting cases.",
        "proposed33": "The source-grounded direction losses warrant one bounded follow-up, with resource and spacing ambiguities left explicit.",
    },
}
assert report["featureCount"] == 86 and report["renderRowCount"] == 172
OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
print(f"{OUT.relative_to(ROOT)}: {report['fixtureCount']} fixtures, "
      f"{report['featureCount']} features, {report['sourceVariantCount']} variants, "
      f"{report['renderRowCount']} rows, {report['verdictCounts']}")
