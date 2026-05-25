import { Dusa } from 'dusa';
import * as fs from 'node:fs';

// first, generate cantus firmus (melody line "input" from user)
const inputText = fs.readFileSync("song_testing.du", {encoding:"utf8"});
const inputParsed = new Dusa(inputText).solution;

let inputCf = "";
let cfLength = 0;

for (const cf of inputParsed.lookup('cf')) {
  inputCf += "cf "+cf[0]+" is "+cf[1]+".\n"
  cfLength++;
}
cfLength--; // off by one error?
inputCf += "length is " + cfLength + ".";

console.log("cf input:")
console.log("------")
console.log(inputCf);

// then concat that parsed input to the solver text as "together.du"
let solverText = fs.readFileSync("counterpoint_opt.du", {encoding:"utf8"})
.split(/\r?\n/)
.join('\n');

const normalizedInputCf = inputCf
.split(/\r?\n/)
.join('\n');

solverText += '\n' + normalizedInputCf;  
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
const max_soln = 10;
const iterator = dusa.solve();
let passed_tests = 1;

console.log("\n=== Starting solution generation ===");

for (let i=0; i<max_soln; i++)  // generate multiple solutions and run tests on them
{
  const result = iterator.next();
  console.log(`Attempting to generate solution ${i + 1}...`);

  if (result.done) 
  {
    console.log(`Only found ${i} solutions`);
    break;
  }
  console.log(`Solution ${i + 1} generated, evaluating...`);

  const solution = result.value;

  if (!evaluateSolution(solution)) 
  {
    passed_tests = 0;
    break;
  }
}
if (passed_tests)
{
  console.log("All tests passed!\nMoving on to generating a midi file...");
}
else
{
  console.log("Some tests failed...");
}


// tests are defined here

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
