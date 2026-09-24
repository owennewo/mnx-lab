#!/usr/bin/env python3
"""Verify source variants, imported MNX and retained 22-series browser evidence."""
from __future__ import annotations

from collections import Counter
from fractions import Fraction
from hashlib import sha256
import json
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
SUITE = ROOT / "converters/fixtures/musicxml-suite"
EVIDENCE = ROOT / "harness/fixtures/musicxml-notehead-evidence"
OUT = ROOT / "harness/reports/musicxml-notehead-assessment.json"
suite = json.loads((SUITE / "manifest.json").read_text())
listed = {f["id"]: f for f in suite["fixtures"]}
IDS = tuple(f["id"] for f in suite["fixtures"] if f["id"].startswith("22"))
assert IDS == ("22a-Noteheads", "22b-Staff-Notestyles",
               "22c-Noteheads-Chords", "22d-Parenthesized-Noteheads")
evidence = json.loads((EVIDENCE / "manifest.json").read_text())
for file in evidence["files"]:
    assert sha256((EVIDENCE / file["path"]).read_bytes()).hexdigest() == file["sha256"]
indexes = {shell: json.loads((EVIDENCE / shell / "index.json").read_text())
           for shell in ("workbench", "studio")}


def ratio(value: Fraction) -> list[int]:
    return [value.numerator, value.denominator]


def pitch_of(note: ET.Element) -> dict | None:
    pitch = note.find("pitch")
    if pitch is None:
        return None
    result = {"step": pitch.findtext("step"), "octave": int(pitch.findtext("octave"))}
    if pitch.findtext("alter") is not None:
        result["alter"] = int(pitch.findtext("alter"))
    return result


def imported_events(measure: dict) -> list[dict]:
    return [event for sequence in measure.get("sequences", [])
            for event in sequence.get("content", [])]


