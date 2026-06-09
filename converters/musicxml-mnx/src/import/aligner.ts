import { MnxPart, MnxPartMeasure, MnxSequence, MnxEvent, MnxNote, MnxPitch, MnxGlobalMeasure } from '../common/types.js';
import { calculateMnxDuration, createPitchKey } from '../common/utils.js';
import { findDirectChild, findDirectChildren, getChildText, getChildInt } from './musicxml.js';

interface AttributeState {
  divisions: number;
  fifths: number | null;
  beats: number | null;
  beatType: number | null;
  transposeChromatic: number;
  transposeDiatonic: number;
  clefSign: string | null;
  clefLine: number | null;
  staffLines: number;
  tuning: MnxPitch[] | null;
}

// Chromatic semitone offsets for each diatonic step (C=0)
const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const STEP_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

/**
 * Estimates diatonic step shift from chromatic semitone shift.
 * Used when <diatonic> is absent in MusicXML <transpose> element.
 */
function getDiatonicFromChromatic(chromatic: number): number {
  // Each octave = 7 diatonic steps, 12 semitones
  const octaves = Math.trunc(chromatic / 12);
  const remainder = chromatic - octaves * 12;
  // Map remaining semitones to nearest diatonic step count
  const semitoneToStep = [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];
  const remainderStep = semitoneToStep[Math.abs(remainder)] * Math.sign(remainder);
  return octaves * 7 + remainderStep;
}

export class Aligner {
  /**
   * Parses a `<part>` element from MusicXML into an MnxPart.
   */
  public parsePart(
    partEl: Element,
    partName: string,
    partId: string,
    globalMeasures: MnxGlobalMeasure[]
  ): MnxPart {
    const measures: MnxPartMeasure[] = [];
    const measureEls = findDirectChildren(partEl, 'measure');

    // Initial attribute state
    const state: AttributeState = {
      divisions: 1,
      fifths: null,
      beats: null,
      beatType: null,
      transposeChromatic: 0,
      transposeDiatonic: 0,
      clefSign: null,
      clefLine: null,
      staffLines: 5,
      tuning: null
    };

    for (let mIdx = 0; mIdx < measureEls.length; mIdx++) {
      const mEl = measureEls[mIdx];
      const measureNum = parseInt(mEl.getAttribute('number') || `${mIdx + 1}`, 10);

      // 1. Process Attributes if present
      const attributesEl = findDirectChild(mEl, 'attributes');
      if (attributesEl) {
        const divs = getChildInt(attributesEl, 'divisions');
        if (divs !== null) state.divisions = divs;

        const keyEl = findDirectChild(attributesEl, 'key');
        if (keyEl) {
          state.fifths = getChildInt(keyEl, 'fifths');
        }

        const timeEl = findDirectChild(attributesEl, 'time');
        if (timeEl) {
          state.beats = getChildInt(timeEl, 'beats');
          state.beatType = getChildInt(timeEl, 'beat-type');
        }

        const clefEl = findDirectChild(attributesEl, 'clef');
        if (clefEl) {
          state.clefSign = getChildText(clefEl, 'sign');
          state.clefLine = getChildInt(clefEl, 'line');
        }

        const transposeEl = findDirectChild(attributesEl, 'transpose');
        if (transposeEl) {
          state.transposeChromatic = getChildInt(transposeEl, 'chromatic') || 0;
          const diatonicRaw = getChildInt(transposeEl, 'diatonic');
          // If <diatonic> is absent, estimate it from the chromatic value
          state.transposeDiatonic = diatonicRaw !== null
            ? diatonicRaw
            : getDiatonicFromChromatic(state.transposeChromatic);
        }

        const staffDetailsEl = findDirectChild(attributesEl, 'staff-details');
        if (staffDetailsEl) {
          const lines = getChildInt(staffDetailsEl, 'staff-lines');
          if (lines !== null) state.staffLines = lines;

          const staffTuningEls = findDirectChildren(staffDetailsEl, 'staff-tuning');
          if (staffTuningEls.length > 0) {
            const tunings: MnxPitch[] = [];
            for (const st of staffTuningEls) {
              const line = parseInt(st.getAttribute('line') || '1', 10);
              const step = getChildText(st, 'tuning-step') as any;
              const octave = getChildInt(st, 'tuning-octave');
              const alter = getChildInt(st, 'tuning-alter') || undefined;
              if (step && octave !== null) {
                tunings[line - 1] = { step, octave, alter };
              }
            }
            state.tuning = tunings.filter(Boolean); // keep only non-empty
          }
        }
      }

      // Update Global Measures details
      if (!globalMeasures[mIdx]) {
        globalMeasures[mIdx] = {};
      }
      const globalM = globalMeasures[mIdx];
      
      if (state.fifths !== null && globalM.key === undefined) {
        globalM.key = { fifths: state.fifths };
      }
      if (state.beats !== null && state.beatType !== null && globalM.time === undefined) {
        globalM.time = { count: state.beats, unit: state.beatType };
      }

      // Check barline style
      const barlineEls = findDirectChildren(mEl, 'barline');
      for (const bar of barlineEls) {
        const style = getChildText(bar, 'bar-style');
        if (style) {
          globalM.barline = {
            type: this.mapBarlineStyle(style)
          };
        }
      }

      // 2. Parse child elements chronologically to handle backup/forward
      const sequences = this.parseMeasureEvents(mEl, state, mIdx);

      // TAB "clefs" are not emitted: the MNX schema's clef-sign enum is C|F|G,
      // and in the tab extension tab-ness is a part-level view declaration
      // (_x.tab.staffKind), not a clef. See docs/tab-extension-spec.md.
      const clefsList: any[] = [];
      if (state.clefSign && state.clefSign !== 'TAB') {
        clefsList.push({
          clef: {
            sign: state.clefSign,
            staffPosition: state.clefLine ? -(state.clefLine) : undefined
          }
        });
      }

      measures.push({
        ...(clefsList.length > 0 ? { clefs: clefsList } : {}),
        sequences
      });
    }

    const tabPartExtension: any = {};
    if (state.tuning) {
      // state.tuning is indexed by MusicXML staff-tuning line (line 1 = bottom
      // visual line = lowest-pitched string). Convert to explicit string
      // numbers: string 1 = highest-pitched string.
      const numStrings = state.tuning.length;
      tabPartExtension.tuning = state.tuning.map((pitch, idx) => ({
        string: numStrings - idx,
        pitch
      }));
    }
    if (state.clefSign === 'TAB') {
      tabPartExtension.staffKind = 'tab';
    }

    // Build W3C MNX transposition metadata block (top-level on the part, not in _x)
    const transpositionBlock = (state.transposeChromatic !== 0 || state.transposeDiatonic !== 0)
      ? {
          transposition: {
            interval: {
              halfSteps: state.transposeChromatic,
              staffDistance: state.transposeDiatonic
            }
          }
        }
      : {};

    return {
      id: partId,
      name: partName,
      measures,
      ...transpositionBlock,
      ...(Object.keys(tabPartExtension).length > 0 ? { _x: { tab: tabPartExtension } } : {})
    };
  }

