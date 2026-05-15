import { useEffect, useRef, useState } from "react";
import {
  RULES,
  type Rule,
  type Note,
  type WorkerSolution,
  type Freeze,
} from "./util";
import { solve } from "./dusa.service";
import Solution from "./Solution";
import Notes from "./Notes";
import style from "./App.module.css";

const SOLUTION_LIMIT = 9;

export default function App() {
  const [cf, setCf] = useState<(Note | null)[]>([]);
  const [frozenCp, setFrozenCp] = useState<(Note | null)[]>([]);
  const [done, setDone] = useState(true);
  const [solutions, setSolutions] = useState<WorkerSolution[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [solverInput, setSolverInput] = useState<{
    solver: string;
    dusaInput: string;
  } | null>(null);
  const [enabledRules, setEnabledRules] = useState<Record<Rule, boolean>>(
    Object.fromEntries(RULES.map((r) => [r, true])) as Record<Rule, boolean>,
  );
  const [solvedCf, setSolvedCf] = useState<(Note | null)[] | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const program = solverInput && solverInput.solver + solverInput.dusaInput;

  const cfIncomplete = cf.length === 0 || cf.some((n) => n === null);

  // terminate the worker on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  const onSolve = async () => {
    // cancel any prior solve before starting a new one
    abortRef.current?.abort();

    if (cf.length === 0) return;
    if (!cf.every((n): n is Note => n !== null)) return;

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setSolutions([]);
    setSolverInput(null);
    setError(null);
    setDone(false);

    try {
      const { solver, dusaInput, solutions } = await solve(
        cf,
        frozenCp
          .map((n, i) => (n === null ? null : ([i, n] satisfies Freeze)))
          .filter((n) => n !== null),
        Object.entries(enabledRules)
          .filter(([, on]) => on)
          .map(([name]) => name as Rule),
        ctrl.signal,
      );
      setSolverInput({ solver, dusaInput });
      let count = 0;
      for await (const sol of solutions) {
        setSolutions((current) => [...current, sol]);
        count += 1;
        if (count >= SOLUTION_LIMIT) break;
      }
      setSolvedCf(cf);
      setDone(true);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      console.error(e);
      setError(e);
      setDone(true);
    }
  };

  return (
    <>
      <h1>CounterChoice Composer</h1>

      <section className={style.controls}>
        <label htmlFor="cf">Enter your cantus firmus:</label>
        <Notes
          className={style.mainNotes}
          cf={cf}
          cp={frozenCp}
          editable
          onCfChange={(newCf) => {
            if (newCf.every((n) => n === null || n <= 7)) {
              setCf(newCf);
            }
          }}
          onCpChange={(newCp) => setFrozenCp(newCp)}
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

        <div className={style.underNotes}>
          <button
            type="button"
            onClick={onSolve}
            disabled={cfIncomplete || !done}
          >
            Solve
          </button>
          <button
            type="button"
            onClick={() => {
              abortRef.current?.abort();
              setDone(true);
            }}
            disabled={done}
          >
            Stop
          </button>
          {program && (
            <span>
              Open this program in{" "}
              <a
                rel="noreferrer"
                target="_blank"
                href={`https://dusa.rocks/#program=${encodeURIComponent(program)}`}
              >
                dusa.rocks
              </a>
              , or{" "}
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(program)}
              >
                copy
              </button>
            </span>
          )}
        </div>
      </section>

      {!done && <p>Working ...</p>}
      {error && <pre>{String(error)}</pre>}

      {done && cf === solvedCf && solutions.length === 0 && (
        <p>No solutions found.</p>
      )}

      <ul className={style.solutions}>
        {solutions.map((sol, i) => (
          <li key={i}>
            <Solution
              id={i + 1}
              onSelect={() => setFrozenCp(sol.cp)}
              {...sol}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
