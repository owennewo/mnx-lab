"""Inventory the original 01a–01h notes against retained browser-imported MNX.

Run after musicxml-editor-capture.mjs, with the retained evidence directory as
the first argument. This is structural evidence, not a rendering verdict.
"""

import json
import hashlib
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "harness/fixtures/musicxml-pitch-evidence"
OUTPUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "harness/reports/musicxml-pitch-source-import.json"
MANIFEST = json.loads((ROOT / "converters/fixtures/musicxml-suite/manifest.json").read_text())
FIXTURES = [f for f in MANIFEST["fixtures"] if f["id"][:3] in {"01a", "01b", "01c", "01d", "01e", "01f", "01g", "01h"}]


def feature_ids(prefix, measure, index):
    if prefix == "01a":
        result = ["01a.pitch-sequence"]
        if measure >= 9:
            result.append("01a.explicit-accidentals")
        if measure == 27 and index >= 3:
            result.append("01a.accidental-qualifiers")
        return result
    if prefix == "01b":
        return ["01b.interval-ladder"]
    if prefix == "01c":
        return ["01c.omitted-voice", "01c.lyric-anchor"]
    if prefix == "01d":
        return ["01d.fractional-pitches"]
    if prefix == "01e":
        return ["01e.accidental-qualifiers"]
    if prefix == "01f":
        return ["01f.microtonal-accidental-qualifiers"]
    if prefix == "01g":
        return ["01g.arrow-accidental-glyphs"]
    return ["01h.turkish-persian-accidental-glyphs"]


def mnx_events(measure):
    return [event for sequence in measure.get("sequences", []) for event in sequence.get("content", []) if event.get("notes")]


rows = []
for fixture in FIXTURES:
    xml_path = ROOT / "converters/fixtures/musicxml-suite" / fixture["path"]
    assert hashlib.sha256(xml_path.read_bytes()).hexdigest() == fixture["sha256"], fixture["id"]
    xml_root = ET.parse(xml_path).getroot()
    assert len(xml_root.findall("./part")) == 1, fixture["id"]
    source_measures = xml_root.findall("./part/measure")
    shell_data = {}
    for shell in ("workbench", "studio"):
        directory = EVIDENCE / shell / fixture["id"]
        document = json.loads((directory / "document.mnx.json").read_text())
        observation = json.loads((directory / "observation.json").read_text())
        assert len(document["parts"]) == 1 and len(document["parts"][0]["measures"]) == len(source_measures), fixture["id"]
        shell_data[shell] = (document, observation)
    assert shell_data["workbench"][0] == shell_data["studio"][0], fixture["id"] + " differs between shells"
    imported, wb_observation = shell_data["workbench"]
    notes = []
    for measure_ordinal, source_measure in enumerate(source_measures, 1):
        source_notes = source_measure.findall("./note")
        events = mnx_events(imported["parts"][0]["measures"][measure_ordinal - 1])
        imported_notes = [note for event in events for note in event["notes"]]
        assert len(source_notes) == len(imported_notes), (fixture["id"], measure_ordinal)
        for note_ordinal, (source_note, imported_note) in enumerate(zip(source_notes, imported_notes), 1):
            pitch = source_note.find("pitch")
            assert pitch is not None, (fixture["id"], measure_ordinal, note_ordinal)
            accidental = source_note.find("accidental")
            source_pitch = {
                "step": pitch.findtext("step"), "octave": int(pitch.findtext("octave")),
                "alter": float(pitch.findtext("alter") or "0"),
            }
            mnx_pitch = imported_note["pitch"]
            imported_pitch = {
                "step": mnx_pitch["step"], "octave": mnx_pitch["octave"],
                "alter": mnx_pitch.get("alter", 0),
            }
            owning_sequence = next(sequence for sequence in imported["parts"][0]["measures"][measure_ordinal - 1].get("sequences", []) if any(imported_note is member for event in sequence.get("content", []) for member in event.get("notes", [])))
            owning_event = next(event for event in owning_sequence.get("content", []) if any(imported_note is member for member in event.get("notes", [])))
            note_id = f"{fixture['id']}/m{measure_ordinal:02}/n{note_ordinal:02}"
            notes.append({
                "id": note_id,
                "featureIds": feature_ids(fixture["id"][:3], measure_ordinal, note_ordinal),
                "source": {
                    "measureNumber": source_measure.attrib.get("number"),
                    "pitch": source_pitch,
                    "accidental": None if accidental is None else {"value": accidental.text, "attributes": accidental.attrib},
                    "voice": source_note.findtext("voice"),
                    "lyric": [lyric.findtext("text") for lyric in source_note.findall("lyric")],
                },
                "imported": {
                    "pitch": imported_pitch,
                    "accidentalDisplay": imported_note.get("accidentalDisplay"),
                    "voice": owning_sequence.get("voice"),
                    "eventLyrics": owning_event.get("lyrics"),
                },
                "pitchEqual": source_pitch == imported_pitch,
            })
    rows.append({
        "id": fixture["id"], "sourcePath": fixture["path"], "sourceSha256": fixture["sha256"],
        "description": fixture["description"], "sourceNotes": len(notes),
        "sourceDeclaresStrings": bool(xml_root.findall(".//staff-tuning")),
        "sourceMeasures": len(source_measures), "importedPitchMatches": sum(note["pitchEqual"] for note in notes),
        "importWarnings": wb_observation.get("warnings", []),
        "workbenchDocumentSha256": wb_observation["importedDocumentSha256"],
        "studioDocumentSha256": shell_data["studio"][1]["importedDocumentSha256"],
        "notes": notes,
    })

result = {
    "kind": "implementation-loop agent structural assessment; source versus actual browser-imported MNX; no visual verdict",
    "corpusRevision": MANIFEST["revision"],
    "fixtureCount": len(rows), "sourceNoteCount": sum(row["sourceNotes"] for row in rows),
    "importedPitchMatchCount": sum(row["importedPitchMatches"] for row in rows),
    "fixtures": rows,
}
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
print(f"{len(rows)} fixtures, {result['sourceNoteCount']} notes, {result['importedPitchMatchCount']} matching imported pitches → {OUTPUT}")
