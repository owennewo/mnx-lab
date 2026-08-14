// The committed construct traces, keyed by target scenario id — the ops
// panel's replay affordance (roadmap/complete/core-element-ops-exemplar.md,
// stage 5 feedback: SEEING the genesis queue beats reading about it). The
// fixtures are harness evidence, imported read-only the same way the corpus
// itself is (committed JSON via glob); the workbench never writes them —
// recording still goes through "copy trace" and the repo.
import type { EditorIntent } from '../edit/intents.ts';

export interface ConstructTrace {
  /** The corpus scenario this trace constructs, starting from `{}`. */
  target: string;
  intents: EditorIntent[];
}

const traceModules = import.meta.glob('../../harness/fixtures/construct-traces/*.json', {
  eager: true,
  import: 'default'
});

export const constructTraceByTarget: ReadonlyMap<string, ConstructTrace> = new Map(
  Object.values(traceModules).map(module => {
    const trace = module as ConstructTrace;
    return [trace.target, trace] as const;
  })
);
