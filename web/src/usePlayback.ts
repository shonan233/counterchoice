import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { type Note } from "./util";
import { mapNote } from "./midi";
import { claimPlayback, releasePlayback, getSampler } from "./piano";

const BPM = 120;
const BEAT = 60 / BPM;

export type PlaybackStatus = "stopped" | "playing" | "paused";

// null/undefined entries in a track are treated as rests.
export function usePlayback(tracks: (Note | null)[][]) {
  const [status, setStatus] = useState<PlaybackStatus>("stopped");
  const [loading, setLoading] = useState(false);
  const pauseOffsetRef = useRef(0);

  useEffect(
    () => () => {
      releasePlayback();
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
    },
    [],
  );

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
    for (const track of tracks) {
      for (let t = 0; t < track.length; t++) {
        const note = track[t];
        if (note == null) continue;
        const noteStart = t * BEAT;
        maxNoteEnd = Math.max(maxNoteEnd, noteStart + BEAT);
        if (noteStart < pauseOffsetRef.current) continue;
        transport.schedule((time) => {
          getSampler().triggerAttackRelease(
            Tone.Frequency(mapNote(note), "midi").toNote(),
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

  const onPlayPause = async () => {
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

  const label = loading
    ? "Loading..."
    : status === "playing"
      ? "Pause"
      : status === "paused"
        ? "Resume"
        : "Play";

  return { status, loading, label, onPlayPause };
}
