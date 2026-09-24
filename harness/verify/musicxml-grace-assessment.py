#!/usr/bin/env python3
"""Derive 24a–24h grace variants and verify retained original-file browser evidence."""
from __future__ import annotations

from collections import Counter
from fractions import Fraction
from hashlib import sha256
import json
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
SUITE = ROOT / "converters/fixtures/musicxml-suite"
EVIDENCE = ROOT / "harness/fixtures/musicxml-grace-evidence"
OUT = ROOT / "harness/reports/musicxml-grace-assessment.json"
suite = json.loads((SUITE / "manifest.json").read_text())
entries = {f["id"]: f for f in suite["fixtures"]}
IDS = tuple(f["id"] for f in suite["fixtures"] if f["id"].startswith("24"))
assert IDS == ("24a-GraceNotes", "24b-ChordAsGraceNote", "24c-GraceNote-MeasureEnd",
               "24d-AfterGrace", "24e-GraceNote-StaffChange", "24f-GraceNote-Slur",
               "24g-GraceNote-Dynamics", "24h-GraceNote-Simultaneous")
evidence = json.loads((EVIDENCE / "manifest.json").read_text())
for file in evidence["files"]:
    assert sha256((EVIDENCE / file["path"]).read_bytes()).hexdigest() == file["sha256"]
indexes = {shell: json.loads((EVIDENCE / shell / "index.json").read_text())
           for shell in ("workbench", "studio")}


def rational(number: Fraction) -> list[int]:
    return [number.numerator, number.denominator]


def pitch_of(note: ET.Element) -> dict | None:
    pitch = note.find("pitch")
    if pitch is None:
        return None
    result = {"step": pitch.findtext("step"), "octave": int(pitch.findtext("octave"))}
    if pitch.findtext("alter") is not None:
        result["alter"] = int(pitch.findtext("alter"))
    return result


def leaves(item: dict) -> list[dict]:
    if item.get("type") in ("grace", "tuplet"):
        return [event for child in item["content"] for event in leaves(child)]
    return [item]


