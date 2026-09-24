"""Rebuild the reviewed 03-series source/import inventory and render verdicts.

This checks pinned XML against actual current browser imports. Feature verdicts
are agent review of the retained Notation SVG/PNG, not batch-load inference.
"""

import hashlib
import json
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SUITE = ROOT / "converters/fixtures/musicxml-suite"
EVIDENCE = ROOT / "harness/fixtures/musicxml-rhythm-evidence"
OUTPUT = ROOT / "harness/reports/musicxml-rhythm-assessment.json"
manifest = json.loads((SUITE / "manifest.json").read_text())
fixtures = [f for f in manifest["fixtures"] if f["id"].startswith("03")]
BASE = {"maxima": Fraction(32), "longa": Fraction(16), "breve": Fraction(8),
        "whole": Fraction(4), "half": Fraction(2), "quarter": Fraction(1),
        "eighth": Fraction(1, 2), "16th": Fraction(1, 4),
        "32nd": Fraction(1, 8), "64th": Fraction(1, 16),
        "128th": Fraction(1, 32), "256th": Fraction(1, 64),
        "512th": Fraction(1, 128), "1024th": Fraction(1, 256)}


def fraction(value):
    return f"{value.numerator}/{value.denominator}"


def mnx_span(item):
    if item.get("type") == "space":
        n, d = item["duration"]
        return Fraction(n * 4, d)
    duration = item["duration"]
    base = BASE[duration["base"]]
    dots = duration.get("dots", 0)
    return base * Fraction(2 ** (dots + 1) - 1, 2 ** dots)


def features_for_note(fixture_id, measure, note):
    kind = "rest" if note.find("rest") is not None else "note"
    if fixture_id.startswith("03a"):
        type_name = note.findtext("type")
        if type_name in ("maxima", "long", "breve"):
            return ["03a.long-values"]
        if type_name in ("256th", "512th", "1024th"):
            return ["03a.short-values"]
        return ["03a.standard-values"]
    if fixture_id.startswith("03b"):
        return ["03b.partial-backup-onsets"]
    if fixture_id.startswith("03c"):
        return ["03c.midmeasure-divisions"]
    if fixture_id.startswith("03d"):
        result = ["03d.meter-context"]
        if kind == "rest":
            result.append("03d.full-bar-rest-values")
        if note.findall("dot"):
            result.append("03d.dotted-pitched-values")
        if measure == 15:
            result.append("03d.unfilled-bar")
        return result
    if fixture_id.endswith("No-Divisions"):
        return ["03e.default-divisions"]
    if fixture_id.endswith("SecondaryBeamBreaks"):
        return ["03e.secondary-beam-breaks"]
    return ["03f.note-onsets", "03f.unwritten-forward-gaps"] if measure == 1 else ["03f.note-onsets"]


def features_for_control(fixture_id, tag):
    if fixture_id.startswith("03b") and tag == "backup":
        return ["03b.partial-backup-onsets", "03b.unwritten-voice-gap"]
    if fixture_id.startswith("03c") and tag == "divisions":
        return ["03c.midmeasure-divisions"]
    if fixture_id.startswith("03d") and tag == "time":
        return ["03d.meter-context"]
    if fixture_id.startswith("03d") and tag == "multi":
        return ["03d.full-bar-rest-values"]
    if fixture_id.startswith("03f") and tag == "forward":
        return ["03f.unwritten-forward-gaps"]
    return []