  private mapBarlineStyle(style: string): 'regular' | 'light-heavy' | 'dotted' | 'dashed' | 'double' | 'final' {
    switch (style.toLowerCase()) {
      case 'regular': return 'regular';
      case 'dotted': return 'dotted';
      case 'dashed': return 'dashed';
      case 'double': return 'double';
      case 'light-heavy': return 'light-heavy';
      case 'final': return 'final';
      default: return 'regular';
    }
  }

  private parseMeasureEvents(
    measureEl: Element,
    state: AttributeState,
    measureIdx: number
  ): MnxSequence[] {
    let currentTime = 0;
    
    // voiceName -> list of { onset: number, event: MnxEvent }
    const voiceEvents = new Map<string, Array<{ onset: number; event: MnxEvent }>>();
    
    // We iterate through XML child nodes to preserve exact document order
    for (let i = 0; i < measureEl.childNodes.length; i++) {
      const node = measureEl.childNodes[i];
      if (node.nodeType !== 1) continue;
      const el = node as Element;

      if (el.tagName === 'backup') {
        const dur = getChildInt(el, 'duration') || 0;
        currentTime -= dur;
      } else if (el.tagName === 'forward') {
        const dur = getChildInt(el, 'duration') || 0;
        currentTime += dur;
      } else if (el.tagName === 'note') {
        const isChord = findDirectChild(el, 'chord') !== null;
        const isRest = findDirectChild(el, 'rest') !== null;
        const voice = getChildText(el, 'voice') || '1';
        const rawDur = getChildInt(el, 'duration') || 0;

        const mnxDur = calculateMnxDuration(
          rawDur,
          state.divisions,
          getChildText(el, 'type') || undefined,
          findDirectChildren(el, 'dot').length
        );

        if (isRest) {
          const restEvent: MnxEvent = {
            duration: mnxDur,
            rest: {}
          };
          if (!voiceEvents.has(voice)) voiceEvents.set(voice, []);
          voiceEvents.get(voice)!.push({ onset: currentTime, event: restEvent });
          currentTime += rawDur;
        } else {
          // Parse Pitch
          const pitchEl = findDirectChild(el, 'pitch');
          let mnxPitch: MnxPitch | undefined;
          if (pitchEl) {
            const step = getChildText(pitchEl, 'step') as any;
            const octave = getChildInt(pitchEl, 'octave') || 4;
            const alter = getChildInt(pitchEl, 'alter') || undefined;
            mnxPitch = this.transposePitch({ step, octave, alter }, state.transposeChromatic, state.transposeDiatonic);
          }

          // Parse Notations
          let tabPosition: { string: number; fret: number } | undefined;
          const notationsEl = findDirectChild(el, 'notations');
          let accidentalDisplay: any;

          if (notationsEl) {
            const techEl = findDirectChild(notationsEl, 'technical');
            if (techEl) {
              const fret = getChildInt(techEl, 'fret');
              const str = getChildInt(techEl, 'string');
              if (fret !== null && str !== null) {
                tabPosition = { string: str, fret };
              }
              // Techniques (bend, hammer-on, slide…) can be parsed here as well
            }

            const accEl = findDirectChild(el, 'accidental');
            if (accEl) {
              accidentalDisplay = { show: true };
              if (accEl.textContent?.includes('parentheses')) {
                accidentalDisplay.enclosure = { symbol: 'parentheses' };
              }
            }
          }

          const mnxNote: MnxNote = {
            pitch: mnxPitch || { step: 'C', octave: 4 },
            ...(tabPosition ? { _x: { tab: { position: tabPosition } } } : {}),
            ...(accidentalDisplay ? { accidentalDisplay } : {})
          };

          if (isChord) {
            // Append note to existing event in this voice at the same onset time
            const events = voiceEvents.get(voice) || [];
            const lastEventObj = events.find(e => e.onset === currentTime);
            if (lastEventObj && lastEventObj.event.notes) {
              lastEventObj.event.notes.push(mnxNote);
            } else {
              // Fallback if no matching onset event was found
              const chordEvent: MnxEvent = {
                duration: mnxDur,
                notes: [mnxNote]
              };
              if (!voiceEvents.has(voice)) voiceEvents.set(voice, []);
              voiceEvents.get(voice)!.push({ onset: currentTime, event: chordEvent });
            }
          } else {
            // New Note event
            const noteEvent: MnxEvent = {
              duration: mnxDur,
              notes: [mnxNote]
            };
            if (!voiceEvents.has(voice)) voiceEvents.set(voice, []);
            voiceEvents.get(voice)!.push({ onset: currentTime, event: noteEvent });
            currentTime += rawDur;
          }
        }
      }
    }

    // Convert Map to MnxSequence array
    const sequences: MnxSequence[] = [];
    for (const [voiceName, events] of voiceEvents.entries()) {
      // Sort events by onset time
      events.sort((a, b) => a.onset - b.onset);

      // Insert padding space events for gaps
      const content: MnxEvent[] = [];
      let cursor = 0;

      for (const item of events) {
        if (item.onset > cursor) {
          const gap = item.onset - cursor;
          // Calculate space duration fraction
          const spaceDur = calculateMnxDuration(gap, state.divisions);
          content.push({
            duration: spaceDur,
            rest: {} // In simple MNX we can pad with rests or space
          });
        }
        content.push(item.event);
        // Calculate duration value in divisions
        // Note: this assumes we can deduce division size of item.event.duration
        // But since we have chronological stream, cursor just updates to next onset
        cursor = item.onset + this.getEventDivisionDuration(item.event, state.divisions);
      }

      sequences.push({
        voice: `v${voiceName}`,
        content
      });
    }

    return sequences;
  }