fixtures = []
variant_ids: set[str] = set()
for fixture_id in IDS:
    entry = listed[fixture_id]
    original = SUITE / entry["path"]
    assert sha256(original.read_bytes()).hexdigest() == entry["sha256"]
    xml = ET.parse(original).getroot()
    assert not xml.findall(".//staff-tuning") and not xml.findall(".//technical/string")
    parts = xml.findall("part")
    assert len(parts) == 1
    docs = {shell: json.loads((EVIDENCE / shell / fixture_id / "document.mnx.json").read_text())
            for shell in indexes}
    assert docs["workbench"] == docs["studio"], fixture_id
    mnx = docs["workbench"]
    assert len(mnx["parts"]) == 1
    assert len(mnx["parts"][0]["measures"]) == len(parts[0].findall("measure"))
    notes: list[dict] = []
    events: list[dict] = []
    controls: list[dict] = []
    measures: list[dict] = []
    divisions = 1
    for measure_no, (bar, imported_bar) in enumerate(
            zip(parts[0].findall("measure"), mnx["parts"][0]["measures"]), 1):
        at = Fraction()
        note_no = event_no = style_no = detail_no = 0
        source_events: list[dict] = []
        source_notes: list[dict] = []
        for child in bar:
            if child.tag == "attributes":
                if child.findtext("divisions") is not None:
                    divisions = int(child.findtext("divisions"))
                for slash in child.findall("measure-style/slash"):
                    style_no += 1
                    control_id = f"{fixture_id}/p01/m{measure_no:02d}/ms{style_no:02d}"
                    variant_ids.add(control_id)
                    controls.append({"id": control_id, "kind": "slashStyle", "part": 1,
                                     "measure": measure_no, "onsetQuarter": ratio(at),
                                     "type": slash.get("type"),
                                     "useStems": slash.get("use-stems", "no"),
                                     "slashType": slash.findtext("slash-type")})
                for detail in child.findall("staff-details"):
                    detail_no += 1
                    control_id = f"{fixture_id}/p01/m{measure_no:02d}/sd{detail_no:02d}"
                    variant_ids.add(control_id)
                    controls.append({"id": control_id, "kind": "staffDetails", "part": 1,
                                     "measure": measure_no, "onsetQuarter": ratio(at),
                                     "staffLines": int(detail.findtext("staff-lines")),
                                     "printObject": detail.get("print-object", "yes")})
            elif child.tag == "note":
                note_no += 1
                note_id = f"{fixture_id}/p01/m{measure_no:02d}/n{note_no:02d}"
                assert note_id not in variant_ids
                variant_ids.add(note_id)
                chord = child.find("chord") is not None
                duration = Fraction(int(child.findtext("duration")), divisions)
                if not chord:
                    event_no += 1
                    event_id = f"{fixture_id}/p01/m{measure_no:02d}/e{event_no:02d}"
                    variant_ids.add(event_id)
                    source_events.append({"id": event_id, "part": 1,
                                          "measure": measure_no, "onsetQuarter": ratio(at),
                                          "durationQuarter": ratio(duration),
                                          "type": child.findtext("type"),
                                          "noteIds": []})
                else:
                    assert source_events
                source_events[-1]["noteIds"].append(note_id)
                head = child.find("notehead")
                rest = child.find("rest")
                rest_info = None if rest is None else {
                    "measure": rest.get("measure", "no"),
                    "displayStep": rest.findtext("display-step"),
                    "displayOctave": rest.findtext("display-octave")}
                head_info = None if head is None else {
                    "value": head.text.strip(), "filled": head.get("filled"),
                    "parentheses": head.get("parentheses", "no"),
                    "smufl": head.get("smufl")}
                lyrics = [{"number": lyric.get("number"), "text": lyric.findtext("text")}
                          for lyric in child.findall("lyric")]
                source_notes.append({"id": note_id, "eventId": source_events[-1]["id"],
                                     "part": 1, "measure": measure_no,
                                     "onsetQuarter": source_events[-1]["onsetQuarter"],
                                     "pitch": pitch_of(child), "rest": rest_info,
                                     "chord": chord, "durationQuarter": ratio(duration),
                                     "type": child.findtext("type"), "head": head_info,
                                     "printObject": child.get("print-object", "yes"),
                                     "printLyric": child.get("print-lyric"),
                                     "lyrics": lyrics})
                if head_info is not None:
                    control_id = note_id + "/head"
                    variant_ids.add(control_id)
                    controls.append({"id": control_id, "kind": "notehead",
                                     "noteId": note_id, **head_info})
                if child.get("print-object") is not None:
                    control_id = note_id + "/print-object"
                    variant_ids.add(control_id)
                    controls.append({"id": control_id, "kind": "noteVisibility",
                                     "noteId": note_id, "value": child.get("print-object")})
                if child.get("print-lyric") is not None:
                    control_id = note_id + "/print-lyric"
                    variant_ids.add(control_id)
                    controls.append({"id": control_id, "kind": "lyricVisibility",
                                     "noteId": note_id, "value": child.get("print-lyric")})
                if rest is not None and rest.find("display-step") is not None:
                    control_id = note_id + "/rest-position"
                    variant_ids.add(control_id)
                    controls.append({"id": control_id, "kind": "restPosition",
                                     "noteId": note_id,
                                     "displayStep": rest.findtext("display-step"),
                                     "displayOctave": rest.findtext("display-octave")})
                if not chord:
                    at += duration
            elif child.tag == "backup":
                at -= Fraction(int(child.findtext("duration")), divisions)
            elif child.tag == "forward":
                at += Fraction(int(child.findtext("duration")), divisions)
        imported = imported_events(imported_bar)
        assert len(imported) == len(source_events), (fixture_id, measure_no)
        assert [n["pitch"] for n in source_notes if n["pitch"] is not None] == [
            n["pitch"] for event in imported for n in event.get("notes", [])], (fixture_id, measure_no)
        for src, imp in zip(source_events, imported):
            src_members = [next(n for n in source_notes if n["id"] == nid)
                           for nid in src["noteIds"]]
            assert [n["pitch"] for n in src_members if n["pitch"] is not None] == [
                n["pitch"] for n in imp.get("notes", [])], src["id"]
            assert ("rest" in imp) == (src_members[0]["rest"] is not None), src["id"]
            expected_base = src["type"] or {Fraction(4): "whole"}[Fraction(*src["durationQuarter"])]
            assert imp["duration"]["base"] == expected_base, src["id"]
        notes.extend(source_notes)
        events.extend(source_events)
        measures.append({"part": 1, "ordinal": measure_no,
                         "sourceNumber": bar.get("number"),
                         "sourceSpanQuarter": ratio(at),
                         "importedEventCount": len(imported)})
    for shell, index in indexes.items():
        assert index["applicationCommit"] == evidence["applicationCommit"]
        assert index["corpusRevision"] == suite["revision"] == evidence["corpusRevision"]
        assert index["captureScriptSha256"] == sha256(
            (ROOT / "harness/verify/musicxml-editor-capture.mjs").read_bytes()).hexdigest()
        assert index["browser"]["product"] == "Chrome/153.0.8010.36"
        assert index["viewport"] == {"width": 1440, "height": 1000, "deviceScaleFactor": 1}
        assert [f["id"] for f in index["fixtures"]] == list(IDS)
        row = next(f for f in index["fixtures"] if f["id"] == fixture_id)
        assert row["sourceSha256"] == entry["sha256"]
        assert not row.get("importError") and not row.get("captureError")
        assert row["consoleErrors"] == []
        assert row["availableViews"] == ["notation"] and row["editorBound"] is True
        assert row["displayOptions"]["timeSignatures"] == "show"
        assert row["displayOptions"]["clefs"] == "show"
        assert row["displayOptions"]["lyrics"] == "all"
        if shell == "studio":
            assert row["editingSuspended"] is False and row["viewingOriginal"] is False
        assert len(row["views"]) == 1
        view = row["views"][0]
        assert view["view"] == "notation" and view["staffScale"] == 1 and view["densityH"] == 2
        assert view["renderErrors"] == [] and view["svgCount"] == 1
        assert view["scrollWidth"] <= view["clientWidth"] + 1
        assert view["diagnosticTitles"] == []
        expected_tiles = {
            ("workbench", "22a-Noteheads"): ["notation-0-0.png", "notation-0-653.png", "notation-0-673.png"],
            ("studio", "22a-Noteheads"): ["notation-0-0.png", "notation-0-88.png"],
        }.get((shell, fixture_id), ["notation-0-0.png"])
        assert view["screenshots"] == expected_tiles
        assert view["scrollHeight"] <= view["clientHeight"] + 1 or fixture_id == "22a-Noteheads"
        assert row["warnings"] == ({
            "22b-Staff-Notestyles": ["part P1, measure 5, staff 1: unsupported staff configuration (0 staff lines); not represented in MNX."],
            "22d-Parenthesized-Noteheads": ["part P1, measure 1: incompatible time symbol common for 6/4; retaining numeric meter."],
        }.get(fixture_id, []))
    fixtures.append({"id": fixture_id, "sourcePath": entry["path"],
                     "sourceSha256": entry["sha256"], "testClass": entry["testClass"],
                     "description": entry["description"], "sourceDeclaresStrings": False,
                     "sourceMeasures": measures, "sourceEvents": events,
                     "sourceNotes": notes, "sourceControls": controls})

