import { Dusa } from 'dusa';
import * as fs from 'node:fs';

const dusa = new Dusa(`
	at 5 0 is 5.
	at 0 0 is 0.
	at 2 1 is 2.
	at 4 1 is 4.
	at 1 1 is 1.
	at 6 0 is 6.
	at 3 0 is 3.
	at 7 0 is 6.
`);

for (const solution of dusa) {
	const tracks = [ ];
	for (const at of solution.lookup('at')) {
		const [time, voice, note] = at;
		console.log(time, voice, note);
		while (voice >= tracks.length) tracks.push([]);
		tracks[voice][time] = note;
	}

	//list of buffers:
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

		//length TBD

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
				0x3E, //note # 3E
				0x64, //velocity 100
				4, //delta time
				0x80, //note off, channel 0
				0x3E, //note # 3E
				0x00 //velocity 0
			]));
			prev_t = t;
		}
		const all = Buffer.concat(trackData);
		data.push(Buffer.from('MTrk')); //type
		const length = Buffer.alloc(4);
		length.writeUInt32BE(all.length, 0);
		data.push(length);
		data.push(all);


	}

	for (const d of data) {
		console.log(d.toString('hex'));
	}

	fs.writeFileSync('out.mid', Buffer.concat(data));
}


//read file
//const lines = fs.read(process.argv[1], {encoding:'utf8'}).split();

//break into notes

//make binary blob

//write
