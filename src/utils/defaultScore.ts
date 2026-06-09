import { MnxStructure } from '../types/mnx.ts';

export const defaultScore: MnxStructure = {
  mnx: {
    version: 1
  },
  global: {
    measures: [
      { key: { fifths: 4 }, time: { count: 4, unit: 4 } },
      {},
      {},
      {},
      {},
      {},
      {},
      {}
    ]
  },
  parts: [
    {
      id: "guitar-part",
      name: "Guitar",
      measures: [
        {
          clefs: [
            { clef: { sign: "G", staffPosition: -2 } }
          ],
          sequences: [
            {
              content: [
                { duration: { base: "quarter" }, notes: [ { id: "n-1", pitch: { step: "E", octave: 3 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-2", pitch: { step: "F", alter: 1, octave: 3 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-3", pitch: { step: "G", alter: 1, octave: 3 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-4", pitch: { step: "A", octave: 3 } } ] }
              ]
            }
          ]
        },
        {
          sequences: [
            {
              content: [
                { duration: { base: "quarter" }, notes: [ { id: "n-5", pitch: { step: "B", octave: 3 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-6", pitch: { step: "C", alter: 1, octave: 4 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-7", pitch: { step: "D", alter: 1, octave: 4 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-8", pitch: { step: "E", octave: 4 } } ] }
              ]
            }
          ]
        },
        {
          sequences: [
            {
              content: [
                { duration: { base: "quarter" }, notes: [ { id: "n-9", pitch: { step: "F", alter: 1, octave: 4 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-10", pitch: { step: "G", alter: 1, octave: 4 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-11", pitch: { step: "A", octave: 4 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-12", pitch: { step: "B", octave: 4 } } ] }
              ]
            }
          ]
        },
        {
          sequences: [
            {
              content: [
                { duration: { base: "quarter" }, notes: [ { id: "n-13", pitch: { step: "C", alter: 1, octave: 5 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-14", pitch: { step: "D", alter: 1, octave: 5 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-15", pitch: { step: "E", octave: 5 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-16", pitch: { step: "D", alter: 1, octave: 5 } } ] }
              ]
            }
          ]
        },
        {
          sequences: [
            {
              content: [
                { duration: { base: "quarter" }, notes: [ { id: "n-17", pitch: { step: "C", alter: 1, octave: 5 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-18", pitch: { step: "B", octave: 4 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-19", pitch: { step: "A", octave: 4 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-20", pitch: { step: "G", alter: 1, octave: 4 } } ] }
              ]
            }
          ]
        },
        {
          sequences: [
            {
              content: [
                { duration: { base: "quarter" }, notes: [ { id: "n-21", pitch: { step: "F", alter: 1, octave: 4 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-22", pitch: { step: "E", octave: 4 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-23", pitch: { step: "D", alter: 1, octave: 4 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-24", pitch: { step: "C", alter: 1, octave: 4 } } ] }
              ]
            }
          ]
        },
        {
          sequences: [
            {
              content: [
                { duration: { base: "quarter" }, notes: [ { id: "n-25", pitch: { step: "B", octave: 3 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-26", pitch: { step: "A", octave: 3 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-27", pitch: { step: "G", alter: 1, octave: 3 } } ] },
                { duration: { base: "quarter" }, notes: [ { id: "n-28", pitch: { step: "F", alter: 1, octave: 3 } } ] }
              ]
            }
          ]
        },
        {
          sequences: [
            {
              content: [
                { duration: { base: "quarter" }, notes: [ { id: "n-29", pitch: { step: "E", octave: 3 } } ] },
                { duration: { base: "half", dots: 1 }, rest: {} }
              ]
            }
          ]
        }
      ]
    }
  ]
};
