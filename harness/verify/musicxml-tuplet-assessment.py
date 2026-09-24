#!/usr/bin/env python3
"""Rebuild the 23a–23f source inventory and verify retained desktop render evidence."""
from __future__ import annotations

from collections import Counter
from fractions import Fraction
from hashlib import sha256
import json
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
SUITE = ROOT / "converters/fixtures/musicxml-suite"
EVIDENCE = ROOT / "harness/fixtures/musicxml-tuplet-evidence"
OUT = ROOT / "harness/reports/musicxml-tuplet-assessment.json"
manifest = json.loads((SUITE / "manifest.json").read_text())
entries = {f["id"]: f for f in manifest["fixtures"]}
IDS = tuple(f["id"] for f in manifest["fixtures"] if f["id"].startswith("23"))
assert IDS == (
    "23a-Tuplets", "23b-Tuplets-Styles", "23c-Tuplet-Display-NonStandard",
    "23d-Tuplets-Nested", "23e-Tuplets-Tremolo", "23f-Tuplets-DurationButNoBracket",
)
evidence = json.loads((EVIDENCE / "manifest.json").read_text())
for file in evidence["files"]:
    assert sha256((EVIDENCE / file["path"]).read_bytes()).hexdigest() == file["sha256"]
indexes = {shell: json.loads((EVIDENCE / shell / "index.json").read_text())
           for shell in ("workbench", "studio")}


def fraction(value: Fraction) -> list[int]:
    return [value.numerator, value.denominator]


def value(base: str, dots: int = 0) -> Fraction:
    beats = {"maxima": 32, "long": 16, "breve": 8, "whole": 4,
             "half": 2, "quarter": 1, "eighth": Fraction(1, 2),
             "16th": Fraction(1, 4), "32nd": Fraction(1, 8),
             "64th": Fraction(1, 16), "128th": Fraction(1, 32)}[base]
    return beats * sum((Fraction(1, 2 ** i) for i in range(dots + 1)), Fraction())


def imported_value(item: dict) -> Fraction:
    if item.get("type") == "tuplet":
        return value(item["outer"]["duration"]["base"],
                     item["outer"]["duration"].get("dots", 0)) * item["outer"]["multiple"]
    if item.get("type") == "grace":
        return Fraction()
    return value(item["duration"]["base"], item["duration"].get("dots", 0))


def leaf_events(item: dict) -> list[dict]:
    if item.get("type") in ("tuplet", "grace"):
        return [event for child in item["content"] for event in leaf_events(child)]
    return [item]


def pitch(note: ET.Element) -> dict | None:
    p = note.find("pitch")
    if p is None:
        return None
    result = {"step": p.findtext("step"), "octave": int(p.findtext("octave"))}
    if p.findtext("alter") is not None:
        result["alter"] = int(p.findtext("alter"))
    return result


