import { Dusa } from 'dusa';
import * as fs from 'node:fs';
import { execFileSync } from 'child_process';


// Configuration
const CHUNK_SIZE = 10;
const OVERLAP = 4;
const MAX_ATTEMPTS_PER_CHUNK = 5;
const TIMEOUT_MS = 2000;

const inputText = fs.readFileSync("song.du", {encoding:"utf8"});
const inputParsed = new Dusa(inputText).solution;



function mapNote(n) {
    //n is a scale degree, sooooooo
    //base of scale is 48 (c4)
    const base = 48; //c4
    const octave = Math.floor(n / 7);
    const offset = [0, 2, 4, 5, 7, 9, 11];
    return base + offset[n - octave * 7] + 12 * octave;
}


// solves one chunk
function solveChunk(chunkCf, chunkType, fixedCp = null, fixedCpStartLocal = 0, globalStartIndex = 0) 
{
    console.log(`*** Solving ${chunkType} chunk [${globalStartIndex}-${globalStartIndex + chunkCf.length - 1}] ***`);


    let inputCf = "";
    for (let i = 0; i < chunkCf.length; i++) 
    {
        inputCf += `cf ${i} is ${chunkCf[i]}.\n`;
    }
    inputCf += `length is ${chunkCf.length - 1}.\n`;

    // adding the cp values from the previous chunk's solution as fixed values
    if (fixedCp) 
    {
        console.log(`Fixed CP values (overlap):`, fixedCp);
        for (let i = 0; i < fixedCp.length; i++)
        {
          inputCf += `cp ${fixedCpStartLocal + i} is ${fixedCp[i]}.\n`;
        }
    }

    // selecting the Dusa file to use
    const dusaFile = (chunkType === 'start') ? 'counterpoint_start.du' :
                    (chunkType === 'end') ? 'counterpoint_end.du' :
                    (chunkType === 'mid') ? 'counterpoint_mid.du' :
                    'counterpoint_one_chunk.du';

    // then concat that parsed input to the solver text as "together.du"
    let solverText = fs.readFileSync(dusaFile, { encoding: "utf8" })
    .split(/\r?\n/)
    .join('\n');
  
  const normalizedInputCf = inputCf
    .split(/\r?\n/)
    .join('\n');
  
  solverText += '\n' + normalizedInputCf;
    //console.log("==== GENERATED DU FILE ====");
    //console.log(solverText);
    //console.log("==== END ====");
    fs.writeFileSync('together.du', Buffer.from(solverText));


    // Create solver script
    const solverScript = `
    const { Dusa } = require('dusa');
    const fs = require('fs');

    const solverText = fs.readFileSync('together.du', 'utf8');
    const dusa = new Dusa(solverText);

    const iterator = dusa.solve();
    const result = iterator.next();

    if (!result.done) 
    {
        const solution = result.value;
        const cpResults = [];
        for (const [T, I] of solution.lookup('cp')) 
        {
            cpResults.push([T, I]);
        }
        console.log(JSON.stringify(cpResults));
    } 
    else // No solution found
    {
        console.log(JSON.stringify(null));
    }
    `;

    fs.writeFileSync('dusa-solver.js', solverScript);
  

    // Retry loop with timeout
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_CHUNK; attempt++) 
    {
        console.log(`Attempt ${attempt}/${MAX_ATTEMPTS_PER_CHUNK}...`);
        const attemptStartTime = Date.now();

        try 
        {
            const result = execFileSync('node', ['dusa-solver.js'], {
                timeout: TIMEOUT_MS,
                encoding: 'utf8'
            });
            
            const cpResults = JSON.parse(result);
            //console.log(`Raw CP results:`, cpResults);
            
            // Check if solution was found
            if (cpResults === null) 
            {
                console.log(`Attempt ${attempt} found no solution`);
                continue; // Try next attempt
            }
            
            const attemptTime = Date.now() - attemptStartTime;
            console.log(`Success on attempt ${attempt}! (${attemptTime}ms)`);
            
            // Convert to map: time -> interval name
            const cpMap = {};
            for (const [time, interval] of cpResults) 
            {
                cpMap[time] = interval.name || interval;
            }
            
            fs.unlinkSync('dusa-solver.js');
            return cpMap;
            
        } 
        catch (error) 
        {
            if (error.killed || error.signal === 'SIGTERM') 
            {
                console.log(`    Attempt ${attempt} timed out`, error.message);
            } 
            else
            {
                console.error(`    Attempt ${attempt} failed:`, error.message);
            }
            
        }
    }
}



