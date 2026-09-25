#!/usr/bin/env python3
"""Rebuild/check the source-marker inventory and reviewed 33a–33k render verdicts."""
from __future__ import annotations

from collections import Counter, defaultdict
from hashlib import sha256
from pathlib import Path
from xml.etree import ElementTree as ET
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
SUITE = ROOT / "converters/fixtures/musicxml-suite"
EVIDENCE = ROOT / "harness/fixtures/musicxml-spanners-evidence"
REPORT = ROOT / "harness/reports/musicxml-spanners-assessment.json"
IDS = tuple(f["id"] for f in json.loads((SUITE / "manifest.json").read_text())["fixtures"] if f["id"].startswith("33"))
assert len(IDS) == 11
SHELLS = ("workbench", "studio")
NOTE_TAGS = {"slur", "tied", "glissando", "slide", "tuplet"}
ORNAMENT_TAGS = {"trill-mark", "accidental-mark", "wavy-line", "tremolo"}
TECHNICAL_TAGS = {"hammer-on", "pull-off"}

def digest(data: bytes) -> str:
    return sha256(data).hexdigest()

def node(e: ET.Element) -> dict:
    return {"tag": e.tag, "attributes": dict(e.attrib), "text": (e.text or "").strip()}

def pitch(n: ET.Element) -> dict | None:
    p = n.find("pitch")
    if p is None:
        return None
    d = {"step": p.findtext("step"), "octave": int(p.findtext("octave"))}
    if p.findtext("alter") is not None:
        d["alter"] = int(p.findtext("alter"))
    return d

def source_markers(fixture: str, root: ET.Element) -> list[dict]:
    out = []
    for pi, part in enumerate(root.findall("part"), 1):
        for mi, measure in enumerate(part.findall("measure"), 1):
            cursor = 0
            ni = di = gi = 0
            for entry in measure:
                if entry.tag == "backup":
                    cursor -= int(entry.findtext("duration"))
                elif entry.tag == "forward":
                    cursor += int(entry.findtext("duration"))
                elif entry.tag == "direction":
                    di += 1
                    ordinal = Counter()
                    offset = int(entry.findtext("offset") or 0)
                    for typ in entry.findall("direction-type"):
                        for mark in typ:
                            ordinal[mark.tag] += 1
                            key = f"{fixture}/p{pi:02}/m{mi:02}/d{di:02}/{mark.tag}{ordinal[mark.tag]:02}"
                            out.append({"id": key, "fixture": fixture, "part": pi, "measure": mi,
                                        "location": "direction", "tag": mark.tag, "source": node(mark),
                                        "direction": {"cursorDivisions": cursor, "offsetDivisions": offset,
                                                      "effectiveDivisions": cursor + offset,
                                                      "placement": entry.get("placement")}})
                elif entry.tag == "grouping":
                    gi += 1
                    out.append({"id": f"{fixture}/p{pi:02}/m{mi:02}/group{gi:02}", "fixture": fixture,
                                "part": pi, "measure": mi, "location": "grouping",
                                "tag": "grouping", "source": node(entry)})
                elif entry.tag == "note":
                    ni += 1
                    nbase = f"{fixture}/p{pi:02}/m{mi:02}/n{ni:02}"
                    note_context = {"pitch": pitch(entry), "voice": entry.findtext("voice"),
                                    "staff": entry.findtext("staff"), "grace": entry.find("grace") is not None,
                                    "chord": entry.find("chord") is not None,
                                    "durationDivisions": int(entry.findtext("duration") or 0),
                                    "cursorDivisions": cursor,
                                    "tiePlayback": [node(x) for x in entry.findall("tie")]}
                    for bi, mark in enumerate(entry.findall("beam"), 1):
                        if fixture.startswith("33j"):
                            out.append({"id": f"{nbase}/beam{bi:02}", "fixture": fixture, "part": pi,
                                        "measure": mi, "location": "note", "tag": "beam",
                                        "note": note_context, "source": node(mark)})
                    for nti, nt in enumerate(entry.findall("notations"), 1):
                        counts = Counter()
                        for mark in nt:
                            targets = [(mark.tag, mark)] if mark.tag in NOTE_TAGS else []
                            if mark.tag in ("ornaments", "technical"):
                                targets = [(c.tag, c) for c in mark
                                           if c.tag in (ORNAMENT_TAGS if mark.tag == "ornaments" else TECHNICAL_TAGS)]
                            for tag, sub in targets:
                                counts[tag] += 1
                                out.append({"id": f"{nbase}/nt{nti:02}/{tag}{counts[tag]:02}",
                                            "fixture": fixture, "part": pi, "measure": mi,
                                            "location": "note", "tag": tag, "note": note_context,
                                            "source": node(sub)})
                    if entry.find("chord") is None:
                        cursor += int(entry.findtext("duration") or 0)
    return out