fixtures = []
variant_ids: set[str] = set()
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
    mnx = docs["workbench"]
    assert len(parts) == len(mnx["parts"])
    source_notes = []
    source_groups = []
    source_controls = []
    measures = []
    for part_no, (part, imported_part) in enumerate(zip(parts, mnx["parts"]), 1):
        bars = part.findall("measure")
        imported_bars = imported_part["measures"]
        assert len(bars) == len(imported_bars)
        divisions = 1
        for measure_no, (bar, imported_bar) in enumerate(zip(bars, imported_bars), 1):
            cursor = Fraction()
            furthest = Fraction()
            notes: list[dict] = []
            groups: list[dict] = []
            controls: list[dict] = []
            open_group: list[dict | None] = [None]
            direction_no = 0
            def close_group() -> None:
                if open_group[0] is not None:
                    groups.append(open_group[0])
                    open_group[0] = None
            for child in bar:
                if child.tag == "attributes":
                    new_divisions = child.findtext("divisions")
                    if new_divisions is not None:
                        divisions = int(new_divisions)
                elif child.tag == "note":
                    no = len(notes) + 1
                    nid = f"{fixture_id}/p{part_no:02d}/m{measure_no:02d}/n{no:02d}"
                    assert nid not in variant_ids
                    variant_ids.add(nid)
                    grace = child.find("grace")
                    voice = child.findtext("voice") or "1"
                    staff = int(child.findtext("staff") or "1")
                    chord = child.find("chord") is not None
                    if grace is None:
                        close_group()
                    elif open_group[0] is None or open_group[0]["voice"] != voice or open_group[0]["staff"] != staff:
                        close_group()
                        gid = f"{fixture_id}/p{part_no:02d}/m{measure_no:02d}/g{len(groups) + 1:02d}"
                        variant_ids.add(gid)
                        open_group[0] = {"id": gid, "part": part_no, "measure": measure_no,
                                      "voice": voice, "staff": staff,
                                      "onsetQuarter": rational(cursor), "noteIds": [],
                                      "eventCount": 0, "graceAttributes": []}
                    duration = (Fraction(int(child.findtext("duration")), divisions)
                                if child.findtext("duration") is not None else Fraction())
                    note = {"id": nid, "part": part_no, "measure": measure_no,
                            "ordinal": no, "voice": voice, "staff": staff,
                            "onsetQuarter": rational(cursor), "pitch": pitch_of(child),
                            "rest": child.find("rest") is not None,
                            "chord": chord, "type": child.findtext("type"),
                            "dots": len(child.findall("dot")),
                            "durationQuarter": rational(duration),
                            "grace": None if grace is None else dict(grace.attrib),
                            "beams": [{"number": b.get("number", "1"), "value": (b.text or "").strip()}
                                      for b in child.findall("beam")]}
                    notes.append(note)
                    source_notes.append(note)
                    if grace is not None:
                        cid = nid + "/grace"
                        variant_ids.add(cid)
                        controls.append({"id": cid, "kind": "grace", "noteId": nid,
                                         "attributes": dict(grace.attrib)})
                        open_group[0]["noteIds"].append(nid)
                        open_group[0]["graceAttributes"].append(dict(grace.attrib))
                        if not chord:
                            open_group[0]["eventCount"] += 1
                    for kind in ("slur", "tied"):
                        for index, marker in enumerate(child.findall(f"./notations/{kind}"), 1):
                            cid = f"{nid}/{kind}{index:02d}"
                            variant_ids.add(cid)
                            controls.append({"id": cid, "kind": kind, "noteId": nid,
                                             "type": marker.get("type"),
                                             "number": marker.get("number")})
                    if grace is None and not chord:
                        cursor += duration
                        furthest = max(furthest, cursor)
                elif child.tag == "direction":
                    direction_no += 1
                    cid = f"{fixture_id}/p{part_no:02d}/m{measure_no:02d}/d{direction_no:02d}"
                    variant_ids.add(cid)
                    child_types = child.findall("direction-type")
                    kinds = [sub.tag for typ in child_types for sub in typ]
                    values = [sub.tag for typ in child_types for dyn in typ.findall("dynamics") for sub in dyn]
                    wedge = [sub.get("type") for typ in child_types for sub in typ.findall("wedge")]
                    controls.append({"id": cid, "kind": "direction", "part": part_no,
                                     "measure": measure_no, "onsetQuarter": rational(cursor),
                                     "types": kinds, "dynamics": values, "wedge": wedge,
                                     "placement": child.get("placement")})
                elif child.tag == "backup":
                    close_group()
                    cursor -= Fraction(int(child.findtext("duration")), divisions)
                elif child.tag == "forward":
                    close_group()
                    cursor += Fraction(int(child.findtext("duration")), divisions)
                    furthest = max(furthest, cursor)
            close_group()
            source_groups.extend(groups)
            source_controls.extend(controls)
            imported_sequences = imported_bar.get("sequences", [])
            imported_leaves = [event for sequence in imported_sequences
                               for item in sequence["content"] for event in leaves(item)]
            source_pitches = [n["pitch"] for n in notes if n["pitch"] is not None]
            imported_pitches = [n["pitch"] for event in imported_leaves
                                for n in event.get("notes", [])]
            assert source_pitches == imported_pitches, (fixture_id, part_no, measure_no)
            source_values = [(n["type"], n["dots"]) for n in notes if n["pitch"] is not None]
            imported_values = [(event["duration"]["base"], event["duration"].get("dots", 0))
                               for event in imported_leaves for _ in event.get("notes", [])]
            assert source_values == imported_values, (fixture_id, part_no, measure_no)
            source_rests = [(n["type"], n["dots"]) for n in notes if n["rest"]]
            imported_rests = [(event["duration"]["base"], event["duration"].get("dots", 0))
                              for event in imported_leaves
                              if not event.get("notes") and event.get("duration")]
            # 24h's third voice starts late; import materializes its source gap as
            # a rest. Assert that explicit source rests survive, allowing that spacer.
            assert len(source_rests) <= len(imported_rests), (fixture_id, part_no, measure_no)
            explicit_rest_values = Counter(value for value in source_rests if value[0] is not None)
            assert not (explicit_rest_values - Counter(imported_rests)), (fixture_id, part_no, measure_no)
            source_grace_count = sum(n["grace"] is not None and n["pitch"] is not None for n in notes)
            imported_grace_count = sum(len(event.get("notes", [])) for sequence in imported_sequences
                                       for item in sequence["content"] if item.get("type") == "grace"
                                       for event in leaves(item))
            assert source_grace_count == imported_grace_count
            imported_graces = [{"graceType": item.get("graceType"),
                                "slash": item.get("slash", "default-yes"),
                                "staffs": [event.get("staff", sequence.get("staff", 1))
                                           for event in leaves(item)],
                                "eventCount": len(leaves(item))}
                               for sequence in imported_sequences for item in sequence["content"]
                               if item.get("type") == "grace"]
            measures.append({"part": part_no, "ordinal": measure_no,
                             "sourceNumber": bar.get("number"),
                             "sourceSpanQuarter": rational(furthest),
                             "sourceNoteCount": len(notes),
                             "importedGraceGroups": imported_graces,
                             "importedSequenceCount": len(imported_sequences)})
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
        assert not row.get("captureError") and not row.get("importError")
        assert row["consoleErrors"] == []
        assert row["warnings"] == []
        assert row["availableViews"] == ["notation"] and row["editorBound"]
        assert row["displayOptions"]["timeSignatures"] == "show"
        assert row["displayOptions"]["clefs"] == "show"
        view = row["views"][0]
        assert view["view"] == "notation" and view["staffScale"] == 1 and view["densityH"] == 2
        assert view["screenshots"] == ["notation-0-0.png"] and view["svgCount"] == 1
        assert view["renderErrors"] == []
        assert view["scrollWidth"] <= view["clientWidth"] + 1
        assert view["scrollHeight"] <= view["clientHeight"] + 1
        if shell == "studio":
            assert row["editingSuspended"] is False and row["viewingOriginal"] is False
    fixtures.append({"id": fixture_id, "sourcePath": entry["path"],
                     "sourceSha256": entry["sha256"], "testClass": entry["testClass"],
                     "description": entry["description"], "sourceDeclaresStrings": False,
                     "sourceNotes": source_notes, "sourceGraceGroups": source_groups,
                     "sourceControls": source_controls, "sourceMeasures": measures})

