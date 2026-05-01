import { NOTES, type Note } from "./util";
import style from "./Solution.module.css";

export interface SolutionProps {
  notes: Note[];
  id: number;
}

export default function Solution({ notes, id }: SolutionProps) {
  return (
    <div className={`${style.solution}`}>
      <span>Solution {id}:</span>
      <ol className={`${style.solutionNotes}`}>
        {notes.map((note, i) => (
          <li key={i}>
            {NOTES[note]} ({note})
          </li>
        ))}
      </ol>
    </div>
  );
}
