import { factToString, type Note } from "./util";
import { tracksToMidi } from "./midi";
import { usePlayback } from "./usePlayback";
import style from "./Solution.module.css";
import Notes from "./Notes";
import type { Fact } from "dusa";

export interface SolutionProps {
  cf: Note[];
  cp: Note[];
  facts: Fact[];
  violations: Fact[];
  id: number;
  onSelect: () => void;
}

export default function Solution({
  cf,
  cp,
  id,
  facts,
  violations,
  onSelect,
}: SolutionProps) {
  const midi = tracksToMidi(cf, cp);
  const factsStrings = facts.map(factToString);
  const { loading, label, onPlayPause } = usePlayback([cf, cp]);

  const handleDownload = () => {
    const url = URL.createObjectURL(
      new Blob([midi.buffer as ArrayBuffer], { type: "audio/midi" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `solution-${id}.mid`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={style.solution}>
      <div>
        <p>
          Solution <span className={style.id}>{id}:</span>
        </p>
        <Notes cf={cf} cp={cp} className={style.notes} />
      </div>
      <button
        type="button"
        className={style.playButton}
        onClick={onPlayPause}
        disabled={loading}
      >
        {label}
      </button>
      <button type="button" onClick={handleDownload}>
        Download
      </button>
      <button type="button" onClick={onSelect}>
        Select
      </button>
      {violations.length !== 0 && (
        <details className={style.violations}>
          <summary>Counterpoint violations</summary>
          <ul>
            {violations.map((v, i) => (
              <li key={i}>{factToString(v)}</li>
            ))}
          </ul>
        </details>
      )}
      <details>
        <summary>
          See generated facts
          <button
            className={style.factCopy}
            type="button"
            onClick={() =>
              navigator.clipboard.writeText(factsStrings.join("\n"))
            }
          >
            copy
          </button>
        </summary>
        <ul>
          {factsStrings.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