assert [len(f["sourceNotes"]) for f in fixtures] == [27, 14, 4, 7, 6, 3, 5, 9]
assert [len(f["sourceGraceGroups"]) for f in fixtures] == [11, 3, 1, 2, 2, 1, 1, 3]
assert [sum(n["grace"] is not None for n in f["sourceNotes"]) for f in fixtures] == [14, 8, 2, 5, 3, 1, 4, 4]
by_id = {f["id"]: f for f in fixtures}


def retained_mnx(fixture_id: str) -> dict:
    return json.loads((EVIDENCE / "workbench" / fixture_id / "document.mnx.json").read_text())


def retained_svg(fixture_id: str) -> ET.Element:
    return ET.parse(EVIDENCE / "workbench" / fixture_id / "notation-0.svg").getroot()


def class_count(svg: ET.Element, name: str) -> int:
    return sum(name in node.get("class", "").split() for node in svg.iter())


def class_nodes(svg: ET.Element, name: str) -> list[ET.Element]:
    return [node for node in svg.iter() if name in node.get("class", "").split()]


def grace_links(fixture_id: str) -> tuple[int, int]:
    slurs = ties = 0
    for part in retained_mnx(fixture_id)["parts"]:
        for bar in part["measures"]:
            for sequence in bar.get("sequences", []):
                for item in sequence["content"]:
                    if item.get("type") != "grace":
                        continue
                    for event in leaves(item):
                        slurs += len(event.get("slurs", []))
                        ties += sum(len(note.get("ties", [])) for note in event.get("notes", []))
    return slurs, ties


