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
  for (const [T, I] of solution.lookup('cp')) 
    {
    console.log("I =", I, "type:", typeof I);
    //console.log("T =", T, "type:", typeof T);
    if (T === 0) 
    {
      if (I.name === 'unison' || I.name === 'octave') 
      {
        console.log(`Passed test: starts with unison or octave (got interval ${I.name})`);
        return true;
      }
      else 
      {
        console.log(`Failed test: starts with unison or octave (got interval ${I.name})`);
        return false;
      }
    }
  }
  console.log("Failed test: starts with unison or octave");
  return false;
}

function check_ends_with_unison_or_octave(solution)
{
  for (const [T, I] of solution.lookup('cp')) 
    {
    if (T === cfLength) 
      {
        if (I.name === 'unison' || I.name === 'octave') 
        {
          console.log(`Passed test: ends with unison or octave (got interval ${I.name})`);
          return true;
        }
        else 
        {
          console.log(`Failed test: ends with unison or octave (got interval ${I.name})`);
          return false;
        }
      }
  }
  console.log("Failed test: ends with unison or octave");
  return false;
}

function check_ends_with_cadence(solution)
{
  /*for (const [T, cadence] of solution.lookup('cadenceAt'))
  {
    console.log("cadence =", cadence, "type:", typeof cadence);
    if (T === cfLength - 1)
    {
      return true; // for now, just check that the cadence is in the right place. Implementing actual cadence checking is a TODO.
    }
  }
  */
  console.log("Passed test: ends with cadence (not actually implemented yet)");
  return true;
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
  for (const [T, val] of solution.lookup('intervalCP')) 
  {
    console.log("val =", val, "type:", typeof val);
    console.log(`At T=${T}, intervalCP is ${val}`);
    if (val === 0 || val > 5)
    {
      console.log(`Failed test: Invalid CP move at T=${T} (intervalCP is ${val})`);
      return false;
    }
  }
  console.log("Passed test: All CP moves are valid");
  return true;
}


function check_consecutive_large_leaps(solution)
{
  for (const [T, val] of solution.lookup('intervalCP')) 
    {
      console.log(`At T=${T}, intervalCP is ${val}`);
      if ((val === 4 || val === 5) && T > 1) 
      {
        const prevVal = solution.get('intervalCP', T - 1);
        const cpNote_T = solution.get('cpNote', T);
        const cpNote_T1 = solution.get('cpNote', T - 1);
        const cpNote_T2 = solution.get('cpNote', T - 2);
        if ((prevVal === 4 || prevVal === 5) 
        && 
        (( (cpNote_T > cpNote_T1) && (cpNote_T1 > cpNote_T2)) 
          || ( (cpNote_T < cpNote_T1) && (cpNote_T1 < cpNote_T2)) ))
        {
          console.log(`Failed test: Consecutive same direction large leaps at T=${T} and T=${T-1} (intervalCP values ${val} and ${prevVal}) and cpNotes ${cpNote_T}, ${cpNote_T1}, ${cpNote_T2}`);
          return false;
        }
      }
    }
    console.log("Passed test: No consecutive large leaps in the same direction in counterpoint");
    return true;
}

function check_more_than_3_leaps(solution)
{
  for (const [T, val] of solution.lookup('intervalCP')) 
    {
      console.log(`At T=${T}, intervalCP is ${val}`);
      if ((val>1) && T > 3) 
      {
        const prevVal1 = solution.get('intervalCP', T - 1);
        const prevVal2 = solution.get('intervalCP', T - 2);
        const prevVal3 = solution.get('intervalCP', T - 3);
        if ((prevVal1 > 1) && (prevVal2 > 1) && (prevVal3 > 1))
        {
          console.log(`Failed test: No more than 3 consecutive leaps at T=${T} with cpNotes ${val}, ${prevVal1}, ${prevVal2}, ${prevVal3}`);
          return false;
        }
      }
    }
    console.log("Passed test: No more than 3 consecutive leaps in counterpoint");
    return true;
}

// main test function that runs all tests on a solution

function evaluateSolution(solution)
{
  if ( check_starts_with_unison_or_octave(solution)
     && check_ends_with_unison_or_octave(solution)
     && check_ends_with_cadence(solution)
     && check_parallel_fifths(solution)
     && check_parallel_octaves(solution)
     && check_validCPmove(solution)
     && check_consecutive_large_leaps(solution)
     && check_more_than_3_leaps(solution)
     //&& check 
    // && add more checks here as needed
  )
  {
    return true;
  }
  return false;
}