  private transposePitch(pitch: MnxPitch, chromatic: number, diatonic: number): MnxPitch {
    if (chromatic === 0 && diatonic === 0) return pitch;

    const srcStepIdx = STEP_NAMES.indexOf(pitch.step as any);
    const srcAlter = pitch.alter || 0;

    // Compute absolute sounding semitone position (from C0)
    const srcAbsSemitone = pitch.octave * 12 + STEP_SEMITONES[pitch.step] + srcAlter;
    const soundingAbsSemitone = srcAbsSemitone + chromatic;

    // Apply diatonic step shift to determine the new note letter
    const newStepRaw = srcStepIdx + diatonic;
    const newStepIdx = ((newStepRaw % 7) + 7) % 7;
    const newStep = STEP_NAMES[newStepIdx];

    // Determine new octave: find which octave places newStep closest to soundingAbsSemitone
    const newStepSemitone = STEP_SEMITONES[newStep];
    // Rough octave from absolute semitone
    const roughOctave = Math.floor(soundingAbsSemitone / 12);
    // Adjust if needed so new note semitone matches
    let newOctave = roughOctave;
    if (newStepSemitone > soundingAbsSemitone - roughOctave * 12 + 6) {
      newOctave = roughOctave - 1;
    }

    // Calculate alter: chromatic difference between sounding pitch and natural step
    const newAlter = soundingAbsSemitone - (newOctave * 12 + newStepSemitone);

    return {
      step: newStep,
      octave: newOctave,
      alter: newAlter !== 0 ? newAlter : undefined
    };
  }

