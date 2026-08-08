// The corpus half of the corpus→primitives pipeline: knows where the SMuFL
// metadata lives on disk and pins the fixed snapshot viewport. The engine
// half (layout, rounding, the output shape) is src/engine/headless.ts — used
// by the layout snapshot test (harness/conformance/primitives.test.ts), the
// preview contact sheet and the PNG renderer, so previews can't drift from
// what the snapshots pin.
import fs from 'node:fs';
import path from 'node:path';
// @ts-expect-error — plain .mjs module without type declarations
import { ROOT } from '../verify/check-scenarios.mjs';
import {
  computePrimitives as computePrimitivesAt,
  computeBothSystem,
  ensureSmufl,
  type RenderedSystem,
  type ScenarioPrimitives
} from '../../src/engine/headless.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

export type { ScenarioPrimitives, RenderedSystem } from '../../src/engine/headless.ts';

export const WIDTH_SP = 80; // fixed viewport so snapshots are deterministic

/** Loads SMuFL metadata from public/smufl/ once per process. */
export function initSmufl(): void {
  ensureSmufl(
    JSON.parse(fs.readFileSync(path.join(ROOT, 'public/smufl/glyphnames.json'), 'utf8')),
    JSON.parse(fs.readFileSync(path.join(ROOT, 'public/smufl/bravura_metadata.json'), 'utf8'))
  );
}

export function computePrimitives(doc: MnxStructure): ScenarioPrimitives {
  initSmufl();
  return computePrimitivesAt(doc, WIDTH_SP);
}

/** The combined notation+tab system for the third SVG golden (null when the
 *  document opts into no tab view) — see computeBothSystem in headless.ts. */
export function computeBoth(doc: MnxStructure): RenderedSystem | null {
  initSmufl();
  return computeBothSystem(doc, WIDTH_SP);
}
