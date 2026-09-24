"""Assemble reviewed 01a–01h verdicts from the retained source/import inventory.

The expectations and judgments below are agent review, not inferred from a
successful import or a nonempty SVG. Re-run after the source audit and browser
probes; inspect changes to the JSON report before accepting them.
"""

import json
import hashlib
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AUDIT = json.loads((ROOT / "harness/reports/musicxml-pitch-source-import.json").read_text())
EVIDENCE = ROOT / "harness/fixtures/musicxml-pitch-evidence"
OUT = ROOT / "harness/reports/musicxml-pitch-assessment.json"

# Each source note is a stable variant ID; feature IDs group the source's
# intended distinctions, including format-only and visually ambiguous cases.
FEATURES = [
    ("01a.pitch-sequence", "All 108 source notes ascend G2–C7 in unaltered, sharp and flat runs; pitch spelling and placement remain readable across 27 bars.", "correct", [], "All 108 step/octave/alter triples match imported MNX; full notation tiles in both shells show the low and high ledger positions. Accidental qualifications in bar 27 are judged separately."),
    ("01a.explicit-accidentals", "Sharp and flat runs, explicit naturals in bars 25–26, and double sharp / double flat in bar 27 retain their ordinary symbol and note pitch.", "correct", [], "All 76 explicit accidental displays and pitch alterations are present; both shells show the ordinary glyphs including the bottom bar. Cautionary/editorial meaning is separate."),
    ("01a.accidental-qualifiers", "Bar 27 note 3 is cautionary and note 4 editorial, with identical sharp pitch but distinct source intent.", "unresolved", ["importer", "source/reference ambiguity"], "Both flags disappear on import, leaving indistinguishable show:true fields. MusicXML leaves the default enclosure for such attributes to applications; the required visible distinction needs a reference policy. The semantic loss is certain."),
    ("01b.interval-ladder", "Each of 41 bars pairs two notes in the source's ascending interval-jump sequence, including enharmonic sharp/flat spellings and distant ledger notes.", "correct", [], "All 82 pitches match, each pair appears in measure order in both shells, and the complete score was inspected through the actual scroll area. The unrelated incompatible 2/4 common-symbol warning is retained."),
    ("01c.omitted-voice", "The sole source note omits the optional MusicXML voice element.", "not applicable", [], "Voice omission is format syntax with no separate mark to engrave; import assigns an internal v1 voice and retains the note. Its visible lyric anchor is judged separately."),
    ("01c.lyric-anchor", "The unvoiced G4 whole note carries lyric A under the note.", "correct", [], "The imported event has lyric line 1 text A; both shell captures show A under the whole note."),
    ("01d.fractional-pitches", "Four quarter-tone alterations −1.5, −0.5, +0.5, +1.5 occur once in each of two staff registers.", "incorrect", ["importer", "MNX representation"], "All eight source pitches become integer alterations and ordinary engraving; all eight locations now have explicit import-loss warnings. Published pitch.alter is integer. Item 22 already owns the diagnostic and representation deferral."),
    ("01e.accidental-qualifiers", "Cautionary/editorial combinations, explicit parentheses off, brackets, parentheses, and bracket-plus-parentheses are distinct around ordinary single/double accidentals.", "partial", ["importer", "layout/SVG engine", "source/reference ambiguity"], "Two plain baseline notes render correctly; explicit bracket/parenthesis choices are dropped on import. A real inspector edit proves MNX can hold parentheses, but the rendered first note remains unenclosed. Default styling for bare cautionary/editorial flags is not fixed by the source."),
    ("01f.microtonal-accidental-qualifiers", "Quarter-flat, sharp, three-quarters-flat and three-quarters-sharp each occur plain, editorial, cautionary, and combined.", "incorrect", ["importer", "MNX representation", "source/reference ambiguity"], "Twelve of 16 pitches are rounded to integers with warnings; all special accidental names and qualification flags collapse to show:true without warning. The one plain sharp is an ordinary-symbol baseline, not a pass for the feature."),
    ("01g.arrow-accidental-glyphs", "Twelve distinct MusicXML 3.1 up/down arrow accidental names are printed on G4, even though the pitch elements have no alter.", "incorrect", ["importer", "MNX representation"], "All twelve source glyph names collapse to identical show:true on unaltered G4; both shells print ordinary natural signs. No import warning identifies the lost glyph names."),
    ("01h.turkish-persian-accidental-glyphs", "Fourteen distinct slash, numbered, sori and koron accidental names are printed on G4.", "incorrect", ["importer", "MNX representation"], "All fourteen source glyph names collapse to identical show:true on unaltered G4; both shells print ordinary natural signs. No import warning identifies the lost glyph names."),
]