def feature(mark: dict) -> str:
    f, tag, m, a = mark["fixture"], mark["tag"], mark["measure"], mark["source"]["attributes"]
    if f.startswith("33a"):
        if tag == "slur": return f"{f}.slur.{'dashed' if m == 3 else 'solid'}"
        if tag == "wedge": return f"{f}.wedge.{'crescendo' if m == 4 else 'diminuendo'}"
        if tag == "wavy-line": return f"{f}.trill-line.{'single-note' if m == 7 else 'continued'}"
        if tag == "trill-mark": return f"{f}.trill-mark.{'below' if m == 7 else 'above'}"
        if tag == "accidental-mark": return f"{f}.trill-accidental.{mark['source']['text']}"
        if tag == "octave-shift": return f"{f}.octave-shift.{'8va' if m == 8 else '15mb'}"
        if tag == "bracket": return f"{f}.bracket.m{m:02}"
        if tag == "pedal": return f"{f}.pedal.{'line' if m == 22 else 'symbol'}"
        if tag == "glissando": return f"{f}.glissando.wavy"
        if tag == "slide": return f"{f}.slide.solid"
        if tag in TECHNICAL_TAGS: return f"{f}.technical.{tag}"
        if tag == "tremolo": return f"{f}.two-note-tremolo"
        return f"{f}.{tag}"
    if f.startswith("33c"):
        return f"{f}.slur.{'chained' if m == 1 else 'nested' if m == 2 else 'cross-voice'}"
    if f.startswith("33d") or f.startswith("33e"):
        size = a.get("size")
        if a["type"] == "stop":
            # Source stop follows its start, including the invalid-size fixture.
            if f.startswith("33d"):
                c = mark["direction"]["cursorDivisions"]
                label = "15ma" if c == 12 else "15mb" if c == 20 else "8va" if c == 28 else "8vb"
            else:
                label = "invalid-27" if mark["direction"]["cursorDivisions"] == 2 else "invalid-11"
        else:
            label = ("invalid-" + size) if f.startswith("33e") else (
                ("15ma" if a["type"] == "down" else "15mb") if size == "15" else
                ("8va" if a["type"] == "down" else "8vb"))
        return f"{f}.octave-shift.{label}"
    if f.startswith("33h"):
        line = a.get("line-type")
        if a.get("type") == "stop":
            # The XML end repeats the style except the source's dashed slide end.
            if tag == "slide" and m == 4 and "/n04/" in mark["id"]:
                line = "dashed"
        return f"{f}.{tag}.{line or 'default'}.m{m:02}"
    if f.startswith("33i"):
        return f"{f}.tie.{'A-C' if m in (1, 2) or (m == 3 and a.get('type') == 'stop') else 'C-open' if m == 3 else 'D-E'}"
    if f.startswith("33j"):
        if tag == "tremolo": return f"{f}.double-note-tremolo.m{m:02}"
        return f"{f}.{tag}.m{m:02}"
    if f.startswith("33k"):
        if tag == "tied":
            return f"{f}.tie.{'cross-voice' if m == 1 and mark['note']['pitch']['step'] == 'G' else 'enharmonic' if m <= 2 and (mark['note']['pitch']['step'] in ('A','B') and mark['note']['pitch']['octave'] == 4) else 'laissez-vibrer' if m == 4 else 'arpeggio'}"
        return f"{f}.beam"
    return f"{f}.{tag}"

