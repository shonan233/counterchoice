import { Dusa } from 'dusa';
import { createPcg32, randomInt } from 'pcg';
import * as fs from 'node:fs';

const RULES_FILES = [
  'counterpoint_opt.du',
  'counterpoint_forbid.du',
];
const SONG_FILE = 'song-46.du';
const TRIALS = 5;

// *** Use deterministic RNG, thanks to Jim ***

//--- from the pcg.js documentation ---
const advancedOptions = {};
const initState = 42; //<-- I *think* this is the seed
const initStreamId = 54;
let pcg = createPcg32(advancedOptions, initState, initStreamId);

const randomUint32 = randomInt(0, (2 ** 32) - 1);
//--- ---- ---- ---

//drop in pcg (a fast-ish, deterministic generator) instead of the default RNG:
Math.random = function newRandom() {
  const [value, nextPcg] = randomUint32(pcg);
  pcg = nextPcg;
  return value / (2 ** 32);
};

// ***

const songText = fs.readFileSync(SONG_FILE, 'utf8');
console.log(`Song: ${SONG_FILE}`);
console.log('');

function average(values) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

for (const rulesFile of RULES_FILES) {
  const program = `${fs.readFileSync(rulesFile, 'utf8')}\n${songText}`;
  console.log(`Rules: ${rulesFile}`);

  const elapsedTimes = [];
  const deductions = [];
  const choices = [];
  const deadEnds = [];
  const numFacts = [];

  for (let trial = 1; trial <= TRIALS; trial++) {
    const start = Date.now();
    const solver = new Dusa(program).solve();
    const next = solver.next();
    const stats = solver.stats();
    const elapsed = Math.round(Date.now() - start);

    elapsedTimes.push(elapsed);
    deductions.push(stats.deductions);
    choices.push(stats.choices);
    deadEnds.push(stats.rejected);
    numFacts.push(next.value.facts().length);

    console.log(
      `Trial ${trial}: ` +
      `${elapsedTimes.at(-1)}ms, ` +
      `${deductions.at(-1)} deductions, ` +
      `${choices.at(-1)} choices, ` +
      `${deadEnds.at(-1)} dead ends, ` +
      `${numFacts.at(-1)} facts`
    );
  }

  console.log(
    `Average: ` +
    `${average(elapsedTimes)}ms, ` +
    `${average(deductions)} deductions, ` +
    `${average(choices)} choices, ` +
    `${average(deadEnds)} dead ends, ` +
    `${average(numFacts)} facts`
  );
  console.log('');
}
