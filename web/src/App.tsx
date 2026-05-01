import { useEffect, useRef, useState } from "react";
import { NOTES, type Note, type WorkerMessage } from "./util";
import Solution from "./Solution";

export default function App() {
  const [input, setInput] = useState("");
  const [done, setDone] = useState(true);
  const [solutions, setSolutions] = useState<Note[][]>([]);
  const [error, setError] = useState<unknown>(null);
  const workerRef = useRef<Worker | null>(null);

  const terminateWorker = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
  };

  const stop = () => {
    terminateWorker();
    setDone(true);
  };

  useEffect(() => {
    console.debug("client: starting worker");
    const worker = new Worker(new URL("./dusa.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.postMessage({
      type: "input",
      payload: [...input.replaceAll(/\s+/g, "")].map(
        (note) => NOTES.indexOf(note) as Note,
      ),
    } satisfies WorkerMessage);

    worker.addEventListener("message", (e: MessageEvent<WorkerMessage>) => {
      const data = e.data;
      if (data.type === "solution") {
        setSolutions((current) => [...current, data.payload.cp]);
      } else if (data.type === "done") {
        setDone(true);
      } else if (data.type === "error") {
        setError(data);
        setDone(true);
      }
    });

    return terminateWorker;
  }, [input]);

  return (
    <>
      <h1>CounterChoice Composer</h1>

      <div>
        <label htmlFor="cf">Enter your cantus firmus:</label>
        <textarea
          name="cf"
          placeholder={NOTES}
          value={input}
          onChange={(e) => {
            const value = e.target.value;
            if (!new RegExp(`^[${NOTES}\\s]*$`).test(value)) {
              e.preventDefault();
            } else {
              setInput(value);
              setSolutions([]);
              setDone(false);
            }
          }}
        />
        <button type="button" title="Stop" onClick={stop}>
          Stop
        </button>
      </div>

      {!done && <p>Working ...</p>}
      {error && <pre>{String(error)}</pre>}

      <ul>
        {solutions.map((soln, i) => (
          <li key={i}>
            <Solution id={i + 1} notes={soln} />
          </li>
        ))}
      </ul>
    </>
  );
}