def verdict(mark: dict) -> tuple[str, list[str], str]:
    f, tag, m = mark["fixture"][:3], mark["tag"], mark["measure"]
    feat = mark["featureId"]
    if f == "33a":
        if tag in ("tuplet", "wedge") or (tag == "slur" and m == 2):
            return "correct", [], "The source start/end and ordinary notation survive in MNX and the complete SVG."
        if tag == "slur":
            return "partial", ["importer"], "The endpoints and curve survive, but dashed line-type is dropped and a solid slur draws."
        if tag == "octave-shift":
            return "incorrect", ["layout/SVG engine"], "MNX retains 8va/15mb and half-bar endpoints in bars 8/9, but the labels and lines draw in unrelated bars in both shells."
        if tag in ("glissando", "slide"):
            return "partial", ["importer", "representation"], "The note targets and straight strokes survive, but glissando/slide identity and requested wavy or solid style collapse to the same shift-slide carrier."
        if tag in TECHNICAL_TAGS:
            return "partial", ["importer", "representation"], "The target and letterless curve survive; hammer versus pull identity and H/P text do not."
        if tag == "grouping":
            return "not applicable", [], "MusicXML grouping here supplies analytical structure, not requested visible ink; no render pass is inferred."
        if tag == "tremolo":
            return "missing", ["importer"], "The source two-stroke double-note tremolo is absent from MNX; the visible numeral 2 is a tuplet, not tremolo ink."
        if tag in ("trill-mark", "accidental-mark", "wavy-line"):
            return "missing", ["importer", "representation"], "The trill, attached accidental or wavy continuation disappears from MNX and has no visible mark."
        return "missing", ["importer", "representation"], "The source bracket/dash/pedal span or endpoint is absent from MNX and the complete notation SVG."
    if f == "33b":
        return "correct", [], "The whole-note F4 tie resolves to the second bar and draws one correct curve."
    if f == "33c":
        if m == 3:
            return "missing", ["importer"], "The lower-to-upper cross-voice slur is absent from MNX and both SVGs."
        return "correct", [], "Chained or nested source endpoints survive in MNX and draw distinct curves at the intended notes."
    if f == "33d":
        return "incorrect", ["importer"], "The label/value survives, but source negative direction offsets place the stop after the start; MNX collapses or shortens that range, and the drawn line misses the intended span."
    if f == "33e":
        return "incorrect", ["importer"], "Invalid size 27 or 11 receives no size warning; the import silently coerces it to ±1 and draws a plausible 8va/8vb. The unrelated common-time warning does not cover this input."
    if f == "33f":
        if tag == "slur":
            return "correct", [], "The ordinary main-note slur survives and draws to its source endpoint."
        return "missing", ["importer", "representation"], "The trill and wavy continuation to the after-grace endpoint disappear; the visible ordinary slur does not substitute for them."
    if f == "33g":
        return "correct", [], "Both source slurs retain exact chord-member targets and distinct upper/lower curves in the complete view."
    if f == "33h":
        if tag == "glissando" and ("default" in feat or "wavy" in feat):
            return "incorrect", ["importer", "representation"], "Default/wavy glissando should have a wavy stroke; MNX collapses it to a straight shift slide."
        return "partial", ["importer", "representation"], "The source endpoints produce a straight stroke, but line-type, glissando/slide identity and optional inline text are lost."
    if f == "33i":
        if "C-open" in feat:
            return "unresolved", ["source/reference ambiguity", "importer"], "This start has no source stop; the importer drops it without a diagnostic. The fixture provides no unambiguous final curve endpoint."
        return "correct", [], "The A–C or D–E source tie resolves to the stated end and draws one curve; the lyric letters are only reference labels."
    if f == "33j":
        if tag == "beam":
            if m == 1:
                return "missing", ["importer"], "The first-bar beam declarations belong to double-note tremolo strokes; they import as generic beams and leave no tremolo ink."
            return "correct", [], "The second-bar ordinary eighth-note chord beam group draws; its separate double-note tremolo strokes are missing."
        if tag == "tuplet":
            return "incorrect", ["importer"], "One source tuplet over the three double-note tremolos is split into multiple displayed tuplet groups and numbers."
        return "missing", ["importer"], "All double-note tremolo stroke counts disappear; ordinary beams and the extra tuplet numbers are not tremolo ink."
    if f == "33k":
        if tag == "beam":
            return "correct", [], "The ordinary source beam groups remain visible; they do not establish the separate tie cases."
        if "cross-voice" in feat:
            return "missing", ["importer"], "The source G4 voice-1 to voice-2 tie is absent from MNX and both SVGs."
        if "enharmonic" in feat:
            return "missing", ["importer"], "The source A-sharp to B-flat enharmonic tie is not linked in MNX and has no curve."
        if "laissez" in feat:
            return "missing", ["importer", "representation"], "The single-note let-ring tie has no MNX carrier or visible outgoing curve."
        return "correct", [], "The three staggered E4/G4/C5 starts retain their chord-member targets and draw three separate curves."
    raise AssertionError(mark["id"])