TASKS = {
    "01a.pitch-sequence": {
        "create": "At an empty first-beat G2 staff position, enter a pitched note without changing the other 107 notes.",
        "inspect": "Select a note and read its written pitch and octave in the note inspector.",
        "change": "Transpose one G2 to G♯2 while retaining its event and all other notes.",
        "remove": "Delete the selected G2 note, leaving its rhythmic cell as a rest.",
    },
    "01a.explicit-accidentals": {
        "create": "Add an explicit sharp, flat, natural or double accidental on the matching selected pitch.",
        "inspect": "Read the selected note's exact spelling and whether its accidental display is explicit.",
        "change": "Change an explicit accidental and its corresponding pitch spelling without moving the note.",
        "remove": "Remove the explicit display while retaining the intended pitch.",
    },
    "01a.accidental-qualifiers": {
        "create": "Add the bar-27 cautionary or editorial distinction to a sharp note.",
        "inspect": "Distinguish cautionary from editorial on the two imported bar-27 notes.",
        "change": "Switch the intended qualification while preserving C♯5.",
        "remove": "Remove only the qualification, retaining pitch and ordinary accidental display.",
    },
    "01b.interval-ladder": {
        "create": "Add a two-note bar with a chosen interval and source-style enharmonic spelling.",
        "inspect": "Select each member of a pair and determine its pitches and interval.",
        "change": "Change one interval endpoint without changing the other note or bar rhythm.",
        "remove": "Remove one interval member while preserving its partner.",
    },
    "01c.omitted-voice": {
        "create": "Omit the MusicXML voice tag for a single-voice note on export.",
        "inspect": "Read whether the original file omitted the optional voice tag.",
        "change": "Switch tag omission without changing musical voice membership.",
        "remove": "Remove the optional source tag without deleting the note.",
    },
    "01c.lyric-anchor": {
        "create": "Attach lyric A to the G4 whole-note event.",
        "inspect": "Select the G4 event and read its lyric text and line.",
        "change": "Replace A with another lyric syllable without altering pitch or duration.",
        "remove": "Remove the syllable while preserving the G4 whole note.",
    },
    "01d.fractional-pitches": {
        "create": "Enter each of −1.5, −0.5, +0.5 and +1.5 semitone alterations at two octaves.",
        "inspect": "Read the exact fractional alteration of each source note.",
        "change": "Change one fractional alteration without rounding or affecting other notes.",
        "remove": "Remove a fractional alteration while retaining its base step and octave.",
    },
    "01e.accidental-qualifiers": {
        "create": "Add a parenthesized or bracketed accidental, or a cautionary/editorial qualification, to a selected note.",
        "inspect": "Read which of the four source qualifications applies to each note.",
        "change": "Switch enclosure or qualification while retaining the sounding pitch.",
        "remove": "Remove the selected accidental qualification without deleting its pitch.",
    },
    "01f.microtonal-accidental-qualifiers": {
        "create": "Enter the exact quarter/three-quarter glyph and its plain, cautionary or editorial form.",
        "inspect": "Read both the fractional pitch and the accidental qualification.",
        "change": "Switch either exact microtonal glyph or qualification without rounding pitch.",
        "remove": "Remove qualification or glyph choice without silently changing pitch.",
    },
    "01g.arrow-accidental-glyphs": {
        "create": "Place one of the twelve distinct up/down arrow accidental glyphs on a G4 note.",
        "inspect": "Read which named arrow accidental the selected source note uses.",
        "change": "Switch between two named arrow glyphs while preserving G4.",
        "remove": "Remove the arrow glyph choice while preserving the note.",
    },
    "01h.turkish-persian-accidental-glyphs": {
        "create": "Place one of the fourteen slash, numbered, sori or koron glyphs on G4.",
        "inspect": "Read the selected glyph's exact MusicXML accidental name.",
        "change": "Switch between two named Turkish/Persian glyphs while preserving G4.",
        "remove": "Remove the named glyph choice while preserving the note.",
    },
}

