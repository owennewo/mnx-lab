import { MnxPitch } from './types.js';

// Mapping from MusicXML type names to MNX base duration strings
const TYPE_MAP_TO_MNX: Record<string, string> = {
  'whole': 'whole',
  'half': 'half',
  'quarter': 'quarter',
  'eighth': 'eighth',
  '16th': '16th',
  '32nd': '32nd',
  '64th': '64th',
  '128th': '128th',
  'sixteenth': '16th',
  'thirty-second': '32nd'
};

// Mapping from MNX base duration strings to MusicXML type names
const TYPE_MAP_TO_XML: Record<string, string> = {
  'whole': 'whole',
  'half': 'half',
  'quarter': 'quarter',
  'eighth': 'eighth',
  '16th': '16th',
  '32nd': '32nd',
  '64th': '64th',
  '128th': '128th'
};

const BASE_RATIOS: Record<string, number> = {
  'whole': 4.0,
  'half': 2.0,
  'quarter': 1.0,
  'eighth': 0.5,
  '16th': 0.25,
  '32nd': 0.125,
  '64th': 0.0625,
  '128th': 0.03125
};

/**
 * Calculates MNX duration base and dots from a MusicXML duration value.
 */
export function calculateMnxDuration(
  duration: number,
  divisions: number,
  typeXml?: string,
  dotsCount: number = 0
): { base: string; dots?: number } {
  // If XML type is specified, try to map it directly
  if (typeXml) {
    const mappedBase = TYPE_MAP_TO_MNX[typeXml.toLowerCase()];
    if (mappedBase) {
      return dotsCount > 0 ? { base: mappedBase, dots: dotsCount } : { base: mappedBase };
    }
  }

  // Fallback to mathematical ratio calculation
  const ratio = duration / divisions;
  
  // Find closest matching ratio
  let bestBase = 'quarter';
  let bestDots = 0;
  let minDiff = Infinity;

  for (const [base, baseRatio] of Object.entries(BASE_RATIOS)) {
    for (let dots = 0; dots <= 3; dots++) {
      const multiplier = 2 - Math.pow(2, -dots);
      const testRatio = baseRatio * multiplier;
      const diff = Math.abs(ratio - testRatio);
      if (diff < minDiff) {
        minDiff = diff;
        bestBase = base;
        bestDots = dots;
      }
    }
  }

  return bestDots > 0 ? { base: bestBase, dots: bestDots } : { base: bestBase };
}

/**
 * Calculates MusicXML duration integer from MNX base and dots.
 */
export function calculateXmlDuration(
  base: string,
  dots: number = 0,
  divisions: number
): number {
  const normBase = TYPE_MAP_TO_XML[base] || 'quarter';
  const baseRatio = BASE_RATIOS[normBase] || 1.0;
  const multiplier = 2 - Math.pow(2, -dots);
  const ratio = baseRatio * multiplier;
  return Math.round(ratio * divisions);
}

/**
 * Gets the MusicXML type string from MNX base string.
 */
export function getXmlNoteType(base: string): string {
  return TYPE_MAP_TO_XML[base] || 'quarter';
}

/**
 * ID management helpers for roundtripping
 */
export function addIdSuffix(id: string, suffix: 'std' | 'tab'): string {
  return `${id}_${suffix}`;
}

export function stripIdSuffix(id: string): { originalId: string; suffix?: 'std' | 'tab' } {
  if (id.endsWith('_std')) {
    return { originalId: id.slice(0, -4), suffix: 'std' };
  }
  if (id.endsWith('_tab')) {
    return { originalId: id.slice(0, -4), suffix: 'tab' };
  }
  return { originalId: id };
}

/**
 * Pitch helper: converts steps/alterations/octaves to pitches and strings
 */
export function createPitchKey(pitch: MnxPitch): string {
  const alterStr = pitch.alter === 1 ? '#' : pitch.alter === -1 ? 'b' : '';
  return `${pitch.step.toLowerCase()}${alterStr}/${pitch.octave}`;
}