# Each tuple is an independently reviewed source feature. Mixed rows name the
# exact surviving/wrong subset in the reason; variant records retain raw values.
FEATURES = {
    "03a.long-values": ("Maxima, longa and breve, each plain, dotted and double-dotted, retain their written duration and distinctive long-value ink.", "incorrect", ["importer", "layout/SVG engine"], "All nine import as whole+3 dots and display whole-note heads with three dots. The isolated MNX probe shows the layout also draws authored maxima/longa/breve with black heads, so fixing import alone will not restore their ink."),
    "03a.standard-values": ("Whole through 128th notes retain their ordinary glyphs and zero/one/two dots in each ladder, at the source's metric positions.", "partial", ["importer"], "All 24 written bases and dot counts survive and are visible, but preceding long-value collapse shifts their onsets and compresses each bar. These are value matches, not full phrase or bar passes."),
    "03a.short-values": ("The 256th, 512th and two 1024th notes in each ladder keep distinct flags and dot counts.", "incorrect", ["importer"], "All 12 import as undotted 128ths and show repeated 128th flags, without warning. The isolated MNX probe shows 256th/512th/1024th flag glyphs exist in layout."),
    "03b.partial-backup-onsets": ("Voice 1 has C4 at beats 1 and 2; a partial backup puts voice-2 A3 at beats 2 and 3.", "correct", [], "Both voices, pitches and four source note onsets survive. Both shells place the voices at the intended beats; unwritten beat-1 ink is a separate finding."),
    "03b.unwritten-voice-gap": ("Voice 2 has no visible rest or note on beat 1 before its first A3.", "incorrect", ["importer"], "The importer adds an explicit quarter-rest event in voice 2; both shells print a quarter rest absent from XML. Published MNX space can represent uninked time."),
    "03c.midmeasure-divisions": ("Changing divisions 1→8 mid-bar and 8→38 in the next bar leaves four quarter notes then two halves in place.", "correct", [], "The six notes keep exact quarter-based onset and duration after each divisions change; both shells draw four quarters and two halves without error."),
    "03d.dotted-pitched-values": ("The bar-5 dotted half and bar-11 double-dotted half retain their written durations and dots.", "correct", [], "Both types and dot counts survive import and both shells show one and two dots respectively."),
    "03d.full-bar-rest-values": ("Each even bar is a one-measure rest matching its 1/8, 2/8, 3/4, 4/4, 5/16, 7/8, 9/8 or 31/8 meter.", "partial", ["importer"], "All eight source multiple-rest=1 markers vanish. Five imported rest durations match; 5/16 becomes a quarter, 9/8 becomes a whole, and 31/8 becomes whole+3, changing visible rest ink and metric meaning without warnings. The one-bar range work belongs with proposed item 25."),
    "03d.meter-context": ("The alternating note/rest bars show their changing meters, including 5/16, 9/8 and 31/8.", "correct", [], "All source meter fractions appear in imported global measures and in both shells with Time signatures set to Show. The mismatched full-bar rests are separately judged."),
    "03d.unfilled-bar": ("Bar 15 contains one 16th note and no fabricated rest for its remaining 31/8 span.", "correct", [], "Imported bar 15 contains just the 16th note; both shells show it without an invented rest. The underfill diagnostic truthfully describes the intentionally incomplete bar."),
    "03e.default-divisions": ("With <divisions> absent, duration 4 and type whole print a single C4 whole note.", "correct", [], "The source-described default of one division per quarter and explicit whole type yield one C4 whole in MNX and both shells. The existing music21 import oracle reports a conflicting metric value; this visual verdict does not resolve that external-tool discrepancy."),
    "03e.secondary-beam-breaks": ("Four eight-note 32nd scales keep their distinct second- and third-level beam breaks.", "correct", [], "All 32 note values and pitches survive; source beam groups match the imported nested groups at levels 1–3, and both shell captures visibly separate the requested secondary and tertiary spans."),
    "03f.note-onsets": ("The first bar's C4 quarter falls on beat 2, its C4 16th on beat 4, and the next bar begins with C4 quarter.", "correct", [], "All three note onsets and written values match source and imported MNX. The extra rest ink and missing trailing empty span are judged separately."),
    "03f.unwritten-forward-gaps": ("Three <forward> intervals place the notes and complete the first bar without any visible rests.", "incorrect", ["importer"], "The first two intervals become printed quarter rests; the final 3/16-whole empty span is omitted, so the first imported bar underfills. A published MNX space probe retains the three notes, draws no rest glyph and removes the first-bar underfill."),
}


def source_beam_groups(notes, level):
    groups, run = [], []
    for index, note in enumerate(notes, 1):
        value = next(((beam.text or "").strip() for beam in note.findall("beam")
                      if beam.get("number") == str(level)), None)
        if value == "begin":
            assert not run
            run = [index]
        elif value == "continue":
            assert run
            run.append(index)
        elif value == "end":
            assert run
            run.append(index)
            groups.append(run)
            run = []
        elif value is not None:
            raise AssertionError((level, value))
    assert not run
    return groups