source_by_id = {fixture["id"]: fixture for fixture in AUDIT["fixtures"]}
features, render_rows, task_rows, persistence_rows = [], [], [], []
for feature_id, expected, verdict, causes, reason in FEATURES:
    fixture_id = next(fixture_id for fixture_id in source_by_id if fixture_id.startswith(feature_id[:3] + "-"))
    fixture = source_by_id[fixture_id]
    variants = [note["id"] for note in fixture["notes"] if feature_id in note["featureIds"]]
    features.append({"id": feature_id, "fixture": fixture_id, "expected": expected, "variantIds": variants, "variantCount": len(variants),
                     "sourceDescription": fixture["description"]})
    for shell in ("workbench", "studio"):
        capture = f"harness/fixtures/musicxml-pitch-evidence/{shell}/{fixture_id}/observation.json"
        render_rows.append({"featureId": feature_id, "shell": shell, "view": "notation", "verdict": verdict,
                            "cause": causes, "reason": reason,
                            "sourceImportEvidence": "harness/reports/musicxml-pitch-source-import.json",
                            "captureEvidence": capture})
        for operation, task in TASKS[feature_id].items():
            row = {"featureId": feature_id, "shell": shell, "operation": operation, "task": task,
                   "expectedStructuralChange": "See task; preserve unrelated notes, events and metadata",
                   "verdict": "unresolved", "cause": ["not yet isolated"],
                   "reason": "No source-specific real-editor action was exercised for this variant family; the displayed import is not authoring proof.",
                   "undoRedo": "unresolved", "evidence": capture}
            if feature_id == "01c.omitted-voice":
                row.update(verdict="not applicable", cause=[], reason="Optional MusicXML voice-tag spelling is a serialization choice; MNX assigns one internal voice and exposes no separate musical operation for tag omission.", undoRedo="not applicable")
            elif feature_id in {"01d.fractional-pitches", "01f.microtonal-accidental-qualifiers", "01g.arrow-accidental-glyphs", "01h.turkish-persian-accidental-glyphs"}:
                row.update(verdict="blocked", cause=["MNX representation", "importer"], reason="The exact source pitch or named glyph is absent from the imported document; no direct control can preserve the requested value. A model/carrier decision precedes a meaningful editing task.", undoRedo="blocked")
            elif feature_id == "01a.pitch-sequence":
                trace = f"harness/fixtures/musicxml-pitch-evidence/write/{shell}-01a/report.json"
                ui = {"create": "N on the selected empty first-beat G2 cell", "inspect": "Enter on first G2 note → pitch:G2 pill", "change": "Alt+↑ on selected first G2 note", "remove": "Delete on the selected first note"}[operation]
                row.update(verdict="partial", cause=[], reason="First G2 variant passed via real controls with exact structural preservation; remaining register and accidental variants were not individually authored.",
                           testedVariantIds=["01a-Pitches-Pitches/m01/n01"], uiPath=ui,
                           undoRedo="exact for tested mutation" if operation != "inspect" else "not applicable", evidence=trace)
            elif feature_id == "01e.accidental-qualifiers":
                trace = f"harness/fixtures/musicxml-pitch-evidence/write/{shell}-01e/report.json"
                ui = {"create": "Enter note inspector → accidental parens", "inspect": "Enter note inspector → accidental show/parens pill", "change": "Enter note inspector → accidental show, then accidental parens", "remove": "Enter note inspector → no accidental"}[operation]
                row.update(verdict="partial", cause=["command/binding", "renderer feedback"],
                           reason="Parentheses and ordinary show/remove pass exact history on one selected note; bracket, editorial and combined qualifications have no proved direct control, and parentheses are not drawn.",
                           testedVariantIds=["01e-Pitches-ParenthesizedAccidentals/m01/n01"], uiPath=ui,
                           undoRedo="exact for tested mutation" if operation != "inspect" else "not applicable", evidence=trace)
            elif feature_id in {"01a.explicit-accidentals", "01a.accidental-qualifiers"}:
                row.update(reason="The first-note/parentheses probes do not prove the source's later natural, double, cautionary or editorial forms in this fixture.")
            elif feature_id == "01b.interval-ladder" and operation == "inspect":
                row.update(verdict="partial", cause=[], reason="Both displayed endpoint pitches can be selected; no dedicated numerical interval readout or all-41-pair authoring probe was checked.")
            elif feature_id == "01c.lyric-anchor" and operation == "inspect":
                row.update(verdict="partial", cause=[], reason="Lyric A is visible and retained in imported event data; its selected inspector state was not captured.")
            task_rows.append(row)

        route_names = ["JSON Copy → file → Open MNX"] if shell == "workbench" else ["Save now → GP checkpoint → reload", "Library Export MNX → Open", "Library Export MusicXML → Open", "Library Export Guitar Pro 7 → Open"]
        for route in route_names:
            persistence = {"featureId": feature_id, "shell": shell, "route": route, "verdict": "unresolved", "cause": ["not yet isolated"],
                           "reason": "No edited source-specific state was reopened through this route.", "evidence": None}
            if feature_id == "01c.omitted-voice":
                persistence.update(verdict="not applicable", cause=[], reason="Omission of an optional XML voice tag is not a direct editor state.")
            elif feature_id == "01a.pitch-sequence":
                trace = f"harness/fixtures/musicxml-pitch-evidence/write/{shell}-01a/report.json"
                if shell == "workbench":
                    persistence.update(verdict="partial", cause=[], reason="Final first-note create state reopens exactly; only this selected edit was exercised.", evidence=trace)
                else:
                    persistence.update(verdict="incorrect", cause=["persistence/export"], reason="GP checkpoint has 93 of 108 notes; each Library download reopens from that saved canonical source with 93 notes. The original XML rendition stays unchanged.", evidence=trace)
            elif feature_id == "01a.explicit-accidentals" and shell == "studio":
                persistence.update(verdict="incorrect", cause=["persistence/export"], reason="The 01a GP checkpoint loses explicit accidental-display fields, independently of its 15 lost notes; downstream Library exports inherit the saved canonical state.", evidence="harness/fixtures/musicxml-pitch-evidence/write/studio-01a/report.json")
            elif feature_id == "01e.accidental-qualifiers":
                trace = f"harness/fixtures/musicxml-pitch-evidence/write/{shell}-01e/report.json"
                if shell == "workbench":
                    persistence.update(verdict="partial", cause=[], reason="Final first-note parenthesis carrier reopens exactly as MNX; other qualifier variants were not authored.", evidence=trace)
                else:
                    persistence.update(verdict="incorrect", cause=["persistence/export"], reason="GP storage retains 16 notes but drops every accidentalDisplay, including the new parentheses; all three Library downloads reopen without it.", evidence=trace)
            elif feature_id in {"01d.fractional-pitches", "01f.microtonal-accidental-qualifiers", "01g.arrow-accidental-glyphs", "01h.turkish-persian-accidental-glyphs"}:
                persistence.update(verdict="blocked", cause=["importer", "MNX representation"], reason="The exact source feature was lost before an editable state or save route existed.")
            persistence_rows.append(persistence)