fixtures = []
variant_ids: set[str] = set()
for fixture_id in IDS:
    entry = entries[fixture_id]
    source = SUITE / entry["path"]
    assert sha256(source.read_bytes()).hexdigest() == entry["sha256"]
    xml = ET.parse(source).getroot()
    assert not xml.findall(".//staff-tuning") and not xml.findall(".//technical/string")
    parts = xml.findall("part")
    assert len(parts) == 1
    docs = {shell: json.loads((EVIDENCE / shell / fixture_id / "document.mnx.json").read_text())
            for shell in indexes}
    assert docs["workbench"] == docs["studio"], fixture_id
    mnx = docs["workbench"]
    assert len(mnx["parts"]) == 1
    bars = parts[0].findall("measure")
    imported_bars = mnx["parts"][0]["measures"]
    assert len(bars) == len(imported_bars)
    source_notes = []
    source_groups = []
    source_controls = []
    measures = []
    divisions = 1
    for measure_no, (bar, imported) in enumerate(zip(bars, imported_bars), 1):
        # The corpus places divisions at bar starts where they change.
        declared_divisions = bar.findtext("./attributes/divisions")
        if declared_divisions is not None:
            divisions = int(declared_divisions)
        cursor = Fraction()
        furthest = Fraction()
        notes = []
        controls = []
        open_groups: dict[str, list[dict]] = {}
        groups = []
        for child in bar:
            if child.tag == "note":
                no = len(notes) + 1
                nid = f"{fixture_id}/p01/m{measure_no:02d}/n{no:02d}"
                assert nid not in variant_ids
                variant_ids.add(nid)
                mod = child.find("time-modification")
                mod_info = None if mod is None else {
                    "actual": int(mod.findtext("actual-notes")),
                    "normal": int(mod.findtext("normal-notes")),
                    "normalType": mod.findtext("normal-type"),
                    "normalDots": len(mod.findall("normal-dot")),
                }
                duration = Fraction(int(child.findtext("duration") or "0"), divisions)
                tremolo = child.find("./notations/ornaments/tremolo")
                row = {"id": nid, "part": 1, "measure": measure_no, "ordinal": no,
                       "staff": int(child.findtext("staff") or "1"),
                       "pitch": pitch(child), "type": child.findtext("type"),
                       "dots": len(child.findall("dot")), "durationQuarter": fraction(duration),
                       "onsetQuarter": fraction(cursor), "timeModification": mod_info,
                       "staccato": child.find("./notations/articulations/staccato") is not None,
                       "tremolo": None if tremolo is None else {
                           "marks": int((tremolo.text or "0").strip()),
                           "type": tremolo.get("type", "single")}}
                notes.append(row)
                source_notes.append(row)
                if row["staccato"]:
                    cid = nid + "/staccato"
                    variant_ids.add(cid)
                    controls.append({"id": cid, "kind": "staccato", "noteId": nid,
                                     "measure": measure_no})
                if row["tremolo"] is not None:
                    cid = nid + "/tremolo"
                    variant_ids.add(cid)
                    controls.append({"id": cid, "kind": "singleNoteTremolo",
                                     "noteId": nid, "measure": measure_no, **row["tremolo"]})
                markers = child.findall("./notations/tuplet")
                for marker in markers:
                    if marker.get("type") != "start":
                        continue
                    gid = f"{fixture_id}/p01/m{measure_no:02d}/t{len(groups) + 1:02d}"
                    assert gid not in variant_ids
                    variant_ids.add(gid)
                    group = {"id": gid, "part": 1, "measure": measure_no,
                             "startNoteId": nid, "endNoteId": None,
                             "sourceRatio": mod_info, "display": dict(marker.attrib),
                             "actualDisplay": {c.tag: {e.tag: e.text for e in c if e.text}
                                               for c in marker},
                             "noteIds": []}
                    groups.append(group)
                    open_groups.setdefault(marker.get("number", "1"), []).append(group)
                for stack in open_groups.values():
                    for group in stack:
                        if nid not in group["noteIds"]:
                            group["noteIds"].append(nid)
                for marker in markers:
                    if marker.get("type") != "stop":
                        continue
                    key = marker.get("number", "1")
                    assert open_groups.get(key), (fixture_id, measure_no, no)
                    group = open_groups[key].pop()
                    group["endNoteId"] = nid
                if child.find("chord") is None:
                    cursor += duration
                    furthest = max(furthest, cursor)
            elif child.tag == "backup":
                cursor -= Fraction(int(child.findtext("duration")), divisions)
            elif child.tag == "forward":
                cursor += Fraction(int(child.findtext("duration")), divisions)
                furthest = max(furthest, cursor)
            elif child.tag == "direction" and child.find("./direction-type/dynamics/fp") is not None:
                cid = f"{fixture_id}/p01/m{measure_no:02d}/d{sum(c['kind'] == 'fp' for c in controls) + 1:02d}"
                variant_ids.add(cid)
                controls.append({"id": cid, "kind": "fp", "measure": measure_no,
                                 "onsetQuarter": fraction(cursor)})
        assert all(not stack for stack in open_groups.values())
        source_controls.extend(controls)
        if fixture_id.startswith("23f"):
            assert not groups and len(notes) == 20
            for first, last in ((3, 5), (8, 10), (15, 20)):
                gid = f"{fixture_id}/p01/m01/t{len(groups) + 1:02d}"
                variant_ids.add(gid)
                groups.append({"id": gid, "part": 1, "measure": 1,
                               "startNoteId": notes[first - 1]["id"],
                               "endNoteId": notes[last - 1]["id"],
                               "sourceRatio": notes[first - 1]["timeModification"],
                               "display": None, "actualDisplay": {},
                               "noteIds": [n["id"] for n in notes[first - 1:last]],
                               "boundaryFromManifest": True})
        source_groups.extend(groups)
        imported_sequences = imported.get("sequences", [])
        imported_leaves = [event for sequence in imported_sequences
                           for item in sequence["content"] for event in leaf_events(item)]
        assert len(imported_leaves) == len(notes), (fixture_id, measure_no)
        assert [n["pitch"] for n in notes] == [event["notes"][0]["pitch"]
                                                  for event in imported_leaves], (fixture_id, measure_no)
        assert [(n["type"], n["dots"]) for n in notes] == [
            (event["duration"]["base"], event["duration"].get("dots", 0))
            for event in imported_leaves], (fixture_id, measure_no)
        imported_spans = [sum((imported_value(item) for item in sequence["content"]), Fraction())
                          for sequence in imported_sequences]
        imported_groups = [{"inner": item["inner"], "outer": item["outer"],
                            "memberCount": len(leaf_events(item)),
                            "display": {k: item[k] for k in ("bracket", "orient", "showNumber", "showValue")
                                        if k in item}}
                           for sequence in imported_sequences for item in sequence["content"]
                           if item.get("type") == "tuplet"]
        measures.append({"ordinal": measure_no, "sourceNumber": bar.get("number"),
                         "sourceSpanQuarter": fraction(furthest),
                         "importedSpanQuarter": fraction(max(imported_spans, default=Fraction())),
                         "sourceNoteCount": len(notes), "importedTuplets": imported_groups})
    for shell, index in indexes.items():
        assert index["applicationCommit"] == evidence["applicationCommit"]
        assert index["corpusRevision"] == manifest["revision"] == evidence["corpusRevision"]
        assert index["captureScriptSha256"] == sha256(
            (ROOT / "harness/verify/musicxml-editor-capture.mjs").read_bytes()).hexdigest()
        assert index["viewport"] == {"width": 1440, "height": 1000, "deviceScaleFactor": 1}
        assert index["browser"]["product"] == "Chrome/153.0.8010.36"
        assert [f["id"] for f in index["fixtures"]] == list(IDS)
        observation = next(f for f in index["fixtures"] if f["id"] == fixture_id)
        assert observation["sourceSha256"] == entry["sha256"]
        assert not observation.get("importError") and not observation.get("captureError")
        assert observation["consoleErrors"] == []
        assert observation["availableViews"] == ["notation"] and observation["editorBound"]
        assert observation["displayOptions"]["timeSignatures"] == "show"
        assert observation["displayOptions"]["clefs"] == "show"
        assert observation["views"][0]["screenshots"] == ["notation-0-0.png"]
        assert observation["views"][0]["scrollWidth"] <= observation["views"][0]["clientWidth"] + 1
        assert observation["views"][0]["scrollHeight"] <= observation["views"][0]["clientHeight"] + 1
        assert observation["views"][0]["renderErrors"] == []
        assert observation["views"][0]["staffScale"] == 1
        if shell == "studio":
            assert observation["editingSuspended"] is False and observation["viewingOriginal"] is False
    fixtures.append({"id": fixture_id, "sourcePath": entry["path"],
                     "sourceSha256": entry["sha256"], "testClass": entry["testClass"],
                     "description": entry["description"], "sourceDeclaresStrings": False,
                     "sourceNotes": source_notes, "sourceTuplets": source_groups,
                     "sourceControls": source_controls,
                     "sourceMeasures": measures})