  private getEventDivisionDuration(event: MnxEvent, divisions: number): number {
    const base = event.duration.base;
    const dots = event.duration.dots || 0;
    
    let baseRatio = 1.0; // quarter
    if (base === 'whole') baseRatio = 4.0;
    else if (base === 'half') baseRatio = 2.0;
    else if (base === 'eighth') baseRatio = 0.5;
    else if (base === '16th' || base === 'sixteenth') baseRatio = 0.25;
    else if (base === '32nd' || base === 'thirty-second') baseRatio = 0.125;
    else if (base === '64th') baseRatio = 0.0625;
    
    const multiplier = 2 - Math.pow(2, -dots);
    return Math.round(baseRatio * multiplier * divisions);
  }

  /**
   * Helper to check if a part represents guitar tablature.
   * (Tab parts no longer carry TAB clefs; tab-ness is the part-level
   * `_x.tab.staffKind` view declaration.)
   */
  public isTabPart(part: MnxPart): boolean {
    return part._x?.tab?.staffKind === 'tab';
  }

  /**
   * Merges a standard notation part and a TAB part into a SINGLE-SOURCE part:
   * the music is encoded once (the standard part's sequences), each note
   * annotated with its fingerboard position from the aligned TAB note. The
   * TAB staff itself is discarded — notation and tab are derived views
   * (part._x.tab.staffKind = 'both'). See docs/tab-extension-spec.md.
   */
  public mergeParts(standardPart: MnxPart, tabPart: MnxPart): MnxPart {
    const numMeasures = Math.min(standardPart.measures.length, tabPart.measures.length);

    for (let m = 0; m < numMeasures; m++) {
      // Assign matching IDs to notes aligned at the same chronological onset
      // time, copying each TAB note's position onto the standard note.
      this.alignNoteIds(standardPart.measures[m].sequences, tabPart.measures[m].sequences, m);
    }

    return {
      id: standardPart.id,
      name: standardPart.name,
      measures: standardPart.measures.slice(0, numMeasures),
      // Preserve transposition from the standard part (TAB parts don't carry transposition)
      ...(standardPart.transposition ? { transposition: standardPart.transposition } : {}),
      _x: {
        tab: {
          ...(tabPart._x?.tab?.tuning ? { tuning: tabPart._x.tab.tuning } : {}),
          ...(tabPart._x?.tab?.capo !== undefined ? { capo: tabPart._x.tab.capo } : {}),
          staffKind: 'both'
        }
      }
    };
  }

  private alignNoteIds(stdSeqs: MnxSequence[], tabSeqs: MnxSequence[], measureIdx: number) {
    // Generate aligned IDs for standard notes, and copy fingerboard positions
    // to them so the single remaining note stream carries the tab data.
    for (const stdSeq of stdSeqs) {
      const voice = stdSeq.voice || 'v1';
      const correspondingTabSeq = tabSeqs.find(s => s.voice === voice);
      if (!correspondingTabSeq) continue;

      let stdOnset = 0;
      let stdNoteCounter = 1;

      for (let stdEvIdx = 0; stdEvIdx < stdSeq.content.length; stdEvIdx++) {
        const stdEv = stdSeq.content[stdEvIdx];
        if (stdEv.notes) {
          // Find matching TAB event at same onset time
          let tabOnset = 0;
          let matchingTabEv: MnxEvent | undefined;

          for (const tabEv of correspondingTabSeq.content) {
            if (tabOnset === stdOnset && tabEv.notes) {
              matchingTabEv = tabEv;
              break;
            }
            tabOnset += this.getEventDivisionDuration(tabEv, 8); // use standard division 8 for onset mapping
          }

          for (let nIdx = 0; nIdx < stdEv.notes.length; nIdx++) {
            const stdNote = stdEv.notes[nIdx];
            const noteId = `n-${measureIdx + 1}-${voice}-${stdOnset}-${stdNoteCounter++}`;
            stdNote.id = noteId;

            if (matchingTabEv && matchingTabEv.notes && matchingTabEv.notes[nIdx]) {
              const tabNote = matchingTabEv.notes[nIdx];
              tabNote.id = noteId; // share same note ID

              // Copy the fingerboard position to the standard note
              if (tabNote._x?.tab?.position) {
                stdNote._x = {
                  tab: {
                    ...stdNote._x?.tab,
                    position: tabNote._x.tab.position
                  }
                };
              }
            }
          }
        }
        stdOnset += this.getEventDivisionDuration(stdEv, 8);
      }
    }
  }
}
