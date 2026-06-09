import { MnxStructure, MnxTabNoteExtension, MnxTuningEntry } from '../types/mnx.ts';

/**
 * Load-time upgrade shim: converts documents using the deprecated v1 guitar
 * extension (`_x.guitar`, TAB clefs, duplicated two-staff tab encoding) to
 * the v2 single-source `_x.tab` form (docs/tab-extension-spec.md). Saved
 * IndexedDB documents created before the migration pass through here once on
 * load; already-v2 documents come back unchanged.
 */
export function upgradeTabExtension(mnxJson: MnxStructure): MnxStructure {
  if (!needsUpgrade(mnxJson)) return mnxJson;

  const doc: any = JSON.parse(JSON.stringify(mnxJson));

  for (const part of doc.parts ?? []) {
    const hadTabClef = (part.measures ?? []).some((m: any) =>
      (m.clefs ?? []).some((c: any) => c?.clef?.sign === 'TAB')
    );
    const hadTabStaff = (part.measures ?? []).some((m: any) =>
      (m.sequences ?? []).some((s: any) => s.staff === 2)
    );

    // 1. Collect note positions by id from every v1-annotated note (the old
    //    two-staff form duplicated notes across staves with shared ids; the
    //    fret/string data may live on either copy).
    const positionsById = new Map<string, { string: number; fret: number }>();
    forEachNote(part, (note: any) => {
      const g = note._x?.guitar;
      if (note.id && g && g.string !== undefined && g.fret !== undefined) {
        positionsById.set(note.id, { string: g.string, fret: g.fret });
      }
    });

    // 2. Drop the duplicated tab staff (staff === 2) where a primary staff
    //    exists, and strip staff fields — single-source has one staff.
    for (const measure of part.measures ?? []) {
      if (!measure.sequences) continue;
      const primary = measure.sequences.filter((s: any) => s.staff !== 2);
      if (primary.length > 0 && primary.some((s: any) => (s.content ?? []).length > 0)) {
        measure.sequences = primary;
      }
      for (const seq of measure.sequences) {
        delete seq.staff;
      }

      // 3. Remove TAB clefs (invalid MNX; tab-ness moves to staffKind) and
      //    per-clef staff fields.
      if (measure.clefs) {
        measure.clefs = measure.clefs.filter((c: any) => c?.clef?.sign !== 'TAB');
        for (const c of measure.clefs) delete c.staff;
        if (measure.clefs.length === 0) delete measure.clefs;
      }
    }

    // 4. Convert note-level v1 -> v2 on the surviving notes.
    forEachNote(part, (note: any) => {
      const g = note._x?.guitar;
      const fromMap = note.id ? positionsById.get(note.id) : undefined;
      if (!g && !fromMap) return;

      const tab: MnxTabNoteExtension = {};
      const position = g && g.string !== undefined && g.fret !== undefined
        ? { string: g.string, fret: g.fret }
        : fromMap;
      if (position) tab.position = position;
      if (g?.fingering?.hand && g?.fingering?.finger) {
        tab.fingering = { hand: g.fingering.hand, finger: g.fingering.finger };
      }
      const technique: any = {};
      if (g?.bend?.amount !== undefined) {
        technique.bend = {
          type: g.bend.type === 'pre-bend' ? 'pre-bend' : 'bend',
          amount: g.bend.amount,
          ...(g.bend.release || g.bend.type === 'bend-release' ? { release: true } : {})
        };
      }
      if (g?.slide?.type) {
        technique.slide = {
          type: g.slide.type,
          ...(g.slide.direction ? { direction: g.slide.direction } : {}),
          ...(g.slide.targetNote ? { target: g.slide.targetNote } : {})
        };
      }
      if (g?.hammerOnPullOff?.targetNote) {
        const key = g.hammerOnPullOff.type === 'pull-off' ? 'pullOff' : 'hammerOn';
        technique[key] = { target: g.hammerOnPullOff.targetNote };
      }
      if (g?.vibrato) technique.vibrato = true;
      if (Object.keys(technique).length > 0) tab.technique = technique;

      delete note._x?.guitar;
      note._x = { ...note._x, tab };
      if (Object.keys(note._x).length === 0) delete note._x;
    });

    // 5. Convert the part-level extension.
    const pg = part._x?.guitar;
    if (pg || hadTabClef || hadTabStaff) {
      const tabPart: any = {};
      const strings: any[] | undefined = pg?.tuning?.strings;
      if (strings && strings.length > 0) {
        // v1 tuning was a bare pitch array whose order was documented
        // inconsistently and written both ways. Resolve by pitch: string 1 is
        // the highest-pitched string regardless of array order.
        const sorted = strings
          .map(p => ({ pitch: p, midi: pitchToMidi(p) }))
          .sort((a, b) => b.midi - a.midi);
        tabPart.tuning = sorted.map((s, idx): MnxTuningEntry => ({
          string: idx + 1,
          pitch: s.pitch
        }));
      }
      if (pg?.capo !== undefined && pg.capo > 0) tabPart.capo = pg.capo;
      tabPart.staffKind = hadTabClef || hadTabStaff ? 'both' : 'notation';

      delete part._x?.guitar;
      part._x = { ...part._x, tab: tabPart };
    }
  }

  return doc as MnxStructure;
}

function needsUpgrade(doc: MnxStructure): boolean {
  for (const part of (doc as any).parts ?? []) {
    if (part._x?.guitar) return true;
    for (const measure of part.measures ?? []) {
      if ((measure.clefs ?? []).some((c: any) => c?.clef?.sign === 'TAB')) return true;
      if ((measure.sequences ?? []).some((s: any) => s.staff === 2)) return true;
      for (const seq of measure.sequences ?? []) {
        for (const event of seq.content ?? []) {
          for (const note of event.notes ?? []) {
            if (note._x?.guitar) return true;
          }
        }
      }
    }
  }
  return false;
}

function forEachNote(part: any, fn: (note: any) => void): void {
  for (const measure of part.measures ?? []) {
    for (const seq of measure.sequences ?? []) {
      for (const event of seq.content ?? []) {
        for (const note of event.notes ?? []) {
          fn(note);
        }
      }
    }
  }
}

function pitchToMidi(p: { step: string; octave: number; alter?: number }): number {
  const offsets: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return (p.octave + 1) * 12 + (offsets[p.step] ?? 0) + (p.alter ?? 0);
}
