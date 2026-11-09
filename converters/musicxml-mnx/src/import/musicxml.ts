import { parseXML, type Element } from '../common/xml.js';
import { MnxStructure, MnxGlobalMeasure, MnxPart } from '../common/types.js';
import { reduceFraction } from '../common/utils.js';
import { walkSequenceEvents } from '../common/utils.js';
import { Aligner } from './aligner.js';
import { readWork, rootExtension } from '../common/scoreMetadata.js';

// Helper functions for XML DOM parsing
export function findDirectChild(parent: Element, tagName: string): Element | null {
  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i];
    if (node.nodeType === 1 && (node as Element).tagName === tagName) {
      return node as Element;
    }
  }
  return null;
}

export function findDirectChildren(parent: Element, tagName: string): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i];
    if (node.nodeType === 1 && (node as Element).tagName === tagName) {
      result.push(node as Element);
    }
  }
  return result;
}

export function getChildText(parent: Element, tagName: string): string | null {
  const child = findDirectChild(parent, tagName);
  return (child && child.textContent) ? child.textContent.trim() : null;
}

export function getChildInt(parent: Element, tagName: string): number | null {
  const text = getChildText(parent, tagName);
  return text ? parseInt(text, 10) : null;
}

export function getChildFloat(parent: Element, tagName: string): number | null {
  const text = getChildText(parent, tagName);
  return text ? parseFloat(text) : null;
}

export interface ImportOptions {
  mergeNotationAndTab?: boolean;
  /**
   * Called with a human-readable message for each problem found in the source
   * document. Import is forgiving by design — malformed input is repaired where
   * possible rather than throwing — so this is the only signal that the output
   * may not faithfully represent the input.
   */
  onWarning?: (message: string) => void;
  /**
   * `YYYY-MM-DD` stamped into `_x.mnxLab.encoding.date`. Omitted by default so
   * derived output stays reproducible; the CLI opts in with `--encoding-date`.
   */
  encodingDate?: string;
}

export function importMusicXML(
  xmlContent: string,
  options: ImportOptions = {}
): MnxStructure {
  const mergeNotationAndTab = options.mergeNotationAndTab !== false; // default to true
  const doc = parseXML(xmlContent);
  const scoreEl = doc.getElementsByTagName('score-partwise')[0];
  if (!scoreEl) {
    throw new Error('Invalid MusicXML: Missing <score-partwise> root.');
  }

  // 1. Score metadata → `_x.mnxLab.work`. The source's own `<encoding>` is
  //    deliberately NOT read: it describes the MusicXML file, not the MNX
  //    derived from it, and the importer stamps its own below.
  const work = readWork(doc);

  // 2. Parse Part Definitions
  const partListEl = scoreEl.getElementsByTagName('part-list')[0];
  const partMap = new Map<string, { id: string; name: string }>();
  if (partListEl) {
    const scorePartEls = partListEl.getElementsByTagName('score-part');
    for (let i = 0; i < scorePartEls.length; i++) {
      const sp = scorePartEls[i];
      const partId = sp.getAttribute('id');
      const partName = getChildText(sp, 'part-name') || 'Instrument';
      if (partId) {
        partMap.set(partId, { id: partId, name: partName });
      }
    }
  }

  // State trackers for global attributes
  const globalMeasures: MnxGlobalMeasure[] = [];
  const parts: MnxPart[] = [];
  const partEls = scoreEl.getElementsByTagName('part');

  const aligner = new Aligner();

  // 3. Process each Part
  for (let pIdx = 0; pIdx < partEls.length; pIdx++) {
    const partEl = partEls[pIdx];
    const partId = partEl.getAttribute('id') || `P${pIdx + 1}`;
    const partInfo = partMap.get(partId) || { id: partId, name: 'Guitar' };

    const mnxPart = aligner.parsePart(partEl, partInfo.name, partInfo.id, globalMeasures);
    parts.push(mnxPart);
  }

  markPickup(partEls, globalMeasures);

  // 4. Merge Treble & TAB parts if requested
  let finalParts = parts;
  if (mergeNotationAndTab && parts.length >= 2) {
    const standardPart = parts.find(p => !aligner.isTabPart(p));
    const tabPart = parts.find(p => aligner.isTabPart(p));
    
    if (standardPart && tabPart) {
      const mergedPart = aligner.mergeParts(standardPart, tabPart);
      // We keep the merged part, and discard the split ones
      finalParts = [mergedPart];
    }
  }

  // Technique targets are id references; resolve them once ids are final
  // (after any notation/TAB merge has assigned them).
  aligner.linkTechniqueTargets(finalParts);
  // After the technique pass, which is what mints the note ids spanners name.
  aligner.linkSpannerTargets(finalParts);
  aligner.linkBeams(finalParts);

  // MusicXML states accidentals and beams outright — `<accidental>` prints one,
  // `<beam>` draws one — so a document converted from it is stating them too,
  // and must say so. Left undeclared, a renderer infers both and overrules the
  // source: `accidentals` gains a flat on a repeated note the source chose not
  // to reprint. Declared only when we actually read some, because a source that
  // wrote none is better served by inference than by being told it has none.
  const support: { useAccidentalDisplay?: boolean; useBeams?: boolean } = {};
  for (const part of finalParts) {
    for (const measure of part.measures ?? []) {
      if (measure.beams?.length) support.useBeams = true;
      for (const sequence of measure.sequences ?? []) {
        for (const { event } of walkSequenceEvents(sequence.content ?? [], 8)) {
          if ((event.notes ?? []).some(note => note.accidentalDisplay)) {
            support.useAccidentalDisplay = true;
          }
        }
      }
    }
  }

  // 5. Report source defects that were repaired (or could not be)
  for (const warning of aligner.warnings) options.onWarning?.(warning);
  const { malformedPitches, recoveredPitches } = aligner.stats;
  if (malformedPitches > 0 && options.onWarning) {
    const unrecovered = malformedPitches - recoveredPitches;
    options.onWarning(
      `${malformedPitches} note(s) had an unusable <pitch> (missing or invalid <step>). ` +
        `${recoveredPitches} were reconstructed from tablature string/fret + tuning` +
        (unrecovered > 0
          ? `; ${unrecovered} could not be recovered and fell back to C4.`
          : '.')
    );
  }

  return {
    mnx: {
      version: 1,
      ...(Object.keys(support).length ? { support } : {})
    },
    global: {
      measures: globalMeasures,
      // Verse order, so consumers stack lines in the order the source declared
      // them rather than however the line-id keys happen to sort.
      ...(aligner.lyricLines.length > 0
        ? { lyrics: { lineOrder: [...aligner.lyricLines] } }
        : {})
    },
    parts: finalParts,
    _x: rootExtension(work, options.encodingDate)
  };
}

