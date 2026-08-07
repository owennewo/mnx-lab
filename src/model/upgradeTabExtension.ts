import { MnxStructure, MnxTuningEntry } from './mnx.ts';

/**
 * Load-time upgrade shim for saved documents, run once on load. Four hops:
 *
 *   v1 → v2  `_x.guitar` + TAB clefs + a duplicated tab staff → the
 *            single-source `_x.tab` form.
 *   v2 → v3  `_x.tab` → `_x.mnxLab.tab`, `_x.section {marker, text}` →
 *            `_x.mnxLab.{rehearsal,section}.label`, hyphenated enum values →
 *            camelCase, and the single-interval bend → a bend curve.
 *   v3 → v4  `_x.mnxLab.{rehearsal,section}` → the STANDARD `rehearsal` and
 *            `section` objects on the global measure.
 *   v4 → v5  the `tab` sub-namespace flattens to the adopted shape it drafts
 *            (roadmap/proposed/instrument-position.md): `tab.position.{string,
 *            fret}` → flat `string`/`fret`, `tab.fingering` → `fingering`,
 *            `tab.tuning` → `strings`, `tab.capo` → `capo`. Only `technique`
 *            and `staffKind` stay under `tab`.
 *
 * The v3 hop exists because `_x` sub-keys name a VENDOR, not a feature
 * (w3c-cg/mnx#429) — `_x.tab` squatted a generic token in a shared namespace.
 * The v4 hop exists because an extension is meant to be a *draft* of the
 * standard object: once drafted and proposed, keeping a private copy would mean
 * two spellings of the same fact. See roadmap/proposed/score-text.md, and note
 * these fields validate only against `schemas/mnx-schema.proposed.json` until
 * the CG adopts them. The v5 hop applies the same draft-mirroring rule to the
 * tab block itself — nesting universal fields under `tab` made them
 * fretboard-scoped by construction.
 *
 * Already-v5 documents come back unchanged. See docs/mnx-extensions.md.
 */
export function upgradeTabExtension(mnxJson: MnxStructure): MnxStructure {
  if (
    !needsUpgrade(mnxJson) &&
    !needsNamespaceUpgrade(mnxJson) &&
    !needsLabelUpgrade(mnxJson) &&
    !needsFlattenUpgrade(mnxJson)
  ) {
    return mnxJson;
  }

  const doc: any = JSON.parse(JSON.stringify(mnxJson));
  upgradeV1(doc);
  upgradeV2(doc);
  upgradeV3(doc);
  upgradeV4(doc);
  return doc as MnxStructure;
}

/** v4 → v5: flatten `tab.position`/`tab.fingering`/`tab.tuning`/`tab.capo`
 *  onto the vendor dict. A move, not a translation — values are unchanged; the
 *  stored fret is kept (its v5 role is validation, and deleting data in an
 *  upgrade shim is never right). */
function upgradeV4(doc: any): void {
  for (const part of doc.parts ?? []) {
    const lab = part._x?.mnxLab;
    const tab = lab?.tab;
    if (tab && (tab.tuning !== undefined || tab.capo !== undefined)) {
      // Rebuilt (not mutated) so key order matches what the converters emit:
      // strings, capo, …, tab.
      const { tuning, capo, ...restTab } = tab;
      const { tab: _t, ...restLab } = lab;
      part._x.mnxLab = {
        ...(tuning !== undefined ? { strings: tuning } : {}),
        ...(capo !== undefined ? { capo } : {}),
        ...restLab,
        ...(Object.keys(restTab).length ? { tab: restTab } : {})
      };
    }

    forEachNote(part, (note: any) => {
      const nLab = note._x?.mnxLab;
      const nTab = nLab?.tab;
      if (!nTab || (nTab.position === undefined && nTab.fingering === undefined)) return;
      const { position, fingering, ...restTab } = nTab;
      const { tab: _t, ...restLab } = nLab;
      note._x.mnxLab = {
        ...(position ? { string: position.string, fret: position.fret } : {}),
        ...(fingering ? { fingering } : {}),
        ...restLab,
        ...(Object.keys(restTab).length ? { tab: restTab } : {})
      };
    });
  }
}

