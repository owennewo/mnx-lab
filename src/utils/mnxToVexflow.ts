import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Barline, TabStave, TabNote, StaveConnector, GhostNote } from 'vexflow';
import { MnxStructure } from '../types/mnx.ts';
import { GUITAR_TUNING, resolveEventPositions } from '../tab/guitarPositions.ts';

export { GUITAR_TUNING, resolveEventPositions };

/**
 * VexFlow Rendering Logic for MNX documents.
 *
 * Supports three view modes:
 * - "notation": Standard notation staff using Stave and StaveNote.
 * - "tab": Guitar tablature staff using TabStave and TabNote, mapping pitches to frets/strings.
 * - "both": Double-staff stacked view showing both standard notation and tab joined by a StaveConnector.
 *
 * Pitch-to-fret mapping is resolved using explicit note annotations (_x.guitar) if present,
 * falling back to a "lowest reasonable position" guitar-tuning heuristic for standard guitar tuning.
 */

const FIFTHS_MAP: Record<number, string> = {
  [-6]: 'Gb',
  [-5]: 'Db',
  [-4]: 'Ab',
  [-3]: 'Eb',
  [-2]: 'Bb',
  [-1]: 'F',
  0: 'C',
  1: 'G',
  2: 'D',
  3: 'A',
  4: 'E',
  5: 'B',
  6: 'F#'
};

const DURATION_MAP: Record<string, string> = {
  'whole': 'w',
  'half': 'h',
  'quarter': 'q',
  'eighth': '8',
  'sixteenth': '16',
  'thirty-second': '32'
};

export interface RenderOptions {
  container: HTMLElement;
  mnx: MnxStructure;
  width: number;
  height: number;
  activeNoteIds?: string[];
  selectedNoteIds?: string[];
  viewMode?: 'notation' | 'tab' | 'both';
  onNoteClick?: (noteId: string, measureIdx: number, noteIdx: number) => void;
}