/**
 * MusicXML's pickup: the first measure marked `implicit="yes"` (conventionally
 * `number="0"`), carrying the piece's signature and only the pickup's notes.
 * The lab stores a bar's TRUE length as its signature, so the measure becomes
 * that length in the signature's own unit, marked `number: 0`, and the bar
 * after it states the piece's signature (roadmap/proposed/core-anacrusis.md).
 * The length is the furthest any part's notes reach, in whole notes.
 */
function markPickup(partEls: ArrayLike<Element>, globalMeasures: MnxGlobalMeasure[]): void {
  const first = globalMeasures[0];
  if (!first?.time || globalMeasures.length < 2) return;
  let longest: [number, number] = [0, 1];
  for (let p = 0; p < partEls.length; p++) {
    const measureEl = findDirectChildren(partEls[p]!, 'measure')[0];
    if (!measureEl || measureEl.getAttribute('implicit') !== 'yes') continue;
    let divisions = 1, position = 0, furthest = 0;
    for (const node of measureEl.childNodes) {
      if (node.nodeType !== 1) continue;
      const child = node as Element;
      if (child.tagName === 'attributes') {
        const divs = Number(getChildText(child, 'divisions'));
        if (divs > 0) divisions = divs;
        continue;
      }
      const duration = Number(getChildText(child, 'duration') ?? 0) || 0;
      if (child.tagName === 'backup') position -= duration;
      else if (child.tagName === 'forward') position += duration;
      else if (child.tagName === 'note' && !findDirectChild(child, 'chord') && !findDirectChild(child, 'grace')) position += duration;
      furthest = Math.max(furthest, position);
    }
    const length = reduceFraction(furthest, divisions * 4);
    if (length[0] * longest[1] > longest[0] * length[1]) longest = length;
  }
  const time = first.time;
  // Empty, or not short: an ordinary first bar that happens to be implicit.
  if (longest[0] === 0 || longest[0] * time.unit >= time.count * longest[1]) return;
  let unit = time.unit;
  while ((longest[0] * unit) % longest[1] !== 0 && unit < 128) unit *= 2;
  if ((longest[0] * unit) % longest[1] !== 0) return;
  globalMeasures[1]!.time ??= { ...time };
  first.time = { count: (longest[0] * unit) / longest[1], unit };
  first.number = 0;
}
