import { Dusa } from "dusa";
import type { Note, WorkerMessage } from "./util";
import SOLVER from "./counterpoint_forbid.du?raw";

onmessage = (e: MessageEvent<WorkerMessage & { type: "input" }>) => {
  console.debug("worker: begin");
  const cfInput = e.data.payload
    .map((note, i) => `cf ${i} is ${note}.`)
    .join("\n");

  const program = SOLVER + cfInput + `\nlength is ${e.data.payload.length}.\n`;

  try {
    for (const solution of new Dusa(program)) {
      console.debug("worker: generated solution");
      // [time, track, note][]
      const results = [...solution.lookup("at")];

      const track = (t: number) =>
        results
          .filter(([, track]) => track === t)
          .map(([, , note]) => note as Note);

      const cf = track(0);
      const cp = track(1);

      postMessage({
        type: "solution",
        payload: { cf, cp },
      } satisfies WorkerMessage);
    }
    console.debug("worker: done");
    postMessage({ type: "done" } satisfies WorkerMessage);
  } catch (e) {
    console.error(e);
    postMessage({
      type: "error",
      payload: e,
    } satisfies WorkerMessage);
  }
};
