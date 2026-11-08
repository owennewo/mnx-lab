/**
 * What a save costs, measured: export the document as the `.gp` Studio stores,
 * read that file straight back, and compare (roadmap: studio-save-pipeline;
 * studio authoring campaign clause 3 — no save is silent about loss).
 *
 * Pure and synchronous, so the harness runs it in Node and the browser runs it
 * in a worker (`storageCheck.ts`); it imports the converters, which is why it is
 * not imported by anything on the main thread.
 */
import { importGuitarProCleanRoom } from '../../converters/guitarpro-mnx/src/cleanRoom.ts';
import { exportGuitarProGpif, STORAGE_EXPORT_OPTIONS } from '../../converters/guitarpro-mnx/src/gpif/fromMnx.ts';
import { collapseDifferences, compareDocuments, type RoundTripCheck } from '../model/documentCompare.ts';
import type { MnxStructure } from '../model/mnx.ts';

/** One thing that will not persist, addressed so an editor could point at it. */
export interface StorageLoss { path: string; kind: 'lost' | 'changed'; was: string }

export interface StorageCheckResult {
  bytes: Uint8Array;
  /** The exporter options that ran — the rendition's `producer_options`. */
  options: Record<string, unknown>;
  /** The summary the service keeps beside the rendition. */
  check: RoundTripCheck;
  /** The first losses in full, for the owner; `check` has the whole count. */
  losses: StorageLoss[];
}

const MAX_LOSSES = 50, MAX_SHAPES = 100, MAX_WARNINGS = 100;
const brief = (value: unknown) => { const text = JSON.stringify(value) ?? ''; return text.length > 120 ? `${text.slice(0, 117)}…` : text; };

export function checkStorage(document: MnxStructure): StorageCheckResult {
  const warnings: string[] = [];
  type Exportable = Parameters<typeof exportGuitarProGpif>[0];
  const bytes = exportGuitarProGpif(document as unknown as Exportable, { ...STORAGE_EXPORT_OPTIONS, onWarning: message => warnings.push(message) });
  const differences = compareDocuments(mergeEndingRuns(document), importGuitarProCleanRoom(bytes));
  const costly = differences.filter(d => d.kind !== 'gained');
  return {
    bytes,
    options: { ...STORAGE_EXPORT_OPTIONS },
    check: {
      verdict: !differences.length ? 'clean' : costly.length ? 'differs' : 'gains',
      differences: collapseDifferences(differences).slice(0, MAX_SHAPES),
      warnings: [...new Set(warnings)].slice(0, MAX_WARNINGS)
    },
    losses: costly.slice(0, MAX_LOSSES).map(d => ({ path: d.path.join('/'), kind: d.kind as 'lost' | 'changed', was: brief(d.before) }))
  };
}

/**
 * Back-to-back bars that each carry the same ending are ONE ending, as long as
 * them all — the player walks them the same (`linearizePasses`), and Guitar
 * Pro, which marks endings bar by bar, hands them back merged. Compared as
 * written, the merge read as a loss: "Bar 16 — duration, changed; Bar 17 —
 * ending, dropped" (Strolling Down the Highway, 2026-11-08, endings 2,3,4,6 on
 * bars 16 and 17). Only what is compared is merged; the document is not.
 */
export function mergeEndingRuns(document: MnxStructure): MnxStructure {
  const measures = document.global?.measures;
  if (!measures?.some(m => m.ending)) return document;
  const copy = structuredClone(document);
  const bars = copy.global.measures;
  const same = (a: readonly number[] = [], b: readonly number[] = []) =>
    a.length === b.length && a.every((n, i) => n === b[i]);
  for (let i = 0; i < bars.length; i++) {
    const ending = bars[i]!.ending as { numbers?: number[]; duration?: number; open?: boolean } | undefined;
    if (!ending) continue;
    let next = i + (ending.duration ?? 1);
    for (;;) {
      const following = bars[next]?.ending as { numbers?: number[]; duration?: number; open?: boolean } | undefined;
      if (!following || !same(ending.numbers, following.numbers) || ending.open) break;
      ending.duration = (ending.duration ?? 1) + (following.duration ?? 1);
      if (following.open) ending.open = true;
      delete bars[next]!.ending;
      next = i + ending.duration;
    }
  }
  return copy;
}