# Per-note visual disposition where the source intentionally mixes plain,
# explicitly enclosed, and default-styled forms inside one feature.
variant_dispositions = []
for fixture in AUDIT["fixtures"]:
    for note in fixture["notes"]:
        prefix = fixture["id"][:3]
        if prefix == "01e":
            attrs = (note["source"]["accidental"] or {}).get("attributes", {})
            status = "incorrect" if attrs.get("bracket") == "yes" or attrs.get("parentheses") == "yes" else "correct" if not attrs else "unresolved"
            variant_dispositions.append({"featureId": "01e.accidental-qualifiers", "variantId": note["id"], "shells": ["workbench", "studio"], "view": "notation", "verdict": status,
                                         "reason": "Explicit enclosure missing" if status == "incorrect" else "Plain baseline" if status == "correct" else "Default styling not specified; semantic flags lost"})
        elif prefix == "01f":
            attrs = (note["source"]["accidental"] or {}).get("attributes", {})
            status = "incorrect" if not note["pitchEqual"] else "correct" if not attrs else "unresolved"
            variant_dispositions.append({"featureId": "01f.microtonal-accidental-qualifiers", "variantId": note["id"], "shells": ["workbench", "studio"], "view": "notation", "verdict": status,
                                         "reason": "Fractional source pitch lost" if status == "incorrect" else "Plain sharp baseline" if status == "correct" else "Default cautionary/editorial styling unresolved; flags lost"})