assert [len(f["sourceNotes"]) for f in fixtures] == [30, 68, 30, 26, 20, 20]
assert [len(f["sourceTuplets"]) for f in fixtures] == [7, 17, 10, 7, 12, 3]
assert [len(f["sourceControls"]) for f in fixtures] == [0, 0, 0, 0, 18, 0]
assert all(g["endNoteId"] for f in fixtures for g in f["sourceTuplets"])
by_id = {f["id"]: f for f in fixtures}


def retained_mnx(fixture_id: str) -> dict:
    return json.loads((EVIDENCE / "workbench" / fixture_id / "document.mnx.json").read_text())


def retained_svg(fixture_id: str) -> str:
    return (EVIDENCE / "workbench" / fixture_id / "notation-0.svg").read_text()


assert [(g["inner"]["multiple"], g["outer"]["multiple"])
        for g in by_id[IDS[0]]["sourceMeasures"][0]["importedTuplets"]] == [
            (3, 2), (3, 2), (3, 2), (4, 2), (4, 1), (7, 3), (6, 2)]
assert all(not g["display"] for measure in by_id[IDS[1]]["sourceMeasures"]
           for g in measure["importedTuplets"])
assert all(not g["display"] for measure in by_id[IDS[2]]["sourceMeasures"]
           for g in measure["importedTuplets"])
assert [m["importedSpanQuarter"] for m in by_id[IDS[2]]["sourceMeasures"]] == [
    [4, 1], [18, 1], [18, 1], [18, 1], [4, 1]]
