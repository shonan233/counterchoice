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






let factsDu = fs.readFileSync('counterpoint_one_chunk.du', { encoding: 'utf8' })
  .split(/\r?\n/)
  .join('\n');

let factsToAppend = '';
for (let t = 0; t < totalLength; t++) {
  factsToAppend += `\ncf ${t} is ${cfNotes[t]}.`;
  factsToAppend += `\ncp ${t} is ${allCpIntervals[t]}.`;
}
factsToAppend += `\nlength is ${totalLength - 1}.`;

factsDu += factsToAppend.split(/\r?\n/).join('\n');

const dusa = new Dusa(factsDu);
const solution = dusa.solution;

const cfLength = totalLength - 1;


function check_starts_with_unison_or_octave(solution)
{
  const I = solution.get('cp', 0); 
  if (I.name === 'unison' || I.name === 'octave') 
  {
    console.log(`Passed test: starts with unison or octave (got interval ${I.name})`);
    return true;
  }
  console.log("Failed test: starts with unison or octave");
  return false;
}

function check_ends_with_unison_or_octave(solution)
{
  const I = solution.get('cp', cfLength);
  if (I.name === 'unison' || I.name === 'octave') 
  {
    console.log(`Passed test: ends with unison or octave (got interval ${I.name})`);
    return true;
  }
  console.log("Failed test: ends with unison or octave");
  return false;
}

function check_ends_with_cadence(solution)
{
    const T = cfLength;
    const I = solution.get('cp', T);
    if (T > 0)
    {
      const prevI = solution.get('cp', T - 1);
      const cp = solution.get('cpNote', T);
      const prevcp = solution.get('cpNote', T - 1);
      const cf = solution.get('cf', T);
      const prevcf = solution.get('cf', T - 1);
      console.log(`cp len=${T} is ${cp}, cp (len-1) is ${prevcp}, I len is ${I.name}, I (len-1) is ${prevI.name}, cf len is ${cf}, cf (len-1) is ${prevcf}`);
      if ((I.name === 'octave') 
        && (prevI.name === 'sixth')
        && ((cp-prevcp)===1) && ((cf-prevcf)===(-1)) )
      {
        console.log("Passed test: ends with cadence of type 6th to octave");
        return true; 
      }
      if ((I.name === 'unison') 
        && (prevI.name === 'third')
        && ((cp-prevcp)===(-1)) && ((cf-prevcf)===1) )
      {
          console.log("Passed test: ends with cadence of type 3rd to unison");
          return true; 
      }
    }
  console.log("Failed test: Does not end with a cadence");
  return false;
}


function check_parallel_fifths(solution)
{
  for (const [T, I] of solution.lookup('cp')) 
    {
    if (I.name === 'fifth' && T > 0) 
      {
        const prevI = solution.get('cp', T - 1);
        console.log(`Current interval at T=${T} is a ${I.name}. Previous interval at T=${T-1} is ${prevI.name}.`);
        if (prevI.name === 'fifth')
        {
          console.log(`Failed test: Parallel fifths at note ${T} and ${T-1}`);
          return false;
        }
      }
  }
  console.log("Passed test: No parallel fifths");
  return true;
}

function check_parallel_octaves(solution)
{
  for (const [T, I] of solution.lookup('cp')) 
    {
    if (I.name === 'octave' && T > 0) 
      {
        const prevI = solution.get('cp', T - 1);
        console.log(`Current interval at T=${T} is a ${I.name}. Previous interval at T=${T-1} is ${prevI.name}.`);
        if (prevI.name === 'octave')
        {
          console.log(`Failed test: Parallel octaves at note ${T} and ${T-1}`);
          return false;
        }
      }
  }
  console.log("Passed test: No parallel octaves");
  return true;
}

function check_validCPmove(solution)
{
  for (const [T, val] of solution.lookup('cpMovement')) 
  {
    console.log("val =", val, "type:", typeof val);
    console.log(`At T=${T}, cpMovement is ${val}`);
    if (val === 0 || val > 5)
    {
      console.log(`Failed test: Invalid CP move at T=${T} (cpMovement is ${val})`);
      return false;
    }
  }
  console.log("Passed test: All CP moves are valid");
  return true;
}


