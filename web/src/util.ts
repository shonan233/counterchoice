import type { Fact } from "dusa";

export type Note = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 12 | 13 | 14;

export const RULES = [
  "cadenceNotThirdUnison",
  "cadenceNotSixthOctave",
  "directOctave",
  "directFifth",
  "parallelOctave",
  "parallelFifth",
  "invalidCPMovement",
  "twoLargeLeapsUp",
  "twoLargeLeapsDown",
  "fourLeaps",
] as const;

export type Rule = (typeof RULES)[number];

export type Freeze = [number, Note];

export type WorkerInput = {
  type: "solve";
  payload: {
    cf: Note[];
    frozen: Freeze[];
    rules: readonly Rule[];
  };
};

export type WorkerResponse =
  | {
      type: "solution";
      payload: {
        cf: Note[];
        cp: Note[];
        violations: Fact[];
      };
    }
  | { type: "done" }
  | { type: "error"; payload: unknown };

export const NOTES = "cdefgabC" as const;

export const noteToLetter = (note: Note) => "cdefgabCDEFGAB"[note];

export interface Pitch {
  name: string; // name, a string
  midi: number; // midi note number, 0 <= midi <= 127
}

export const PITCHES: Pitch[] = [
  { name: "C2", midi: 48 },
  { name: "D2", midi: 50 },
  { name: "E2", midi: 52 },
  { name: "F2", midi: 53 },
  { name: "G2", midi: 55 },
  { name: "A2", midi: 57 },
  { name: "B2", midi: 59 },
  { name: "C3", midi: 60 },
  { name: "D3", midi: 62 },
  { name: "E3", midi: 64 },
  { name: "F3", midi: 65 },
  { name: "G3", midi: 67 },
  { name: "A3", midi: 69 },
  { name: "B3", midi: 71 },
  { name: "C4", midi: 72 },
];
