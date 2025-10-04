import { Dusa } from 'dusa';
import * as fs from 'node:fs';

// first, generate cantus firmus (melody line "input" from user)
// defined and parsed in song.du
const inputText = fs.readFileSync("song.du", {encoding:"utf8"});
const inputParsed = new Dusa(inputText).solution;

let inputCf = "";
let cfLength = 0;

for (const cf of inputParsed.lookup('cf')) {
  inputCf += "cf "+cf[0]+" "+cf[1]+".\n"
  cfLength++;
}
cfLength--; // off by one error?
inputCf += "length is " + cfLength + ".";

console.log("cf input:")
console.log("------")
console.log(inputCf);

// then concat that parsed input to the solver text as "together.du"
let solverText = fs.readFileSync("counterpoint58.du", {encoding:"utf8"});
solverText += inputCf;
fs.writeFileSync('together.du', Buffer.from(solverText));


// generate tracks
//

function mapNote(n) {
  //n is a scale degree, sooooooo
  //base of scale is 48 (c4)
  const base = 48; //c4
  const octave = Math.floor(n / 7);
  const offset = [0, 2, 4, 5, 7, 9, 11];
  return base + offset[n - octave * 7] + 12 * octave;
}


const dusa = new Dusa(solverText);
// for (const solution of dusa) 
const solution = dusa.solution; // just get one solution for now
{
  const tracks = [ ];
  for (const at of solution.lookup('at')) {
          const [time, voice, note] = at;
          console.log(time, voice, note);
          while (voice >= tracks.length) tracks.push([]);
          tracks[voice][time] = note;
  }

  // generate midi
  // list of buffers:
  const data = [];

  //encode header
  const header = Buffer.alloc(14);
  data.push(header);
  header.write('MThd', 0); //type
  header.writeUInt32BE(6, 4); //length
  header.writeUInt16BE(1, 8); //format
  header.writeUInt16BE(tracks.length, 10); //# of tracks
  header.writeUInt16BE(1, 12); //quarter note is one tick // MAYBE REVISIT

  for (const track of tracks) {
    let trackData = [];
    //for each note, write note-on, then note-off
    let prev_t = 0;
    for (let t = 0; t < track.length; ++t) {
      if (typeof(track[t]) === 'undefined') continue;
      //note off
      //                 chan   note     vel
      // delta time, 1000nnnn 0kkkkkkk 0vvvvvvv
      //note on      1001nnnn

      trackData.push(Buffer.from([
              (t - prev_t) * 4, //delta time
              0x90, //note on, channel 0
              mapNote(track[t]), //note # 3E
              0x64, //velocity 100
              4, //delta time
              0x80, //note off, channel 0
              mapNote(track[t]), //note # 3E
              0x00 //velocity 0
      ]));
      prev_t = t + 1;
    } // end loop over notes in track

    trackData.push(Buffer.from([0x00, 0xff, 0x2f, 0x00]));

    const all = Buffer.concat(trackData);
    data.push(Buffer.from('MTrk')); //type
    const length = Buffer.alloc(4);
    length.writeUInt32BE(all.length, 0);
    data.push(length);
    data.push(all);
  } // end loop over tracks

  for (const d of data) {
          console.log(d.toString('hex'));
  }

  fs.writeFileSync('out.mid', Buffer.concat(data));
}