result = {
    "kind": "implementation-loop agent assessment; feature and task verdicts are not human scenario verification",
    "corpusRevision": AUDIT["corpusRevision"],
    "applicationCommit": json.loads((EVIDENCE / "workbench/index.json").read_text())["applicationCommit"],
    "scope": "Eight 01a–01h originals. Source → browser-imported MNX → all applicable notation views. Direct desktop task probes use 01a and 01e; other task variants have explicit unresolved/blocked dispositions.",
    "fixtureCount": len(AUDIT["fixtures"]), "featureCount": len(features), "sourceNoteVariantCount": AUDIT["sourceNoteCount"],
    "sourcePitchMatchCount": AUDIT["importedPitchMatchCount"],
    "browser": json.loads((EVIDENCE / "workbench/index.json").read_text())["browser"]["product"],
    "viewport": {"width": 1440, "height": 1000, "deviceScaleFactor": 1},
    "viewPolicy": "Originals declare no strings; notation only. Time signatures were explicitly set to Show; effective display options and actual scroller tiles are in each observation.",
    "features": features, "render": render_rows, "renderVariantDispositions": variant_dispositions,
    "authoringTasks": task_rows, "persistence": persistence_rows,
    "counts": {"renderRows": len(render_rows), "renderVerdicts": dict(Counter(row["verdict"] for row in render_rows)),
               "authoringTaskRows": len(task_rows), "authoringVerdicts": dict(Counter(row["verdict"] for row in task_rows)),
               "persistenceRows": len(persistence_rows), "persistenceVerdicts": dict(Counter(row["verdict"] for row in persistence_rows))},
    "deduplication": {
        "item22": "01d's eight fractional pitch warnings and carrier deferral already belong to completed item 22. The 01f fractional cases share that blocker; they are not a new fractional-pitch implementation request.",
        "item23": "Item 23 enables untitled Studio originals to become editable; the current eight do. It records 01a's 15-note GP storage loss but does not repair it.",
        "newProposal": "core-musicxml-accidental-fidelity: explicit enclosure import/render, named accidental diagnostics and carrier decision, direct bracket/editorial authoring, and GP storage policy."
    },
}
OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
artifact_files = sorted(path for path in EVIDENCE.rglob("*") if path.is_file() and path.name != "manifest.json")
manifest = {
    "kind": "implementation-loop retained 01a–01h agent assessment artifacts; not pixel goldens",
    "applicationCommit": result["applicationCommit"],
    "corpusRevision": AUDIT["corpusRevision"],
    "files": [
        {"path": str(path.relative_to(EVIDENCE)), "bytes": path.stat().st_size,
         "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
        for path in artifact_files
    ],
}
(EVIDENCE / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(f"{len(features)} features, {len(render_rows)} render rows, {len(task_rows)} authoring rows, {len(persistence_rows)} persistence rows → {OUT}")
