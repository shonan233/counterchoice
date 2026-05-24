import type {
  Freeze,
  Note,
  RuleName,
  WorkerInput,
  WorkerResponse,
} from "./util";

type Solution = Extract<WorkerResponse, { type: "solution" }>["payload"];

export interface SolveHandle {
  solver: string;
  dusaInput: string;
  solutions: AsyncGenerator<Solution, void, void>;
}

export async function solve(
  cf: Note[],
  frozen: Freeze[],
  rules: readonly RuleName[],
  signal?: AbortSignal,
): Promise<SolveHandle> {
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

  const cleanup = () => {
    signal?.removeEventListener("abort", onAbort);
    worker.removeEventListener("message", onMessage);
    worker.terminate();
  };

  const next = async (): Promise<WorkerResponse> => {
    while (queue.length === 0 && !signal?.aborted) {
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
    signal?.throwIfAborted();
    return queue.shift()!;
  };

  worker.postMessage({
    type: "solve",
    payload: { cf, frozen, rules },
  } satisfies WorkerInput);

  let metadata: { solver: string; dusaInput: string };
  try {
    const first = await next();
    if (first.type === "input") {
      metadata = first.payload;
    } else if (first.type === "error") {
      throw first.payload;
    } else {
      throw new Error(
        `Expected "input" message first from worker, got "${first.type}".`,
      );
    }
  } catch (e) {
    cleanup();
    throw e;
  }

  const solutions = (async function* (): AsyncGenerator<Solution, void, void> {
    try {
      while (true) {
        const msg = await next();
        if (msg.type === "solution") {
          yield msg.payload;
        } else if (msg.type === "done") {
          return;
        } else if (msg.type === "error") {
          throw msg.payload;
        }
        // a second "input" message would be unexpected; ignore it
      }
    } finally {
      cleanup();
    }
  })();

  return { ...metadata, solutions };
}
