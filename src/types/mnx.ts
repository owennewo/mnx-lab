export interface MnxPitch {
  step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
  octave: number;
  alter?: number;
}

export interface MnxNote {
  id?: string;
  pitch: MnxPitch;
  _x?: {
    guitar?: {
      string?: number;
      fret?: number;
      fingering?: {
        hand?: 'left' | 'right';
        finger?: string;
      };
      bend?: {
        type?: string;
        amount?: number;
        release?: boolean;
      };
    };
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

export interface MnxPart {
  id: string;
  name: string;
  measures: MnxPartMeasure[];
  _x?: {
    guitar?: {
      tuning?: { strings: MnxPitch[] };
      capo?: number;
    };
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
    type?: 'regular' | 'light-heavy' | 'dotted' | 'dashed';
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
