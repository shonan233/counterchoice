import type { Fact } from "dusa";

export type Note = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 12 | 13;

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
    rules: Rule[];
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
