#!/usr/bin/env python3
"""Check pinned 21-series sources, browser imports/captures and agent render rows."""
from __future__ import annotations

from collections import Counter
from fractions import Fraction
from hashlib import sha256
import json
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
SUITE = ROOT / "converters/fixtures/musicxml-suite"
EVIDENCE = ROOT / "harness/fixtures/musicxml-chord-evidence"
OUT = ROOT / "harness/reports/musicxml-chord-assessment.json"
suite = json.loads((SUITE / "manifest.json").read_text())
listed = {f["id"]: f for f in suite["fixtures"]}
IDS = tuple(f["id"] for f in suite["fixtures"] if f["id"].startswith("21"))
assert len(IDS) == 9
evidence = json.loads((EVIDENCE / "manifest.json").read_text())
for file in evidence["files"]:
    assert sha256((EVIDENCE / file["path"]).read_bytes()).hexdigest() == file["sha256"]
indexes = {shell: json.loads((EVIDENCE / shell / "index.json").read_text())
           for shell in ("workbench", "studio")}

def position(value: Fraction) -> list[int]:
    return [value.numerator, value.denominator]

def pitch_info(note: ET.Element) -> dict | None:
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
    docs = {shell: json.loads((EVIDENCE / shell / fixture_id / "document.mnx.json").read_text())
            for shell in indexes}
    assert docs["workbench"] == docs["studio"], fixture_id
    mnx = docs["workbench"]
    assert len(mnx["parts"]) == len(xml.findall("part")) == 1
    parts = xml.findall("part")
    assert len(mnx["parts"][0]["measures"]) == len(parts[0].findall("measure"))
    notes, events, controls, measures = [], [], [], []
    divisions = 1
    for measure_no, (bar, imported_bar) in enumerate(
            zip(parts[0].findall("measure"), mnx["parts"][0]["measures"]), 1):
        at = Fraction()
        note_no = event_no = direction_no = 0
        source_events: list[dict] = []
        source_notes: list[dict] = []
        if bar.get("implicit") is not None:
            variant = f"{fixture_id}/p01/m{measure_no:02d}/implicit"
            variant_ids.add(variant)
            controls.append({"id": variant, "kind": "measureImplicit",
                             "part": 1, "measure": measure_no,
                             "value": bar.get("implicit"), "sourceMeasureNumber": bar.get("number")})
        for child in bar:
            if child.tag == "attributes":
                if child.findtext("divisions") is not None:
                    divisions = int(child.findtext("divisions"))
            elif child.tag == "direction":
                direction_no += 1
                variant = f"{fixture_id}/p01/m{measure_no:02d}/d{direction_no:02d}"
                variant_ids.add(variant)
                offset = Fraction(int(child.findtext("offset", "0")), divisions)
                types = [{ "kind": item.tag, "value": item.text.strip() if item.text else None,
                           "children": [x.tag for x in item] }
                         for item in child.findall("direction-type/*")]
                controls.append({"id": variant, "kind": "direction", "part": 1,
                                 "measure": measure_no,
                                 "onsetQuarter": position(at + offset),
                                 "sourceCursorQuarter": position(at),
                                 "types": types})
            elif child.tag == "note":
                note_no += 1
                variant = f"{fixture_id}/p01/m{measure_no:02d}/n{note_no:02d}"
                assert variant not in variant_ids
                variant_ids.add(variant)
                chord = child.find("chord") is not None
                if not chord:
                    event_no += 1
                    event_id = f"{fixture_id}/p01/m{measure_no:02d}/e{event_no:02d}"
                    variant_ids.add(event_id)
                    source_events.append({"id": event_id, "part": 1, "measure": measure_no,
                                          "onsetQuarter": position(at), "noteIds": [],
                                          "voice": child.findtext("voice"),
                                          "durationQuarter": position(Fraction(int(child.findtext("duration")), divisions)),
                                          "type": child.findtext("type"),
                                          "dots": len(child.findall("dot"))})
                else:
                    assert source_events, variant
                source_events[-1]["noteIds"].append(variant)
                accident = child.find("accidental")
                accidental = None if accident is None else {
                    "value": accident.text.strip(),
                    "cautionary": accident.get("cautionary", "no"),
                    "editorial": accident.get("editorial", "no"),
                    "parentheses": accident.get("parentheses"),
                    "bracket": accident.get("bracket")}
                note_row = {"id": variant, "eventId": source_events[-1]["id"],
                            "part": 1, "measure": measure_no,
                            "onsetQuarter": source_events[-1]["onsetQuarter"],
                            "pitch": pitch_info(child), "voice": child.findtext("voice"),
                            "chord": chord, "type": child.findtext("type"),
                            "dots": len(child.findall("dot")),
                            "durationQuarter": position(Fraction(int(child.findtext("duration")), divisions)),
                            "accidental": accidental}
                if accidental is not None:
                    control_id = variant + "/accidental"
                    variant_ids.add(control_id)
                    controls.append({"id": control_id, "kind": "accidental",
                                     "noteId": variant, **accidental})
                for tied_no, tied in enumerate(child.findall("notations/tied"), 1):
                    control_id = variant + f"/tied{tied_no:02d}"
                    variant_ids.add(control_id)
                    controls.append({"id": control_id, "kind": "tied", "noteId": variant,
                                     "type": tied.get("type"),
                                     "placement": tied.get("placement"),
                                     "orientation": tied.get("orientation")})
                for accent_no, accent in enumerate(child.findall("notations/articulations/accent"), 1):
                    control_id = variant + f"/accent{accent_no:02d}"
                    variant_ids.add(control_id)
                    controls.append({"id": control_id, "kind": "accent",
                                     "noteId": variant, "placement": accent.get("placement")})
                for fermata_no, fermata in enumerate(child.findall("notations/fermata"), 1):
                    control_id = variant + f"/fermata{fermata_no:02d}"
                    variant_ids.add(control_id)
                    controls.append({"id": control_id, "kind": "fermata",
                                     "noteId": variant, "type": fermata.get("type", "upright"),
                                     "shape": fermata.text.strip() if fermata.text else None})
                for tremolo_no, tremolo in enumerate(child.findall("notations/ornaments/tremolo"), 1):
                    control_id = variant + f"/tremolo{tremolo_no:02d}"
                    variant_ids.add(control_id)
                    controls.append({"id": control_id, "kind": "tremolo",
                                     "noteId": variant, "type": tremolo.get("type", "single"),
                                     "marks": int(tremolo.text)})
                source_notes.append(note_row)
                if not chord:
                    at += Fraction(int(child.findtext("duration")), divisions)
            elif child.tag == "backup":
                at -= Fraction(int(child.findtext("duration")), divisions)
            elif child.tag == "forward":
                at += Fraction(int(child.findtext("duration")), divisions)
        imported = imported_events(imported_bar)
        imported_note_pitches = [note["pitch"] for event in imported
                                 for note in event.get("notes", [])]
        source_note_pitches = [note["pitch"] for note in source_notes if note["pitch"] is not None]
        assert imported_note_pitches == source_note_pitches, (fixture_id, measure_no)
        if fixture_id != "21i-Chord-DifferentVoices":
            assert len(source_events) == len(imported), (fixture_id, measure_no)
            for src, imp in zip(source_events, imported):
                assert [next(n["pitch"] for n in source_notes if n["id"] == nid)
                        for nid in src["noteIds"] if
                        next(n["pitch"] for n in source_notes if n["id"] == nid) is not None] == \
                       [n["pitch"] for n in imp.get("notes", [])], src["id"]
                assert imp["duration"]["base"] == src["type"], src["id"]
                assert imp["duration"].get("dots", 0) == src["dots"], src["id"]
        notes.extend(source_notes)
        events.extend(source_events)
        measures.append({"part": 1, "ordinal": measure_no,
                         "sourceNumber": bar.get("number"),
                         "implicit": bar.get("implicit", "no"),
                         "sourceSpanQuarter": position(at),
                         "importedEventCount": len(imported),
                         "importedVoiceEvents": [{"voice": seq.get("voice"),
                                                  "events": [{"duration": event["duration"],
                                                              "pitchCount": len(event.get("notes", [])),
                                                              "rest": "rest" in event}
                                                             for event in seq.get("content", [])]}
                                                 for seq in imported_bar.get("sequences", [])]})
    for shell, index in indexes.items():
        assert index["applicationCommit"] == evidence["applicationCommit"]
        assert index["corpusRevision"] == suite["revision"] == evidence["corpusRevision"]
        assert index["browser"]["product"] == "Chrome/153.0.8010.36"
        assert index["viewport"] == {"width": 1440, "height": 1000, "deviceScaleFactor": 1}
        assert [f["id"] for f in index["fixtures"]] == list(IDS)
        row = next(r for r in index["fixtures"] if r["id"] == fixture_id)
        assert row["sourceSha256"] == entry["sha256"]
        assert not row.get("importError") and not row.get("captureError")
        assert row["warnings"] == [] and row["consoleErrors"] == []
        assert row["availableViews"] == ["notation"] and row["editorBound"] is True
        assert row["displayOptions"]["timeSignatures"] == "show"
        assert row["displayOptions"]["clefs"] == "show"
        if shell == "studio":
            assert row["editingSuspended"] is False and row["viewingOriginal"] is False
        assert len(row["views"]) == 1
        view = row["views"][0]
        assert view["view"] == "notation" and view["staffScale"] == 1 and view["densityH"] == 2
        assert view["renderErrors"] == [] and view["svgCount"] == 1
        assert view["scrollWidth"] <= view["clientWidth"] + 1
        assert view["scrollHeight"] <= view["clientHeight"] + 1
        assert view["screenshots"] == ["notation-0-0.png"]
    fixtures.append({"id": fixture_id, "sourcePath": entry["path"],
                     "sourceSha256": entry["sha256"], "testClass": entry["testClass"],
                     "description": entry["description"], "sourceDeclaresStrings": False,
                     "sourceMeasures": measures, "sourceEvents": events,
                     "sourceNotes": notes, "sourceControls": controls})