def imported_beam_groups(beams, event_index, depth=1, output=None):
    output = output if output is not None else defaultdict(list)
    for beam in beams:
        output[depth].append([event_index[event_id] for event_id in beam["events"]])
        imported_beam_groups(beam.get("beams", []), event_index, depth + 1, output)
    return output


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
        assert observation["availableViews"] == ["notation"]
        assert [v["view"] for v in observation["views"]] == ["notation"]
        assert observation["displayOptions"]["timeSignatures"] == "show"
        assert observation["views"][0]["screenshots"] and not observation["views"][0]["renderErrors"]
        if shell == "studio":
            assert observation["editorBound"] and not observation["editingSuspended"]
        assert len(document["parts"][0]["measures"]) == len(measures)
        shells[shell] = (document, observation)
    assert shells["workbench"][0] == shells["studio"][0]
    imported = shells["workbench"][0]
    variants, controls, beam_comparison = [], [], None
    measure_spans, imported_rests = [], []
    divisions = 1
    for measure_no, measure in enumerate(measures, 1):
        cursor = Fraction(0)
        note_no = 0
        control_counts = defaultdict(int)
        source_notes = []
        for element in measure:
            tags = []
            if element.tag == "attributes":
                tags = [child for child in element if child.tag in ("divisions", "time")]
                multiple = element.find("./measure-style/multiple-rest")
                if multiple is not None:
                    tags.append(multiple)
            else:
                tags = [element]
            for child in tags:
                tag = "multi" if child.tag == "multiple-rest" else child.tag
                if tag in ("divisions", "time", "multi", "backup", "forward"):
                    control_counts[tag] += 1
                    value = child.text if tag in ("divisions", "multi") else child.findtext("duration")
                    before = cursor
                    if tag == "divisions":
                        divisions = int(child.text)
                    if tag in ("backup", "forward"):
                        delta = Fraction(int(child.findtext("duration")), divisions)
                        cursor += delta if tag == "forward" else -delta
                    control_id = f"{fixture['id']}/m{measure_no:02}/{tag}{control_counts[tag]:02}"
                    controls.append({"id": control_id, "featureIds": features_for_control(fixture["id"], tag),
                        "tag": tag, "measureNumber": measure.get("number"),
                        "value": value if value is not None else ET.tostring(child, encoding="unicode"),
                        "divisions": divisions, "beforeQuarter": fraction(before), "afterQuarter": fraction(cursor)})
                elif tag == "note":
                    note_no += 1
                    source_notes.append(child)
                    duration = Fraction(int(child.findtext("duration")), divisions)
                    kind = "rest" if child.find("rest") is not None else "note"
                    pitch = child.find("pitch")
                    variants.append({"id": f"{fixture['id']}/m{measure_no:02}/n{note_no:02}",
                        "featureIds": features_for_note(fixture["id"], measure_no, child),
                        "source": {"measureNumber": measure.get("number"), "kind": kind,
                            "pitch": None if pitch is None else {"step": pitch.findtext("step"), "octave": int(pitch.findtext("octave"))},
                            "voice": child.findtext("voice") or "1", "type": child.findtext("type"),
                            "dots": len(child.findall("dot")), "durationDivisions": child.findtext("duration"),
                            "divisions": divisions, "onsetQuarter": fraction(cursor), "durationQuarter": fraction(duration),
                            "beams": {beam.get("number"): (beam.text or "").strip() for beam in child.findall("beam")}}})
                    cursor += duration
        mnx_measure = imported["parts"][0]["measures"][measure_no - 1]
        source_time = measure.find("./attributes/time")
        if source_time is not None:
            imported_time = imported["global"]["measures"][measure_no - 1]["time"]
            assert (imported_time["count"], imported_time["unit"]) == (
                int(source_time.findtext("beats")), int(source_time.findtext("beat-type")))
        source_in_measure = [v for v in variants if v["id"].split("/m")[-1].startswith(f"{measure_no:02}/")]
        source_by_voice_kind = defaultdict(list)
        for variant in source_in_measure:
            source_by_voice_kind[(variant["source"]["voice"], variant["source"]["kind"])].append(variant)
        imported_by_voice_kind = defaultdict(list)
        imported_voice_spans = []
        for sequence in mnx_measure.get("sequences", []):
            onset = Fraction(0)
            for event in sequence.get("content", []):
                if event.get("type") == "space":
                    onset += mnx_span(event)
                    continue
                assert isinstance(event.get("duration"), dict), (fixture["id"], measure_no, event)
                kind = "rest" if "rest" in event else "note"
                imported_by_voice_kind[(sequence["voice"].removeprefix("v"), kind)].append((event, onset))
                if kind == "rest":
                    imported_rests.append({"id": f"{fixture['id']}/m{measure_no:02}/v{sequence['voice'].removeprefix('v')}/rest{len([r for r in imported_rests if r['measureOrdinal'] == measure_no and r['voice'] == sequence['voice']]) + 1:02}",
                        "measureOrdinal": measure_no, "voice": sequence["voice"],
                        "onsetQuarter": fraction(onset), "durationQuarter": fraction(mnx_span(event)),
                        "duration": event["duration"]})
                onset += mnx_span(event)
            imported_voice_spans.append({"voice": sequence["voice"], "durationQuarter": fraction(onset)})
        measure_spans.append({"measureOrdinal": measure_no, "sourceCursorEndQuarter": fraction(cursor),
            "importedVoiceSpans": imported_voice_spans})
        for key, source_variants in source_by_voice_kind.items():
            imported_events = imported_by_voice_kind[key]
            assert len(imported_events) >= len(source_variants), (fixture["id"], measure_no, key)
            for variant, (event, onset) in zip(source_variants, imported_events):
                variant["imported"] = {"duration": event["duration"], "onsetQuarter": fraction(onset),
                    "durationQuarter": fraction(mnx_span(event)), "kind": key[1],
                    "pitch": None if key[1] == "rest" else event["notes"][0]["pitch"]}
                variant["onsetEqual"] = variant["source"]["onsetQuarter"] == variant["imported"]["onsetQuarter"]
                variant["durationEqual"] = variant["source"]["durationQuarter"] == variant["imported"]["durationQuarter"]
        if fixture["id"].endswith("SecondaryBeamBreaks"):
            assert len(source_notes) == 32
            events = mnx_measure["sequences"][0]["content"]
            event_index = {event["id"]: index for index, event in enumerate(events, 1)}
            imported_groups = imported_beam_groups(mnx_measure["beams"], event_index)
            beam_comparison = []
            for level in (1, 2, 3):
                expected = source_beam_groups(source_notes, level)
                actual = imported_groups[level]
                assert expected == actual, (fixture["id"], level, expected, actual)
                beam_comparison.append({"level": level, "sourceNoteGroups": expected, "importedNoteGroups": actual})
            for group_no in range(1, 5):
                controls.append({"id": f"{fixture['id']}/m01/beam{group_no:02}",
                    "featureIds": ["03e.secondary-beam-breaks"], "tag": "beam-group",
                    "sourceNoteIds": [f"{fixture['id']}/m01/n{n:02}" for n in range((group_no - 1) * 8 + 1, group_no * 8 + 1)]})
    assert not xml.findall(".//staff-tuning")
    rows.append({"id": fixture["id"], "description": fixture["description"], "testClass": fixture["testClass"],
        "sourcePath": fixture["path"], "sourceSha256": fixture["sha256"], "sourceMeasures": len(measures),
        "sourceDeclaresStrings": False, "notes": variants, "controls": controls,
        "measureSpans": measure_spans, "importedRests": imported_rests,
        "beamComparison": beam_comparison,
        "warnings": shells["workbench"][1].get("warnings", []),
        "workbenchDocumentSha256": shells["workbench"][1]["importedDocumentSha256"],
        "studioDocumentSha256": shells["studio"][1]["importedDocumentSha256"]})

