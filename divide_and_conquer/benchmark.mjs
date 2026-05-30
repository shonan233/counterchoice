import { Dusa } from 'dusa';
import * as fs from 'node:fs';
import { execFileSync } from 'child_process';



function solveFullPiece()
{
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

  let solnTimes = [];

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
              solnTimes.push(attemptTime);
              
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
      return { success: false, totalTime: Date.now() - totalStartTime, chunkTimes: solnTimes, failedChunk: i };
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

  let avgSolnTime = 0;
  for (const t of solnTimes) avgSolnTime += t;
  avgSolnTime /= solnTimes.length;

  console.log(`\n Average soln time per chunk (excluding the cases where it got stuck):`, avgSolnTime, `ms (based on ${solnTimes.length} successful chunks)`);

  return { success: true, totalTime, chunkTimes: solnTimes };
}

const TRIALS = 100;
const results = { successes: 0, failures: 0, totalTimes: [], avgChunkTimes: [], failedChunks: {} };


for (let trial = 0; trial < TRIALS; trial++)
  {
    const result = solveFullPiece();
    if (result.success)
    {
      results.successes++;
      results.totalTimes.push(result.totalTime);
      results.avgChunkTimes.push(result.chunkTimes.reduce((a,b) => a+b, 0) / result.chunkTimes.length);
    }
    else
    {
      results.failures++;
      results.failedChunks[result.failedChunk] = (results.failedChunks[result.failedChunk] || 0) + 1;
    }
  }
  
console.log(`Success rate: ${results.successes / TRIALS * 100}%`);
console.log(`Avg total time (successful runs): ${results.totalTimes.reduce((a,b) => a+b,0) / results.totalTimes.length}ms`);
// console.log(`Failed chunk distribution:`, results.failedChunks);