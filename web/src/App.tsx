import { useEffect, useRef, useState } from "react";
import {
  RULES,
  type Note,
  type WorkerSolution,
  type Freeze,
  type RuleName,
} from "./util";
import { solve } from "./dusa.service";
import Solution from "./Solution";
import Notes from "./Notes";
import { usePlayback } from "./usePlayback";
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
  const [enabledRules, setEnabledRules] = useState<Record<RuleName, boolean>>(
    Object.fromEntries(RULES.map((r) => [r.name, true])) as Record<
      RuleName,
      boolean
    >,
  );
  const [solvedCf, setSolvedCf] = useState<(Note | null)[] | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const program = solverInput && solverInput.solver + solverInput.dusaInput;

  const cfIncomplete = cf.length === 0 || cf.some((n) => n === null);
  const cfHasNotes = cf.some((n) => n !== null);

  const cfPlayback = usePlayback([cf]);

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
          .map(([name]) => name as RuleName),
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
        <label>
          Enter your cantus firmus, shift-click to edit counterpoint:
        </label>
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

        <p>Select enabled rules</p>
        <ul className={style.rules}>
          {RULES.map((r) => (
            <li key={r.name}>
              <span className={style.ruleCheckbox}>
                <input
                  name={r.name}
                  id={r.name}
                  type="checkbox"
                  checked={enabledRules[r.name]}
                  title={r.name}
                  onChange={(e) =>
                    setEnabledRules({
                      ...enabledRules,
                      [r.name]: e.target.checked,
                    })
                  }
                />
                <label htmlFor={r.name}>{r.name}</label>
              </span>
            </li>
          ))}
        </ul>

        <details>
          <summary>Instructions</summary>
          <p>
            Each row represents a constant note. Each column is a time step.
            Click on a note for each time. All notes for the cantus firmus must
            be filled to be able to solve. Shift-clicking will fix the
            counterpoint note for that time, and restrict solutions to only
            those containing your specified notes. Overconstraining the
            counterpoint might result in no solutions being possible.
          </p>
          <p>
            The checkboxes control which scenarios are forbidden. Having all
            boxes selected ensures a valid counterpoint track.
          </p>
        </details>

        <div className={style.underNotes}>
          <button
            type="button"
            onClick={cfPlayback.onPlayPause}
            disabled={cfPlayback.loading || !cfHasNotes}
          >
            {cfPlayback.label} cf
          </button>
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
        <p>
          No solutions found. Ensure your cantus firmus ends with a single step
          change. Or, disable the checkbox for{" "}
          <code>cadenceStepwiseContrary</code>.
        </p>
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