for fixture in (IDS[0], IDS[5]):
    assert class_count(retained_svg(fixture), "slur") == 0
assert class_count(retained_svg(IDS[1]), "tie") == 0
assert [grace_links(fixture) for fixture in (IDS[0], IDS[1], IDS[5])] == [
    (3, 0), (0, 2), (1, 0)]
assert class_count(retained_svg(IDS[0]), "grace-slash") == 6
assert class_count(retained_svg(IDS[1]), "grace-slash") == 2
assert class_count(retained_svg(IDS[5]), "grace-slash") == 1
assert class_count(retained_svg(IDS[6]), "dynamic") == 2
assert class_count(retained_svg(IDS[7]), "dynamic") == 1
assert len({(node.get("x"), node.get("y")) for node in class_nodes(retained_svg(IDS[6]), "dynamic")}) == 1
fp = class_nodes(retained_svg(IDS[7]), "dynamic")[0]
heads = {node.get("data-source-id"): node for node in class_nodes(retained_svg(IDS[7]), "notehead")}
assert abs(float(fp.get("x")) - float(heads["n-1-1-v1-0-0"].get("x"))) < 5
assert abs(float(fp.get("x")) - float(heads["n-1-1-v1-1-0"].get("x"))) > 25
grace_dynamics = retained_mnx(IDS[6])["parts"][0]["measures"][0]["dynamics"]
assert [d.get("value", d.get("wedgeType")) for d in grace_dynamics] == ["f", "decreasing", "p"]
assert all(d["position"]["fraction"] == [0, 1] for d in grace_dynamics)
assert grace_dynamics[1]["end"]["position"]["fraction"] == [0, 1]
assert [m["staffs"] for m in by_id[IDS[4]]["sourceMeasures"][0]["importedGraceGroups"]] == [[2], [2, 2]]


def feature(fid: str, fixture: str, variants: list[str], expected: str,
            verdict: str, cause: list[str], reason: str) -> dict:
    assert variants and all(v in variant_ids for v in variants)
    return {"id": fid, "fixture": fixture, "variantIds": sorted(set(variants)),
            "sourceDescription": entries[fixture]["description"],
            "expected": expected, "verdict": verdict, "cause": cause, "reason": reason}


features = []
for fixture in fixtures:
    short = fixture["id"][:3]
    features.append(feature(
        short + ".pitch-written-values", fixture["id"],
        [n["id"] for n in fixture["sourceNotes"]],
        "All source pitches, written values and grace note counts survive in part/voice order; grace notes consume no metric duration.",
        "correct", [],
        "Source pitched-note order, pitch, value and grace-note count match browser-imported MNX. The complete views show the retained pitches; attachment, staff placement and spanners are separate features."))
    for group in fixture["sourceGraceGroups"]:
        bar = group["measure"]
        ordinal = int(group["id"].split("/g")[-1])
        gid = f"{short}.p{group['part']:02d}.m{bar:02d}.g{ordinal:02d}"
        controls = [n + "/grace" for n in group["noteIds"]]
        expected = (f"Grace group {group['id']} has {group['eventCount']} zero-duration events, "
                    f"{len(group['noteIds'])} notes on source staff {group['staff']}, "
                    f"with source <grace> attributes {group['graceAttributes']!r}.")
        if short == "24e":
            verdict, cause = "incorrect", ["layout/SVG engine"]
            reason = "The importer preserves staff=2 on every grace event, but both shells draw the small grace heads on staff 1 above the principal notes."
        else:
            verdict, cause = "correct", []
            reason = "Pitches, small noteheads, value, chord membership where present, order and visible placement match this source group. Explicit slash=yes/no is respected; absent slash remains an application choice."
            if short == "24d":
                reason = "The small notes remain visibly between/after the two principal half notes in source order. Explicit steal-time percentages are nonvisual and assessed separately."
            if short == "24c":
                reason = "The two small beamed notes appear after the two half notes and before the barline. The source gives no steal-time percentage."
            if short == "24h":
                reason = "The small source group appears on its own declared part/staff, aligned with the other voices' opening beat without inventing grace notes on the empty voices."
        features.append(feature(gid, fixture["id"],
                                [group["id"], *group["noteIds"], *controls],
                                expected, verdict, cause, reason))