by_id = {f["id"]: f for f in fixtures}
assert [len(f["sourceNotes"]) for f in fixtures] == [114, 24, 28, 10]
assert [len(f["sourceEvents"]) for f in fixtures] == [114, 24, 20, 6]
assert [len(f["sourceControls"]) for f in fixtures] == [114, 16, 11, 9]
assert len(variant_ids) == 490
assert sum(n["head"] is not None and n["head"]["filled"] == "no"
           for n in by_id[IDS[0]]["sourceNotes"]) == 42
assert sum(n["printObject"] == "no" for n in by_id[IDS[1]]["sourceNotes"]) == 8
assert sum(len(n["lyrics"]) for n in by_id[IDS[2]]["sourceNotes"]) == 12
assert sum(n["head"] is not None and n["head"]["parentheses"] == "yes"
           for n in by_id[IDS[3]]["sourceNotes"]) == 8


def imported_document(fixture: str) -> dict:
    return json.loads((EVIDENCE / "workbench" / fixture / "document.mnx.json").read_text())


def imported_measure_events(fixture: str, measure: int) -> list[dict]:
    return imported_events(imported_document(fixture)["parts"][0]["measures"][measure - 1])


for fixture in (IDS[0], IDS[2], IDS[3]):
    assert all("head" not in note and "notehead" not in note
               for measure in imported_document(fixture)["parts"][0]["measures"]
               for event in imported_events(measure) for note in event.get("notes", []))
