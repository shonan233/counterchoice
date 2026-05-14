import { useEffect, useRef, useState } from "react";
import { RULES, type Rule, type Note, type WorkerSolution } from "./util";
import { solve } from "./dusa.service";
import Solution from "./Solution";
import Notes from "./Notes";
import style from "./App.module.css";

const SOLUTION_LIMIT = 10;

export default function App() {
  const [cf, setCf] = useState<Note[]>([]);
  const [done, setDone] = useState(true);
  const [solutions, setSolutions] = useState<WorkerSolution[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [enabledRules, setEnabledRules] = useState<Record<Rule, boolean>>(
    Object.fromEntries(RULES.map((r) => [r, true])) as Record<Rule, boolean>,
  );
  const abortRef = useRef<AbortController | null>(null);

  // invalidate solutions when their input (cf or enabledRules) changes
  const [solutionsCf, setSolutionsCf] = useState(cf);
  const [solutionsRules, setSolutionsRules] = useState(enabledRules);
  if (cf !== solutionsCf || enabledRules !== solutionsRules) {
    setSolutionsCf(cf);
    setSolutionsRules(enabledRules);
    setSolutions([]);
  }

  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    (async () => {
      if (cf.some((n) => n < 0 || n > 14)) return;
      if (cf.length === 0) return;

      try {
        for await (const sol of solve(
          cf,
          [],
          Object.entries(enabledRules)
            .filter(([, on]) => on)
            .map(([name]) => name as Rule),
          ctrl.signal,
        )) {
          setSolutions((current) => [...current, sol]);
        }
        setDone(true);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        console.error(e);
        setError(e);
        setDone(true);
      }
    })();

    return () => ctrl.abort();
  }, [cf, enabledRules]);

  useEffect(() => {
    if (solutions.length >= SOLUTION_LIMIT) {
      abortRef.current?.abort();
    }
  }, [solutions]);

  return (
    <>
      <h1>CounterChoice Composer</h1>

      <div className={`${style.controls}`}>
        <label htmlFor="cf">Enter your cantus firmus:</label>
        <Notes
          className={style.mainNotes}
          cf={cf}
          editable
          onChange={(newCf) => {
            if (newCf.every((n) => n <= 7)) {
              setCf(newCf);
            }
          }}
        />

        <ul className={style.rules}>
          {RULES.map((r) => (
            <li key={r}>
              <span className={style.ruleCheckbox}>
                <input
                  name={r}
                  type="checkbox"
                  checked={enabledRules[r]}
                  title={r}
                  onChange={(e) =>
                    setEnabledRules({ ...enabledRules, [r]: e.target.checked })
                  }
                />
                <label htmlFor={r}>{r}</label>
              </span>
            </li>
          ))}
        </ul>

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
        {solutions.map((sol, i) => (
          <li key={i}>
            <Solution id={i + 1} cf={cf} cp={sol.cp} />
          </li>
        ))}
      </ul>
    </>
  );
}