assert len(rows) == 7
assert all(row["workbenchDocumentSha256"] == row["studioDocumentSha256"] and not row["warnings"] for row in rows)
by_id = {row["id"]: row for row in rows}
assert sum(not note["durationEqual"] for note in by_id["03a-Rhythm-Durations"]["notes"]) == 21
assert sum(not note["durationEqual"] for note in by_id["03d-Rhythm-DottedDurations-Factors"]["notes"]) == 3
assert len([note for note in by_id["03d-Rhythm-DottedDurations-Factors"]["notes"]
            if "03d.full-bar-rest-values" in note["featureIds"]]) == 8
assert all(note["onsetEqual"] and note["durationEqual"] for note in by_id["03c-Rhythm-DivisionChange"]["notes"])
assert all(note["onsetEqual"] and note["durationEqual"] for note in by_id["03e-Rhythm-SecondaryBeamBreaks"]["notes"])
assert all(note["onsetEqual"] and note["durationEqual"] for note in by_id["03f-Rhythm-Forward"]["notes"])
assert len(by_id["03b-Rhythm-Backup"]["importedRests"]) == 1
assert len(by_id["03f-Rhythm-Forward"]["importedRests"]) == 2
assert by_id["03f-Rhythm-Forward"]["measureSpans"][0]["sourceCursorEndQuarter"] == "4/1"
assert by_id["03f-Rhythm-Forward"]["measureSpans"][0]["importedVoiceSpans"] == [
    {"voice": "v1", "durationQuarter": "13/4"}]

