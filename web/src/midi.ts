import type { Note } from "./util";

export function tracksToMidi(...tracks: Note[][]): Uint8Array {
  const data: number[] = [];

  ascii(data, "MThd");
  u32be(data, 6);
  u16be(data, 1); // format 1
  u16be(data, tracks.length);
  u16be(data, 4); // ticks per quarter note

  for (const track of tracks) {
    const trackData: number[] = [];
    let prevT = 0;

    for (let t = 0; t < track.length; t++) {
      if (track[t] === undefined) continue;
      trackData.push(
        (t - prevT) * 4, // delta time
        0x90, // note on, channel 0
        mapNote(track[t]),
        0x64, // velocity 100
        4, // delta time
        0x80, // note off, channel 0
        mapNote(track[t]),
        0x00, // velocity 0
      );
      prevT = t + 1;
    }

    trackData.push(0x00, 0xff, 0x2f, 0x00); // end of track

    ascii(data, "MTrk");
    u32be(data, trackData.length);
    data.push(...trackData);
  }

  return new Uint8Array(data);
}

export function mapNote(n: Note) {
  const base = 48;
  const octave = Math.floor(n / 7);
  const offset = [0, 2, 4, 5, 7, 9, 11];
  return base + offset[n - octave * 7] + 12 * octave;
}

function u32be(arr: number[], v: number) {
  arr.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
}

function u16be(arr: number[], v: number) {
  arr.push((v >>> 8) & 0xff, v & 0xff);
}

function ascii(arr: number[], s: string) {
  for (let i = 0; i < s.length; i++) arr.push(s.charCodeAt(i));
}
