import type { Freeze, Note, Rule, WorkerInput, WorkerResponse } from "./util";

type Solution = Extract<WorkerResponse, { type: "solution" }>["payload"];

export async function* solve(
  cf: Note[],
  frozen: Freeze[],
  rules: readonly Rule[],
  signal?: AbortSignal,
): AsyncGenerator<Solution, void, void> {
  signal?.throwIfAborted();

  const worker = new Worker(new URL("./dusa.worker.ts", import.meta.url), {
    type: "module",
  });

  const queue: WorkerResponse[] = [];
  let wake: (() => void) | null = null;
  const notify = () => {
    const w = wake;
    wake = null;
    w?.();
  };

  const onMessage = (e: MessageEvent<WorkerResponse>) => {
    queue.push(e.data);
    notify();
  };
  worker.addEventListener("message", onMessage);

  const onAbort = () => notify();
  signal?.addEventListener("abort", onAbort);

  try {
    worker.postMessage({
      type: "solve",
      payload: { cf, frozen, rules },
    } satisfies WorkerInput);

    while (true) {
      while (queue.length === 0 && !signal?.aborted) {
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
      signal?.throwIfAborted();

      const msg = queue.shift()!;
      if (msg.type === "solution") {
        yield msg.payload;
      } else if (msg.type === "done") {
        return;
      } else if (msg.type === "error") {
        throw msg.payload;
      }
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
    worker.removeEventListener("message", onMessage);
    worker.terminate();
  }
}
