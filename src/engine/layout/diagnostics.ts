import { Primitive, DiagnosticKind } from '../primitives.ts';

/**
 * Per-measure diagnostic markers: when something is wrong with a bar, it gets
 * a small badge at its bottom-left per issue, message riding along as a native
 * SVG `<title>` tooltip (hover works in the app and in static contact sheets
 * alike). Three visually distinct kinds:
 *
 *   - validation (red circle)        — the user can and should fix the document
 *   - warning    (blue circle)       — legal and possibly intentional, but
 *                                      ambiguous: consumers will disagree
 *   - render     (amber rounded box) — this renderer's limitation, not theirs
 *
 * Warning shares the circle shape with validation (both are about the
 * document, not the renderer) but not its colour — a warning must not read as
 * "you made a mistake".
 */

export interface MeasureIssue {
  kind: DiagnosticKind;
  message: string;
}

const MARKER_SIZE_SP = 1.1;
const MARKER_GAP_SP = 0.3;
const MARKER_INSET_SP = 0.3;   // from the start barline
const MARKER_DROP_SP = 1.2;    // below the bottom staff line

const STYLE: Record<DiagnosticKind, { fill: string; radius: number; titlePrefix: string }> = {
  validation: { fill: '#b91c1c', radius: MARKER_SIZE_SP / 2, titlePrefix: 'validation — ' },
  warning: { fill: '#1d4ed8', radius: MARKER_SIZE_SP / 2, titlePrefix: 'warning — ' },
  render: { fill: '#b45309', radius: 0.3, titlePrefix: 'renderer — ' }
};

/** Leftmost first: errors, then warnings, then renderer gaps. */
const ORDER: Record<DiagnosticKind, number> = { validation: 0, warning: 1, render: 2 };

/**
 * Badges for issues attributable to ONE event: centred under that event's
 * column, same styles and drop as the corner stack — position IS the
 * attribution, so the reader's eye lands on the offending note.
 */
export function emitPositionedDiagnostics(
  xCentre: number,
  staffBottom: number,
  issues: readonly MeasureIssue[],
  primitives: Primitive[]
): void {
  const ordered = [...issues].sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
  const total = ordered.length * MARKER_SIZE_SP + (ordered.length - 1) * MARKER_GAP_SP;
  const start = xCentre - total / 2;
  ordered.forEach((issue, i) => {
    const style = STYLE[issue.kind];
    const title = style.titlePrefix + issue.message;
    const className = `diagnostic-marker diagnostic-${issue.kind}`;
    const x = start + i * (MARKER_SIZE_SP + MARKER_GAP_SP);
    const y = staffBottom + MARKER_DROP_SP;
    primitives.push({
      kind: 'rect',
      x, y,
      w: MARKER_SIZE_SP, h: MARKER_SIZE_SP,
      radius: style.radius,
      fill: style.fill,
      className,
      title
    });
    primitives.push({
      kind: 'text',
      text: '!',
      x: x + MARKER_SIZE_SP / 2,
      y: y + MARKER_SIZE_SP / 2,
      font: 'body',
      size: 0.9,
      weight: 'bold',
      anchor: 'middle',
      baseline: 'central',
      fill: '#fff',
      className,
      title
    });
  });
}

export function emitMeasureDiagnostics(
  measureX: number,
  staffBottom: number,
  issues: readonly MeasureIssue[],
  primitives: Primitive[]
): void {
  // Validation first (leftmost): it's the user-actionable kind.
  const ordered = [...issues].sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
  ordered.forEach((issue, i) => {
    const style = STYLE[issue.kind];
    const title = style.titlePrefix + issue.message;
    const className = `diagnostic-marker diagnostic-${issue.kind}`;
    const x = measureX + MARKER_INSET_SP + i * (MARKER_SIZE_SP + MARKER_GAP_SP);
    const y = staffBottom + MARKER_DROP_SP;
    primitives.push({
      kind: 'rect',
      x, y,
      w: MARKER_SIZE_SP, h: MARKER_SIZE_SP,
      radius: style.radius,
      fill: style.fill,
      className,
      title
    });
    primitives.push({
      kind: 'text',
      text: '!',
      x: x + MARKER_SIZE_SP / 2,
      y: y + MARKER_SIZE_SP / 2,
      font: 'body',
      size: 0.9,
      weight: 'bold',
      anchor: 'middle',
      baseline: 'central',
      fill: '#fff',
      className,
      title
    });
  });
}
