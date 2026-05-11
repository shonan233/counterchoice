import { Dusa } from "dusa";
import {
  RULES,
  type Note,
  type WorkerInput,
  type WorkerResponse,
} from "./util";
import SOLVER from "./counterpoint_forbid.du?raw";

function solve({
  cf,
  frozen,
  rules,
}: (WorkerInput & { type: "solve" })["payload"]) {
  console.debug("solving with notes", cf);
  const dusaInput =
    rules.map((r) => `forbidden ${r}.`).join("\n") +
    "\n" +
    cf.map((n, i) => `cf ${i} is ${n}.`).join("\n") +
    "\n" +
    frozen.map(([idx, n]) => `at 1 ${idx} is ${n}.`).join("\n") +
    `\nlength is ${cf.length}.\n`;

  for (const solution of new Dusa(SOLVER + dusaInput)) {
    const results = [...solution.lookup("at")];
    const track = (t: number) =>
      results
        .filter(([, track]) => track === t)
        .map(([, , note]) => note as Note);
    const cf = track(0);
    const cp = track(1);

    const violations = solution
      .facts()
      .filter((fact) => (RULES as readonly string[]).includes(fact.name));

    postMessage({
      type: "solution",
      payload: { cf, cp, violations },
    } satisfies WorkerResponse);
  }

  postMessage({ type: "done" } satisfies WorkerResponse);
}

onmessage = ({ data: message }: MessageEvent<WorkerInput>) => {
  const call =
    <T, R>(f: (arg: T) => R) =>
    ({ payload }: { payload: T }) =>
      f(payload);

  const lookup: {
    [K in WorkerInput["type"]]: (
      msg: Extract<WorkerInput, { type: K }>,
    ) => void;
  } = {
    solve: call(solve),
  };

  try {
    lookup[message.type](message as never);
  } catch (e) {
    postMessage({
      type: "error",
      payload: e,
    } satisfies WorkerResponse);
  }
};