assert all("printObject" not in event and "hidden" not in event
           for measure in imported_document(IDS[1])["parts"][0]["measures"]
           for event in imported_events(measure))
assert [set(imported_measure_events(IDS[2], m)[0]["lyrics"]["lines"])
        for m in (1, 3, 5, 7)] == [{"1"}] * 4
assert imported_measure_events(IDS[3], 1)[-1]["rest"] == {}
assert by_id[IDS[3]]["sourceNotes"][-1]["rest"] == {
    "measure": "no", "displayStep": "E", "displayOctave": "4"}
for fixture in (IDS[0], IDS[1]):
    source = by_id[fixture]
    for measure in source["sourceMeasures"]:
        ordinal = measure["ordinal"]
        source_events = [e for e in source["sourceEvents"] if e["measure"] == ordinal]
        imported = imported_measure_events(fixture, ordinal)
        for src, imp in zip(source_events, imported):
            expected = {lyric["number"]: lyric["text"]
                        for note in source["sourceNotes"] if note["eventId"] == src["id"]
                        for lyric in note["lyrics"]}
            actual = {number: line["text"]
                      for number, line in imp.get("lyrics", {}).get("lines", {}).items()}
            assert actual == expected, src["id"]


def rows(fixture: str, key: str, predicate=lambda row: True) -> list[str]:
    return [row["id"] for row in by_id[fixture][key] if predicate(row)]


def context(fixture: str, measures: set[int] | None = None,
            note_predicate=lambda row: True, control_predicate=lambda row: True) -> list[str]:
    notes = [n for n in by_id[fixture]["sourceNotes"]
             if (measures is None or n["measure"] in measures) and note_predicate(n)]
    note_ids = {n["id"] for n in notes}
    events = {n["eventId"] for n in notes}
    controls = [c["id"] for c in by_id[fixture]["sourceControls"]
                if control_predicate(c) and (c.get("noteId") in note_ids or
                ("noteId" not in c and (measures is None or c["measure"] in measures)))]
    return sorted(events | note_ids | set(controls))


def feature(fid: str, fixture: str, variants: list[str], expected: str,
            verdict: str, cause: list[str], reason: str) -> dict:
    assert variants and all(v in variant_ids for v in variants)
    return {"id": fid, "fixture": fixture, "variantIds": variants,
            "sourceDescription": listed[fixture]["description"],
            "expected": expected, "verdict": verdict, "cause": cause, "reason": reason}


a, b, c, d = IDS
features = [
    feature("22a.pitch-rhythm", a,
            context(a, control_predicate=lambda _: False),
            "All 114 pitched events retain their source order, pitch, duration and staff placement.",
            "correct", [],
            "The browser-imported MNX matches every source pitch and written quarter/half duration; all 32 bars are visible across the retained tiles. This does not approve their head shapes."),
    feature("22a.style-labels", a,
            context(a, note_predicate=lambda n: bool(n["lyrics"]),
                    control_predicate=lambda _: False),
            "Source style labels remain legible under the associated notes with All verses shown.",
            "correct", [],
            "The imported event lyrics and complete tiled views retain the source labels; current-verse defaults were changed to All verses before this verdict."),
]

for measure in range(1, 15):
    source = [n for n in by_id[a]["sourceNotes"] if n["measure"] == measure]
    assert len(source) == 4
    names = list(dict.fromkeys(n["head"]["value"] for n in source))
    slug = "-".join(name.replace(" ", "-") for name in names)
    ordinary = names == ["normal"]
    features.append(feature(
        f"22a.quarter-head.{slug}", a, context(a, {measure}),
        f"Bar {measure} shows {', '.join(names)} quarter heads; the last pair explicitly sets filled=no.",
        "partial" if ordinary else "incorrect",
        ["importer", "MNX representation"],
        ("The first two ordinary black heads match, but both explicitly unfilled quarter heads draw black."
         if ordinary else "All four source head values disappear from MNX and draw as ordinary black ovals; the filled=no attributes also vanish.")))

