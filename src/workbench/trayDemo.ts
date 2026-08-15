// DEMO DATA for the selection command tray — scaffolding for the visuals
// review (roadmap/inprogress/core-selection-tray-visuals.md), replaced by the
// command registry when the mechanism lands. Everything here is PLACEHOLDER:
// the note/event/bar/part sets mirror the design spec's mockups; the
// voice/section/score sets are drafted from the ladder's ownership table and
// mostly name verbs that now exist (the campaign's vocabulary sweep) — the
// registry will front the real things. Glyphs are canonical SMuFL names
// (checked against public/smufl/glyphnames.json); slur/tie draw as arcs.
//
// States are distributed so the review sees all four tile reads: available,
// active (= remove), mixed (2px accent left edge), unavailable (needs a
// different rung — greyed, not focusable).
import type { TrayRow, TrayTile } from './SelectionTray.ts';

export interface TrayDemoSet {
  tiles?: TrayTile[];
  rows?: TrayRow[];
}

const t = (
  id: string,
  glyph: TrayTile['glyph'],
  shortcut: string,
  label: string,
  state: TrayTile['state'] = 'available'
): TrayTile => ({ id, glyph, shortcut, label, state });

/** Keyed by the HUD's row vocabulary (score|section|bar|part|voice|event|note). */
export const TRAY_DEMO: Record<string, TrayDemoSet> = {
  note: {
    tiles: [
      t('flat', { smufl: 'accidentalFlat' }, '−', 'Flat'),
      t('sharp', { smufl: 'accidentalSharp' }, '+', 'Sharp'),
      t('staccato', { smufl: 'articStaccatoAbove' }, 'S', 'Remove staccato', 'active'),
      t('accent', { smufl: 'articAccentAbove' }, 'A', 'Accent', 'mixed'),
      t('trill', { smufl: 'ornamentTrill' }, 'R', 'Trill'),
      t('grace', { smufl: 'graceNoteAcciaccaturaStemUp' }, 'G', 'Grace note'),
      t('tuplet', { smufl: 'tuplet3' }, '3', 'Triplet — needs an event', 'unavailable')
    ]
  },
  event: {
    tiles: [
      t('slur', { arc: 'slur' }, '⇧S', 'Remove slur', 'active'),
      t('tie', { arc: 'tie' }, 'T', 'Tie to next'),
      t('tuplet', { smufl: 'tuplet3' }, '3', 'Triplet'),
      t('cresc', { smufl: 'dynamicCrescendoHairpin' }, '<', 'Crescendo'),
      t('dim', { smufl: 'dynamicDiminuendoHairpin' }, '>', 'Diminuendo'),
      t('piano', { smufl: 'dynamicPiano' }, 'P', 'Remove piano', 'active'),
      t('forte', { smufl: 'dynamicForte' }, 'F', 'Forte'),
      t('arpeggio', { smufl: 'arpeggiato' }, '⇧A', 'Arpeggio'),
      t('breath', { smufl: 'breathMarkComma' }, ',', 'Breath mark'),
      t('pedal', { smufl: 'keyboardPedalPed' }, '⇧P', 'Pedal'),
      t('fermata', { smufl: 'fermataAbove' }, 'F', 'Fermata')
    ]
  },
  voice: {
    tiles: [
      t('fmrest', { smufl: 'restWhole' }, '⇧B', 'Full-measure rest'),
      t('cycle', { smufl: 'arrowBlackUp' }, '⌥V', 'Cycle voices'),
      t('movedn', { smufl: 'arrowBlackDown' }, '·', 'Move to next voice', 'unavailable'),
      t('delvoice', { smufl: 'restQuarter' }, '·', 'Delete voice (empty only)', 'unavailable')
    ]
  },
  part: {
    rows: [
      { id: 'clef', glyph: { smufl: 'gClef' }, label: 'clef', value: 'treble 8vb' },
      { id: 'key', glyph: { smufl: 'accidentalSharp' }, label: 'key', value: 'G major' },
      { id: 'transpose', glyph: { smufl: 'ottava' }, label: 'transpose', value: '0' },
      { id: 'mute', glyph: { smufl: 'restWhole' }, label: 'mute part', value: 'off' }
    ]
  },
  bar: {
    tiles: [
      t('rstart', { smufl: 'repeatLeft' }, '[', 'Repeat start'),
      t('rend', { smufl: 'repeatRight' }, ']', 'Remove repeat end', 'active'),
      t('final', { smufl: 'barlineFinal' }, '⇧|', 'Final barline'),
      t('time', { smufl: 'timeSig4' }, '⇧T', 'Time signature'),
      t('keychange', { smufl: 'accidentalSharp' }, '⇧K', 'Key change'),
      t('segno', { smufl: 'segno' }, '⇧B', 'Segno'),
      t('coda', { smufl: 'coda' }, '⇧B', 'Coda'),
      t('rehearsal', { smufl: 'repeat2Bars' }, '⇧B', 'Rehearsal mark')
    ]
  },
  section: {
    tiles: [
      t('label', { smufl: 'repeat2Bars' }, '⇧B', 'Rename section'),
      t('colour', { smufl: 'coda' }, '·', 'Section colour', 'unavailable'),
      t('boundary', { smufl: 'barlineDashed' }, '·', 'Move boundary', 'unavailable'),
      t('range', { smufl: 'barlineSingle' }, '·', 'Select the range', 'unavailable')
    ]
  },
  score: {
    tiles: [
      t('part', { smufl: 'brace' }, '⇧P', 'Add part'),
      t('staffkind', { smufl: '6stringTabClef' }, '·', 'Staff kind'),
      t('addbar', { smufl: 'barlineSingle' }, '⇧M', 'Add bar'),
      t('sysbreak', { smufl: 'systemDivider' }, '·', 'System break', 'unavailable'),
      t('mmrest', { smufl: 'restHBar' }, '·', 'Multimeasure rest', 'unavailable'),
      t('title', { smufl: 'textBlackNoteShortStem' }, '·', 'Title', 'unavailable')
    ]
  }
};
