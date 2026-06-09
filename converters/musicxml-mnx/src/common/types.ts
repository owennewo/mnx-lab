export interface MnxPitch {
  step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
  octave: number;
  alter?: number;
}

// ---- Tablature extension v2 (`_x.tab`) — see docs/tab-extension-spec.md ----

export interface MnxFingering {
  hand: 'left' | 'right';
  finger: string;
}

export interface MnxBend {
  type: 'bend' | 'pre-bend';
  amount: number;
  release?: boolean;
}

export interface MnxSlide {
  type: 'shift' | 'legato' | 'slide-in' | 'slide-out';
  direction?: 'up' | 'down';
  target?: string;
}

export interface MnxTabPosition {
  /** String number; 1 = highest-pitched string. */
  string: number;
  /** Fret number; 0 = open string. */
  fret: number;
}

export interface MnxTabTechnique {
  bend?: MnxBend;
  slide?: MnxSlide;
  hammerOn?: { target: string };
  pullOff?: { target: string };
  vibrato?: boolean;
}

export interface MnxTabNoteExtension {
  position?: MnxTabPosition;
  technique?: MnxTabTechnique;
  fingering?: MnxFingering;
}

export interface MnxNote {
  id?: string;
  pitch: MnxPitch;
  accidentalDisplay?: {
    show: boolean;
    enclosure?: {
      symbol: 'parentheses' | 'brackets';
    };
  };
  _x?: {
    tab?: MnxTabNoteExtension;
  };
}

export interface MnxRest {}

export interface MnxEvent {
  duration: {
    base: string; // e.g. 'whole', 'half', 'quarter', 'eighth', '16th', '32nd'
    dots?: number;
  };
  notes?: MnxNote[];
  rest?: MnxRest;
  stemDirection?: 'up' | 'down';
  staff?: number;
}

export interface MnxSequence {
  content: MnxEvent[];
  voice?: string;
  staff?: number;
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
  id: string;
  name: string;
  staves?: number;
  measures: MnxPartMeasure[];
  transposition?: {
    interval: {
      halfSteps: number;
      staffDistance?: number;
    };
  };
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
