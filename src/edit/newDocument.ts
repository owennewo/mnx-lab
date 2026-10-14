/**
 * A blank piece: what a "New piece" form makes before anyone has written a note
 * (roadmap: studio-campaign-authoring, item studio-piece-create).
 *
 * Genesis is OPS, not a template: the document is built from the literal `{}`
 * through `applyOp`, the way the construct traces build every corpus scenario,
 * so a new piece is exactly what the editor could have made by hand and nothing
 * the editor cannot then address — its title and artist included (`setWork`).
 *
 * A piece has strings. Guitar Pro — studio's stored format — cannot say "no
 * instrument": a part written without a tuning reloads as a six-string guitar
 * (harness/fixtures/roundtrip-register.json), so offering one here would be
 * offering something the first save quietly replaces.
 */
import type { MnxStructure, MnxTuningEntry } from '../model/mnx.ts';
import { applyOp } from './ops.ts';
import type { EditOp } from './ops.ts';

export interface NewDocumentSpec {
  title: string;
  artist?: string;
  /** The part's display name; its id is derived as the name's slug. */
  partName?: string;
  /** Numbered per `_x.mnxLab`: string 1 is the highest-pitched. */
  tuning: MnxTuningEntry[];
  /** 0 or absent writes no capo at all. */
  capo?: number;
  time: { count: number; unit: number; display?: 'common' | 'cut' };
  fifths: number;
  bars: number;
}

export const MAX_NEW_BARS = 999;

/** A reason the spec cannot be built, or null. The form shows it; the builder throws it. */
export function newDocumentProblem(spec: NewDocumentSpec): string | null {
  if (!spec.title.trim()) return 'A piece needs a title.';
  if (spec.tuning.length < 3 || spec.tuning.length > 12) return 'A tuning has 3 to 12 strings.';
  if (spec.capo !== undefined && (!Number.isInteger(spec.capo) || spec.capo < 0 || spec.capo > 24)) return 'A capo sits on fret 0 to 24.';
  if (!Number.isInteger(spec.bars) || spec.bars < 1 || spec.bars > MAX_NEW_BARS) return `A piece starts with 1 to ${MAX_NEW_BARS} bars.`;
  if (!Number.isInteger(spec.fifths) || spec.fifths < -7 || spec.fifths > 7) return 'A key signature has at most seven sharps or flats.';
  return null;
}

const slug = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'part';

/** The ops that make the instrument: a part, its strings, its staves, its capo. */
export function newDocumentOps(spec: NewDocumentSpec): EditOp[] {
  const partName = spec.partName?.trim() || 'Guitar';
  const ops: EditOp[] = [
    { type: 'addPart', partId: slug(partName), name: partName },
    // String 1 first, the order every importer writes; the grammar recites low string first.
    { type: 'setTuning', tuning: [...spec.tuning].sort((a, b) => a.string - b.string) },
    { type: 'setStaffKind', kind: 'both' }
  ];
  if (spec.capo) ops.push({ type: 'setPartDeclaration', declaration: { kind: 'capo', value: spec.capo } });
  return ops;
}

export function buildNewDocument(spec: NewDocumentSpec): MnxStructure {
  const problem = newDocumentProblem(spec);
  if (problem) throw new Error(problem);
  let document = {} as MnxStructure;
  for (const op of newDocumentOps(spec)) document = applyOp(document, op);
  // Bars before meter: a time signature belongs to a bar, so the first one has to
  // exist. Whether `addPart` opened it is the op's business — ask the document.
  while (document.global.measures.length < spec.bars) document = applyOp(document, { type: 'appendMeasure' });
  document = applyOp(document, { type: 'setTimeSignature', measureIndex: 0, time: spec.time });
  document = applyOp(document, { type: 'setKeySignature', measureIndex: 0, fifths: spec.fifths });
  return applyOp(document, { type: 'setWork', work: { title: spec.title, artist: spec.artist ?? null } });
}

/** What the form lets a person change about a piece made from a file. */
export interface FromFileSpec {
  title: string;
  artist?: string;
  /** Absent leaves every part's capo as the file wrote it; a number puts the
   *  capo there on every part that has strings (0 takes it off). */
  capo?: number;
}

const stringedParts = (document: MnxStructure) =>
  (document.parts ?? []).flatMap((part, index) => part._x?.mnxLab?.strings?.length ? [index] : []);

/** The capo the file put on its first fretted part, 0 for none, or null when no part has strings. */
export function fileCapo(document: MnxStructure): number | null {
  const [first] = stringedParts(document);
  return first === undefined ? null : document.parts[first]._x?.mnxLab?.capo ?? 0;
}

/** A piece made from a file (roadmap: studio-new-piece-from-file): the imported
 *  document, with the title, artist and capo the form settled on written by the
 *  same ops the editor uses — so the file's music arrives untouched. */
export function adoptImportedDocument(imported: MnxStructure, spec: FromFileSpec): MnxStructure {
  if (!spec.title.trim()) throw new Error('A piece needs a title.');
  if (spec.capo !== undefined && (!Number.isInteger(spec.capo) || spec.capo < 0 || spec.capo > 24)) throw new Error('A capo sits on fret 0 to 24.');
  let document = applyOp(imported, { type: 'setWork', work: { title: spec.title.trim(), artist: spec.artist?.trim() || null } });
  if (spec.capo === undefined) return document;
  for (const partIndex of stringedParts(document)) {
    document = spec.capo
      ? applyOp(document, { type: 'setPartDeclaration', partIndex, declaration: { kind: 'capo', value: spec.capo } })
      : applyOp(document, { type: 'removePartDeclaration', partIndex, kind: 'capo' });
  }
  return document;
}