const cfNotes = [];
for (const cf of inputParsed.lookup('cf')) 
{
  const [time, degree] = cf;
  cfNotes[time] = degree;
}

const totalLength = cfNotes.length;
console.log(`Total CF length: ${totalLength} notes`);
console.log(`CF notes:`, cfNotes);

// Main chunking logic
console.log("\n*** Planning Chunks ***");
const chunks = [];
let startId = 0;
const increment = CHUNK_SIZE - OVERLAP;

while (startId < totalLength) 
{
  let endId = Math.min(startId + CHUNK_SIZE, totalLength);
  const remainingAfterThisChunk = totalLength - endId;

  if (remainingAfterThisChunk < OVERLAP)
  {
    console.log(`Remaining notes (${remainingAfterThisChunk}) less than overlap size, adjusting final chunk to include all remaining notes.`);
    endId = totalLength;
  }
  
  let chunkType;
  if (startId === 0 && endId >= totalLength)
  {
    chunkType = 'one_chunk';
  }
  else if (startId === 0) 
  {
    chunkType = 'start';
  } 
  else if (endId >= totalLength)
  {
    chunkType = 'end';
  }
  else
  {
    chunkType = 'mid';
  }
  
  const chunkCf = cfNotes.slice(startId, endId);
  chunks.push({ startId, endId, chunkCf, chunkType });
  
  if (endId >= totalLength) break;
  startId += increment;
}

console.log(`Total chunks: ${chunks.length}`);
for (let i = 0; i < chunks.length; i++) 
{
  console.log(`  Chunk ${i}: [${chunks[i].startId}-${chunks[i].endId - 1}] (${chunks[i].chunkType})`);
}

// solving chunks sequentially
console.log("\n*** Generating Solution ***");
const totalStartTime = Date.now();
const allCpIntervals = {}; 

for (let i = (chunks.length-1); i >=0; i--) 
{
  const current_chunk = chunks[i];
  
  // Determine fixed CP values from overlap
  let fixedCp = null;
  const fixedLocalStart = current_chunk.chunkCf.length - OVERLAP;
  
  if (i < (chunks.length - 1)) 
  {
    const overlapStart = chunks[i + 1].startId;
    
    fixedCp = [];
    for (let globalIdx = overlapStart; globalIdx < overlapStart + OVERLAP; globalIdx++)
    {
      fixedCp.push(allCpIntervals[globalIdx]);
    }
  }
  
  
  // calling the solver
  const cpMap = solveChunk(current_chunk.chunkCf, current_chunk.chunkType, fixedCp, fixedLocalStart, current_chunk.startId);
  
  if (!cpMap)
  {
    console.error(`\n Failed to solve chunk ${i} after ${MAX_ATTEMPTS_PER_CHUNK} attempts`);
    console.error(`Consider: reducing chunk size, increasing timeout, or simplifying rules`);
    process.exit(1);
  }
  
  // Store results (only newly solved portion, not the fixed overlap)
  const storeUntil = (i < chunks.length - 1) ? fixedLocalStart : current_chunk.chunkCf.length;
  for (let localId = 0; localId < storeUntil; localId++)
  {
    const globalId = current_chunk.startId + localId;
    allCpIntervals[globalId] = cpMap[localId];
  }
  
  console.log(`  Stored intervals for global [${current_chunk.startId}-${current_chunk.startId + storeUntil - 1}]`);
}

const totalTime = Date.now() - totalStartTime;
console.log(`\n Complete solution generated! Total time: ${totalTime}ms`);




// generating the MIDI file
console.log("\n*** Generating MIDI ***");
const tracks = [[], []]; // [CF track, CP track]

// Build tracks
for (let t = 0; t < totalLength; t++) 
{
  tracks[0][t] = cfNotes[t]; // CF
  
  // Convert interval name to number
  const intervalName = allCpIntervals[t];
  const intervalMap = {
    'unison': 0,
    'third': 2,
    'fifth': 4,
    'sixth': 5,
    'octave': 7
  };
  const interval = intervalMap[intervalName] || 0;
  tracks[1][t] = cfNotes[t] + interval; // CP = CF + interval
}

console.log("Final counterpoint intervals:", allCpIntervals);

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
  header.writeUInt16BE(4, 12); //quarter note is 4 ticks // MAYBE REVISIT

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