function check_consecutive_large_leaps(solution)
{
  for (const [T, val] of solution.lookup('cpMovement')) 
    {
      console.log(`At T=${T}, cpMovement is ${val}`);
      if ((val === 4 || val === 5) && T < (cfLength - 1)) 
      {
        const nextVal = solution.get('cpMovement', T + 1);
        const cpNote_T = solution.get('cpNote', T);
        const cpNote_T1 = solution.get('cpNote', T + 1);
        const cpNote_T2 = solution.get('cpNote', T + 2);
        if ((nextVal === 4 || nextVal === 5) 
        && 
        (( (cpNote_T > cpNote_T1) && (cpNote_T1 > cpNote_T2)) 
          || ( (cpNote_T < cpNote_T1) && (cpNote_T1 < cpNote_T2)) ))
        {
          console.log(`Failed test: Consecutive same direction large leaps at T=${T} and T=${T+1} (cpMovement values ${val} and ${nextVal}) and cpNotes ${cpNote_T}, ${cpNote_T1}, ${cpNote_T2}`);
          return false;
        }
      }
    }
    console.log("Passed test: No consecutive large leaps in the same direction in counterpoint");
    return true;
}

function check_more_than_3_leaps(solution)
{
  for (const [T, val] of solution.lookup('cpMovement')) 
    {
      console.log(`At T=${T}, cpMovement is ${val}`);
      if ((val>1) && T < (cfLength - 2)) 
      {
        const nextVal1 = solution.get('cpMovement', T + 1);
        const nextVal2 = solution.get('cpMovement', T + 2);
        const nextVal3 = solution.get('cpMovement', T + 3);
        if ((nextVal1 > 1) && (nextVal2 > 1) && (nextVal3 > 1))
        {
          console.log(`Failed test: No more than 3 consecutive leaps at T=${T} with cpNotes ${val}, ${nextVal1}, ${nextVal2}, ${nextVal3}`);
          return false;
        }
      }
    }
    console.log("Passed test: No more than 3 consecutive leaps in counterpoint");
    return true;
}

function check_direct_fifth_and_octave(solution)
{
  for (const [T, I] of solution.lookup('cp')) 
    {
      //console.log("T =", T, "I =", I, "type:", typeof I);
      if ((I.name === 'fifth' || I.name === 'octave') 
      && (T > 0) ) 
      {
        const val = solution.get('cpMovement', T - 1); 
        const cpNote_T = solution.get('cpNote', T);
        const cpNote_T1 = solution.get('cpNote', T - 1);
        const cfNote_T = solution.get('cf', T);
        const cfNote_T1 = solution.get('cf', T - 1);
        const movement = (cpNote_T - cpNote_T1) * (cfNote_T - cfNote_T1);
        console.log(`cpNote at T=${T} is ${cpNote_T}, cpNote at T=${T-1} is ${cpNote_T1}, cfNote at T=${T} is ${cfNote_T}, cfNote at T=${T-1} is ${cfNote_T1}.`);
        if ((movement > 0)
        && (val > 1) ) // if both voices move in the same direction and there is a jump in CP
        {
          const leapval = solution.has('leap', T - 1); 
          console.log(`Failed test: Direct ${I.name} at T=${T} where cpMovement is ${val} and leap check is ${leapval}.`);
          return false;
        }
        console.log(`Movement not in same direction, moving on.`);
      }
    }
  console.log("Passed test: No direct fifths or octaves after jumps in the same direction");
  return true;
}

function check_unison_in_middle(solution)
{
  for (const [T, I] of solution.lookup('cp')) 
    {
    if ((T < cfLength) && (T > 0) && (I.name === 'unison')) 
      {
          console.log(`Failed test: No unisons in middle (got ${I.name} at T=${T})`);
          return false;
      }
  }
  console.log("Passed test: No unisons in middle");
  return true;
}

// main test function that runs all tests on a solution

function evaluateSolution(solution)
{
  for (const [T, I] of solution.lookup('cp')) 
  {
    console.log("T =", T, `cf: ${solution.get('cf', T)} `,"I =", I, "cpNote:", solution.get('cpNote', T));
  }
  if ( check_starts_with_unison_or_octave(solution)
     && check_ends_with_unison_or_octave(solution)
     && check_ends_with_cadence(solution)
     && check_parallel_fifths(solution)
     && check_parallel_octaves(solution)
     && check_validCPmove(solution)
     && check_consecutive_large_leaps(solution)
     && check_more_than_3_leaps(solution)
     && check_direct_fifth_and_octave(solution)
     && check_unison_in_middle(solution)
     //  
     // && add more checks here as needed
  )
  {
    return true;
  }
  return false;
}


if (evaluateSolution(solution))
{
  console.log("All tests passed!\n");
}
else
{
  console.log("Some tests failed...");
}