by_id = {f["id"]: f for f in fixtures}
assert [len(f["sourceNotes"]) for f in fixtures] == [3, 24, 21, 9, 6, 5, 20, 3, 4]
assert [len(f["sourceEvents"]) for f in fixtures] == [2, 12, 7, 5, 3, 3, 6, 1, 1]
assert sum(len(f["sourceNotes"]) for f in fixtures) == 95
assert sum(len(f["sourceEvents"]) for f in fixtures) == 40
assert sum(len(f["sourceControls"]) for f in fixtures) == 32
assert len(variant_ids) == 167

def rows(fixture: str, key: str, predicate=lambda row: True) -> list[str]:
    return [row["id"] for row in by_id[fixture][key] if predicate(row)]

def event_variants(fixture: str, predicate=lambda row: True) -> list[str]:
    events = [row for row in by_id[fixture]["sourceEvents"] if predicate(row)]
    return [item for row in events for item in (row["id"], *row["noteIds"])]

def feature(fid: str, fixture: str, variants: list[str], expected: str,
            verdict: str, cause: list[str], reason: str) -> dict:
    assert variants and all(v in variant_ids for v in variants)
    return {"id": fid, "fixture": fixture, "variantIds": variants,
            "sourceDescription": listed[fixture]["description"],
            "expected": expected, "verdict": verdict, "cause": cause, "reason": reason}