assert [m["importedTuplets"] for m in by_id[IDS[3]]["sourceMeasures"]] == [[], [], []]
assert len(next(f for f in indexes["workbench"]["fixtures"] if f["id"] == IDS[3])["warnings"]) == 8
assert all("markings" not in event
           for bar in retained_mnx(IDS[4])["parts"][0]["measures"]
           for seq in bar.get("sequences", []) for item in seq["content"]
           for event in leaf_events(item))
assert 'class="dynamic"' in retained_svg(IDS[4])
assert [len(m["importedTuplets"]) for m in by_id[IDS[5]]["sourceMeasures"]] == [4]


def feature(fid: str, fixture: str, variants: list[str], expected: str,
            verdict: str, cause: list[str], reason: str) -> dict:
    assert variants and all(v in variant_ids for v in variants)
    return {"id": fid, "fixture": fixture, "variantIds": sorted(set(variants)),
            "sourceDescription": entries[fixture]["description"], "expected": expected,
            "verdict": verdict, "cause": cause, "reason": reason}


features = []
for fixture in fixtures:
    fid = fixture["id"][:3]
    features.append(feature(
        fid + ".pitch-written-values", fixture["id"],
        [n["id"] for n in fixture["sourceNotes"]],
        "Every source pitch, written note value and dot remains in source order.",
        "correct", [],
        "Every source pitch and written value matches browser-imported MNX, and all noteheads are visible. Tuplet timing and display are judged in separate rows."))
    for group in fixture["sourceTuplets"]:
        bar, ordinal = group["measure"], int(group["id"].split("/t")[-1])
        feature_id = f"{fid}.m{bar:02d}.t{ordinal:02d}"
        variants = [group["id"], *group["noteIds"]]
        ratio = group["sourceRatio"]
        expected = (f"Source group {group['id']} covers {len(group['noteIds'])} notes, "
                    f"time-modification {ratio['actual']}:{ratio['normal']}; "
                    f"display marker {group['display']!r}.")
        if fid == "23a":
            verdict, causes = "correct", []
            reason = "The imported MNX retains this group's ratio, member count and order; its number and boundary appear in both complete views."
        elif fid == "23b":
            if (bar == 3 and ordinal == 1) or (bar == 4 and ordinal == 2):
                verdict, causes = "correct", []
                reason = ("Source bracket=no yields a beamed 3 without a bracket in both shells."
                          if bar == 3 else "The XML states 17:3, and both shells display 17 below the beamed group. The manifest's 17:2 wording conflicts with the original XML.")
            else:
                verdict, causes = "incorrect", ["importer", "layout/SVG engine"]
                reason = "The source's bracket/curved line, number-pair, type-value or below-placement request is absent from imported MNX; both shells print only the default actual count, with no requested bracket style."
        elif fid == "23c":
            verdict, causes = "incorrect", ["importer", "layout/SVG engine"]
            reason = ("Requested note-value and paired-number display is lost; the second three-note group is split into a two-note and a one-note tuplet."
                      if ordinal == 2 else "Requested note-value and, where declared, custom number display is lost; only the default 3 prints. Breve normal-type in bars 2–4 also makes imported timing exceed the source 4/4 bar.")
        elif fid == "23d":
            verdict, causes = "incorrect", ["importer"]
            reason = "A source-located converter warning names the unstated ratio, but no nested tuplet container reaches MNX. Both shells show plain notes and the first two bars overfill."
        elif fid == "23e":
            verdict, causes = "correct", []
            reason = "This tuplet's ratio, member count and visible number survive. Staccato and tremolo strokes are separate features below."
        else:
            if ordinal == 1:
                verdict, causes = "incorrect", ["importer", "layout/SVG engine"]
                reason = "The upper quarter triplet has no graphical tuplet declaration, but both shells draw a hooked bracket. Its three written quarters still consume two beats."
            elif ordinal == 2:
                verdict, causes = "correct", []
                reason = "The beamed eighth triplet consumes two eighth beats and prints a 3 without a bracket."
            else:
                verdict, causes = "partial", ["importer"]
                reason = "The six 16ths keep their 3:2 performed timing, but the manifest calls this a sextuplet and both shells split it into two separately numbered triplets. No source tuplet boundary resolves this beyond the manifest description."
        features.append(feature(feature_id, fixture["id"], variants, expected,
                                verdict, causes, reason))

