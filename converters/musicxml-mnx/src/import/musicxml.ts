import { parseXML } from '../common/xml.js';
import { MnxStructure, MnxGlobalMeasure, MnxPart, MnxPitch } from '../common/types.js';
import { Aligner } from './aligner.js';

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

  // 1. Parse Metadata
  const metadata: any = {};
  const identificationEl = doc.getElementsByTagName('identification')[0];
  if (identificationEl) {
    const encodingEl = identificationEl.getElementsByTagName('encoding')[0];
    if (encodingEl) {
      const software = getChildText(encodingEl, 'software');
      const date = getChildText(encodingEl, 'encoding-date');
      metadata.encoding = {
        ...(software ? { software } : {}),
        ...(date ? { date } : {})
      };
    }
  }

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
      version: 1
    },
    global: {
      measures: globalMeasures,
      // Verse order, so consumers stack lines in the order the source declared
      // them rather than however the line-id keys happen to sort.
      ...(aligner.lyricLines.length > 0
        ? { lyrics: { lineOrder: [...aligner.lyricLines] } }
        : {})
    },
    parts: finalParts
  };
}
