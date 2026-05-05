export type Note = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 12 | 13;

export type WorkerMessage =
  | { type: "input"; payload: Note[] }
  | {
      type: "solution";
      payload: {
        cf: Note[];
        cp: Note[];
      };
    }
  | { type: "done" }
  | { type: "error"; payload: unknown };

export const NOTES = "cdefgabC" as const;

export const noteToLetter = (note: Note) => "cdefgabCDEFGAB"[note];
