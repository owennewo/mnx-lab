// All event matches are maximum-cardinality, one-to-one. No predicted duplicates
// can buy extra recall. Ties follow input order for reproducibility.
export function match(expected, predicted, accept) {
  const owner = new Map();
  function visit(i, seen) {
    for (let j = 0; j < predicted.length; j++)
      if (!seen.has(j) && accept(expected[i], predicted[j])) {
        seen.add(j);
        if (!owner.has(j) || visit(owner.get(j), seen)) {
          owner.set(j, i);
          return true;
        }
      }
    return false;
  }
  expected.forEach((_, i) => visit(i, new Set()));
  return [...owner].map(([predicted, expected]) => ({ expected, predicted }));
}
export function counts(tp, fp, fn) {
  const precision = tp + fp ? tp / (tp + fp) : null,
    recall = tp + fn ? tp / (tp + fn) : null;
  return {
    tp,
    fp,
    fn,
    precision,
    recall,
    f1: 2 * tp + fp + fn ? (2 * tp) / (2 * tp + fp + fn) : null,
  };
}
export const quantile = (values, q) => {
  if (!values.length) return null;
  const s = values.toSorted((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))];
};
export function attacks(notes) {
  // Unison voices struck together are acoustically one pitch onset, not two strings.
  return notes.filter(
    (n, i) =>
      !notes
        .slice(0, i)
        .some(
          (p) =>
            Math.abs(n.pitch - p.pitch) < 1e-6 &&
            Math.abs(n.start - p.start) < 1e-6,
        ),
  );
}
export function soundingPitch(note, t) {
  if (!note.bend || t < note.bend.start) return note.pitch;
  return (
    note.pitch +
    (note.bend.cents / 100) *
      Math.min(1, (t - note.bend.start) / (note.bend.end - note.bend.start))
  );
}
function pitches(notes, t) {
  return [
    ...new Set(
      notes
        .filter((n) => n.start <= t && t < n.end)
        .map((n) => soundingPitch(n, t)),
    ),
  ];
}
export function evaluate(actual, predicted, duration, config) {
  for (const n of predicted)
    if (
      ![n.pitch, n.start, n.end, n.confidence].every(Number.isFinite) ||
      n.start < 0 ||
      n.end < n.start
    )
      throw Error("Invalid prediction");
  const truth = attacks(actual);
  const accepts = (a, b) =>
    Math.abs(a.pitch - b.pitch) <= config.pitchTolerance &&
    Math.abs(a.start - b.start) <= config.attackTolerance + 1e-9;
  const pairs = match(truth, predicted, accepts);
  const onset = counts(
    pairs.length,
    predicted.length - pairs.length,
    truth.length - pairs.length,
  );
  let tp = 0,
    fp = 0,
    fn = 0,
    exact = 0,
    activeFrames = 0,
    silentFalseFrames = 0,
    silentFrames = 0;
  const polyphony = {};
  for (let t = 0; t < duration; t += config.frameStep) {
    const a = pitches(actual, t),
      p = pitches(predicted, t),
      m = match(a, p, (x, y) => Math.abs(x - y) <= config.pitchTolerance);
    tp += m.length;
    fp += p.length - m.length;
    fn += a.length - m.length;
    const key = String(a.length),
      cell = (polyphony[key] ??= { tp: 0, fp: 0, fn: 0, frames: 0, exact: 0 });
    cell.tp += m.length;
    cell.fp += p.length - m.length;
    cell.fn += a.length - m.length;
    cell.frames++;
    cell.exact += m.length === a.length && m.length === p.length ? 1 : 0;
    if (a.length) {
      activeFrames++;
      exact += m.length === a.length && m.length === p.length ? 1 : 0;
    } else {
      silentFrames++;
      silentFalseFrames += p.length ? 1 : 0;
    }
  }
  const usedE = new Set(pairs.map((p) => p.expected)),
    usedP = new Set(pairs.map((p) => p.predicted));
  const octave = match(
    truth.filter((_, i) => !usedE.has(i)),
    predicted.filter((_, i) => !usedP.has(i)),
    (a, b) =>
      Math.abs(Math.abs(a.pitch - b.pitch) - 12) <= config.pitchTolerance &&
      Math.abs(a.start - b.start) <= config.attackTolerance,
  ).length;
  const curve = config.confidenceThresholds.map((threshold) => {
    const subset = predicted.filter((n) => n.confidence >= threshold),
      matches = match(truth, subset, accepts);
    return {
      threshold,
      retainedFraction: predicted.length
        ? subset.length / predicted.length
        : null,
      ...counts(
        matches.length,
        subset.length - matches.length,
        truth.length - matches.length,
      ),
    };
  });
  const bins = Array.from({ length: 5 }, (_, i) => {
    const ids = predicted
      .map((n, j) => ({ n, j }))
      .filter(
        ({ n }) =>
          n.confidence >= i / 5 && (i === 4 || n.confidence < (i + 1) / 5),
      );
    return {
      from: i / 5,
      to: (i + 1) / 5,
      count: ids.length,
      correct: ids.filter(({ j }) => usedP.has(j)).length,
      meanScore: ids.length
        ? ids.reduce((s, { n }) => s + n.confidence, 0) / ids.length
        : null,
    };
  });
  const latency = pairs
    .map((p) => predicted[p.predicted].emittedAt - truth[p.expected].start)
    .filter(Number.isFinite);
  return {
    onset,
    active: counts(tp, fp, fn),
    exactActiveFrames: exact,
    activeFrames,
    exactChordRate: activeFrames ? exact / activeFrames : null,
    silentFalseFrames,
    silentFrames,
    octaveConfusions: octave,
    polyphony,
    latency: {
      count: latency.length,
      p50: quantile(latency, 0.5),
      p95: quantile(latency, 0.95),
    },
    onsetError: pairs.length
      ? pairs.reduce(
          (s, p) =>
            s +
            Math.abs(truth[p.expected].start - predicted[p.predicted].start),
          0,
        ) / pairs.length
      : null,
    releaseError: pairs.length
      ? pairs.reduce(
          (s, p) =>
            s + Math.abs(truth[p.expected].end - predicted[p.predicted].end),
          0,
        ) / pairs.length
      : null,
    confidenceCurve: curve,
    scoreBins: bins,
    matched: pairs,
    missing: truth.filter((_, i) => !usedE.has(i)),
    extra: predicted.filter((_, i) => !usedP.has(i)),
  };
}
// Deliberately conservative assessment probe: only unmatched observed attacks accuse.
// Absence of a detected target attack is unassessed, never proof of a missing note.
export function assessment(target, actual, predicted, config) {
  const t = attacks(target),
    a = attacks(actual),
    accept = (x, y) =>
      Math.abs(x.pitch - y.pitch) <= config.pitchTolerance &&
      Math.abs(x.start - y.start) <= config.attackTolerance + 1e-9;
  const trueMatch = match(t, a, accept),
    detMatch = match(t, predicted, accept);
  const actualMatched = new Set(trueMatch.map((p) => p.predicted)),
    predMatched = new Set(detMatch.map((p) => p.predicted));
  const actualExtra = a.filter((_, i) => !actualMatched.has(i)),
    accused = predicted.filter((_, i) => !predMatched.has(i));
  const correct = match(actualExtra, accused, accept).length;
  const missingTarget = t.length - trueMatch.length;
  return {
    correctAccusations: correct,
    falseAccusations: accused.length - correct,
    missedUnexpectedAttacks: actualExtra.length - correct,
    missingTargetEvents: missingTarget,
    unassessedTargetEvents: t.length - detMatch.length,
    policy:
      "Unexpected attacks only; missing target events are unassessed. A substitution is an unexpected attack plus an absent target.",
  };
}
