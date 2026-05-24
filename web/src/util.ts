import type { Fact, Term } from "dusa";

export type Note = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 12 | 13 | 14;

export const RULES = [
  { type: "forbid", name: "unisoninMiddle", arity: 1 },
  { type: "forbid", name: "directOctave", arity: 1 },
  { type: "forbid", name: "directFifth", arity: 1 },
  { type: "forbid", name: "parallelOctave", arity: 1 },
  { type: "forbid", name: "parallelFifth", arity: 1 },
  { type: "forbid", name: "twoLargeLeapsUp", arity: 1 },
  { type: "forbid", name: "twoLargeLeapsDown", arity: 1 },
  { type: "forbid", name: "invalidCPMovement", arity: 1 },
  { type: "forbid", name: "fourLeaps", arity: 1 },
  { type: "demand", name: "cadenceStepwiseContrary", arity: 0 },
] as const;

export type Rule = {
  type: "forbid" | "demand";
  name: string;
  arity: number;
};

export type RuleName = (typeof RULES)[number]["name"];

export type Freeze = [number, Note];

export type WorkerInput = {
  type: "solve";
  payload: {
    cf: Note[];
    frozen: Freeze[];
    rules: readonly RuleName[];
  };
};

export type WorkerSolution = {
  cf: Note[];
  cp: Note[];
  violations: Fact[];
  facts: Fact[];
};

export type WorkerResponse =
  | {
      type: "input";
      payload: { solver: string; dusaInput: string };
    }
  | {
      type: "solution";
      payload: WorkerSolution;
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

function termToString(term: Term): string {
  if (term === null) {
    return "()";
  } else if (typeof term === "string") {
    return term;
  } else if (typeof term === "boolean" || typeof term === "number") {
    return String(term);
  } else if (term.name !== null) {
    if (term.args === undefined) {
      return term.name;
    } else {
      return `(${term.name} ${term.args.map(termToString).join(" ")})`;
    }
  } else throw new TypeError("expected proper Dusa Term");
}

export function factToString(fact: Fact): string {
  let preValue: string;
  if (fact.args.length === 0) {
    preValue = fact.name;
  } else {
    preValue = `${fact.name} ${fact.args.map(termToString).join(" ")}`;
  }

  if (fact.value !== undefined) {
    return `${preValue} is ${termToString(fact.value)}.`;
  } else return `${preValue}.`;
}