a, b, c, d, e, f, g, h, i = IDS
features = [
    feature("21a.two-note-chord", a, event_variants(a, lambda x: len(x["noteIds"]) == 2),
            "A4 and F4 share one quarter event and one stem.", "correct", [],
            "The two pitches share an imported event and visible quarter chord."),
    feature("21a.following-rest", a, event_variants(a, lambda x: len(x["noteIds"]) == 1),
            "A quarter rest follows the chord.", "correct", [],
            "The rest retains its quarter value and visible position; the remaining half bar is source-short and diagnosed."),
    feature("21b.repeated-two-note-chords", b, event_variants(b),
            "Twelve quarter chords retain both member pitches and rhythm.", "correct", [],
            "All 24 pitches group into twelve visible two-note quarter events."),
    feature("21b.tie-targets", b, rows(b, "sourceControls", lambda x: x["kind"] == "tied"),
            "Eight source tie starts reach the matching pitched notes in the next chord.", "correct", [],
            "Eight imported note-level target links resolve to the expected pitches and adjacent chords; all eight curves appear."),
    feature("21b.forced-tie-placement", b, rows(b, "sourceControls", lambda x: x["kind"] == "tied" and x["placement"] is not None),
            "The lower F4 tie is forced above and upper D5 tie below in the first third-bar pair.",
            "incorrect", ["importer"], "The published tie.side can carry up/down, but import drops both placement requests and layout draws default sides."),
    feature("21b.forced-tie-orientation", b, rows(b, "sourceControls", lambda x: x["kind"] == "tied" and x["orientation"] is not None),
            "The last third-bar pair preserves explicit overhand and underhand tie orientations.",
            "incorrect", ["importer", "MNX representation"],
            "The two orientation requests disappear; the displayed curves use the default shape. Exact orientation-to-MNX policy needs a carrier decision."),
    feature("21c.three-note-chord-members", c, event_variants(c),
            "All seven events are three-note chords with their source member pitches.", "correct", [],
            "All 21 pitches remain grouped in seven visible three-note events."),
    feature("21c.chord-duration-variants", c, rows(c, "sourceEvents"),
            "The dotted-quarter, eighth, quarter and half chord values remain distinct.", "correct", [],
            "MNX retains each base/dot; the corresponding heads, stems and dot appear in both shells."),
    feature("21d.words-and-dynamics", d, event_variants(d, lambda x: x["measure"] == 1) + rows(d, "sourceControls", lambda x: x["kind"] == "direction"),
            "Largo, fp and p remain visible at their respective bars.", "correct", [],
            "All three directions survive in MNX and are legible in both shells; their fine offset geometry is not separately approved."),
    feature("21d.first-bar-accent", d, rows(d, "sourceControls", lambda x: x["kind"] == "accent"),
            "The first whole note carries an accent below.", "missing", ["importer"],
            "The event-level MNX accent carrier exists, but the source notation is absent from imported MNX and no accent appears."),
    feature("21d.first-bar-fermata", d, rows(d, "sourceControls", lambda x: x["kind"] == "fermata"),
            "The first whole note carries an upright fermata.", "missing", ["importer"],
            "The event-level MNX fermata carrier exists, but import drops the source notation and no fermata appears."),
    feature("21d.second-bar-chords", d, event_variants(d, lambda x: x["measure"] == 2),
            "Four two-note chords follow the first-bar ornaments, with dotted-quarter, eighth and quarter values.",
            "correct", [], "All eight second-bar pitches group into four visible chords with matching written durations."),
    feature("21e.pickup-note", e, event_variants(e, lambda x: x["measure"] == 1),
            "The one-quarter opening note remains visible before the full numbered bar.", "correct", [],
            "The first C5 remains a distinct one-quarter opening event."),
    feature("21e.pickup-implicit-state", e, rows(e, "sourceControls", lambda x: x["kind"] == "measureImplicit"),
            "The implicit measure-zero pickup is recognized without a false 4/4 underfill badge.",
            "incorrect", ["importer", "MNX representation", "layout/SVG engine"],
            "MusicXML implicit=yes/number=0 is not carried; both shells issue a red 4/4 underfill badge on the pickup."),
    feature("21e.after-pickup-chords", e, event_variants(e, lambda x: x["measure"] == 2),
            "The numbered bar retains a C5-A4-F4 chord then a C5-A4 chord.",
            "correct", [], "Both source chord groups and pitches survive; the separate source-short second bar also receives a default-meter badge."),
    feature("21f.interleaved-chord-members", f, event_variants(f, lambda x: len(x["noteIds"]) == 3),
            "Directions interleaved between note elements do not split the A4-F#4-D4 chord.",
            "correct", [], "The three pitched members remain one quarter event despite the interposed directions."),
    feature("21f.directions-after-chord", f, rows(f, "sourceControls", lambda x: x["kind"] == "direction"),
            "Segno and p attach at the following rest rather than within the chord.",
            "correct", [], "Both imported positions are quarter 1 and their visible marks align with the first rest."),
    feature("21f.following-rests", f, event_variants(f, lambda x: len(x["noteIds"]) == 1),
            "Quarter and half rests follow the chord.", "correct", [],
            "The two rest values and positions match the source."),
    feature("21g.chord-member-pitches", g, event_variants(g, lambda x: len(x["noteIds"]) > 1),
            "Five chords retain their 4/4/4/4/3 pitched members and written values.",
            "correct", [], "All 19 pitches group into the expected five visible chords; the final eighth rest also survives."),
    feature("21g.final-rest", g, event_variants(g, lambda x: len(x["noteIds"]) == 1),
            "An eighth rest follows the five tremolo-bearing chords.", "correct", [],
            "The imported final eighth rest appears at the source position."),
    feature("21g.measured-member-tremolos", g, rows(g, "sourceControls", lambda x: x["kind"] == "tremolo" and x["type"] == "single"),
            "Four single tremolos with 4, 2, 1 and 3 marks remain on their selected chord members.",
            "missing", ["importer", "MNX representation"],
            "All four note-specific ornaments vanish without warning. Published event-level tremolo marks cannot identify their distinct chord members."),
    feature("21g.unmeasured-member-tremolo", g, rows(g, "sourceControls", lambda x: x["kind"] == "tremolo" and x["type"] == "unmeasured"),
            "The final chord's G4 carries an unmeasured tremolo distinct from counted marks.",
            "missing", ["importer", "MNX representation"],
            "The unmeasured type/zero value vanishes without warning; published single-tremolo marks require a positive count."),
    feature("21h.chord-pitches-and-glyphs", h, event_variants(h) + rows(h, "sourceControls", lambda x: x["kind"] == "accidental"),
            "D-flat, F-sharp and A-natural occupy one quarter chord with flat, sharp and natural ink.",
            "correct", [], "The three pitch/accidentalDisplay values survive and all three conventional signs are visible."),
    feature("21h.cautionary-editorial-identity", h, rows(h, "sourceControls", lambda x: x["kind"] == "accidental" and
            (x["cautionary"] == "yes" or x["editorial"] == "yes")),
            "The middle sharp is cautionary and upper natural editorial; their distinction remains inspectable and visibly meaningful.",
            "unresolved", ["importer", "source/reference ambiguity"],
            "Both semantic flags disappear and all three signs look ordinary. The source specifies no enclosure, so MusicXML leaves exact cautionary/editorial styling to application defaults; item 24 owns that policy."),
    feature("21i.four-pitches-present", i, rows(i, "sourceNotes"),
            "All four pitched notes survive the malformed cross-voice chord input.",
            "correct", [], "E5, C5, A4 and F4 all import and remain visible; this does not approve their grouping or onset."),
    feature("21i.simultaneous-onset", i, rows(i, "sourceEvents"),
            "The three chord-tagged tones share the first note's onset even though source voice labels disagree.",
            "incorrect", ["importer"],
            "Import splits vX and vY into two events, inserts a vY rest, and moves A4/F4 from quarter 0 to quarter 1."),
    feature("21i.cross-voice-engraving-policy", i, rows(i, "sourceEvents"),
            "Choose a graceful visual layout for an intentionally nonsensical chord spanning X and Y voices.",
            "unresolved", ["source/reference ambiguity"],
            "The score stays legible and does not crash, but the fixture leaves ideal voice/stem grouping to the application; the definite onset error is separately incorrect."),
]
assert len({f["id"] for f in features}) == len(features)
assert set.union(*(set(f["variantIds"]) for f in features)) == variant_ids
render = []
for feat in features:
    for shell in indexes:
        row = next(r for r in indexes[shell]["fixtures"] if r["id"] == feat["fixture"])
        render.append({"featureId": feat["id"], "shell": shell, "view": "notation",
                       "verdict": feat["verdict"], "cause": feat["cause"], "reason": feat["reason"],
                       "observationEvidence": f"harness/fixtures/musicxml-chord-evidence/{shell}/{feat['fixture']}/observation.json",
                       "documentEvidence": f"harness/fixtures/musicxml-chord-evidence/{shell}/{feat['fixture']}/document.mnx.json",
                       "svgEvidence": f"harness/fixtures/musicxml-chord-evidence/{shell}/{feat['fixture']}/notation-0.svg",
                       "screenshotEvidence": f"harness/fixtures/musicxml-chord-evidence/{shell}/{feat['fixture']}/notation-0-0.png",
                       "diagnosticTitles": row["views"][0]["diagnosticTitles"]})