function needsFlattenUpgrade(doc: any): boolean {
  for (const part of doc.parts ?? []) {
    const tab = part._x?.mnxLab?.tab;
    if (tab && (tab.tuning !== undefined || tab.capo !== undefined)) return true;
    for (const measure of part.measures ?? []) {
      for (const seq of measure.sequences ?? []) {
        for (const event of seq.content ?? []) {
          for (const note of event.notes ?? []) {
            const nTab = note._x?.mnxLab?.tab;
            if (nTab && (nTab.position !== undefined || nTab.fingering !== undefined)) return true;
          }
        }
      }
    }
  }
  return false;
}

/** v3 → v4: promote the two label objects out of the vendor dict. Both are
 *  properties of the measure in the standard shape, exactly as they were in the
 *  extension, so this is a move rather than a translation. */
function upgradeV3(doc: any): void {
  for (const measure of doc.global?.measures ?? []) {
    const lab = measure._x?.mnxLab;
    if (!lab?.rehearsal && !lab?.section) continue;

    if (lab.rehearsal) measure.rehearsal = { label: lab.rehearsal.label };
    if (lab.section) measure.section = { label: lab.section.label };

    const { rehearsal: _r, section: _s, ...restLab } = lab;
    const { mnxLab: _m, ...restX } = measure._x;
    // Drop `_x` entirely once nothing is left in it, rather than leaving an
    // empty vendor dict behind.
    const nextX = Object.keys(restLab).length ? { ...restX, mnxLab: restLab } : restX;
    if (Object.keys(nextX).length) measure._x = nextX;
    else delete measure._x;
  }
}

function needsLabelUpgrade(doc: any): boolean {
  return (doc.global?.measures ?? []).some(
    (m: any) => m._x?.mnxLab?.rehearsal || m._x?.mnxLab?.section
  );
}

function upgradeV1(doc: any): void {
  if (!needsUpgrade(doc)) return;

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

      // v2-SHAPED on purpose: this hop targets v2; the v4→v5 hop flattens it.
      const tab: any = {};
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
}

/** v2 → v3: re-namespace under `mnxLab`, split the section label, camelCase the
 *  enums, and turn a single-interval bend into a two-point curve. */
function upgradeV2(doc: any): void {
  const nest = (owner: any) => {
    if (!owner?._x?.tab) return;
    const { tab, ...rest } = owner._x;
    owner._x = { ...rest, mnxLab: { ...owner._x.mnxLab, tab } };
  };

  for (const measure of doc.global?.measures ?? []) {
    const section = measure._x?.section;
    if (!section) continue;
    const { section: _dropped, ...rest } = measure._x;
    measure._x = {
      ...rest,
      mnxLab: {
        ...measure._x.mnxLab,
        ...(section.marker ? { rehearsal: { label: section.marker } } : {}),
        ...(section.text ? { section: { label: section.text } } : {})
      }
    };
  }

  for (const part of doc.parts ?? []) {
    nest(part);
    forEachNote(part, (note: any) => {
      nest(note);
      const technique = note._x?.mnxLab?.tab?.technique;
      if (!technique) return;

      if (technique.slide?.type === 'slide-in') technique.slide.type = 'slideIn';
      if (technique.slide?.type === 'slide-out') technique.slide.type = 'slideOut';

      // v2 stated one interval in WHOLE STEPS plus flags; v3 states the curve
      // in semitones, which is the unit of MNX's own `pitch.alter`. v2 carried
      // no timing at all, so the reconstructed curve places the peak where the
      // gesture implies: at the end, or mid-note when there is a release after.
      if (technique.bend && technique.bend.points === undefined) {
        const peak = (technique.bend.amount ?? 0) * 2;
        const prebent = technique.bend.type === 'pre-bend';
        const released = technique.bend.release === true;
        const points = prebent
          ? [{ position: 0, alter: peak }]
          : [{ position: 0, alter: 0 }, { position: released ? 0.5 : 1, alter: peak }];
        if (released) points.push({ position: 1, alter: 0 });
        else if (prebent) points.push({ position: 1, alter: peak });
        technique.bend = { points };
      }
    });
  }
}

function needsNamespaceUpgrade(doc: any): boolean {
  for (const measure of doc.global?.measures ?? []) {
    if (measure._x?.section) return true;
  }
  for (const part of doc.parts ?? []) {
    if (part._x?.tab) return true;
    for (const measure of part.measures ?? []) {
      for (const seq of measure.sequences ?? []) {
        for (const event of seq.content ?? []) {
          for (const note of event.notes ?? []) {
            if (note._x?.tab) return true;
          }
        }
      }
    }
  }
  return false;
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