def controls_of(fixture: str, kind: str) -> list[str]:
    return [c["id"] for c in by_id[fixture]["sourceControls"] if c["kind"] == kind]


features.extend([
    feature("24a.grace-to-main-slurs", IDS[0], controls_of(IDS[0], "slur"),
            "Three grace-to-principal slurs connect the two appoggiaturas in bar 1 and the acciaccatura in bar 2.",
            "missing", ["layout/SVG engine"],
            "The importer resolves all three slur targets in MNX, but neither shell draws any slur curve from a grace container."),
    feature("24b.grace-chord-ties", IDS[1], controls_of(IDS[1], "tied"),
            "The D5 tie joins two grace chords and the G4 tie joins the last grace chord to the principal chord.",
            "missing", ["layout/SVG engine"],
            "Both note-level target links survive in MNX. Neither shell draws the two tie curves from grace chord members."),
    feature("24d.steal-time-percentages", IDS[3],
            [c["id"] for c in by_id[IDS[3]]["sourceControls"]
             if c["kind"] == "grace" and ("steal-time-previous" in c["attributes"] or
                                         "steal-time-following" in c["attributes"])],
            "Two source grace notes specify 20 percent stolen from previous and following notes, respectively.",
            "not applicable", ["importer"],
            "Playback percentages are nonvisual. The importer collapses the three-note run under stealPrevious and does not retain either numeric percentage; this is not a render pass."),
    feature("24f.grace-to-main-slur", IDS[5], controls_of(IDS[5], "slur"),
            "The grace G5 slurs to the following main E5.",
            "missing", ["layout/SVG engine"],
            "The MNX grace event retains a slur target, but both shells draw the notes without the connecting curve. An absent slash attribute is an application policy, not a failed mark."),
])

g_directions = controls_of(IDS[6], "direction")
assert len(g_directions) == 4
features.extend([
    feature("24g.grace-and-main-dynamics", IDS[6], [g_directions[0], g_directions[3]],
            "A forte is under the first grace note; a piano is under the following principal note.",
            "incorrect", ["importer", "MNX representation", "layout/SVG engine"],
            "Both marks import at fraction 0 and both SVG glyphs occupy exactly the same x/y, so the two separate source placements overprint. Zero-time grace attachment is not represented by the current measure-fraction carrier."),
    feature("24g.diminuendo", IDS[6], [g_directions[1], g_directions[2]],
            "A diminuendo wedge spans the grace run and ends before the principal-note piano.",
            "missing", ["importer", "MNX representation"],
            "The imported gradual dynamic begins and ends at fraction 0; both shell SVGs omit a hairpin. The source start/stop order is distinct despite their equal metric positions."),
    feature("24h.fp-on-main", IDS[7], controls_of(IDS[7], "direction"),
            "The fp dynamic sits under the first main note on P1's top staff.",
            "incorrect", ["importer", "MNX representation", "layout/SVG engine"],
            "The fp survives, but its measure-fraction 0 position draws directly under the grace head (about 4 units away), over 25 units left of the main head named by the manifest. Zero-time grace and principal share a metric position."),
    feature("24h.voices-without-grace", IDS[7],
            [n["id"] for n in by_id[IDS[7]]["sourceNotes"]
             if ((n["part"] == 1 and n["voice"] == "3")
                 or (n["part"] == 2 and n["voice"] == "2"))
             and n["grace"] is None],
            "P1 voice 3 begins on beat 2 without graces; P2 voice 2 remains a rest without graces.",
            "correct", [],
            "Both shells keep the opening rest/offset on P1's third staff and the lower P2 rest, without inventing grace notes on either voice."),
])
assert len({f["id"] for f in features}) == len(features)
assert set.union(*(set(f["variantIds"]) for f in features)) == variant_ids