counts = Counter(r["verdict"] for r in render)
report = {
    "kind": "implementation-loop agent render assessment; not human verification",
    "applicationCommit": evidence["applicationCommit"], "corpusRevision": suite["revision"],
    "scope": "Nine 21-series chord originals, source to current browser-imported MNX to complete Notation in both desktop shells",
    "fixtureCount": len(fixtures), "featureCount": len(features),
    "sourceNoteCount": sum(len(f["sourceNotes"]) for f in fixtures),
    "sourceEventCount": sum(len(f["sourceEvents"]) for f in fixtures),
    "sourceControlCount": sum(len(f["sourceControls"]) for f in fixtures),
    "sourceVariantCount": len(variant_ids), "renderRowCount": len(render),
    "browser": indexes["workbench"]["browser"]["product"],
    "viewport": indexes["workbench"]["viewport"],
    "viewPolicy": "No declared source strings; Notation only. Clefs and time signatures Show. Every complete score fits one viewport tile per shell.",
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
        {"featureId": "21h.cautionary-editorial-identity",
         "reason": "Cautionary/editorial semantic flags vanish, but the source specifies no explicit enclosure; exact glyph policy is application-dependent."},
        {"featureId": "21i.cross-voice-engraving-policy",
         "reason": "The fixture calls its cross-voice chord nonsensical and permits graceful application-specific handling. Its shifted onset is a separate definite error."},
        {"featureId": "21b.forced-tie-orientation",
         "reason": "The source orientation attributes disappear; mapping overhand/underhand shape to published side or another carrier needs explicit policy."},
    ],
    "deduplication": {
        "completed22": "Piano, fractional pitch, clef and meter repairs do not cover chord-member tremolo, tie side, note ornaments or pickup interpretation.",
        "completed23": "All nine Studio XML versions are editable after title repair; this render review does not credit authoring or GP persistence.",
        "proposed24": "21h confirms the already proposed cautionary/editorial default-policy and missing semantic identity; no duplicate accidental proposal.",
        "proposed29": "Bounded new follow-up for lost tie shape, representable accent/fermata, chord-member tremolos, pickup diagnostics and cross-voice onset containment.",
    },
}
OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
print(f"{OUT.relative_to(ROOT)}: {len(fixtures)} fixtures, {len(features)} features, {len(variant_ids)} variants, {len(render)} rows, {dict(counts)}")
