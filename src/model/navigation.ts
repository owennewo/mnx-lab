import type {
  MnxGlobalMeasure,
  MnxLabNavigationJump,
  NavigationJumpType
} from './mnx.ts';

export interface NavigationMark {
  id?: string;
  kind: 'segno' | 'coda' | 'fine';
  count: 1 | 2;
  location: { fraction: [number, number] };
  glyph?: string;
  color?: string;
  source: 'published' | 'mnxLab';
}

export interface NavigationJump {
  type: NavigationJumpType;
  location: { fraction: [number, number] };
  target?: string;
  resumeAt?: string;
  text?: string;
  source: 'published' | 'mnxLab';
}

export interface MeasureNavigation {
  marks: NavigationMark[];
  jumps: NavigationJump[];
}

/** One read-only view over published and lab navigation. Consumers must use
 * this instead of growing parallel standard/extension branches. */
export function measureNavigation(measure: MnxGlobalMeasure): MeasureNavigation {
  const marks: NavigationMark[] = [];
  const jumps: NavigationJump[] = [];
  if (measure.segno) marks.push({
    id: measure.segno.id,
    kind: 'segno', count: 1, location: measure.segno.location,
    glyph: measure.segno.glyph, color: measure.segno.color, source: 'published'
  });
  if (measure.fine) marks.push({
    kind: 'fine', count: 1, location: measure.fine.location,
    color: measure.fine.color, source: 'published'
  });
  if (measure.jump) jumps.push({
    type: measure.jump.type, location: measure.jump.location, source: 'published'
  });
  for (const mark of measure._x?.mnxLab?.navigation?.marks ?? []) {
    marks.push({ ...mark, count: mark.count ?? 1, source: 'mnxLab' });
  }
  for (const jump of measure._x?.mnxLab?.navigation?.jumps ?? []) {
    jumps.push(normalizeLabJump(jump));
  }
  return { marks, jumps };
}

function normalizeLabJump(jump: MnxLabNavigationJump): NavigationJump {
  return { ...jump, source: 'mnxLab' };
}

export function navigationMarkById(
  measures: readonly MnxGlobalMeasure[], id: string | undefined
): { measureIndex: number; mark: NavigationMark } | undefined {
  if (!id) return undefined;
  for (let measureIndex = 0; measureIndex < measures.length; measureIndex++) {
    const mark = measureNavigation(measures[measureIndex]!).marks.find(candidate => candidate.id === id);
    if (mark) return { measureIndex, mark };
  }
  return undefined;
}
