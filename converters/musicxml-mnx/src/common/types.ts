export interface MnxPitch {
  step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
  octave: number;
  alter?: number;
}

export interface MnxFingering {
  hand: 'left' | 'right';
  finger: string;
}

export interface MnxBend {
  type: string;
  amount: number;
  release?: boolean;
}

export interface MnxSlide {
  type: 'shift' | 'legato' | 'slide-in' | 'slide-out';
  direction?: 'up' | 'down';
  targetNote?: string;
}

export interface MnxHammerOnPullOff {
  type: 'hammer-on' | 'pull-off';
  targetNote: string;
}

export interface MnxGuitarNoteExtension {
  fret: number;
  string: number;
  fingering?: MnxFingering;
  bend?: MnxBend;
  slide?: MnxSlide;
  hammerOnPullOff?: MnxHammerOnPullOff;
  vibrato?: boolean;
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
    guitar?: MnxGuitarNoteExtension;
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

export interface MnxGuitarPartExtension {
  tuning?: {
    strings: MnxPitch[];
  };
  capo?: number;
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
    guitar?: MnxGuitarPartExtension;
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
    type?: 'regular' | 'light-heavy' | 'dotted' | 'dashed' | 'double' | 'final';
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