feature_rows, render_rows, variant_dispositions = [], [], []
for feature_id, (expected, verdict, causes, reason) in FEATURES.items():
    fixture = next(row for row in rows if row["id"].startswith(feature_id[:3] + "-")
                   and (feature_id[:3] != "03e" or
                        ("No-Divisions" in row["id"]) == (feature_id == "03e.default-divisions")))
    variants = [v["id"] for v in fixture["notes"] + fixture["controls"] if feature_id in v["featureIds"]]
    assert variants, feature_id
    feature_rows.append({"id": feature_id, "fixture": fixture["id"], "expected": expected,
        "variantIds": variants, "variantCount": len(variants), "sourceDescription": fixture["description"]})
    for shell in ("workbench", "studio"):
        observation = json.loads((EVIDENCE / shell / fixture["id"] / "observation.json").read_text())
        render_rows.append({"featureId": feature_id, "shell": shell, "view": "notation",
            "verdict": verdict, "cause": causes, "reason": reason,
            "captureEvidence": f"harness/fixtures/musicxml-rhythm-evidence/{shell}/{fixture['id']}/observation.json",
            "diagnosticTitles": observation["views"][0]["diagnosticTitles"]})

for note in by_id["03a-Rhythm-Durations"]["notes"]:
    feature_id = note["featureIds"][0]
    verdict = "partial" if feature_id == "03a.standard-values" else "incorrect"
    variant_dispositions.append({"featureId": feature_id, "variantId": note["id"],
        "shells": ["workbench", "studio"], "view": "notation", "verdict": verdict,
        "reason": "Written value and dots survive, but onset shifts after long-value loss" if verdict == "partial"
                  else "Source note value/dots differ from browser-imported MNX"})
for note in by_id["03d-Rhythm-DottedDurations-Factors"]["notes"]:
    if "03d.full-bar-rest-values" not in note["featureIds"]:
        continue
    variant_dispositions.append({"featureId": "03d.full-bar-rest-values", "variantId": note["id"],
        "shells": ["workbench", "studio"], "view": "notation",
        "verdict": "partial" if note["durationEqual"] else "incorrect",
        "reason": "Metric duration matches, but one-bar multiple-rest marker is lost" if note["durationEqual"]
                  else "One-bar marker and exact metric duration are lost"})
for fixture_id, feature_id, tag in [
    ("03b-Rhythm-Backup", "03b.unwritten-voice-gap", "backup"),
    ("03f-Rhythm-Forward", "03f.unwritten-forward-gaps", "forward")]:
    for control in by_id[fixture_id]["controls"]:
        if control["tag"] == tag:
            variant_dispositions.append({"featureId": feature_id, "variantId": control["id"],
                "shells": ["workbench", "studio"], "view": "notation", "verdict": "incorrect",
                "reason": "Unwritten gap prints a rest" if tag == "backup" or control["id"].endswith(("forward01", "forward02"))
                          else "Trailing forward interval is omitted"})

result = {"kind": "implementation-loop agent render assessment; not human verification",
    "applicationCommit": json.loads((EVIDENCE / "workbench/index.json").read_text())["applicationCommit"],
    "corpusRevision": manifest["revision"],
    "scope": "Seven 03-series rhythm originals, source → browser-imported MNX → complete Notation in both shells",
    "fixtureCount": len(rows), "featureCount": len(feature_rows),
    "sourceNoteCount": sum(len(row["notes"]) for row in rows),
    "sourceControlCount": sum(len(row["controls"]) for row in rows),
    "browser": json.loads((EVIDENCE / "workbench/index.json").read_text())["browser"]["product"],
    "viewport": {"width": 1440, "height": 1000, "deviceScaleFactor": 1},
    "viewPolicy": "No source strings: Notation only. Time signatures explicitly Show; complete score tiles reviewed.",
    "fixtures": rows, "features": feature_rows, "render": render_rows,
    "renderVariantDispositions": variant_dispositions,
    "unresolvedCases": [{"id": "03e.default-divisions/external-metric-oracle",
        "scope": "Independent music21 duration only; visible whole-note result is correct",
        "reason": "The source description says the absent-divisions default is one per quarter, while the pinned music21 comparison reports a 1/2520-quarter duration. The current review does not resolve that tool/compatibility discrepancy."}],
    "counts": {"renderRows": len(render_rows), "renderVerdicts": dict(Counter(row["verdict"] for row in render_rows))},
    "deduplication": {"21": "Completed export short-duration work does not repair 03a import types or long-note rendering.",
        "22": "Exact meter totals already landed; 03d meter display is correct. Its one-bar full-rest loss extends proposed item 25.",
        "23": "Untitled Studio version promotion is already complete; all seven imports had bound desktop editors.",
        "25": "Rest value and one-bar collapse work is owned by proposed rest item 25; new note/space findings are separate."}}
OUTPUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
print(f"{len(rows)} fixtures, {len(feature_rows)} features, {len(render_rows)} render rows → {OUTPUT}")