for measure in range(15, 22):
    source = [n for n in by_id[a]["sourceNotes"] if n["measure"] == measure]
    assert len(source) == 2
    for note in source:
        name = note["head"]["value"]
        slug = name.replace(" ", "-")
        ordinary = name == "normal"
        features.append(feature(
            f"22a.half-head.{slug}", a,
            context(a, {measure}, note_predicate=lambda n, note=note: n["id"] == note["id"]),
            f"The source half note uses the {name} head with default fill semantics.",
            "correct" if ordinary else "incorrect",
            [] if ordinary else ["importer", "MNX representation"],
            ("The default hollow half-note oval matches this explicit normal head."
             if ordinary else "The imported note has no shape choice; both shells show a generic hollow oval.")))

for measure in range(22, 29):
    source = [n for n in by_id[a]["sourceNotes"] if n["measure"] == measure]
    assert len(source) == 4 and len({n["head"]["value"] for n in source}) == 1
    name = source[0]["head"]["value"]
    features.append(feature(
        f"22a.aiken-head.{name}", a, context(a, {measure}),
        f"Four quarter notes use Aiken {name} heads, including two with filled=no.",
        "incorrect", ["importer", "MNX representation"],
        "All four Aiken shapes and both filled=no attributes vanish from MNX; black ovals display instead."))

for slug, measures in (("low-scale", {29, 30}), ("high-scale", {31, 32})):
    features.append(feature(
        f"22a.aiken-{slug}", a, context(a, measures),
        "Eight ascending scale tones retain their distinct do/re/mi/fa/so/la/ti/do heads and source pitches.",
        "incorrect", ["importer", "MNX representation"],
        "The eight source pitches and changing key context survive, but their Aiken head identities vanish and every head is an ordinary black oval."))

features.append(feature(
    "22a.explicit-filled-no", a,
    context(a, note_predicate=lambda n: n["head"] is not None and n["head"]["filled"] == "no"),
    "Forty-two quarter noteheads retain their explicit filled=no intent; enclosed shapes use their unfilled forms where applicable.",
    "incorrect", ["importer", "MNX representation"],
    "All 42 override attributes disappear and both shells draw filled black ovals. The exact visual effect depends on each source shape; quarter durations survive."))