def imported_projection(measure: dict) -> dict:
    out = {k: measure.get(k, []) for k in ("ottavas", "dynamics", "directions", "beams") if measure.get(k)}
    events = []
    def visit(content):
        for e in content:
            if "notes" in e:
                data = {k: e[k] for k in ("id", "slurs", "tuplet", "tremolo") if k in e}
                data["notes"] = [{k: n[k] for k in ("id", "pitch", "ties", "_x") if k in n} for n in e["notes"]]
                events.append(data)
            if "content" in e:
                visit(e["content"])
    for seq in measure.get("sequences", []):
        visit(seq.get("content", []))
    out["events"] = events
    return out

def pair_markers(marks: list[dict]) -> None:
    open_marks = defaultdict(list)
    for mark in marks:
        tag, a = mark["tag"], mark["source"]["attributes"]
        typ = a.get("type")
        if tag == "beam":
            typ = {"begin": "start", "end": "stop", "continue": "continue"}.get(mark["source"]["text"])
        if typ not in ("start", "stop", "down", "up", "crescendo", "diminuendo", "change", "continue"):
            continue
        if tag == "tuplet" and typ == "stop": pass
        key = (mark["fixture"], tag, mark["measure"] if tag == "beam" else None, a.get("number", "1"))
        if typ in ("start", "down", "up", "crescendo", "diminuendo"):
            open_marks[key].append(mark)
        elif typ == "stop":
            choices = open_marks[key]
            if tag == "tied" and mark.get("note", {}).get("pitch"):
                target = mark["note"]["pitch"]
                def midi(p):
                    names = {"C":0,"D":2,"E":4,"F":5,"G":7,"A":9,"B":11}
                    return 12 * p["octave"] + names[p["step"]] + p.get("alter", 0)
                choices = [x for x in choices if x.get("note", {}).get("pitch") and midi(x["note"]["pitch"]) == midi(target)]
            if choices:
                start = choices[-1]
                open_marks[key].remove(start)
                start["pairedEndpoint"] = mark["id"]
                mark["pairedEndpoint"] = start["id"]
        elif typ in ("continue", "change") and open_marks[key]:
            mark["pairedEndpoint"] = open_marks[key][-1]["id"]
    # In a MusicXML multi-voice measure the stop may precede the start in XML order.
    by_id = {x["id"]: x for x in marks}
    a = by_id["33c-Spanners-Slurs/p01/m03/n04/nt01/slur01"]
    b = by_id["33c-Spanners-Slurs/p01/m03/n02/nt01/slur01"]
    a["pairedEndpoint"] = b["id"]
    b["pairedEndpoint"] = a["id"]

