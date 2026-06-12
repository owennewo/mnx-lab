import { Primitive, DiagnosticKind } from '../primitives.ts';

/**
 * Per-measure diagnostic markers: when something is wrong with a bar, it gets
 * a small badge at its bottom-left per issue, message riding along as a native
 * SVG `<title>` tooltip (hover works in the app and in static contact sheets
 * alike). Two visually distinct kinds:
 *
 *   - validation (red circle)        — the user can and should fix the document
 *   - render     (amber rounded box) — this renderer's limitation, not theirs
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
  render: { fill: '#b45309', radius: 0.3, titlePrefix: 'renderer — ' }
};

export function emitMeasureDiagnostics(
  measureX: number,
  staffBottom: number,
  issues: readonly MeasureIssue[],
  primitives: Primitive[]
): void {
  // Validation first (leftmost): it's the user-actionable kind.
  const ordered = [...issues].sort((a, b) =>
    a.kind === b.kind ? 0 : a.kind === 'validation' ? -1 : 1
  );
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