features.extend([
    feature("22b.normal-opening", b, context(b, {1}),
            "Bar 1 has four ordinary pitched quarters on a five-line staff.",
            "correct", [], "Pitch, values, normal staff and first descriptor lyric remain visible."),
    feature("22b.slash-without-stems", b, context(b, {2}),
            "The first slash-style span suppresses pitched heads and stems while keeping four quarter beats.",
            "incorrect", ["importer", "MNX representation"],
            "Both start/stop slash declarations vanish from MNX. Four ordinary pitched/stemmed notes print in both shells."),
    feature("22b.slash-with-stems", b, context(b, {3}),
            "The second slash-style span shows quarter slashes with stems but no pitch-specific heads.",
            "incorrect", ["importer", "MNX representation"],
            "The use-stems=yes span is absent from MNX; ordinary pitched oval heads and stems print instead."),
    feature("22b.hidden-notes-on-staff", b, context(b, {4}),
            "All four bar-4 note objects are hidden while the five-line staff remains.",
            "incorrect", ["importer", "MNX representation"],
            "All four print-object=no attributes vanish; both shells display ordinary black notes on five lines."),
    feature("22b.hidden-notes-without-staff", b, context(b, {5}),
            "All four bar-5 note objects remain hidden in the staffless passage.",
            "incorrect", ["importer", "MNX representation"],
            "The four visibility flags vanish and black noteheads/stems print; the independent zero-line configuration also disappears."),
    feature("22b.zero-staff-lines", b,
            rows(b, "sourceControls", lambda x: x["kind"] == "staffDetails" and x["staffLines"] == 0),
            "Bar 5 has zero printed staff lines.",
            "incorrect", ["importer", "MNX representation"],
            "Five lines print, but item 22's source-located unsupported-staff warning correctly names measure 5 and zero lines. Full line geometry remains its documented deferral."),
    feature("22b.hidden-lyric-overrides", b,
            context(b, {4, 5}, note_predicate=lambda n: n["printLyric"] == "yes"),
            "The first hidden note in each bar still prints all its lyric lines because print-lyric=yes is explicit.",
            "partial", ["importer", "MNX representation"],
            "With All verses shown, both bars display their two preserved lyric lines, but the print-lyric override is absent from MNX and the notes wrongly remain visible."),
    feature("22b.restored-ordinary-staff", b, context(b, {6}),
            "Bar 6 restores five staff lines and four visible ordinary quarters.",
            "correct", [], "The final bar shows five lines, all four pitches and its three descriptor lyric lines."),
    feature("22c.chord-pitches-and-grouping", c,
            context(c, note_predicate=lambda n: n["pitch"] is not None,
                    control_predicate=lambda _: False),
            "Four isolated E5/C5/A4 quarter chords retain three simultaneous source pitches each.",
            "correct", [], "All twelve pitches group into four visible three-note chords; this does not approve per-member head or lyric identity."),
    feature("22c.rest-pattern", c,
            context(c, note_predicate=lambda n: n["rest"] is not None,
                    control_predicate=lambda _: False),
            "Each chord bar has three quarter rests and each following even bar has a full-measure rest.",
            "correct", [], "All twelve quarter rests and four following whole-measure rests retain their positions and values."),
])

for measure, label in ((1, "triangle-slash"), (3, "cross-square-diamond"),
                       (5, "inverted-triangle-circle-x-x"),
                       (7, "slashed-arrow-up-arrow-down")):
    features.append(feature(
        f"22c.member-heads.{label}", c,
        context(c, {measure}, note_predicate=lambda n: n["pitch"] is not None),
        "The three simultaneous chord members use their own source notehead values.",
        "incorrect", ["importer", "MNX representation"],
        "Per-member head values vanish before MNX; the chord groups correctly, but all three visible heads are ordinary black ovals."))

features.extend([
    feature("22c.member-lyric-stanzas", c,
            context(c, note_predicate=lambda n: n["pitch"] is not None,
                    control_predicate=lambda _: False),
            "Each chord member's style label appears in its numbered lyric line 1, 2 or 3 when All verses is selected.",
            "missing", ["importer"],
            "The source has 12 numbered member lyrics, but imported event lyrics retain only the four line-1 labels; All verses still shows only the upper member's word."),
    feature("22d.pitch-rhythm-and-grouping", d,
            context(d, control_predicate=lambda _: False),
            "The four pitched events, two quarter rests and both three-note chord groups retain their note counts and onsets.",
            "correct", [], "All eight pitches, two rests and six quarter events survive; this does not approve head parentheses or explicit rest height."),
])

for fid, numbers, expected, reason in (
    ("single-normal-parentheses", {1}, "The first ordinary A4 quarter head has parentheses.",
     "The normal head remains but no parentheses are carried or drawn."),
    ("single-x-parentheses", {2}, "The second A4 has an x head inside parentheses.",
     "Both x identity and enclosing parentheses disappear; an ordinary black head prints."),
    ("middle-chord-member-parentheses", {4}, "Only C5, the middle member of the first chord, is parenthesized.",
     "The three pitches group, but the C5-only enclosure disappears."),
    ("whole-chord-parentheses", {6, 7, 8}, "Each member of the second three-note chord has its own parentheses.",
     "All three source enclosures disappear while the three black heads remain."),
    ("ordinary-rest-parentheses", {9}, "The first quarter rest is parenthesized.",
     "The quarter rest appears without the requested parentheses."),
    ("pitched-rest-parentheses", {10}, "The last quarter rest is parenthesized and positioned at E4.",
     "The parentheses and E4 rest placement disappear; both rests print at the default height. The position loss is already proposed under item 25."),
):
    features.append(feature(
        f"22d.{fid}", d,
        context(d, note_predicate=lambda n, numbers=numbers: int(n["id"].split("/n")[-1]) in numbers),
        expected, "incorrect",
        ["importer", "MNX representation"],
        reason))

