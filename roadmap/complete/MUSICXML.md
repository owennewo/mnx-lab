# MusicXML & MNX Bi-directional Conversion Assessment

This document assesses the feasibility, mappings, and challenges of bi-directional conversion between guitar-oriented MusicXML files (specifically based on the analysis of [House-of-the-Rising-Sun.xml](file:///home/williao/dev/mnx-editor/server/scores/House-of-the-Rising-Sun.xml)) and the W3C MNX format.

The goal of this assessment is to prepare for the development of a TypeScript-based internal package (`converters/musicxml-mnx`) that performs import (MusicXML $\rightarrow$ MNX) and export (MNX $\rightarrow$ MusicXML).

---

## 1. Feasibility Summary
Bi-directional conversion is **highly feasible** but asymmetric:
1. **MusicXML $\rightarrow$ MNX (Import)**: Requires stateful parsing to thread flat note streams into parallel sequences, aligning standard and TAB parts, and storing guitar-specific tablature details in the `_x` vendor extension.
2. **MNX $\rightarrow$ MusicXML (Export)**: Requires splitting combined representations back into separate standard and TAB parts (note duplication), re-transposing pitches, and flattening sequences back into a single stream with `<backup>` and `<forward>` commands.
3. **Roundtripping & ID Preservation**: Unique IDs must be deterministically mapped and suffixes added/stripped during splitting to avoid XML ID collisions while ensuring full roundtrip integrity.
4. **Guitar Extension JSON Schema**: Stored under [guitar-tab-extension.schema.json](file:///home/williao/dev/mnx-editor/schemas/guitar-tab-extension.schema.json) to formally specify and validate note-level and part-level tab parameters under the `_x.guitar` property.

---

## 2. Common Type & Element Mappings

Below is the complete mapping of all 56 unique XML element types found in [House-of-the-Rising-Sun.xml](file:///home/williao/dev/mnx-editor/server/scores/House-of-the-Rising-Sun.xml) to their equivalents in the MNX schema or the project's Typescript definition. This mapping serves as the foundation for both import and export.

### Document & Metadata Structure
| MusicXML Element | MNX Schema Location | Supported Natively? | Mapping Logic & Suggested `_x` Extension |
| :--- | :--- | :---: | :--- |
| `score-partwise` | Root object | **Yes** | Maps to the root of the MNX document. |
| `identification` | Root level metadata | **No** | Maps to `_x.metadata`. MNX does not natively specify composer or rights metadata. |
| `encoding` | Sub-element | **No** | Maps to `_x.metadata.encoding`. |
| `supports` | N/A (Discarded) | **No** | Exporter-level feature check; discarded during conversion. |
| `software` | Sub-element | **No** | Maps to `_x.metadata.encoding.software`. |
| `encoding-date` | Sub-element | **No** | Maps to `_x.metadata.encoding.date`. |
| `part-list` | N/A (Logical Group) | **Yes** | Used to group parts and layouts. |
| `score-part` | `parts` array item | **Yes** | Corresponds to an entry in `parts` and layouts. |
| `part-name` | `part.name` | **Yes** | Map `<part-name>Guitar</part-name>` directly to `part.name = "Guitar"`. |

### Score Attributes & Measure Globals
| MusicXML Element | MNX Schema Location | Supported Natively? | Mapping Logic & Suggested `_x` Extension |
| :--- | :--- | :---: | :--- |
| `part` | `parts[i]` (`MnxPart`) | **Yes** | Contains measures for a specific instrument. |
| `measure` | `global.measures[i]` and `part.measures[i]` | **Yes** | Separated in MNX: global layout properties (time, key) go to `global.measures[i]`; note contents go to `part.measures[i]`. |
| `attributes` | N/A (Logical Group) | **Yes** | Container for clef, key, time, divisions, transpose, and staff-details. |
| `divisions` | N/A (Discarded) | **Yes** | Used mathematically to calculate fractional durations; discarded in output. |
| `key` | `global.measures[i].key` | **Yes** | Maps key signature changes. |
| `fifths` | `global.measures[i].key.fifths` | **Yes** | Number of sharps/flats (e.g. `0` for C Major/A Minor). |
| `time` | `global.measures[i].time` | **Yes** | Time signature definition. |
| `beats` | `global.measures[i].time.count` | **Yes** | Time signature numerator. |
| `beat-type` | `global.measures[i].time.unit` | **Yes** | Time signature denominator. |
| `clef` | `part.measures[i].clefs` | **Yes** | List of clef definitions. |
| `sign` | `clef.sign` | **Partial** | Enum: `"G"`, `"F"`, `"C"`. For `"TAB"`, use `_x.clef.sign = "TAB"` (Standard MNX schema fails on `"TAB"`). |
| `line` | `clef.staffPosition` | **Yes** | Staff line index. Treble Clef on line 2 maps to `staffPosition = -2`. |
| `transpose` | `part.transposition` | **Yes** | Transposition settings for written vs sounding pitches. |
| `chromatic` | `part.transposition.interval.halfSteps` | **Yes** | Semitones offset (e.g., `-12` for standard guitar). |
| `staff-details` | `part._x.staffDetails` | **No** | Tablature details. Store in `part._x.staffDetails`. |
| `staff-lines` | `part._x.staffDetails.staffLines` | **No** | Number of lines (e.g., `6` for standard guitar). |
| `staff-tuning` | `part._x.staffDetails.tuning` | **No** | Store tuning array containing pitches for each string. |
| `tuning-step` | `tuning[stringIndex].step` | **No** | Pitch step (e.g. `E`, `A`, `D`, `G`, `B`, `E`). |
| `tuning-octave` | `tuning[stringIndex].octave` | **No** | Pitch octave (e.g. `2`, `2`, `3`, `3`, `3`, `4`). |
| `sound` | `global.measures[i].tempos` | **Yes** | Controls playback tempo. |
| `tempo` | `tempo.bpm` | **Yes** | Playback tempo in beats per minute (e.g., `160`). |

### Harmony & Chord Symbols
| MusicXML Element | MNX Schema Location | Supported Natively? | Mapping Logic & Suggested `_x` Extension |
| :--- | :--- | :---: | :--- |
| `harmony` | `_x.harmony` | **No** | Chord symbols (e.g., "Am", "C/G"). Map to `_x.harmony` or `_x.chordSymbols` at the rhythmic position. |
| `root` | `_x.harmony.root` | **No** | Root note container. |
| `root-step` | `_x.harmony.root.step` | **No** | Root note step (e.g. `A`, `C`, `D`). |
| `kind` | `_x.harmony.kind` | **No** | Chord type (e.g., `minor` with display text `"m"`). |
| `bass` | `_x.harmony.bass` | **No** | Bass override container. |
| `bass-step` | `_x.harmony.bass.step` | **No** | Bass note step (e.g. `G`, `F#`). |
| `bass-alter` | `_x.harmony.bass.alter` | **No** | Alteration of the bass note (e.g., `1` for sharp). |

### Notes, Rests, and Rhythms
| MusicXML Element | MNX Schema Location | Supported Natively? | Mapping Logic & Suggested `_x` Extension |
| :--- | :--- | :---: | :--- |
| `note` | `event.notes` or `event.rest` | **Yes** | Translates to an event containing note structures or a rest flag. |
| `pitch` | `note.pitch` | **Yes** | Standard pitch information. |
| `step` | `note.pitch.step` | **Yes** | `"C" | "D" | "E" | "F" | "G" | "A" | "B"`. |
| `octave` | `note.pitch.octave` | **Yes** | Octave number (e.g., `3`). |
| `alter` | `note.pitch.alter` | **Yes** | Chromatic alteration (`-1` for flat, `1` for sharp). |
| `duration` | `event.duration` | **Yes** | Numerical duration value. Converted to fractional duration (base + dots). |
| `voice` | `sequence.voice` | **Yes** | Voice index. Restructured into separate voice `sequences`. |
| `type` | `event.duration.base` | **Yes** | Duration name mapping (e.g. `quarter` -> `"quarter"`, `16th` -> `"sixteenth"`). |
| `dot` | `event.duration.dots` | **Yes** | Dotted duration flag. Increments dot count. |
| `chord` | `event.notes` | **Yes** | Sub-note indicator. Combines adjacent notes with `<chord/>` into a single `event.notes` array. |
| `rest` | `event.rest = {}` | **Yes** | Represents a rest. |
| `backup` | N/A (State tracker) | **Yes** | Decrements parser cursor time within measure to separate voices. |
| `barline` | `global.measures[i].barline` | **Yes** | Measure line style (e.g. double, light-light). |
| `bar-style` | `barline.type` | **Yes** | Bar style text mapped to MNX enum values. |

### Notations & Guitar Technical Extensions
| MusicXML Element | MNX Schema Location | Supported Natively? | Mapping Logic & Suggested `_x` Extension |
| :--- | :--- | :---: | :--- |
| `notations` | `event` decorators | **Yes** | Container for slurs, beams, accidentals, technical directions. |
| `beam` | `part.measures[i].beams` | **Yes** | Maps beam numbers (begin, continue, end) to stave-note references in `beams`. |
| `accidental` | `note.accidentalDisplay` | **Yes** | Rendering accidental instruction (e.g. `<accidental>sharp</accidental>`). |
| `technical` | `note._x.guitar` | **No** | Guitar-specific technical markers (frets, strings). |
| `fret` | `note._x.guitar.fret` | **No** | Fret index (e.g., `0` for open, `2` for second fret). |
| `string` | `note._x.guitar.string` | **No** | String index (`1` through `6` on guitar). |

---

## 3. Direction-Specific Conversion Challenges

```mermaid
graph TD
    subgraph Import (MusicXML to MNX)
        A[MusicXML P1 Standard & P2 TAB] -->|Align by Time & Merge| B[Unified MNX Note]
        C[Flat Backup/Forward Stream] -->|Stateful Parser| D[Parallel MNX Sequences]
    end
    subgraph Export (MNX to MusicXML)
        E[Unified MNX Note] -->|Duplicate & Transpose| F[MusicXML P1 Standard & P2 TAB]
        G[Parallel MNX Sequences] -->|Flatten & Calculate Backups| H[Flat Backup/Forward Stream]
    end
    B -->|Roundtrip ID Mapping| E
```

---

## 4. MusicXML $\rightarrow$ MNX (Import) Challenges

### 1. Merging Notation & Tablature Parts
In [House-of-the-Rising-Sun.xml](file:///home/williao/dev/mnx-editor/server/scores/House-of-the-Rising-Sun.xml), there are two distinct parts:
* **Part `P1`**: Standard treble clef staff.
* **Part `P2`**: Guitar tablature staff.

In MNX, these should ideally be unified into a single `MnxPart` with **two staves** (Staff 1 = Treble, Staff 2 = Tablature).

**The Challenge**: The parser must align `P1` and `P2` measure-by-measure, voice-by-voice, and event-by-event:
* Track absolute rhythmic position (in beats/ticks) across both parts.
* Merge pitches from `P1` and frets/strings from `P2` into a single note node if they represent the same musical event.

### 2. Written vs. Sounding Transposition
Guitar standard notation is written **one octave higher** than it sounds. 
* Part `P1` has a transposition attribute: `<transpose><chromatic>-12</chromatic></transpose>`.
* Part `P2` (TAB) records notes at sounding pitch (e.g., low E string is `E2`, but standard notation in `P1` writes it as `E3`).
* **The Challenge**: When merging, the parser must adjust the octaves of standard-notation written pitches to match the sounding pitches:
  $$\text{Sounding Pitch} = \text{Written Pitch} + \text{Transpose Chromatic}$$
  The importer must apply this offset to ensure alignment checks succeed.

### 3. Flat XML Streams to Stateful Parallel Sequences
MusicXML uses a flat stream of `<note>` and `<backup>`/`<forward>` markers to write multi-voice measures.

**The Challenge**: MNX expects distinct sequences for each voice:
```json
"sequences": [
  { "voice": "v1", "content": [...] },
  { "voice": "v2", "content": [...] }
]
```
The parser must maintain a stateful `currentTime` cursor. When a `<backup>` occurs, it shifts the cursor backwards. When notes are parsed, they must be assigned to their respective voice array. If a voice starts late, the importer must generate empty `<space>` elements in MNX to pad it.

---

## 5. MNX $\rightarrow$ MusicXML (Export) Challenges

### 1. ID Mapping & Roundtripping
MNX relies heavily on node-level identifiers (e.g. `id: "n-1"` on notes) to support visual highlighting, editing context, and annotations. MusicXML 3.0+ supports an optional `id` attribute on `<note>`, `<measure>`, and `<part>` tags.

**The Challenge**: Preserving unique identifiers across a roundtrip is difficult due to XML uniqueness constraints:
1. **Uniqueness Violation**: If standard and TAB parts are split into separate XML `<part>` nodes, the same logical note is duplicated into two `<note>` XML nodes. Assigning the same ID (e.g., `id="n-1"`) to both nodes will violate the XML specification's ID uniqueness constraint, leading to invalid XML.
2. **Suffix Solution**: During export, the converter must append deterministic suffixes to split notes:
   * Standard note: `id="n-1_std"`
   * TAB note: `id="n-1_tab"`
3. **Re-merging on Import**: When importing back, the parser must recognize these suffixes, strip them, and merge the notes back into the original ID `n-1`.

### 2. Deduplication & Splitting (Dual-Representation Export)
In a unified MNX score, standard notation and TAB reside in a single part or staff. When exporting to a consumer like Soundslice, Guitar Pro, or MuseScore, the files must be written as **two separate parts** (or two distinct staves in one part, depending on exporter settings).

**The Challenge**:
1. **Note Duplication**: For each note in MNX, the exporter must write one instance to the standard notation part and one instance to the TAB part.
2. **Reverse Transposition**: Standard notation notes must have their pitches shifted **up** by an octave to account for the transposing treble clef:
   $$\text{Written Pitch} = \text{Sounding Pitch} - \text{Transpose Chromatic}$$
   TAB notes must remain at sounding pitch.
3. **Annotation Filtering**: 
   * TAB notes must receive the `<notations><technical><fret>...<string>...</></></>` elements.
   * Standard notes must strip these elements to avoid cluttering standard notation rendering.

### 3. Flattening Sequences and Reconstructing `<backup>`
MNX organizes multi-voice measures as neat, isolated JSON arrays inside `sequences`. MusicXML requires these to be flattened into a single sequence of notes separated by `<backup>` and `<forward>` commands.

**The Challenge**:
1. **Sort Order**: The exporter must sort all notes from all sequences chronologically by their onset times.
2. **Cursor Calculations**: For each voice switch, the exporter must calculate the duration difference between the end of the previous voice and the start of the next voice, generating `<backup>` or `<forward>` nodes with integer `duration` values.
3. **Integer Divisions**: The exporter must select a global `<divisions>` factor (usually the least common multiple of all rhythmic divisions in the piece) and convert all fractional MNX durations back to integer durations:
   $$\text{MusicXML Duration} = \text{MNX Fraction} \times \text{Divisions} \times 4$$

### 4. Reconstructing Harmony/Chord Symbols
If chord symbols are stored under `_x.harmony` at a specific rhythmic position, the exporter must insert `<harmony>` elements in the XML stream. Because MusicXML places `<harmony>` inline before the note it aligns with, the exporter must carefully compute the chronological position of the harmony symbol and inject it at the correct index in the flattened note stream.

---

## 6. Proposed TypeScript Converter Package Design

To maintain flexibility and separation of concerns, the converter will live in a dedicated subdirectory at `/converters/musicxml-mnx` in the workspace root.

### Directory Structure

```
converters/musicxml-mnx/
├── src/
│   ├── import/
│   │   ├── musicxml.ts       # XML parser & state tracker
│   │   └── aligner.ts        # Aligns and merges standard & TAB parts
│   ├── export/
│   │   ├── mnx.ts            # High-level exporter logic
│   │   ├── splitter.ts       # Splits parts & recalculates transpositions
│   │   └── flattener.ts      # Computes voice backups/forwards and divisions
│   ├── common/
│   │   ├── types.ts          # Extended MNX & MusicXML typescript types
│   │   ├── utils.ts          # Duration/fraction math & ID helpers
│   │   └── xml.ts            # Environment-agnostic XML DOM shim
│   ├── cli.ts                # Command Line Interface (Node)
│   └── index.ts              # Entry point (ESM / Library API)
├── tests/
│   ├── import.test.ts
│   └── export.test.ts
├── package.json
└── tsconfig.json
```

---

---

## 7. Standalone Node CLI Tool Design

By framing the converter **strictly as a standalone Node.js CLI tool**, we prevent the editor rendering layer (VexFlow) from acting as an implicit interstitial format. The CLI parses and serializes the complete, lossless representation of both MusicXML and MNX schemas, completely decoupled from any browser-side rendering constraints or VexFlow omissions.

The editor application can then consume or save the raw MNX files generated by the CLI, keeping the browser rendering logic cleanly separated from the conversion logic.

### 1. Robust Server-Side XML Parsing
Since the CLI runs natively in Node.js, we do not need browser shims. We use `@xmldom/xmldom` to parse the MusicXML structure into a standard W3C DOM object:

```typescript
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

export function parseXML(xmlString: string): Document {
  return new DOMParser().parseFromString(xmlString, 'text/xml');
}

export function serializeXML(doc: Document): string {
  return new XMLSerializer().serializeToString(doc);
}
```

---

### 2. CLI Implementation (`src/cli.ts`)
The CLI wrapper exposes a clear command-line interface using standard Node filesystems:

```typescript
#!/usr/bin/env ts-node
import * as fs from 'fs/promises';
import * as path from 'path';
import { importMusicXML, exportMusicXML } from './index';

async function main() {
  const args = process.argv.slice(2);
  const importIndex = args.indexOf('--import');
  const exportIndex = args.indexOf('--export');
  const outputIndex = args.indexOf('--output');

  if (importIndex !== -1 && outputIndex !== -1) {
    const inputPath = path.resolve(args[importIndex + 1]);
    const outputPath = path.resolve(args[outputIndex + 1]);
    
    console.log(`Importing MusicXML: ${inputPath}...`);
    const xmlContent = await fs.readFile(inputPath, 'utf-8');
    const mnx = importMusicXML(xmlContent);
    await fs.writeFile(outputPath, JSON.stringify(mnx, null, 2), 'utf-8');
    console.log(`Conversion complete. Written to MNX: ${outputPath}`);
  } else if (exportIndex !== -1 && outputIndex !== -1) {
    const inputPath = path.resolve(args[exportIndex + 1]);
    const outputPath = path.resolve(args[outputIndex + 1]);
    
    console.log(`Exporting MNX: ${inputPath}...`);
    const mnxContent = await fs.readFile(inputPath, 'utf-8');
    const mnx = JSON.parse(mnxContent);
    const xml = exportMusicXML(mnx);
    await fs.writeFile(outputPath, xml, 'utf-8');
    console.log(`Conversion complete. Written to MusicXML: ${outputPath}`);
  } else {
    console.error('Usage:');
    console.error('  musicxml-mnx --import <input.xml> --output <output.json>');
    console.error('  musicxml-mnx --export <input.json> --output <output.xml>');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error during conversion:', err);
  process.exit(1);
});
```

---

### 3. Usage Examples
Developers can run the converter directly against local file paths:

```bash
# Convert MusicXML file to MNX JSON
node converters/musicxml-mnx/src/cli.ts --import server/scores/House-of-the-Rising-Sun.xml --output scores/House-of-the-Rising-Sun.json

# Convert MNX JSON back to MusicXML
node converters/musicxml-mnx/src/cli.ts --export scores/House-of-the-Rising-Sun.json --output exported.xml
```

---

## 8. Bi-directional API Interface

```typescript
import { MnxStructure } from '../../src/types/mnx.ts';

export interface ImportOptions {
  /**
   * If true, merges standard notation part and tablature part into
   * a single part with 2 staves. Defaults to true.
   */
  mergeNotationAndTab?: boolean;
}

export interface ExportOptions {
  /**
   * If true, splits unified staves back into separate standard and
   * tab parts. Defaults to true.
   */
  splitNotationAndTab?: boolean;

  /**
   * The divisions factor to use in MusicXML. Defaults to 8.
   */
  divisions?: number;
}

/**
 * Converts a MusicXML string into an MNX JSON object structure.
 */
export function importMusicXML(
  xmlContent: string,
  options?: ImportOptions
): MnxStructure;

/**
 * Converts an MNX JSON object structure back into a MusicXML string.
 */
export function exportMusicXML(
  mnxJson: MnxStructure,
  options?: ExportOptions
): string;
```

---

## 9. Decoupling Renderer from Document Representation
By separating the **document schema** from the **rendering engine**:
1. **Lossless Conversion**: The CLI tool can fully preserve annotations, harmonies, dynamics, and guitar specifics in the exported/imported files, even if the current frontend renderer ([mnxToVexflow.ts](file:///home/williao/dev/mnx-editor/src/utils/mnxToVexflow.ts)) does not yet support drawing them. Fortunately, the project's [mnx.ts](file:///home/williao/dev/mnx-editor/src/types/mnx.ts) type definitions already include a custom `_x` schema for guitar frets, strings, fingerings, and bends. To formally define these structures, a JSON Schema has been designed at [guitar-tab-extension.schema.json](file:///home/williao/dev/mnx-editor/schemas/guitar-tab-extension.schema.json) which defines the `guitar` extensions at both the Note level (`_x.guitar` note extension) and the Part/Staff level (`_x.guitar` part/tuning extension).
2. **Modular Upgrades**: VexFlow rendering support for TAB staves and `_x.guitar` can be implemented incrementally in the editor app without changing the underlying document conversion engine.
3. **No Intermediate Loss**: We avoid treating VexFlow as an intermediate format. The score is preserved cleanly as W3C MNX at rest, and only mapped to VexFlow at the view level during browser rendering.