export function renderMnxToVexflow(options: RenderOptions) {
  const {
    container,
    mnx,
    width,
    height,
    activeNoteIds = [],
    selectedNoteIds = [],
    viewMode = 'notation',
    onNoteClick
  } = options;

  // Clear previous SVG content
  container.innerHTML = '';

  if (!mnx.parts || mnx.parts.length === 0) return;

  // Initialize VexFlow Renderer (cast container to any to bypass TS Strict HTMLDivElement mismatch)
  const renderer = new Renderer(container as any, Renderer.Backends.SVG);
  renderer.resize(width, height);
  const context = renderer.getContext();

  const part = mnx.parts[0]; // Renders the first part for the minimal version
  const numMeasures = part.measures.length;
  const isGuitarPart = part.name.toLowerCase().includes('guitar');

  const measuresPerRow = width > 800 ? 4 : 2;
  const margin = 20;
  const rowHeight = viewMode === 'both' ? 220 : 130;
  const usableWidth = width - margin * 2;
  const measureWidth = usableWidth / measuresPerRow;

  let activeKeyFifths = 0;
  let activeTime = { count: 4, unit: 4 };
  let activeClefType = 'treble';
  let activeClefOctave: string | undefined = isGuitarPart ? '8vb' : undefined;

  for (let i = 0; i < numMeasures; i++) {
    // Inherit global measure parameters
    const globalMeasure = mnx.global.measures[i] || {};
    const partMeasure = part.measures[i] || {};
    let keyChanged = false;
    let timeChanged = false;
    let clefChanged = false;

    if (partMeasure.clefs) {
      const staff1Clef = partMeasure.clefs.find((c: any) => c.staff === 1);
      if (staff1Clef && staff1Clef.clef) {
        const sign = staff1Clef.clef.sign;
        let newClefType = 'treble';
        let newClefOctave: string | undefined = undefined;
        if (sign === 'F') {
          newClefType = 'bass';
        } else if (sign === 'G') {
          newClefType = 'treble';
          if (staff1Clef.clef.octave === -1) {
            newClefOctave = '8vb';
          } else if (staff1Clef.clef.octave === 1) {
            newClefOctave = '8va';
          }
        }
        if (newClefType !== activeClefType || newClefOctave !== activeClefOctave) {
          activeClefType = newClefType;
          activeClefOctave = newClefOctave;
          clefChanged = true;
        }
      }
    }

    if (globalMeasure.key) {
      const newFifths = globalMeasure.key.fifths;
      if (i === 0 || newFifths !== activeKeyFifths) {
        activeKeyFifths = newFifths;
        if (i > 0) {
          keyChanged = true;
        }
      }
    }
    if (globalMeasure.time) {
      const newCount = globalMeasure.time.count;
      const newUnit = globalMeasure.time.unit;
      if (i === 0 || newCount !== activeTime.count || newUnit !== activeTime.unit) {
        activeTime = { count: newCount, unit: newUnit };
        if (i > 0) {
          timeChanged = true;
        }
      }
    }

    const row = Math.floor(i / measuresPerRow);
    const col = i % measuresPerRow;

    const x = margin + col * measureWidth;
    const y = margin + row * rowHeight;

    let stave: Stave | null = null;
    let tabStave: TabStave | null = null;

    if (viewMode === 'notation' || viewMode === 'both') {
      stave = new Stave(x, y, measureWidth);
    }
    if (viewMode === 'tab' || viewMode === 'both') {
      const tabY = viewMode === 'both' ? y + 90 : y;
      tabStave = new TabStave(x, tabY, measureWidth);
    }

    // Render Clef, Key, and Time signatures at start of systems
    const isFirstInRow = col === 0;
    const isFirstInScore = i === 0;

    if (stave) {
      if (isFirstInScore) {
        stave.addClef(activeClefType, undefined, activeClefOctave);
        stave.addKeySignature(FIFTHS_MAP[activeKeyFifths] || 'C');
        stave.addTimeSignature(`${activeTime.count}/${activeTime.unit}`);
      } else if (isFirstInRow) {
        stave.addClef(activeClefType, undefined, activeClefOctave);
        stave.addKeySignature(FIFTHS_MAP[activeKeyFifths] || 'C');
      } else {
        // Add mid-score changes if any
        if (clefChanged) {
          stave.addClef(activeClefType, undefined, activeClefOctave);
        }
        if (keyChanged) {
          stave.addKeySignature(FIFTHS_MAP[activeKeyFifths] || 'C');
        }
        if (timeChanged) {
          stave.addTimeSignature(`${activeTime.count}/${activeTime.unit}`);
        }
      }

      // Set end barline for last measure
      if (i === numMeasures - 1) {
        stave.setEndBarType(Barline.type.DOUBLE);
      }

      stave.setContext(context).draw();
    }

    if (tabStave) {
      if (isFirstInScore) {
        tabStave.addClef('tab');
        tabStave.addTimeSignature(`${activeTime.count}/${activeTime.unit}`);
      } else if (isFirstInRow) {
        tabStave.addClef('tab');
      } else {
        if (timeChanged) {
          tabStave.addTimeSignature(`${activeTime.count}/${activeTime.unit}`);
        }
      }

      // Set end barline for last measure
      if (i === numMeasures - 1) {
        tabStave.setEndBarType(Barline.type.DOUBLE);
      }

      tabStave.setContext(context).draw();
    }

    // Link staves together with a bracket connector at the start of rows
    if (stave && tabStave && (isFirstInScore || isFirstInRow)) {
      const connector = new StaveConnector(stave, tabStave);
      connector.setType(StaveConnector.type.BRACKET);
      connector.setContext(context).draw();
    }

    // Render notes in standard sequences (staff 1 or undefined)
    if (!partMeasure.sequences || partMeasure.sequences.length === 0) continue;
    const stdSequences = partMeasure.sequences.filter(
      seq => seq.staff === 1 || seq.staff === undefined
    );

    if (stdSequences.length === 0) continue;

    const standardVoices: Voice[] = [];
    const tabVoices: Voice[] = [];

    stdSequences.forEach((sequence, seqIdx) => {
      const vexNotesStandard: StaveNote[] = [];
      const vexNotesTab: (TabNote | StaveNote | GhostNote)[] = [];
      // Voice 1 (seqIdx 0, Bass) gets stem DOWN (-1), Voice 2 (seqIdx 1, Melody) gets stem UP (1)
      const stemDirection = stdSequences.length > 1 ? (seqIdx === 0 ? -1 : 1) : undefined;

      sequence.content.forEach((event) => {
        const base = event.duration.base;
        const durationStr = DURATION_MAP[base] || 'q';
        const hasDots = event.duration.dots || 0;

        if (event.rest) {
          // Rest (passing dots directly into constructor options is the v5 way)
          if (stave) {
            const restNote = new StaveNote({
              keys: ['b/4'],
              duration: `${durationStr}r`,
              dots: hasDots
            });
            vexNotesStandard.push(restNote);
          }
          if (tabStave) {
            const ghostNote = new GhostNote({
              duration: durationStr,
              dots: hasDots
            });
            vexNotesTab.push(ghostNote);
          }
        } else if (event.notes && event.notes.length > 0) {
          // Standard Stave Note
          if (stave) {
            const keys = event.notes.map(note => {
              const step = note.pitch.step.toLowerCase();
              const alter = note.pitch.alter;
              // Guitar notes in MNX are stored as sounding pitch (1 octave lower than written).
              // We transpose them by +1 octave to render at correct written position on treble clef.
              const octave = (isGuitarPart && activeClefType === 'treble') ? note.pitch.octave + 1 : note.pitch.octave;
              const accidental = alter === 1 ? '#' : alter === -1 ? 'b' : '';
              return `${step}${accidental}/${octave}`;
            });

            const staveNote = new StaveNote({
              keys: keys,
              duration: durationStr,
              dots: hasDots
            });

            if (stemDirection !== undefined) {
              staveNote.setStemDirection(stemDirection);
            }

            // Add accidentals
            event.notes.forEach((note, noteKeyIdx) => {
              if (note.pitch.alter === 1) {
                staveNote.addModifier(new Accidental('#'), noteKeyIdx);
              } else if (note.pitch.alter === -1) {
                staveNote.addModifier(new Accidental('b'), noteKeyIdx);
              }
            });

            // Set highlight styles based on active (playback) or selected states
            const containsActive = event.notes.some(n => n.id && activeNoteIds.includes(n.id));
            const containsSelected = event.notes.some(n => n.id && selectedNoteIds.includes(n.id));

            if (containsActive) {
              staveNote.setStyle({ fillStyle: 'oklch(0.65 0.22 274)', strokeStyle: 'oklch(0.65 0.22 274)' });
            } else if (containsSelected) {
              staveNote.setStyle({ fillStyle: 'oklch(0.7 0.15 190)', strokeStyle: 'oklch(0.7 0.15 190)' });
            }

            // Tag SVG elements with the first note's ID for DOM queries
            const mainNoteId = event.notes[0].id;
            if (mainNoteId) {
              staveNote.setAttribute('id', mainNoteId);
              staveNote.setAttribute('class', 'vf-clickable-note');
            }

            vexNotesStandard.push(staveNote);
          }

          // Tab Note
          if (tabStave) {
            const tabNote = new TabNote({
              positions: resolveEventPositions(event.notes),
              duration: durationStr
            });

            // Set highlight styles based on active (playback) or selected states
            const containsActive = event.notes.some(n => n.id && activeNoteIds.includes(n.id));
            const containsSelected = event.notes.some(n => n.id && selectedNoteIds.includes(n.id));

            if (containsActive) {
              tabNote.setStyle({ fillStyle: 'oklch(0.65 0.22 274)', strokeStyle: 'oklch(0.65 0.22 274)' });
            } else if (containsSelected) {
              tabNote.setStyle({ fillStyle: 'oklch(0.7 0.15 190)', strokeStyle: 'oklch(0.7 0.15 190)' });
            }

            // Tag SVG elements with the first note's ID for DOM queries
            const mainNoteId = event.notes[0].id;
            if (mainNoteId) {
              tabNote.setAttribute('id', mainNoteId + '-tab');
              tabNote.setAttribute('class', 'vf-clickable-note');
            }

            vexNotesTab.push(tabNote);
          }
        }
      });

      if (stave && vexNotesStandard.length > 0) {
        // Create standard voice
        const voice = new Voice({
          numBeats: activeTime.count,
          beatValue: activeTime.unit
        });
        voice.setStrict(false);
        voice.addTickables(vexNotesStandard);
        standardVoices.push(voice);
      }

      if (tabStave && vexNotesTab.length > 0) {
        // Create tab voice
        const voice = new Voice({
          numBeats: activeTime.count,
          beatValue: activeTime.unit
        });
        voice.setStrict(false);
        voice.addTickables(vexNotesTab);
        tabVoices.push(voice);
      }
    });

    const widthOffset = isFirstInRow ? 65 : 25;

    if (stave && standardVoices.length > 0) {
      if (tabStave && tabVoices.length > 0) {
        // Format both standard notation and tab voices together to align vertically
        new Formatter()
          .joinVoices(standardVoices)
          .joinVoices(tabVoices)
          .format([...standardVoices, ...tabVoices], measureWidth - widthOffset);

        standardVoices.forEach(v => v.draw(context, stave!));
        tabVoices.forEach(v => v.draw(context, tabStave!));
      } else {
        // Format standard notation only
        new Formatter().joinVoices(standardVoices).format(standardVoices, measureWidth - widthOffset);
        standardVoices.forEach(v => v.draw(context, stave!));
      }
    } else if (tabStave && tabVoices.length > 0) {
      // Format tab only
      new Formatter().joinVoices(tabVoices).format(tabVoices, measureWidth - widthOffset);
      tabVoices.forEach(v => v.draw(context, tabStave!));
    }
  }

  // Bind notehead click events in DOM
  setTimeout(() => {
    const clickableNotes = container.querySelectorAll('[id^="vf-n-"]');
    clickableNotes.forEach(el => {
      const fullId = el.getAttribute('id');
      if (!fullId) return;
      let noteId = fullId.replace('vf-', '');
      if (noteId.endsWith('-tab')) {
        noteId = noteId.slice(0, -4);
      }

      let measureIdx = -1;
      let noteIdx = -1;

      for (let m = 0; m < part.measures.length; m++) {
        const sequences = part.measures[m].sequences || [];
        let found = false;
        for (let s = 0; s < sequences.length; s++) {
          const seq = sequences[s];
          const foundIdx = seq.content.findIndex(ev => ev.notes?.some(n => n.id === noteId));
          if (foundIdx !== -1) {
            measureIdx = m;
            noteIdx = foundIdx;
            found = true;
            break;
          }
        }
        if (found) break;
      }

      (el as HTMLElement).style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onNoteClick && measureIdx !== -1 && noteIdx !== -1) {
          onNoteClick(noteId, measureIdx, noteIdx);
        }
      });
    });
  }, 100);
}