e = IDS[4]
features.extend([
    feature("23e.staccato-nine", e,
            [c["id"] for c in by_id[e]["sourceControls"] if c["kind"] == "staccato"],
            "Each of the nine first-bar eighths has a visible staccato point.",
            "missing", ["importer"],
            "All nine staccato elements vanish from imported MNX; the two shell SVGs show no staccato marks."),
    feature("23e.single-note-tremolo-eight", e,
            [c["id"] for c in by_id[e]["sourceControls"] if c["kind"] == "singleNoteTremolo"],
            "Eight source single-note tremolos retain their one slash and appear on their stems.",
            "missing", ["importer"],
            "All eight single tremolo controls vanish from imported MNX and no strokes appear. Published event markings.tremolo could carry the positive count."),
    feature("23e.fp-dynamic", e,
            [c["id"] for c in by_id[e]["sourceControls"] if c["kind"] == "fp"],
            "The fourth bar displays the source fp dynamic under the second tuplet.",
            "correct", [], "The imported dynamic and visible fp glyph agree with the source."),
])
assert len({f["id"] for f in features}) == len(features)
assert set.union(*(set(f["variantIds"]) for f in features)) == variant_ids

render = []
for feat in features:
    for shell, index in indexes.items():
        observation = next(f for f in index["fixtures"] if f["id"] == feat["fixture"])
        base = f"harness/fixtures/musicxml-tuplet-evidence/{shell}/{feat['fixture']}"
        render.append({"featureId": feat["id"], "shell": shell, "view": "notation",
                       "verdict": feat["verdict"], "cause": feat["cause"],
                       "reason": feat["reason"], "observationEvidence": base + "/observation.json",
                       "documentEvidence": base + "/document.mnx.json",
                       "svgEvidence": base + "/notation-0.svg",
                       "screenshotEvidence": [base + "/notation-0-0.png"],
                       "diagnosticTitles": observation["views"][0]["diagnosticTitles"]})
counts = Counter(row["verdict"] for row in render)
report = {
    "kind": "implementation-loop agent render assessment; not human verification",
    "applicationCommit": evidence["applicationCommit"],
    "corpusRevision": manifest["revision"],
    "scope": "Six original 23a–23f MusicXML files through current Workbench and editable Studio, source to imported MNX to complete Notation",
    "fixtureCount": len(fixtures), "featureCount": len(features),
    "sourceNoteCount": sum(len(f["sourceNotes"]) for f in fixtures),
    "sourceTupletCount": sum(len(f["sourceTuplets"]) for f in fixtures),
    "sourceControlCount": sum(len(f["sourceControls"]) for f in fixtures),
    "sourceVariantCount": len(variant_ids), "renderRowCount": len(render),
    "verdictCounts": dict(sorted(counts.items())),
    "browser": indexes["workbench"]["browser"]["product"],
    "viewport": indexes["workbench"]["viewport"],
    "viewPolicy": "No original declares known strings: Notation only. Clefs and time signatures Show. Lyrics remain Current because these sources contain no lyrics. Every score fits one full viewport in both shells.",
    "fixtures": fixtures,
    "features": [{k: v for k, v in feat.items() if k not in ("verdict", "cause", "reason")}
                 for feat in features],
    "render": render,
    "unresolvedCases": [
        {"fixture": IDS[1], "reason": "Manifest describes final group as 17:2, while the pinned original repeatedly writes 17:3 and imports 17:3. The original XML is used for the ratio verdict; the description conflict remains explicit."},
        {"fixture": IDS[5], "reason": "Six continuous unmarked 16ths have 3:2 per-note time modifications. The manifest calls the passage a sextuplet; without <tuplet> boundaries the exact graphical grouping is ambiguous. Their performed timing is preserved; the two displayed triplet numbers are a partial verdict."},
    ],
    "deduplication": {
        "completed22": "The incompatible common symbol on 23b's 5/4 is already diagnosed under item 22. Its source bar 4 is four performed beats in 5/4 and the underfill diagnostic is not a tuplet loss.",
        "completed23": "All Studio XML versions were made current and editable using the title/version workflow. No authoring or GP persistence task was exercised by these render captures.",
        "proposed29": "Item 29 covers 21g chord-member and zero-mark tremolos. The eight positive single-note tremolos in 23e fit published event markings and are a distinct importer mapping, cross-linked rather than duplicated there.",
        "proposed31": "The new source-grounded tuplet display, nested-group, duration and single-note marking gaps warrant a bounded proposal.",
    },
}
OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
print(f"{OUT.relative_to(ROOT)}: {len(fixtures)} fixtures, {len(features)} features, "
      f"{len(variant_ids)} variants, {len(render)} rows, {dict(counts)}")