render = []
for feat in features:
    for shell, index in indexes.items():
        row = next(f for f in index["fixtures"] if f["id"] == feat["fixture"])
        base = f"harness/fixtures/musicxml-grace-evidence/{shell}/{feat['fixture']}"
        render.append({"featureId": feat["id"], "shell": shell, "view": "notation",
                       "verdict": feat["verdict"], "cause": feat["cause"],
                       "reason": feat["reason"], "observationEvidence": base + "/observation.json",
                       "documentEvidence": base + "/document.mnx.json",
                       "svgEvidence": base + "/notation-0.svg",
                       "screenshotEvidence": [base + "/notation-0-0.png"],
                       "diagnosticTitles": row["views"][0]["diagnosticTitles"]})
counts = Counter(row["verdict"] for row in render)
report = {
    "kind": "implementation-loop agent render assessment; not human verification",
    "applicationCommit": evidence["applicationCommit"], "corpusRevision": suite["revision"],
    "scope": "Eight original 24a–24h MusicXML files through current Workbench and editable Studio, source to imported MNX to complete Notation",
    "fixtureCount": len(fixtures), "featureCount": len(features),
    "sourceNoteCount": sum(len(f["sourceNotes"]) for f in fixtures),
    "sourcePitchedNoteCount": sum(n["pitch"] is not None for f in fixtures for n in f["sourceNotes"]),
    "sourceRestCount": sum(n["rest"] for f in fixtures for n in f["sourceNotes"]),
    "sourceGraceGroupCount": sum(len(f["sourceGraceGroups"]) for f in fixtures),
    "sourceControlCount": sum(len(f["sourceControls"]) for f in fixtures),
    "sourceVariantCount": len(variant_ids), "renderRowCount": len(render),
    "verdictCounts": dict(sorted(counts.items())),
    "browser": indexes["workbench"]["browser"]["product"],
    "viewport": indexes["workbench"]["viewport"],
    "viewPolicy": "No original declares known strings: Notation only. Clefs and time signatures Show. No tested lyric is present. Every complete score fits one viewport in both shells.",
    "fixtures": fixtures,
    "features": [{k: v for k, v in feat.items() if k not in ("verdict", "cause", "reason")}
                 for feat in features],
    "render": render,
    "unresolvedCases": [
        {"featureId": "24f.p01.m01.g01", "reason": "The original omits <grace slash>; its manifest explicitly leaves slash interpretation to applications. The drawn slash is not judged incorrect."},
        {"fixture": IDS[0], "reason": "Three bar-3 grace elements omit slash; the pinned source/description does not select a default. Their pitch/value/size are judged, the slash choice is left open."},
        {"featureId": "24d.steal-time-percentages", "reason": "The 20-percent playback directives are nonvisual and lost structurally; this render pass does not measure playback or authoring."},
    ],
    "deduplication": {
        "completed22": "Ordinary clefs, 4/4 and common symbols are already covered by item 22. The source 24g bar contains one principal quarter and intentionally underfills 4/4; this validation diagnostic is not a grace render failure.",
        "completed23": "Every Studio XML version is current/editable after the version-title workflow. No grace authoring or GP storage route is credited by these captures.",
        "proposed31": "Tuplet item 31's single-note staccato/tremolo import is distinct from these grace spanner, staff and zero-time dynamic issues.",
        "proposed32": "Source-grounded grace spanner drawing, cross-staff placement and dynamic anchoring warrant one bounded follow-up.",
    },
}
OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
print(f"{OUT.relative_to(ROOT)}: {len(fixtures)} fixtures, {len(features)} features, "
      f"{len(variant_ids)} variants, {len(render)} rows, {dict(counts)}")
