import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { noteToLetter, type Note } from "./util";
import { mapNote, tracksToMidi } from "./midi";
import { claimPlayback, releasePlayback, getSampler } from "./piano";
import style from "./Solution.module.css";

export interface SolutionProps {
  cf: Note[];
  notes: Note[];
  id: number;
}

const BPM = 120;
const BEAT = 60 / BPM;

type Status = "stopped" | "playing" | "paused";

export default function Solution({ cf, notes, id }: SolutionProps) {
  const midi = tracksToMidi(cf, notes);

  const [status, setStatus] = useState<Status>("stopped");
  const [loading, setLoading] = useState(false);
  const pauseOffsetRef = useRef(0);

  useEffect(() => {
    return () => {
      releasePlayback();
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
    };
  }, []);

  const reset = () => {
    pauseOffsetRef.current = 0;
    setStatus("stopped");
  };

  const scheduleAndPlay = () => {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    transport.seconds = pauseOffsetRef.current;

    let maxNoteEnd = 0;
    for (const track of [cf, notes]) {
      for (let t = 0; t < track.length; t++) {
        if (track[t] === undefined) continue;
        const noteStart = t * BEAT;
        maxNoteEnd = Math.max(maxNoteEnd, noteStart + BEAT);
        if (noteStart < pauseOffsetRef.current) continue;
        transport.schedule((time) => {
          getSampler().triggerAttackRelease(
            Tone.Frequency(mapNote(track[t]), "midi").toNote(),
            BEAT * 0.9,
            time,
          );
        }, noteStart);
      }
    }

    transport.scheduleOnce(() => {
      pauseOffsetRef.current = 0;
      releasePlayback();
      setStatus("stopped");
    }, maxNoteEnd + 0.1);

    transport.start();
  };

  const handlePlayPause = async () => {
    if (status === "playing") {
      pauseOffsetRef.current = Tone.getTransport().seconds;
      Tone.getTransport().pause();
      setStatus("paused");
      return;
    }

    await Tone.start();

    if (status === "stopped") {
      const sampler = getSampler();
      if (!sampler.loaded) {
        setLoading(true);
        await Tone.loaded();
        setLoading(false);
      }
      claimPlayback(reset);
    }

    scheduleAndPlay();
    setStatus("playing");
  };

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

  const label = loading
    ? "Loading..."
    : status === "playing"
      ? "Pause"
      : status === "paused"
        ? "Resume"
        : "Play";

  return (
    <div className={`${style.solution}`}>
      <span>
        Solution <span className={style.id}>{id}:</span>
      </span>
      <ol className={`${style.solutionNotes}`}>
        {notes.map((note, i) => (
          <li key={i}>{noteToLetter(note)}</li>
        ))}
      </ol>
      <button
        type="button"
        className={style.playButton}
        onClick={handlePlayPause}
        disabled={loading}
      >
        {label}
      </button>
      <button type="button" onClick={handleDownload}>
        Download
      </button>
    </div>
  );
}
