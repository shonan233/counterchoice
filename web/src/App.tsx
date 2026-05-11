import { useEffect, useMemo, useRef, useState } from "react";
import { NOTES, type Note } from "./util";
import { solve } from "./dusa.service";
import Solution from "./Solution";
import Notes from "./Notes";
import style from "./App.module.css";

export default function App() {
  const [input, setInput] = useState("");
  const [done, setDone] = useState(true);
  const [solutions, setSolutions] = useState<Note[][]>([]);
  const [error, setError] = useState<unknown>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cf = useMemo(
    () =>
      [...input.replaceAll(/\s+/g, "")].map(
        (note) => NOTES.indexOf(note) as Note,
      ),
    [input],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    (async () => {
      try {
        for await (const sol of solve(cf, [], [], ctrl.signal)) {
          setSolutions((current) => [...current, sol.cp]);
        }
        setDone(true);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e);
        setDone(true);
      }
    })();

    return () => ctrl.abort();
  }, [cf]);

  return (
    <>
      <h1>CounterChoice Composer</h1>

      <div className={`${style.controls}`}>
        <label htmlFor="cf">Enter your cantus firmus:</label>
        <Notes className={style.mainNotes} />
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
              setError(null);
              setDone(false);
            }
          }}
        />
        <button
          type="button"
          title="Stop"
          onClick={() => {
            abortRef.current?.abort();
            setDone(true);
          }}
        >
          Stop
        </button>
      </div>

      {!done && <p>Working ...</p>}
      {error && <pre>{String(error)}</pre>}

      <ul className={`${style.solutions}`}>
        {solutions.map((cp, i) => (
          <li key={i}>
            <Solution id={i + 1} cf={cf} notes={cp} />
          </li>
        ))}
      </ul>
    </>
  );
}
