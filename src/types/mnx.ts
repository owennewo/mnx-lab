export interface MnxPitch {
  step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
  octave: number;
  alter?: number;
}

// ---- Tablature extension v2 (`_x.tab`) — see docs/tab-extension-spec.md ----

export interface MnxTabPosition {
  /** String number; 1 = highest-pitched string. */
  string: number;
  /** Fret number; 0 = open string. */
  fret: number;
}

export interface MnxTabTechnique {
  bend?: {
    type: 'bend' | 'pre-bend';
    amount: number;
    release?: boolean;
  };
  slide?: {
    type: 'shift' | 'legato' | 'slide-in' | 'slide-out';
    direction?: 'up' | 'down';
    target?: string;
  };
  hammerOn?: { target: string };
  pullOff?: { target: string };
  vibrato?: boolean;
}

export interface MnxTabNoteExtension {
  position?: MnxTabPosition;
  technique?: MnxTabTechnique;
  fingering?: {
    hand: 'left' | 'right';
    finger: string;
  };
}

export interface MnxNote {
  id?: string;
  pitch: MnxPitch;
  _x?: {
    tab?: MnxTabNoteExtension;
  };
}

export interface MnxRest {}

export interface MnxEvent {
  duration: {
    base: 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth' | 'thirty-second';
    dots?: number;
  };
  notes?: MnxNote[];
  rest?: MnxRest;
}

export interface MnxSequence {
  content: MnxEvent[];
  staff?: number;
  voice?: string;
}

export interface MnxPartMeasure {
  clefs?: {
    clef: {
      sign: string;
      staffPosition?: number;
      octave?: number;
    };
  }[];
  sequences: MnxSequence[];
}

export interface MnxTuningEntry {
  /** Explicit string number — array order carries no meaning. */
  string: number;
  pitch: MnxPitch;
}

export interface MnxTabPartExtension {
  tuning?: MnxTuningEntry[];
  capo?: number;
  /** The part's preferred presentation; tab-ness is a view, not content. */
  staffKind?: 'notation' | 'tab' | 'both';
}

export interface MnxPart {
  // Optional per the MNX schema — `part` requires only `measures`.
  id?: string;
  name?: string;
  measures: MnxPartMeasure[];
  _x?: {
    tab?: MnxTabPartExtension;
  };
}

export interface MnxGlobalMeasure {
  key?: {
    fifths: number;
  };
  time?: {
    count: number;
    unit: number;
  };
  barline?: {
    type?: 'regular' | 'dotted' | 'dashed' | 'heavy' | 'double' | 'final'
      | 'heavyLight' | 'heavyHeavy' | 'tick' | 'short' | 'noBarline';
  };
}

export interface MnxStructure {
  mnx: {
    version: number;
  };
  global: {
    measures: MnxGlobalMeasure[];
  };
  parts: MnxPart[];
}

export interface MnxDocument {
  id: string;
  name: string;
  lastUpdated: number;
  mnxJson: MnxStructure;
}