assert len({f["id"] for f in features}) == len(features)
assert set.union(*(set(f["variantIds"]) for f in features)) == variant_ids
render = []
for feat in features:
    for shell in indexes:
        row = next(r for r in indexes[shell]["fixtures"] if r["id"] == feat["fixture"])
        render.append({"featureId": feat["id"], "shell": shell, "view": "notation",
                       "verdict": feat["verdict"], "cause": feat["cause"], "reason": feat["reason"],
                       "observationEvidence": f"harness/fixtures/musicxml-notehead-evidence/{shell}/{feat['fixture']}/observation.json",
                       "documentEvidence": f"harness/fixtures/musicxml-notehead-evidence/{shell}/{feat['fixture']}/document.mnx.json",
                       "svgEvidence": f"harness/fixtures/musicxml-notehead-evidence/{shell}/{feat['fixture']}/notation-0.svg",
                       "screenshotEvidence": [f"harness/fixtures/musicxml-notehead-evidence/{shell}/{feat['fixture']}/{name}"
                                              for name in row["views"][0]["screenshots"]],
                       "diagnosticTitles": row["views"][0]["diagnosticTitles"]})
counts = Counter(r["verdict"] for r in render)
report = {
    "kind": "implementation-loop agent render assessment; not human verification",
    "applicationCommit": evidence["applicationCommit"], "corpusRevision": suite["revision"],
    "scope": "Four 22-series originals, source to browser-imported MNX to complete Notation with All verses in both desktop shells",
    "fixtureCount": len(fixtures), "featureCount": len(features),
    "sourceNoteCount": sum(len(f["sourceNotes"]) for f in fixtures),
    "sourceEventCount": sum(len(f["sourceEvents"]) for f in fixtures),
    "sourceControlCount": sum(len(f["sourceControls"]) for f in fixtures),
    "sourceVariantCount": len(variant_ids), "renderRowCount": len(render),
    "browser": indexes["workbench"]["browser"]["product"],
    "viewport": indexes["workbench"]["viewport"],
    "viewPolicy": "No declared strings; Notation only. Clefs and time signatures Show, Lyrics All verses. Complete 22a requires three Workbench and two Studio scroll tiles; other scores fit one tile.",
    "fixtures": fixtures,
    "features": [{k: v for k, v in f.items() if k not in ("verdict", "cause", "reason")}
                 for f in features],
    "render": render,
    "renderVariantDispositions": [
        {"featureId": f["id"], "variantId": variant, "shells": ["workbench", "studio"],
         "view": "notation", "verdict": f["verdict"], "reason": f["reason"]}
        for f in features for variant in f["variantIds"]],
    "verdictCounts": dict(sorted(counts.items())),
    "unresolvedCases": [
        {"featureId": "22a.quarter-head.arrow-down-arrow-up",
         "reason": "A future carrier needs a glyph mapping for every source notehead value; the current omission is definite, while exact SMuFL selection is a design decision."},
        {"featureId": "22b.zero-staff-lines",
         "reason": "The zero-line score is diagnosed under completed item 22; full staff geometry still awaits its documented representation/layout decision."},
    ],
    "deduplication": {
        "completed22": "22b measure 5 zero-line diagnostic is already implemented and the full geometry was expressly deferred; the common-symbol 6/4 warning in 22d is also existing meter containment.",
        "completed23": "All four Studio imported XML versions are current and editable after the title-path fix; these render captures do not credit authoring or GP persistence.",
        "proposed25": "22d's positioned rest is another original-file witness for the already proposed rest-placement gap; do not open a duplicate rest item.",
        "proposed30": "The new notehead, slash-style, hidden-note and chord-member lyric losses have bounded follow-up evidence.",
    },
}
OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
print(f"{OUT.relative_to(ROOT)}: {len(fixtures)} fixtures, {len(features)} features, {len(variant_ids)} variants, {len(render)} rows, {dict(counts)}")