def main() -> None:
    suite = json.loads((SUITE / "manifest.json").read_text())
    entries = {x["id"]: x for x in suite["fixtures"]}
    indexes = {s: json.loads((EVIDENCE / s / "index.json").read_text()) for s in SHELLS}
    commit = indexes["workbench"]["applicationCommit"]
    script_hash = digest(subprocess.check_output(
        ["git", "show", f"{commit}:harness/verify/musicxml-editor-capture.mjs"], cwd=ROOT))
    fixtures, marks = [], []
    for fixture in IDS:
        entry = entries[fixture]
        source_path = SUITE / entry["path"]
        assert digest(source_path.read_bytes()) == entry["sha256"]
        source = ET.parse(source_path).getroot()
        assert not source.findall(".//staff-tuning")
        docs = {s: json.loads((EVIDENCE / s / fixture / "document.mnx.json").read_text()) for s in SHELLS}
        assert docs["workbench"] == docs["studio"], fixture
        capture = {}
        for shell in SHELLS:
            index = indexes[shell]
            assert index["applicationCommit"] == commit and index["corpusRevision"] == suite["revision"]
            assert index["captureScriptSha256"] == script_hash
            assert index["viewport"] == {"width": 1440, "height": 1000, "deviceScaleFactor": 1}
            assert index["browser"]["product"] == "Chrome/153.0.8010.36"
            assert [x["id"] for x in index["fixtures"]] == list(IDS)
            obs = json.loads((EVIDENCE / shell / fixture / "observation.json").read_text())
            assert obs["sourceSha256"] == entry["sha256"]
            assert obs["editorBound"] and obs["availableViews"] == ["notation"]
            assert not obs.get("editingSuspended") and not obs.get("viewingOriginal")
            assert not obs.get("importError") and not obs.get("captureError") and not obs["consoleErrors"]
            assert obs["displayOptions"]["lyrics"] == "all"
            assert obs["displayOptions"]["timeSignatures"] == obs["displayOptions"]["clefs"] == "show"
            view = obs["views"][0]
            assert view["view"] == "notation" and view["svgCount"] == 1
            assert view["staffScale"] == 1 and view["densityH"] == 2
            assert not view["renderErrors"] and not view["diagnosticTitles"]
            assert view["scrollHeight"] <= view["clientHeight"] + 1
            assert len(view["screenshots"]) == 1
            svg = ET.parse(EVIDENCE / shell / fixture / "notation-0.svg").getroot()
            classes = Counter(e.attrib["class"] for e in svg.iter() if "class" in e.attrib)
            capture[shell] = {"observation": f"{shell}/{fixture}/observation.json",
                              "importedMnx": f"{shell}/{fixture}/document.mnx.json",
                              "svg": f"{shell}/{fixture}/notation-0.svg",
                              "screenshots": [f"{shell}/{fixture}/{n}" for n in view["screenshots"]],
                              "visibleHeight": view["visibleHeight"],
                              "scrollHeight": view["scrollHeight"],
                              "svgClasses": dict(sorted(classes.items())),
                              "warnings": obs["warnings"]}
        source_pitches = Counter(json.dumps(pitch(n), sort_keys=True) for n in source.findall("part/measure/note")
                                 if pitch(n) is not None)
        def imported_pitches(content):
            values = []
            for event in content:
                values.extend(json.dumps(n["pitch"], sort_keys=True) for n in event.get("notes", []))
                values.extend(imported_pitches(event.get("content", [])))
            return values
        rendered_pitches = Counter(p for part in docs["workbench"]["parts"]
                                   for measure in part["measures"] for seq in measure.get("sequences", [])
                                   for p in imported_pitches(seq["content"]))
        assert rendered_pitches == source_pitches, fixture
        fixtures.append({k: entry[k] for k in ("id", "path", "sha256", "description", "testClass")} |
                        {"capture": capture, "sourceMeasures": len(source.findall("part/measure")),
                         "sourcePitchedNotes": sum(source_pitches.values()),
                         "importedPitchedNotes": sum(rendered_pitches.values()),
                         "pitchMultisetExact": True})
        for mark in source_markers(fixture, source):
            mark["featureId"] = feature(mark)
            measure = docs["workbench"]["parts"][mark["part"]-1]["measures"][mark["measure"]-1]
            mark["importedMeasure"] = imported_projection(measure)
            marks.append(mark)
    pair_markers(marks)
    for mark in marks:
        verdict_name, causes, reason = verdict(mark)
        mark["viewRows"] = [{"shell": shell, "view": "notation", "verdict": verdict_name,
                            "causes": causes, "reason": reason,
                            "observation": fixtures[IDS.index(mark["fixture"])]["capture"][shell]["observation"],
                            "svg": fixtures[IDS.index(mark["fixture"])]["capture"][shell]["svg"],
                            "screenshots": fixtures[IDS.index(mark["fixture"])]["capture"][shell]["screenshots"]}
                           for shell in SHELLS]
    groups = defaultdict(list)
    for mark in marks:
        groups[mark["featureId"]].append(mark)
    features = []
    for fid, group in sorted(groups.items()):
        rows = []
        for shell in SHELLS:
            counts = Counter(mark["viewRows"][SHELLS.index(shell)]["verdict"] for mark in group)
            status = next(iter(counts)) if len(counts) == 1 else "partial"
            rows.append({"shell": shell, "view": "notation", "verdict": status,
                         "variantVerdicts": dict(sorted(counts.items())),
                         "causes": sorted({c for mark in group for c in mark["viewRows"][SHELLS.index(shell)]["causes"]}),
                         "reason": "Aggregate of explicit source-marker and endpoint rows; inspect each marker for a mixed result."})
        features.append({"id": fid, "variantIds": [x["id"] for x in group], "viewRows": rows})
    report = {
        "kind": "agent source-to-MNX and current both-shell spanner render assessment",
        "scope": "eleven original 33a–33k fixtures; no authoring, undo/redo or persistence verdicts",
        "suiteRevision": suite["revision"], "applicationCommit": commit,
        "browser": indexes["workbench"]["browser"]["product"],
        "viewPolicy": "Notation only: no source declares tuned strings; Show clefs/meters, All verses; one complete unscrolled tile per score",
        "fixtures": fixtures, "features": features, "variants": marks,
        "totals": {"originals": len(fixtures), "featureIds": len(features), "sourceMarkers": len(marks),
                   "featureViewRows": len(features)*2,
                   "featureVerdicts": dict(sorted(Counter(row["verdict"] for x in features for row in x["viewRows"]).items())),
                   "variantViewRows": len(marks)*2,
                   "variantVerdicts": dict(sorted(Counter(row["verdict"] for x in marks for row in x["viewRows"]).items()))}
    }
    data = (json.dumps(report, indent=2, ensure_ascii=False) + "\n").encode()
    manifest = {"kind": "retained original-file browser evidence",
                "suiteRevision": suite["revision"], "applicationCommit": commit,
                "captureScriptSha256": script_hash,
                "files": [{"path": p.relative_to(EVIDENCE).as_posix(), "sha256": digest(p.read_bytes())}
                          for p in sorted(EVIDENCE.rglob("*")) if p.is_file() and p.name != "manifest.json"]}
    manifest_bytes = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode()
    if "--write" in sys.argv:
        REPORT.write_bytes(data)
        (EVIDENCE / "manifest.json").write_bytes(manifest_bytes)
        print(report["totals"])
    else:
        assert REPORT.read_bytes() == data, "Report differs; run with --write and review."
        assert (EVIDENCE / "manifest.json").read_bytes() == manifest_bytes, "Evidence hash manifest differs."
        print("Verified", report["totals"])

if __name__ == "__main__":
    main()
