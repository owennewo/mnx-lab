import { MnxBeam, MnxPartMeasure } from '../types/mnx.ts';

/**
 * Beam-group resolution: flattens the MNX `beams` forest (per part-measure)
 * into per-group specs — the level-1 event run plus every deeper beam segment
 * and hook, explicit or implied. Pure data transformation; all geometry stays
 * in notation.ts.
 *
 * MNX encoding (per the spec examples):
 *   - a top-level beam object is a primary (level-1) group over `events`
 *   - nested `beams` are one level deeper (16th, then 32nd, …)
 *   - a nested beam with a single event is a hook ("partial beam"), with an
 *     optional explicit `direction`
 *   - levels not encoded explicitly are implied from the durations
 *     (beams-secondary-beam-breaks-implied)
 */

/** Beam levels (= flag count) per duration base; absent → not beamable. */
export const BEAM_LEVELS_BY_BASE: Record<string, number> = {
  eighth: 1,
  '16th': 2,
  '32nd': 3,
  '64th': 4
};

export interface BeamSegmentSpec {
  level: number;
  /** ≥2 events, in document order. */
  eventIds: string[];
}

export interface BeamHookSpec {
  level: number;
  eventId: string;
  direction: 'left' | 'right';
}

export interface BeamGroupSpec {
  /** The level-1 run, in document order. */
  eventIds: string[];
  segments: BeamSegmentSpec[];
  hooks: BeamHookSpec[];
}

export interface BeamEventInfo {
  /** Beam levels this duration carries (1 = eighth, 2 = 16th, …). */
  levels: number;
  /** Duration in ticks (whole note = 4096), for implied-break onsets. */
  ticks: number;
}

export const WHOLE_NOTE_TICKS = 4096;

/**
 * Implied subdivision: a group breaks its secondary beams at multiples of the
 * value two levels above its finest note — 32nd groups (level 3) subdivide at
 * eighths, 16th groups (level 2) at quarters (i.e. not within a beat). ALL
 * secondary levels break at that boundary; only the primary beam carries
 * through. Matches the engraving the spec's
 * beams-secondary-beam-breaks-implied example shares with the explicit one.
 */
function impliedBreakTicks(maxLevel: number): number {
  return WHOLE_NOTE_TICKS / 4 / 2 ** (maxLevel - 2);
}

/**
 * A hook points at the neighbour it subdivides with: left when the event has
 * a predecessor in the group, right when it opens the group.
 */
function inferHookDirection(eventId: string, groupEventIds: string[]): 'left' | 'right' {
  return groupEventIds.indexOf(eventId) > 0 ? 'left' : 'right';
}

/**
 * Group spec for an implied (un-encoded) primary run: the secondary levels
 * and hooks are inferred from the durations alone. Used when a document
 * leaves beaming to the renderer (no `support.useBeams`, no `beams` arrays).
 */
export function impliedBeamGroup(
  eventIds: string[],
  info: Map<string, BeamEventInfo>
): BeamGroupSpec {
  const segments: BeamSegmentSpec[] = [];
  const hooks: BeamHookSpec[] = [];
  inferImplied(eventIds, segments, hooks, info);
  return { eventIds, segments, hooks };
}

export function resolveBeamGroups(
  measures: MnxPartMeasure[],
  info: Map<string, BeamEventInfo>
): BeamGroupSpec[] {
  const groups: BeamGroupSpec[] = [];
  for (const measure of measures) {
    for (const top of measure.beams ?? []) {
      if (!top.events?.length) continue;
      const segments: BeamSegmentSpec[] = [];
      const hooks: BeamHookSpec[] = [];
      collectExplicit(top, 1, segments, hooks, top.events);
      inferImplied(top.events, segments, hooks, info);
      groups.push({ eventIds: top.events, segments, hooks });
    }
  }
  return groups;
}

function collectExplicit(
  beam: MnxBeam,
  level: number,
  segments: BeamSegmentSpec[],
  hooks: BeamHookSpec[],
  groupEventIds: string[]
): void {
  for (const child of beam.beams ?? []) {
    const childLevel = level + 1;
    const events = child.events ?? [];
    if (events.length >= 2) {
      segments.push({ level: childLevel, eventIds: events });
    } else if (events.length === 1) {
      hooks.push({
        level: childLevel,
        eventId: events[0],
        direction: child.direction ?? inferHookDirection(events[0], groupEventIds)
      });
    }
    collectExplicit(child, childLevel, segments, hooks, groupEventIds);
  }
}

/**
 * Fills in beam levels the document left implicit: consecutive runs of events
 * still needing level L (and not explicitly covered there) become segments,
 * broken at the metric boundaries of impliedBreakTicks; stranded single
 * events become hooks.
 */
function inferImplied(
  eventIds: string[],
  segments: BeamSegmentSpec[],
  hooks: BeamHookSpec[],
  info: Map<string, BeamEventInfo>
): void {
  const levelsOf = (id: string) => info.get(id)?.levels ?? 0;
  const maxLevel = Math.max(0, ...eventIds.map(levelsOf));

  const onsets = new Map<string, number>();
  let t = 0;
  for (const id of eventIds) {
    onsets.set(id, t);
    t += info.get(id)?.ticks ?? 0;
  }

  const breakTicks = impliedBreakTicks(maxLevel);
  for (let level = 2; level <= maxLevel; level++) {
    const covered = new Set<string>();
    for (const s of segments) if (s.level === level) s.eventIds.forEach(id => covered.add(id));
    for (const h of hooks) if (h.level === level) covered.add(h.eventId);

    let run: string[] = [];
    const flush = () => {
      if (run.length >= 2) {
        segments.push({ level, eventIds: run });
      } else if (run.length === 1) {
        hooks.push({ level, eventId: run[0], direction: inferHookDirection(run[0], eventIds) });
      }
      run = [];
    };
    for (const id of eventIds) {
      if (levelsOf(id) < level || covered.has(id)) {
        flush();
        continue;
      }
      if (run.length > 0 && onsets.get(id)! % breakTicks === 0) flush();
      run.push(id);
    }
    flush();
  }
}
