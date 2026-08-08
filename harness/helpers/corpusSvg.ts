// The second golden: a scenario's primitives put through the REAL SVG emitter
// (src/engine/render/svg.ts) and frozen as text.
//
// Why a second golden at all — expected.primitives.json already pins layout
// exactly. Because it pins layout and nothing else. The primitives stop at
// staff-space coordinates and SMuFL glyph *names*:
//
//     {"kind": "glyph", "glyph": "gClef", "x": 3.1, "y": 11, ...}
//
// Everything between that and what a human actually looked at is ungoverned:
// the name → codepoint lookup in emitGlyph, the five emit branches, the sp→px
// conversion, the viewBox. Map `gClef` to the wrong codepoint and the
// primitives hash does not move a bit while every reader sees the wrong
// symbol. This closes that gap.
//
// Text, not pixels, is the deliberate choice. A PNG hash would absorb the
// local Chrome build, font hinting and antialiasing, so a browser upgrade
// would demote every approval at once — fatal for a record whose entire job
// is to mean "the renderer changed". The SVG string is a pure function of the
// primitives plus our own code, so it stays a verdict about us. What is left
// uncovered is glyph rasterization, which is Bravura's correctness, not ours.
import { renderSvgToString } from './svgString.ts';
import type { ScenarioPrimitives, RenderedSystem } from './corpusPrimitives.ts';

/**
 * Fixed scale. The app scales to fit its viewport (fitPxPerSp), which is a
 * property of the browser window, not of the engraving — pinning it here keeps
 * the golden about the emitter.
 *
 * A POWER OF TWO on purpose. Primitives are rounded to 4 decimals, but sp→px
 * is a multiply, and an arbitrary factor reintroduces float noise in the
 * output (39.3929 × 12 prints as 472.71479999999997). Scaling by a power of
 * two only shifts the exponent, so every coordinate stays as short as the
 * primitive it came from. 16 is also FIT_MAX_PX_PER_SP in svg.ts — the app's
 * own ceiling, so the golden sits at a scale the app actually renders at.
 */
export const GOLDEN_PX_PER_SP = 16;

/** One element per line, so a golden diff reads as a list of what changed. */
function formatSvg(svg: string): string {
  return svg.replace(/>(?=<[^/])/g, '>\n').replace(/(<\/svg>)$/, '\n$1') + '\n';
}

export function renderSystemSvg(system: RenderedSystem): string {
  return formatSvg(
    renderSvgToString({
      primitives: system.primitives,
      widthSp: system.widthSp,
      heightSp: system.heightSp,
      pxPerSp: GOLDEN_PX_PER_SP
    })
  );
}

/** The SVG goldens for a scenario, keyed by the filename each is stored under.
 *  `both` is the combined notation+tab system (computeBothSystem) — a third
 *  golden pinning what the standalone projections structurally cannot see:
 *  vertical composition, spanning barlines, interleaved multi-system wrap. */
export function scenarioSvg(
  computed: ScenarioPrimitives,
  both?: RenderedSystem | null
): Record<string, string> {
  const out: Record<string, string> = {
    'expected.svg': renderSystemSvg(computed.notation)
  };
  if (computed.tab) out['expected.tab.svg'] = renderSystemSvg(computed.tab);
  if (both) out['expected.both.svg'] = renderSystemSvg(both);
  return out;
}

/** Every filename a scenario's SVG goldens can occupy, tab and both included. */
export const SVG_GOLDEN_FILES = ['expected.svg', 'expected.tab.svg', 'expected.both.svg'] as const;
